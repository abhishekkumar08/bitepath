import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import { createEmulsifyLensBeat } from '@/scene/beats/emulsifyLens';
import { fermentBeat, idleBacteriaBeat } from '@/scene/beats/ferment';
import type { BeatContext, BeatFactory } from '@/scene/beats/types';
import type { Lens } from '@/scene/lens/types';

const show = (factory: BeatFactory) => {
  const lens = { show: vi.fn(), hide: vi.fn(), setAnchor: vi.fn(), update: vi.fn(), endStation: vi.fn(), dispose: vi.fn() } satisfies Lens;
  const ctx = {
    journey: { sex: 'female', totals: emptyNutrients(), stations: [] },
    body: { organs: {}, anchors: { colon: [4, 5, 6], smallIntestine: [7, 8, 9] } },
    beat: { star: null },
    lens,
  } as unknown as BeatContext;
  factory(ctx).enter();
  expect(lens.show).toHaveBeenCalledTimes(1);
  const [, anchor, opts] = lens.show.mock.calls[0];
  return { anchor, opts };
};

describe('bacteria lens beats', () => {
  it('ferment opens at the colon with the Sped up tag', () => {
    expect(show(fermentBeat)).toEqual({ anchor: [4, 5, 6], opts: { sped: true } });
  });

  it('ferment frames the colon itself only in the fibre star window', () => {
    const effect = (star: 'fibre' | null) =>
      fermentBeat({
        stage: { camera: new THREE.PerspectiveCamera(35, 1.6) },
        body: { organs: { colon: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)) }, anchors: { colon: [0, 0, 0] }, front: [0, 0, 1] },
        beat: { star },
        lens: null,
      } as unknown as BeatContext);
    expect(effect('fibre').camera?.(0.5)?.target).toEqual([0, 0, 0]);
    expect(effect(null).camera).toBeUndefined();
  });

  it('idle bacteria open at the colon without the Sped up tag', () => {
    expect(show(idleBacteriaBeat)).toEqual({ anchor: [4, 5, 6], opts: { sped: false } });
  });
});

describe('emulsify lens beat', () => {
  it('opens at the small intestine', () => {
    expect(show(createEmulsifyLensBeat).anchor).toEqual([7, 8, 9]);
  });
});

