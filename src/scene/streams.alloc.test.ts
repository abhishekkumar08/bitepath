import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import type { Journey } from '@/engine/types';
import type { FoodLook } from '@/scene/food/types';
import type { Moment } from '@/scene/types';
import { createStreams } from '@/scene/streams';
import { TEST_ANCHORS as anchors } from '@/scene/testAnchors';

const made = vi.hoisted(() => ({ counting: false, count: 0 }));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  type Ctor = new (...args: any[]) => object;
  const counted = <T extends Ctor>(Base: T): T =>
    class extends Base {
      constructor(...args: any[]) {
        super(...args);
        if (made.counting) made.count += 1;
      }
    };
  return { ...actual, Vector3: counted(actual.Vector3), Matrix4: counted(actual.Matrix4), Color: counted(actual.Color), Quaternion: counted(actual.Quaternion) };
});

const journey: Journey = {
  sex: 'female',
  totals: { ...emptyNutrients(), starch: 40, fat: 15, fibre: 6, alcohol: 10 },
  stations: (['mouth', 'stomach', 'smallIntestine', 'liver', 'largeIntestine'] as const).map((id) => ({ id, captions: [], streams: [], stars: [], beats: [], dwellSeconds: 4 })),
};
const looks: FoodLook[] = [
  { id: 'palak', name: 'Palak', model: 'greens', piece: 'leaf', colors: [0x2f6b2c], chyme: 0x8f9a5e, liquid: false, share: 0.5 },
  { id: 'beer', name: 'Beer', model: 'glass-beer', piece: 'droplet', colors: [0xe0a82e, 0xf3e3b0], chyme: 0xcdb372, liquid: true, share: 0.5 },
];
const moment = (index: number, stationProgress: number): Moment => ({ index, phase: 'dwell', progress: stationProgress, stationProgress, star: null, done: false, beatIndex: null, beatProgress: 0, beatEffect: null });

describe('streams.update allocations', () => {
  it('counts constructions (the probe works)', () => {
    made.counting = true;
    made.count = 0;
    createStreams(anchors, journey, looks);
    made.counting = false;
    expect(made.count).toBeGreaterThan(0);
    expect(new THREE.Vector3()).toBeInstanceOf(THREE.Vector3);
  });

  it('constructs no Vector3, Matrix4, Color or Quaternion while updating, with every modifier active', () => {
    const streams = createStreams(anchors, journey, looks);
    Object.assign(streams.mod, { swell: 1.4, visible: 0.8, advance: 0.6, swirl: 0.7 });
    made.count = 0;
    made.counting = true;
    for (let index = 0; index < journey.stations.length; index++) {
      for (const p of [0, 0.3, 0.7, 1]) streams.update(index, moment(index, p));
    }
    made.counting = false;
    expect(made.count).toBe(0);
  });
});
