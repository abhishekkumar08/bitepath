import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import type { Nutrients, StarId, StationId } from '@/engine/types';
import { circulateBeat } from '@/scene/beats/circulate';
import { lymphBeat } from '@/scene/beats/lymph';
import { VEIN_COLOR } from '@/scene/beats/flowView';
import { portalBeat } from '@/scene/beats/portal';
import type { BeatContext, BeatFactory } from '@/scene/beats/types';
import { applyFocus } from '@/scene/focus';
import { NUTRIENT_COLOR } from '@/scene/path';
import { applyStarEffect, starOrgan } from '@/scene/stars';
import type { LoadedBody } from '@/scene/types';
import { TEST_ANCHORS } from '@/scene/testAnchors';

const REST_INTENSITY = 0;
const REST_COLOR = 0x884444;

function organAt(at: readonly number[], size: number, organ: string): THREE.Group {
  const group = new THREE.Group();
  group.userData.organ = organ;
  const material = new THREE.MeshPhysicalMaterial({ color: REST_COLOR, emissiveIntensity: REST_INTENSITY });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size).translate(at[0] as number, at[1] as number, at[2] as number), material));
  return group;
}

interface Fixture {
  ctx: BeatContext;
  scene: THREE.Scene;
  host: { append: ReturnType<typeof vi.fn> };
  tag: { remove: ReturnType<typeof vi.fn> };
  organs: Record<'liver' | 'heart' | 'brain', THREE.Group>;
}

function fixture(totals: Partial<Nutrients>, ruleId = 'liver-portal'): Fixture {
  const scene = new THREE.Scene();
  const organs = {
    liver: organAt(TEST_ANCHORS.liver, 0.1, 'liver'),
    heart: organAt(TEST_ANCHORS.heart, 0.06, 'heart'),
    brain: organAt(TEST_ANCHORS.brain, 0.12, 'brain'),
  };
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3).translate(0, 0.8, -0.1));
  const root = new THREE.Group();
  root.add(organs.liver, organs.heart, organs.brain, spine);
  root.updateMatrixWorld(true);
  const body = { root, organs, anchors: TEST_ANCHORS, front: [0, 0, 1], layers: { skeleton: [spine], skin: [], muscle: [], organs: [] } } as unknown as LoadedBody;
  const tag = { remove: vi.fn(), className: '', textContent: '' };
  const host = { append: vi.fn(), ownerDocument: { createElement: () => tag } };
  const ctx = {
    stage: { scene, camera: new THREE.PerspectiveCamera(35), renderer: { domElement: { parentElement: host } } },
    body,
    beat: { ruleId, effect: null, star: null },
    journey: { sex: 'female', totals: { ...emptyNutrients(), ...totals }, stations: [] },
    streams: { mod: { swell: 1, visible: 1, advance: null, swirl: 0 }, holdModifiers: false },
    lens: null,
    looks: [],
  } as unknown as BeatContext;
  return { ctx, scene, host, tag, organs };
}

const materialOf = (organ: THREE.Object3D): THREE.MeshPhysicalMaterial => (organ.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial;

function expectRestored(organ: THREE.Object3D): void {
  const m = materialOf(organ);
  expect(m.emissive.getHex()).toBe(0);
  expect(m.emissiveIntensity).toBe(0);
  expect(m.color.getHex()).toBe(REST_COLOR);
  expect(organ.scale.toArray()).toEqual([1, 1, 1]);
  expect(organ.position.toArray()).toEqual([0, 0, 0]);
}

const overlays = (scene: THREE.Scene): THREE.Mesh[] => {
  const found: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) found.push(o);
  });
  return found;
};

