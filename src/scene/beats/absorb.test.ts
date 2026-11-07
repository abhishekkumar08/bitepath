import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import { CAFFEINE_BEADS, IRON_BEADS, absorbFastBeat, absorbPartialBeat, villiBeat } from '@/scene/beats/absorb';
import type { BeatContext } from '@/scene/beats/types';
import type { Lens } from '@/scene/lens/types';
import { beadSchedule } from '@/scene/lens/motion';

describe('single-kind absorption beads', () => {
  it('shows only a minority of iron crossing and nearly all caffeine', () => {
    expect(IRON_BEADS.kind).toBe('iron');
    expect(IRON_BEADS.fraction).toBeLessThan(0.5);
    expect(IRON_BEADS.fraction).toBeGreaterThan(0);
    expect(CAFFEINE_BEADS.kind).toBe('caffeine');
    expect(CAFFEINE_BEADS.fraction).toBeGreaterThanOrEqual(0.9);
    expect(CAFFEINE_BEADS.fraction).toBeLessThan(1);
    expect(CAFFEINE_BEADS.count).toBeLessThanOrEqual(40);
    expect(IRON_BEADS.count).toBeLessThanOrEqual(40);
  });
});

describe('bead crossing counts', () => {
  it('lets 22 of 24 caffeine beads cross and 6 of 24 iron beads', () => {
    const crossing = (g: typeof IRON_BEADS): number => beadSchedule(g.count, g.fraction, 1).filter((slot) => slot.crosses).length;
    expect(crossing(CAFFEINE_BEADS)).toBe(22);
    expect(crossing(IRON_BEADS)).toBe(6);
  });
});

describe.each([
  ['villi', villiBeat],
  ['absorb-fast', absorbFastBeat],
  ['absorb-partial', absorbPartialBeat],
] as const)('%s beat', (_name, factory) => {
  const run = (organ: THREE.Object3D | undefined) => {
    const lens = { show: vi.fn(), hide: vi.fn(), setAnchor: vi.fn(), update: vi.fn(), endStation: vi.fn(), dispose: vi.fn() } satisfies Lens;
    const ctx = {
      journey: { sex: 'female', totals: emptyNutrients(), stations: [] },
      body: { organs: { smallIntestine: organ }, anchors: { smallIntestine: [1, 2, 3] } },
      beat: { star: null },
      lens,
    } as unknown as BeatContext;
    const effect = factory(ctx);
    effect.enter();
    effect.update(0.5, 0);
    effect.exit();
    effect.dispose();
    return lens;
  };

  it('opens the lens once at the organ centre with no tag text and closes it on exit', () => {
    const organ = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6));
    organ.position.set(10, 20, 30);
    organ.updateMatrixWorld();
    const lens = run(organ);
    expect(lens.show).toHaveBeenCalledTimes(1);
    const [build, anchor, opts] = lens.show.mock.calls[0];
    expect(typeof build).toBe('function');
    expect(anchor).toEqual([10, 20, 30]);
    expect(opts).toBeUndefined();
    expect(lens.hide).toHaveBeenCalledTimes(1);
  });

  it('falls back to the small-intestine anchor when the organ is missing or empty', () => {
    expect(run(undefined).show.mock.calls[0][1]).toEqual([1, 2, 3]);
    expect(run(new THREE.Group()).show.mock.calls[0][1]).toEqual([1, 2, 3]);
  });
});

describe('absorb-partial framing', () => {
  const effectFor = (star: 'iron' | null) => {
    const organ = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6));
    organ.updateMatrixWorld();
    const ctx = {
      journey: { sex: 'female', totals: emptyNutrients(), stations: [] },
      body: { organs: { smallIntestine: organ }, anchors: { smallIntestine: [1, 2, 3] }, front: [0, 0, 1] },
      stage: { camera: new THREE.PerspectiveCamera(35, 1.6) },
      beat: { star },
    } as unknown as BeatContext;
    return absorbPartialBeat(ctx);
  };

  it('frames the organ on its star beat and leaves the camera to the star pan otherwise', () => {
    expect(effectFor('iron').camera).toBeTypeOf('function');
    expect(effectFor(null).camera).toBeUndefined();
  });
});
