import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import type { Beat, Nutrients } from '@/engine/types';
import { emulsifyBeat, findGallbladder } from '@/scene/beats/bile';
import { drainLevel, drainRate } from '@/scene/beats/bodyMotion';
import { chewBeat } from '@/scene/beats/chew';
import { fourHourDrainBeat, stomachDrainBeat } from '@/scene/beats/drain';
import { peristalsisBeat } from '@/scene/beats/peristalsis';
import type { BeatContext, BeatFactory } from '@/scene/beats/types';
import { disposeFoodModel } from '@/scene/food/models';
import { FALLBACK_LOOK } from '@/scene/food/share';
import { gutCurve } from '@/scene/path';
import type { Lens } from '@/scene/lens/types';
import type { LoadedBody, StreamModifier } from '@/scene/types';
import { TEST_ANCHORS } from '@/scene/testAnchors';

vi.mock('@/scene/food/models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/scene/food/models')>();
  return { ...actual, disposeFoodModel: vi.fn(actual.disposeFoodModel) };
});

function organAt(x: number, y: number, z: number, size: number, organ: string): THREE.Group {
  const group = new THREE.Group();
  group.userData.organ = organ;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size).translate(x, y, z), new THREE.MeshPhysicalMaterial({ emissive: 0x112233, emissiveIntensity: 0.1 })));
  return group;
}

interface Fixture {
  ctx: BeatContext;
  scene: THREE.Scene;
  host: { append: ReturnType<typeof vi.fn>; ownerDocument: { createElement: () => { remove: ReturnType<typeof vi.fn> } } };
  lens: Lens;
  mod: StreamModifier;
}

function fixture(totals: Partial<Nutrients> = {}, organs: THREE.Object3D[] = [], beats: Beat[] = [], beatIndex = 0): Fixture {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.add(...organs);
  root.updateMatrixWorld(true);
  const byId = Object.fromEntries(organs.map((o) => [o.userData.organ as string, o]));
  const body = { root, organs: byId, anchors: TEST_ANCHORS, front: [0, 0, 1] } as unknown as LoadedBody;
  const tag = { remove: vi.fn(), className: '', textContent: '' };
  const host = { append: vi.fn(), ownerDocument: { createElement: () => tag } };
  const lens = { show: vi.fn(), hide: vi.fn(), setAnchor: vi.fn(), update: vi.fn(), endStation: vi.fn(), dispose: vi.fn() } satisfies Lens;
  const mod: StreamModifier = { swell: 1, visible: 1, advance: null, swirl: 0 };
  const ctx = {
    stage: { scene, camera: new THREE.PerspectiveCamera(35), renderer: { domElement: { parentElement: host } } },
    body,
    journey: { sex: 'female', totals: { ...emptyNutrients(), ...totals }, stations: [] },
    station: { id: 'stomach', beats },
    beatIndex,
    streams: { mod, holdModifiers: false },
    lens,
    looks: [{ ...FALLBACK_LOOK, model: 'samosa' }],
  } as unknown as BeatContext;
  return { ctx, scene, host, lens, mod };
}

const centreOf = (object: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());

const materialsOf = (object: THREE.Object3D): THREE.Material[] => {
  const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  return material === undefined ? [] : Array.isArray(material) ? material : [material];
};

