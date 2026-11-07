import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import type { Journey, Nutrient } from '@/engine/types';
import { massParticles } from '@/scene/flow';
import type { FoodLook } from '@/scene/food/types';
import type { Moment } from '@/scene/types';
import { createStreams } from '@/scene/streams';
import { TEST_ANCHORS as anchors } from '@/scene/testAnchors';

const journey: Journey = {
  sex: 'female',
  totals: { ...emptyNutrients(), starch: 40, fat: 15, fibre: 6, caffeine: 50 },
  stations: [
    { id: 'mouth', captions: [], streams: [], stars: [], beats: [], dwellSeconds: 4 },
    { id: 'stomach', captions: [], streams: [], stars: [], beats: [], dwellSeconds: 6 },
    { id: 'largeIntestine', captions: [], streams: [], stars: [], beats: [], dwellSeconds: 6 },
  ],
};

const PALAK: FoodLook = { id: 'palak', name: 'Palak', model: 'greens', piece: 'leaf', colors: [0x2f6b2c, 0x1f4d22], chyme: 0x8f9a5e, liquid: false, share: 0.7 };
const COFFEE: FoodLook = { id: 'black-coffee', name: 'Coffee', model: 'cup-hot', piece: 'droplet', colors: [0x3b2417], chyme: 0x6b4a33, liquid: true, share: 0.3 };
const looks = [PALAK, COFFEE];

const moment = (index: number, stationProgress: number): Moment => ({ index, phase: 'dwell', progress: stationProgress, stationProgress, star: null, done: false, beatIndex: null, beatProgress: 0, beatEffect: null });
const instanced = (g: THREE.Group, prefix: string): THREE.InstancedMesh[] =>
  g.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.name.startsWith(prefix));
const food = (g: THREE.Group) => instanced(g, 'food:');
const drops = (g: THREE.Group) => instanced(g, 'droplet:');
const paste = (g: THREE.Group) => instanced(g, 'paste')[0] as THREE.InstancedMesh;
const drawn = (meshes: THREE.InstancedMesh[]): number => meshes.reduce((sum, m) => sum + m.count, 0);
const capacity = (meshes: THREE.InstancedMesh[]): number => meshes.reduce((sum, m) => sum + m.instanceMatrix.count, 0);
const dropletOf = (g: THREE.Group, n: Nutrient) => instanced(g, `droplet:${n}`)[0] as THREE.InstancedMesh;
const positionOf = (mesh: THREE.InstancedMesh, i: number): THREE.Vector3 => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};
const total = Object.values(massParticles(journey.totals)).reduce((a, b) => a + (b ?? 0), 0);