describe.each([
  ['portal', portalBeat, 'liver-portal'],
  ['lymph', lymphBeat, 'blood-fat-lymph'],
  ['circulate caffeine', circulateBeat, 'blood-caffeine'],
  ['circulate alcohol', circulateBeat, 'blood-alcohol'],
] as [string, BeatFactory, string][])('%s beat', (_name, factory, ruleId) => {
  it('draws on top of the body, frames itself, and leaves the scene and every organ as it found them', () => {
    const f = fixture({ sugar: 30, fat: 15, caffeine: 80, alcohol: 13 }, ruleId);
    const effect = factory(f.ctx);
    effect.enter();
    expect(f.scene.children.length).toBeGreaterThan(0);
    for (const mesh of overlays(f.scene)) {
      expect(mesh.renderOrder).toBeGreaterThanOrEqual(9);
      expect((mesh.material as THREE.Material).depthTest).toBe(false);
      expect((mesh.material as THREE.Material).depthWrite).toBe(false);
    }
    for (const p of [0, 0.2, 0.5, 0.8, 1]) {
      effect.update(p, 0);
      const goal = effect.camera?.(p);
      expect(goal).toBeTruthy();
      for (const v of [...(goal?.position ?? []), ...(goal?.target ?? [])]) expect(Number.isFinite(v)).toBe(true);
    }
    effect.exit();
    expect(f.scene.children).toEqual([]);
    for (const organ of Object.values(f.organs)) expectRestored(organ);
    effect.enter();
    effect.update(0.9, 0);
    effect.exit();
    effect.dispose();
    expect(f.scene.children).toEqual([]);
    for (const organ of Object.values(f.organs)) expectRestored(organ);
  });

  it('is a pure function of beat progress', () => {
    const f = fixture({ sugar: 30, fat: 15, caffeine: 80, alcohol: 13 }, ruleId);
    const effect = factory(f.ctx);
    effect.enter();
    const snapshot = (): number[] => {
      const out: number[] = [];
      for (const mesh of overlays(f.scene)) if (mesh instanceof THREE.InstancedMesh) out.push(...mesh.instanceMatrix.array);
      return out;
    };
    effect.update(0.63, 0.016);
    const first = snapshot();
    effect.update(0.2, 0.5);
    effect.update(0.63, 0);
    expect(snapshot()).toEqual(first);
    effect.exit();
  });
});

describe('portal', () => {
  const instanceColors = (scene: THREE.Scene): Set<number> => {
    const dots = scene.getObjectByName('portal-dots') as THREE.InstancedMesh;
    const colors = new Set<number>();
    const c = new THREE.Color();
    for (let i = 0; i < dots.count; i++) colors.add((dots.getColorAt(i, c), c.getHex()));
    return colors;
  };

  it('colours its particles by the water-soluble nutrients on the plate, never a fixed sugar colour', () => {
    const coffee = fixture({ caffeine: 95 });
    const effect = portalBeat(coffee.ctx);
    effect.enter();
    effect.update(0.5, 0);
    expect(instanceColors(coffee.scene)).toEqual(new Set([NUTRIENT_COLOR.caffeine]));
    effect.exit();

    const samosa = fixture({ starch: 28, protein: 4.6, fat: 15 });
    const other = portalBeat(samosa.ctx);
    other.enter();
    other.update(0.5, 0);
    expect(instanceColors(samosa.scene)).toEqual(new Set([NUTRIENT_COLOR.sugar, NUTRIENT_COLOR.protein]));
    other.exit();
  });

  it('keeps the liver dark until the particles arrive, then makes it glow', () => {
    const f = fixture({ sugar: 30 });
    const effect = portalBeat(f.ctx);
    effect.enter();
    effect.update(0.3, 0);
    expect(materialOf(f.organs.liver).emissiveIntensity).toBe(0);
    effect.update(0.85, 0);
    expect(materialOf(f.organs.liver).emissiveIntensity).toBeGreaterThan(0.1);
    effect.exit();
  });
});