describe.each([
  ['chew', chewBeat, true],
  ['peristalsis', peristalsisBeat, true],
  ['drain', stomachDrainBeat, true],
  ['drain4h', fourHourDrainBeat, true],
  ['emulsify', emulsifyBeat, false],
] as [string, BeatFactory, boolean][])('%s beat', (_name, factory, drives) => {
  it('holds the stream modifiers in every update while it drives them', () => {
    const { ctx } = fixture({ starch: 30, fat: 12 });
    const effect = factory(ctx);
    effect.enter();
    for (const p of [0, 0.2, 0.5, 0.9, 1]) {
      ctx.streams.holdModifiers = false;
      effect.update(p, 0);
      expect(ctx.streams.holdModifiers).toBe(drives);
    }
    effect.exit();
  });

  it('draws everything at render order 9 or above without depth testing', () => {
    const { ctx, scene } = fixture({ starch: 30, fat: 12 }, [organAt(0, 1.5, 0.05, 0.1, 'mouth'), organAt(-0.04, 1.16, 0, 0.02, 'gallbladder')]);
    const effect = factory(ctx);
    effect.enter();
    effect.update(0.5, 0);
    let checked = 0;
    scene.traverse((object) => {
      if (object.renderOrder < 9) return;
      for (const material of materialsOf(object)) {
        expect(material.depthTest, object.name).toBe(false);
        checked += 1;
      }
    });
    if (_name !== 'chew' && _name !== 'peristalsis') expect(checked).toBeGreaterThan(0);
    effect.exit();
  });

  it('disposes every geometry and material it created', () => {
    vi.mocked(disposeFoodModel).mockClear();
    const { ctx, scene } = fixture({ starch: 30, fat: 12 }, [organAt(-0.04, 1.16, 0, 0.02, 'gallbladder')]);
    const effect = factory(ctx);
    effect.enter();
    const spies: ReturnType<typeof vi.spyOn>[] = [];
    scene.traverse((object) => {
      const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (geometry && _name !== 'chew') spies.push(vi.spyOn(geometry, 'dispose'));
      if (_name !== 'chew') for (const material of materialsOf(object)) spies.push(vi.spyOn(material, 'dispose'));
    });
    effect.exit();
    effect.dispose();
    if (_name === 'chew') expect(disposeFoodModel).toHaveBeenCalledTimes(1);
    else expect(spies.length).toBeGreaterThan(0);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });

  it('adds its objects on enter, holds the stream modifiers while it drives them and leaves the scene empty on exit', () => {
    const { ctx, scene } = fixture({ starch: 30, fat: 12 }, [organAt(0, 1.5, 0.05, 0.1, 'mouth'), organAt(-0.04, 1.16, 0, 0.02, 'gallbladder')]);
    const effect = factory(ctx);
    effect.enter();
    expect(scene.children.length).toBeGreaterThan(0);
    for (const p of [0, 0.3, 0.6, 0.95]) {
      effect.update(p, 0);
      expect(effect.camera?.(p)).toBeTruthy();
    }
    effect.exit();
    expect(scene.children).toEqual([]);
    effect.enter();
    effect.exit();
    effect.dispose();
    expect(scene.children).toEqual([]);
  });

  it('touches the stream modifiers only with finite values', () => {
    const { ctx, mod } = fixture({ starch: 30, fat: 12 });
    const effect = factory(ctx);
    effect.enter();
    for (let p = 0; p <= 1; p += 0.05) {
      effect.update(p, 0.016);
      for (const v of [mod.swell, mod.visible, mod.swirl, mod.advance ?? 0]) expect(Number.isFinite(v)).toBe(true);
    }
    effect.exit();
  });
});