describe('createStreams', () => {
  it('draws the gut tube and the paste below the food so organs never hide them', () => {
    const { group } = createStreams(anchors, journey, looks);
    const tubes = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && !(c instanceof THREE.InstancedMesh));
    expect(tubes.length).toBeGreaterThan(0);
    expect(food(group).length).toBeGreaterThan(0);
    expect(drops(group)).toHaveLength(4);
    for (const mesh of [...tubes, ...drops(group), paste(group)]) {
      expect(mesh.material as THREE.Material).toMatchObject({ depthTest: false, depthWrite: false, transparent: true });
    }
    for (const mesh of food(group)) expect(mesh.material as THREE.Material).toMatchObject({ depthTest: true, depthWrite: true, transparent: true });
    const renderer = { clearDepth: vi.fn() };
    paste(group).onAfterRender(renderer as never, new THREE.Scene(), new THREE.Camera(), new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), null as never);
    expect(renderer.clearDepth).toHaveBeenCalledOnce();
    expect(tubes.every((t) => t.renderOrder === 9)).toBe(true);
    expect(paste(group).renderOrder).toBe(9);
    expect([...food(group), ...drops(group)].every((m) => m.renderOrder === 10)).toBe(true);
  });

  it('keeps the piece count of the plate whatever the food looks like', () => {
    for (const set of [looks, [PALAK], [COFFEE], []]) {
      const { group } = createStreams(anchors, journey, set);
      expect(capacity(food(group))).toBe(total);
    }
    const { group } = createStreams(anchors, journey, looks);
    for (const [n, count] of Object.entries(massParticles(journey.totals))) expect(dropletOf(group, n as Nutrient).instanceMatrix.count).toBe(count);
  });

  it('uses a piece shape per food kind', () => {
    const names = food(createStreams(anchors, journey, looks).group).map((m) => m.name).sort();
    expect(names).toEqual(['food:droplet', 'food:leaf']);
  });

  it('shows only food on the shared gut and switches to nutrient droplets past the small intestine', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.update(1, moment(1, 1));
    expect(drawn(food(streams.group))).toBe(total);
    expect(drawn(drops(streams.group))).toBe(0);

    streams.update(2, moment(2, 1));
    const fibre = massParticles(journey.totals).fibre ?? 0;
    expect(dropletOf(streams.group, 'fibre').count).toBe(fibre);
    expect(drawn(drops(streams.group))).toBe(fibre);
    expect(drawn(food(streams.group))).toBe(total - fibre);
    expect(positionOf(dropletOf(streams.group, 'fibre'), 0).distanceTo(new THREE.Vector3(...anchors.colon))).toBeLessThan(0.15);
  });

  it('paints food in its own colours at the mouth and in chyme colours by the stomach', () => {
    const streams = createStreams(anchors, journey, [PALAK]);
    const leaf = food(streams.group)[0] as THREE.InstancedMesh;
    const colour = new THREE.Color();
    streams.update(0, moment(0, 0.5));
    leaf.getColorAt(0, colour);
    const hsl = { h: 0, s: 0, l: 0 };
    colour.getHSL(hsl, THREE.SRGBColorSpace);
    expect(hsl.h).toBeGreaterThan(0.25);
    expect(hsl.h).toBeLessThan(0.42);
    expect(hsl.l).toBeLessThan(0.4);
    streams.update(1, moment(1, 1));
    leaf.getColorAt(0, colour);
    expect(colour.getHSL(hsl, THREE.SRGBColorSpace).l).toBeGreaterThan(0.42);
  });

  it('fades the paste of solid food in past the mouth', () => {
    const streams = createStreams(anchors, journey, [PALAK]);
    streams.update(0, moment(0, 0.5));
    expect(paste(streams.group).count).toBe(0);
    streams.update(1, moment(1, 1));
    expect(paste(streams.group).count).toBeGreaterThanOrEqual(3);
    expect(paste(streams.group).count).toBeLessThanOrEqual(6);
  });

  it('gives a drink a liquid body from the mouth', () => {
    const streams = createStreams(anchors, journey, [COFFEE]);
    streams.update(0, moment(0, 0.5));
    expect(paste(streams.group).count).toBeGreaterThanOrEqual(3);
  });

  it('shows a drink-only plate as the glossy liquid body alone, never as beads, while a meal keeps its drink droplets', () => {
    const drink = createStreams(anchors, journey, [COFFEE]);
    for (const [index, p] of [[0, 0.5], [1, 1]] as const) {
      drink.update(index, moment(index, p));
      expect(drawn(food(drink.group))).toBe(0);
      expect(paste(drink.group).count).toBeGreaterThanOrEqual(3);
    }
    const meal = createStreams(anchors, journey, looks);
    meal.update(0, moment(0, 0.5));
    expect(food(meal.group).find((m) => m.name === 'food:droplet')?.count).toBeGreaterThan(0);
  });

  it('places food near the route', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.update(1, moment(1, 1));
    for (const mesh of food(streams.group)) {
      expect(positionOf(mesh, 0).distanceTo(new THREE.Vector3(...anchors.stomach))).toBeLessThan(0.15);
    }
  });

  it('keeps depth testing off for everything on the tracer and paste passes except the food pieces', () => {
    const streams = createStreams(anchors, journey, [PALAK, COFFEE, { ...PALAK, id: 'rice', piece: 'grain' }, { ...PALAK, id: 'samosa', piece: 'crumb' }, { ...PALAK, id: 'paneer', piece: 'morsel' }]);
    const depthTested = new Set(['food:morsel', 'food:crumb', 'food:grain', 'food:droplet', 'food:leaf']);
    const late = streams.group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.renderOrder >= 9);
    expect(late.length).toBeGreaterThan(0);
    for (const mesh of late) {
      const material = mesh.material as THREE.Material;
      if (depthTested.has(mesh.name)) expect(material.depthTest).toBe(true);
      else expect(material.depthTest).toBe(false);
    }
    expect(food(streams.group).map((m) => m.name).sort()).toEqual([...depthTested].sort());
  });

  it('shows both cream food and droplets for a nutrient resting at the small intestine', () => {
    const resting: Journey = {
      sex: 'female',
      totals: { ...emptyNutrients(), starch: 40, fat: 20 },
      stations: (['mouth', 'stomach', 'smallIntestine', 'liver'] as const).map((id) => ({ id, captions: [], streams: [], stars: [], beats: [], dwellSeconds: 4 })),
    };
    const streams = createStreams(anchors, resting, [PALAK]);
    streams.update(3, moment(3, 1));
    expect(dropletOf(streams.group, 'starch').count).toBe(massParticles(resting.totals).starch);
    const fat = massParticles(resting.totals).fat ?? 0;
    expect(fat).toBeGreaterThan(0);
    expect(dropletOf(streams.group, 'fat').count).toBe(fat);
    expect(drawn(food(streams.group))).toBeGreaterThan(fat / 2);
    expect(drawn(food(streams.group))).toBeLessThanOrEqual(fat);
    expect(dropletOf(streams.group, 'fat').visible).toBe(true);
  });

  it('hides droplet meshes that draw nothing', () => {
    const streams = createStreams(anchors, journey, looks);
    expect(drops(streams.group).every((m) => !m.visible)).toBe(true);
    streams.update(2, moment(2, 1));
    for (const mesh of drops(streams.group)) expect(mesh.visible).toBe(mesh.count > 0);
    expect(dropletOf(streams.group, 'fibre').visible).toBe(true);
  });

  it('draws no food before the first update', () => {
    const { group } = createStreams(anchors, journey, looks);
    expect(drawn(food(group))).toBe(0);
    expect(paste(group).count).toBe(0);
  });

  it('disposes every mesh, material and geometry it made', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.update(1, moment(1, 1));
    const meshes = streams.group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    const instancedSpies = meshes.filter((m): m is THREE.InstancedMesh => m instanceof THREE.InstancedMesh).map((m) => vi.spyOn(m, 'dispose'));
    const materials = new Set(meshes.map((m) => m.material as THREE.Material));
    const geometries = new Set(meshes.map((m) => m.geometry));
    const materialSpies = [...materials].map((m) => vi.spyOn(m, 'dispose'));
    const geometrySpies = [...geometries].map((g) => vi.spyOn(g, 'dispose'));
    streams.dispose();
    for (const spy of [...instancedSpies, ...materialSpies, ...geometrySpies]) expect(spy).toHaveBeenCalledOnce();
    expect(streams.group.parent).toBeNull();
  });
});