describe('lymph', () => {
  it('shows a faint portal vein for contrast and lights the heart once the fat arrives', () => {
    const f = fixture({ fat: 15 });
    const effect = lymphBeat(f.ctx);
    effect.enter();
    expect(f.scene.getObjectByName('portal-faint')).toBeTruthy();
    expect(f.scene.getObjectByName('lymph-duct')).toBeTruthy();
    effect.update(0.2, 0);
    expect(materialOf(f.organs.heart).emissiveIntensity).toBe(0);
    effect.update(0.9, 0);
    expect(materialOf(f.organs.heart).emissiveIntensity).toBeGreaterThan(0.1);
    effect.exit();
  });
});

describe('circulate', () => {
  it('shows the "Sped up" tag and removes it on exit', () => {
    const f = fixture({ alcohol: 13 }, 'blood-alcohol');
    const effect = circulateBeat(f.ctx);
    effect.enter();
    expect(f.host.append).toHaveBeenCalledTimes(1);
    expect((f.host.append.mock.calls[0]?.[0] as { textContent: string }).textContent).toBe('Sped up');
    effect.exit();
    expect(f.tag.remove).toHaveBeenCalledTimes(1);
  });

  it('lights the brain only for caffeine, and only after the first dot reaches it', () => {
    const caffeine = fixture({ caffeine: 80 }, 'blood-caffeine');
    const effect = circulateBeat(caffeine.ctx);
    effect.enter();
    effect.update(0.1, 0);
    expect(materialOf(caffeine.organs.brain).emissiveIntensity).toBe(0);
    const rim = caffeine.scene.getObjectByName('brain-rim') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    expect(rim.visible).toBe(false);
    effect.update(0.7, 0);
    expect(materialOf(caffeine.organs.brain).emissiveIntensity).toBeGreaterThan(0.1);
    expect(rim.visible).toBe(true);
    expect(rim.material.uniforms.strength?.value).toBeGreaterThan(0.3);
    effect.exit();

    const alcohol = fixture({ alcohol: 13 }, 'blood-alcohol');
    const other = circulateBeat(alcohol.ctx);
    other.enter();
    other.update(0.7, 0);
    expect(materialOf(alcohol.organs.brain).emissiveIntensity).toBe(REST_INTENSITY);
    expect(alcohol.scene.getObjectByName('brain-rim')).toBeUndefined();
    other.exit();
  });

  it('uses the caffeine or alcohol colour family for its dots', () => {
    const hueOf = (ruleId: string): number => {
      const f = fixture({ caffeine: 80, alcohol: 13 }, ruleId);
      const effect = circulateBeat(f.ctx);
      effect.enter();
      const dots = f.scene.getObjectByName('circulate-dots') as THREE.InstancedMesh;
      const hsl = { h: 0, s: 0, l: 0 };
      dots.getColorAt(0, new THREE.Color()).getHSL(hsl);
      effect.exit();
      return hsl.h;
    };
    const expected = (hex: number): number => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).h;
    expect(hueOf('blood-caffeine')).toBeCloseTo(expected(NUTRIENT_COLOR.caffeine), 1);
    expect(hueOf('blood-alcohol')).toBeCloseTo(expected(NUTRIENT_COLOR.alcohol), 1);
  });
});