describe('chew', () => {
  it('brings the dish in first with no food mass, then shows the morsels and squeezes them into a ball', () => {
    const { ctx, mod, scene } = fixture({ starch: 30 }, [organAt(0, 1.5, 0.05, 0.1, 'mouth')]);
    const effect = chewBeat(ctx);
    effect.enter();
    effect.update(0.1, 0);
    expect(ctx.streams.holdModifiers).toBe(true);
    expect(mod.visible).toBe(0);
    expect(scene.children.some((c) => c.visible && c.name.startsWith('bite:'))).toBe(true);
    effect.update(0.45, 0);
    const scattered = mod.swell;
    expect(mod.visible).toBe(1);
    expect(scene.children.some((c) => c.visible && c.name.startsWith('bite:'))).toBe(false);
    effect.update(0.95, 0);
    expect(mod.swell).toBeLessThan(scattered / 2);
    effect.exit();
  });

  it('lets a drink float in, tilt to the lips and pour in as one body, with one gentle swallow instead of bites', () => {
    const mouth = organAt(0, 1.5, 0.05, 0.1, 'mouth');
    const { ctx, mod, scene } = fixture({ caffeine: 80 }, [mouth]);
    ctx.looks = [{ ...FALLBACK_LOOK, model: 'cup-hot', piece: 'droplet', liquid: true }];
    const effect = chewBeat(ctx);
    effect.enter();
    const cup = () => scene.children.find((c) => c.name.startsWith('bite:')) as THREE.Object3D;
    effect.update(0.1, 0.1);
    const upright = cup().quaternion.clone();
    expect(mod.visible).toBe(0);
    effect.update(0.3, 0.1);
    expect(cup().visible).toBe(true);
    expect(cup().scale.x).toBeGreaterThan(0);
    expect(cup().quaternion.angleTo(upright)).toBeGreaterThan(0.5);
    expect(mod.visible).toBeGreaterThan(0);
    let smallest = Infinity;
    let squeezes = 0;
    let previous = 1;
    for (let p = 0.4; p <= 1; p += 0.01) {
      effect.update(p, 0);
      expect(mod.visible).toBe(1);
      smallest = Math.min(smallest, mod.swell);
      if (mouth.scale.x < 1 && previous === 1) squeezes += 1;
      previous = mouth.scale.x;
    }
    expect(smallest).toBeGreaterThan(0.9);
    expect(squeezes).toBe(1);
    expect(mouth.scale.x).toBeGreaterThan(1 - 0.07);
    effect.exit();
    expect(mouth.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('sips the glass and bites the solid on a mixed plate, per dish', () => {
    const { ctx, scene } = fixture({ starch: 30, caffeine: 80 }, [organAt(0, 1.5, 0.05, 0.1, 'mouth')]);
    ctx.looks = [
      { ...FALLBACK_LOOK, model: 'samosa' },
      { ...FALLBACK_LOOK, model: 'cup-hot', piece: 'droplet', liquid: true },
    ];
    const effect = chewBeat(ctx);
    effect.enter();
    const dish = (model: string) => scene.children.find((c) => c.name === `bite:${model}`) as THREE.Object3D;
    effect.update(0.1, 0);
    const samosaAt = dish('samosa').quaternion.clone();
    const cupAt = dish('cup-hot').quaternion.clone();
    effect.update(0.3, 2);
    expect(dish('samosa').rotation.y).toBeGreaterThan(0.5);
    expect(dish('cup-hot').quaternion.angleTo(cupAt)).toBeGreaterThan(0.5);
    effect.update(0.3, 0);
    const cupTilted = dish('cup-hot').quaternion.clone();
    effect.update(0.3, 5);
    expect(dish('cup-hot').quaternion.angleTo(cupTilted)).toBeLessThan(1e-9);
    expect(dish('samosa').quaternion.angleTo(samosaAt)).toBeGreaterThan(0.01);
    effect.exit();
  });

  it('pulses the mouth about its own centre and restores it exactly', () => {
    const mouth = organAt(0, 1.5, 0.05, 0.1, 'mouth');
    const { ctx } = fixture({}, [mouth]);
    const before = centreOf(mouth);
    const effect = chewBeat(ctx);
    effect.enter();
    effect.update(0.5, 0);
    expect(mouth.scale.x).toBeLessThan(1);
    expect(centreOf(mouth).distanceTo(before)).toBeLessThan(1e-9);
    effect.exit();
    expect(mouth.scale.toArray()).toEqual([1, 1, 1]);
    expect(mouth.position.toArray()).toEqual([0, 0, 0]);
  });
});

describe('peristalsis', () => {
  it('pushes the mass down the oesophagus by the surge, top to bottom', () => {
    const { ctx, mod } = fixture();
    const effect = peristalsisBeat(ctx);
    effect.enter();
    effect.update(0, 0);
    expect(mod.advance).toBe(0);
    effect.update(0.5, 0);
    const mid = mod.advance ?? -1;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    effect.update(0.95, 0);
    expect(mod.advance).toBe(1);
    effect.exit();
  });
});

describe('peristalsis rings', () => {
  it('stand square to the oesophagus curve', () => {
    const { ctx, scene } = fixture();
    const effect = peristalsisBeat(ctx);
    effect.enter();
    effect.update(0.4, 0);
    const gut = gutCurve(TEST_ANCHORS);
    const rings = scene.children.filter((c) => c.name.startsWith('peristalsis-ring') && c.visible);
    expect(rings.length).toBeGreaterThan(0);
    for (const ring of rings) {
      let best = Infinity;
      let t = 0;
      for (let u = 0; u <= 1; u += 1e-4) {
        const d = gut.getPoint(u).distanceTo(ring.position);
        if (d < best) {
          best = d;
          t = u;
        }
      }
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion);
      expect(axis.dot(gut.getTangent(t))).toBeGreaterThan(0.999);
    }
    effect.exit();
  });
});

describe('drain', () => {
  it('lowers the stomach level more slowly for a fatty plate than for a carbohydrate-only plate', () => {
    const level = (totals: Partial<Nutrients>): number => {
      const { ctx, mod } = fixture(totals);
      const effect = stomachDrainBeat(ctx);
      effect.enter();
      effect.update(0.95, 0);
      effect.exit();
      return mod.visible;
    };
    expect(level({ starch: 28, protein: 4.6, fat: 15 })).toBeGreaterThan(level({ starch: 60 }));
  });

  it('starts the four-hour fall exactly where the emptying-order beat left the level and the swirl', () => {
    const drain: Beat = { ruleId: 'stomach-emptying-order', effect: 'drain', seconds: 5, star: null };
    const fourHours: Beat = { ruleId: 'stomach-four-hours', effect: 'drain4h', seconds: 5, star: null };
    for (const totals of [{ fat: 40 }, { starch: 60 }, { starch: 28, protein: 4.6, fat: 15 }]) {
      const first = fixture(totals, [], [drain, fourHours], 0);
      const before = stomachDrainBeat(first.ctx);
      before.enter();
      before.update(1, 0);
      before.exit();
      const second = fixture(totals, [], [drain, fourHours], 1);
      const after = fourHourDrainBeat(second.ctx);
      after.enter();
      after.update(0, 0);
      expect(second.mod.visible).toBe(first.mod.visible);
      expect(second.mod.visible).toBe(drainLevel(1, drainRate({ ...emptyNutrients(), ...totals })));
      expect(second.mod.swell).toBe(first.mod.swell);
      expect(second.mod.swirl).toBe(first.mod.swirl);
      after.update(0.95, 0);
      expect(second.mod.visible).toBeLessThan(0.12);
      after.exit();
    }
    const alone = fixture({ starch: 30 }, [], [fourHours], 0);
    const effect = fourHourDrainBeat(alone.ctx);
    effect.enter();
    effect.update(0, 0);
    expect(alone.mod.visible).toBe(1);
    effect.exit();
  });

  it('shows the "Sped up" tag only for the four-hour beat and removes it on exit', () => {
    const slow = fixture({ starch: 30 });
    const plain = stomachDrainBeat(slow.ctx);
    plain.enter();
    expect(slow.host.append).not.toHaveBeenCalled();
    plain.exit();

    const sped = fixture({ starch: 30 });
    const effect = fourHourDrainBeat(sped.ctx);
    effect.enter();
    expect(sped.host.append).toHaveBeenCalledTimes(1);
    const tag = sped.host.append.mock.calls[0]?.[0] as { textContent: string; remove: ReturnType<typeof vi.fn> };
    expect(tag.textContent).toBe('Sped up');
    effect.update(0.95, 0);
    expect(sped.mod.visible).toBeLessThan(0.15);
    effect.exit();
    expect(tag.remove).toHaveBeenCalledTimes(1);
  });
});

describe('bile', () => {
  const tree = (): THREE.Group => organAt(0.02, 1.2, -0.02, 0.12, 'gallbladder');
  const sac = (): THREE.Group => organAt(-0.05, 1.17, 0.01, 0.02, 'gallbladder');

  it('finds the gallbladder sac, not the larger biliary tree that shares its organ id', () => {
    const small = sac();
    const { ctx } = fixture({}, [tree(), small]);
    const out = new THREE.Vector3();
    expect(findGallbladder(ctx.body, out)).toBe(small);
    expect(out.toArray().map((v) => Math.round(v * 1000) / 1000)).toEqual([-0.05, 1.17, 0.01]);
  });

  it('rejects a tagged node too large to be the sac and prefers one named gallbladder', () => {
    const big = organAt(-0.03, 1.17, 0, 0.14, 'gallbladder');
    big.name = 'gallbladder_huge';
    const out = new THREE.Vector3();
    expect(findGallbladder(fixture({}, [big]).ctx.body, out)).toBeNull();
    const named = organAt(-0.05, 1.17, 0.01, 0.03, 'gallbladder');
    named.name = 'VH_F_gallbladder_';
    const unnamed = organAt(0.02, 1.16, 0, 0.01, 'gallbladder');
    unnamed.name = 'VH_F_biliary_tree';
    expect(findGallbladder(fixture({}, [unnamed, named]).ctx.body, out)).toBe(named);
  });

  it('accepts a sac as large as the male one (0.073 on its longest side)', () => {
    const male = organAt(-0.05, 1.17, 0.01, 0.075, 'gallbladder');
    expect(findGallbladder(fixture({}, [male]).ctx.body, new THREE.Vector3())).toBe(male);
  });

  it('falls back to a point between the duodenum and the liver when no plausible gallbladder exists', () => {
    const out = new THREE.Vector3();
    expect(findGallbladder(fixture().ctx.body, out)).toBeNull();
    const [dx, dy, dz] = TEST_ANCHORS.duodenum;
    const [lx, ly, lz] = TEST_ANCHORS.liver;
    expect(out.distanceTo(new THREE.Vector3(dx + 0.6 * (lx - dx), dy + 0.6 * (ly - dy), dz + 0.6 * (lz - dz)))).toBeLessThan(1e-9);
    expect(findGallbladder(fixture({}, [organAt(3, 3, 3, 0.02, 'gallbladder')]).ctx.body, out)).toBeNull();
  });

  it('keeps the lens clear of the whole duct, more on a taller screen', () => {
    const clearanceAt = (width: number, height: number): number => {
      const { ctx, lens } = fixture({ fat: 15 }, [sac()]);
      Object.assign(ctx.stage.renderer.domElement, { clientWidth: width, clientHeight: height });
      emulsifyBeat(ctx).enter();
      return (lens.show as ReturnType<typeof vi.fn>).mock.calls[0][2].clearance as number;
    };
    const short = clearanceAt(1600, 700);
    const tall = clearanceAt(1600, 1100);
    expect(short).toBeGreaterThan(12);
    expect(tall).toBeGreaterThan(short);
  });

  it('runs the lens and the squirt together, squeezing the gallbladder in place and restoring it', () => {
    const small = sac();
    const { ctx, lens } = fixture({ fat: 15 }, [small]);
    const material = (small.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
    const before = centreOf(small);
    const effect = emulsifyBeat(ctx);
    effect.enter();
    expect(lens.show).toHaveBeenCalledTimes(1);
    effect.update(0.12, 0);
    expect(small.scale.x).toBeLessThan(1);
    expect(centreOf(small).distanceTo(before)).toBeLessThan(1e-9);
    expect(material.emissiveIntensity).toBeGreaterThan(0.1);
    effect.exit();
    expect(lens.hide).toHaveBeenCalledTimes(1);
    expect(small.scale.toArray()).toEqual([1, 1, 1]);
    expect(material.emissive.getHex()).toBe(0x112233);
    expect(material.emissiveIntensity).toBe(0.1);
  });
});