describe('stream modifiers', () => {
  const allPositions = (g: THREE.Group): THREE.Vector3[] => food(g).flatMap((m) => Array.from({ length: m.count }, (_, i) => positionOf(m, i)));
  const spread = (streams: ReturnType<typeof createStreams>): number => {
    const points = allPositions(streams.group);
    const centre = new THREE.Vector3();
    points.forEach((p) => centre.add(p));
    centre.divideScalar(points.length);
    return points.reduce((sum, p) => sum + p.distanceTo(centre), 0) / points.length;
  };
  const visibleShare = (visible: number): number =>
    Object.values(massParticles(journey.totals)).reduce((sum, n) => sum + Math.round((n ?? 0) * visible), 0);

  it('starts at the defaults', () => {
    expect(createStreams(anchors, journey, looks).mod).toEqual({ swell: 1, visible: 1, advance: null, swirl: 0 });
  });

  it('draws only the visible fraction of each nutrient', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.mod.visible = 0.5;
    streams.update(1, moment(1, 1));
    expect(drawn(food(streams.group))).toBe(visibleShare(0.5));
    streams.mod.visible = 1;
    streams.update(1, moment(1, 1));
    expect(drawn(food(streams.group))).toBe(total);
  });

  it('hides droplets with visible too', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.mod.visible = 0;
    streams.update(2, moment(2, 1));
    expect(drawn(drops(streams.group))).toBe(0);
    expect(drawn(food(streams.group))).toBe(0);
    expect(paste(streams.group).count).toBe(0);
  });

  it('clamps visible to the allocated buffer and treats NaN as fully visible', () => {
    const streams = createStreams(anchors, journey, looks);
    for (const [visible, fraction] of [[2, 1], [-1, 0], [Number.NaN, 1]] as const) {
      streams.mod.visible = visible;
      streams.update(1, moment(1, 1));
      expect(drawn(food(streams.group))).toBe(visibleShare(fraction));
    }
  });

  it('resets every modifier and the hold flag', () => {
    const streams = createStreams(anchors, journey, looks);
    Object.assign(streams.mod, { swell: 2, visible: 0.2, advance: 0.9, swirl: 3 });
    streams.holdModifiers = true;
    streams.resetModifiers();
    expect(streams.mod).toEqual({ swell: 1, visible: 1, advance: null, swirl: 0 });
    expect(streams.holdModifiers).toBe(false);
  });

  it('scales both the jitter and the along-gut offsets with swell', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.update(1, moment(1, 1));
    const base = spread(streams);
    streams.mod.swell = 2;
    streams.update(1, moment(1, 1));
    expect(spread(streams)).toBeGreaterThan(base * 1.5);
    streams.mod.swell = 0;
    streams.update(1, moment(1, 1));
    expect(spread(streams)).toBeLessThan(1e-9);
  });

  it('moves the stream along the route with an advance override', () => {
    const walk: Journey = { ...journey, stations: [journey.stations[0], { id: 'oesophagus', captions: [], streams: [], stars: [], beats: [], dwellSeconds: 4 }] } as Journey;
    const streams = createStreams(anchors, walk, looks);
    streams.update(1, moment(1, 0));
    const before = positionOf(food(streams.group)[0] as THREE.InstancedMesh, 0);
    streams.mod.advance = 1;
    streams.update(1, moment(1, 0));
    expect(positionOf(food(streams.group)[0] as THREE.InstancedMesh, 0).distanceTo(before)).toBeGreaterThan(0.01);
  });

  it('rotates the jitter around the gut with swirl', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.update(1, moment(1, 0.5));
    const before = positionOf(food(streams.group)[0] as THREE.InstancedMesh, 3);
    streams.mod.swirl = Math.PI / 2;
    streams.update(1, moment(1, 0.5));
    expect(positionOf(food(streams.group)[0] as THREE.InstancedMesh, 3).distanceTo(before)).toBeGreaterThan(1e-4);
  });

  it('eases modifiers back to defaults within half a second unless held', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.update(1, moment(1, 0.4));
    Object.assign(streams.mod, { swell: 2, visible: 0.2, advance: 0.9, swirl: 3 });
    streams.holdModifiers = true;
    streams.easeModifiers(1);
    expect(streams.mod).toEqual({ swell: 2, visible: 0.2, advance: 0.9, swirl: 3 });
    streams.holdModifiers = false;
    streams.easeModifiers(0.25);
    expect(streams.mod.swell).toBeGreaterThan(1);
    expect(streams.mod.swell).toBeLessThan(2);
    streams.easeModifiers(0.25);
    expect(streams.mod).toEqual({ swell: 1, visible: 1, advance: null, swirl: 0 });
  });

  it('does not ease while dt is zero', () => {
    const streams = createStreams(anchors, journey, looks);
    streams.mod.swell = 2;
    streams.easeModifiers(0);
    expect(streams.mod.swell).toBe(2);
  });
});