describe('portal glow and fade', () => {
  it('glows the liver in the most saturated arriving colour, with starch counted as glucose', () => {
    const glowHex = (totals: Partial<Nutrients>): number => {
      const f = fixture(totals);
      const effect = portalBeat(f.ctx);
      effect.enter();
      effect.update(0.9, 0);
      const hex = materialOf(f.organs.liver).emissive.getHex();
      effect.exit();
      return hex;
    };
    expect(glowHex({ starch: 40 })).toBe(NUTRIENT_COLOR.sugar);
    expect(glowHex({ starch: 28, protein: 4.6 })).toBe(NUTRIENT_COLOR.sugar);
    expect(glowHex({ protein: 20 })).toBe(NUTRIENT_COLOR.protein);
    expect(glowHex({ caffeine: 95 })).toBe(VEIN_COLOR);
  });

  it('fades the waiting nutrient cloud early in the beat, purely by progress, and holds that', () => {
    const f = fixture({ starch: 40 });
    const effect = portalBeat(f.ctx);
    effect.enter();
    effect.update(0, 0);
    expect(f.ctx.streams.mod.visible).toBe(1);
    expect(f.ctx.streams.holdModifiers).toBe(true);
    effect.update(0.5, 0);
    expect(f.ctx.streams.mod.visible).toBeCloseTo(0.35, 9);
    effect.update(0.06, 0);
    expect(f.ctx.streams.mod.visible).toBeGreaterThan(0.35);
    expect(f.ctx.streams.mod.visible).toBeLessThan(1);
    effect.exit();
  });
});

describe.each([
  ['portal', portalBeat, 'liver-portal', 'liver', 'sugar', 'liver'],
  ['lymph', lymphBeat, 'blood-fat-lymph', 'bloodstream', 'fat', 'heart'],
  ['circulate', circulateBeat, 'blood-caffeine', 'bloodstream', 'caffeine', 'brain'],
] as [string, BeatFactory, string, StationId, StarId, 'liver' | 'heart' | 'brain'][])('%s in its star window', (_name, factory, ruleId, station, star, lit) => {
  it('owns the glow after the star pass, leaves the focus dimming alone, and restores the star-neutral state on exit', () => {
    const f = fixture({ sugar: 35, fat: 15, caffeine: 80 }, ruleId);
    const frame = (p: number): void => {
      applyFocus(f.ctx.body, station, starOrgan(star));
      applyStarEffect(f.ctx.body, star, p);
    };
    frame(0);
    const effect = factory(f.ctx);
    effect.enter();
    const opacities = (): number[] => Object.values(f.organs).map((o) => materialOf(o).opacity);
    for (const p of [0.05, 0.95]) {
      frame(p);
      const dimmed = opacities();
      effect.update(p, 0);
      expect(opacities()).toEqual(dimmed);
    }
    const alone = fixture({ sugar: 35, fat: 15, caffeine: 80 }, ruleId);
    const reference = factory(alone.ctx);
    reference.enter();
    reference.update(0.95, 0);
    expect(materialOf(f.organs[lit]).emissive.getHex()).toBe(materialOf(alone.organs[lit]).emissive.getHex());
    expect(materialOf(f.organs[lit]).emissiveIntensity).toBe(materialOf(alone.organs[lit]).emissiveIntensity);
    expect(materialOf(f.organs[lit]).emissiveIntensity).toBeGreaterThan(0);
    reference.exit();
    frame(0.5);
    expect(materialOf(f.organs[lit]).emissiveIntensity).toBeGreaterThan(0);
    effect.update(0.05, 0);
    expect(materialOf(f.organs[lit]).emissiveIntensity).toBe(0);
    effect.exit();
    for (const organ of Object.values(f.organs)) {
      expect(materialOf(organ).emissiveIntensity).toBe(0);
      expect(organ.scale.toArray()).toEqual([1, 1, 1]);
    }
  });
});

describe('circulate dots', () => {
  it('are bigger on a narrow (phone) view', () => {
    const radiusAt = (aspect: number): number => {
      const f = fixture({ alcohol: 13 }, 'blood-alcohol');
      (f.ctx.stage.camera as THREE.PerspectiveCamera).aspect = aspect;
      const effect = circulateBeat(f.ctx);
      effect.enter();
      const dots = f.scene.getObjectByName('circulate-dots') as THREE.InstancedMesh;
      dots.geometry.computeBoundingSphere();
      const r = dots.geometry.boundingSphere?.radius ?? 0;
      effect.exit();
      return r;
    };
    expect(radiusAt(0.46)).toBeGreaterThan(radiusAt(1.6) * 1.4);
  });
});
