import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import { amylaseBeat, chopCarbsBeat, chopProteinBeat, pepsinBeat } from '@/scene/beats/chop';
import type { BeatContext, BeatFactory } from '@/scene/beats/types';
import type { Lens } from '@/scene/lens/types';

const ANCHOR: [number, number, number] = [1, 2, 3];

describe.each([
  ['amylase', amylaseBeat, 'mouth'],
  ['pepsin', pepsinBeat, 'stomach'],
  ['chop-carbs', chopCarbsBeat, 'smallIntestine'],
  ['chop-protein', chopProteinBeat, 'smallIntestine'],
] as const)('%s beat', (_name, factory: BeatFactory, organName) => {
  const run = (organ: THREE.Object3D | undefined, withLens = true) => {
    const lens = { show: vi.fn(), hide: vi.fn(), setAnchor: vi.fn(), update: vi.fn(), endStation: vi.fn(), dispose: vi.fn() } satisfies Lens;
    const stage = { scene: new THREE.Scene() };
    const ctx = {
      stage,
      journey: { sex: 'female', totals: emptyNutrients(), stations: [] },
      body: { organs: { [organName]: organ }, anchors: { [organName]: ANCHOR } },
      lens: withLens ? lens : null,
    } as unknown as BeatContext;
    const effect = factory(ctx);
    effect.enter();
    effect.update(0.5, 0);
    effect.exit();
    effect.exit();
    effect.dispose();
    return { lens, stage };
  };

  it('opens the lens once at the organ centre and closes it once, adding nothing to the body scene', () => {
    const organ = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6));
    organ.position.set(10, 20, 30);
    organ.updateMatrixWorld();
    const { lens, stage } = run(organ);
    expect(lens.show).toHaveBeenCalledTimes(1);
    const [build, anchor, opts] = lens.show.mock.calls[0];
    expect(typeof build).toBe('function');
    expect(anchor).toEqual([10, 20, 30]);
    expect(opts).toBeUndefined();
    expect(lens.hide).toHaveBeenCalledTimes(1);
    expect(stage.scene.children).toHaveLength(0);
  });

  it(`falls back to the ${organName} anchor when the organ is missing or empty`, () => {
    expect(run(undefined).lens.show.mock.calls[0][1]).toEqual(ANCHOR);
    expect(run(new THREE.Group()).lens.show.mock.calls[0][1]).toEqual(ANCHOR);
  });

  it('is safe without a lens', () => {
    expect(() => run(undefined, false)).not.toThrow();
  });
});
