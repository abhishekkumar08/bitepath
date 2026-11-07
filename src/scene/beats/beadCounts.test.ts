import { describe, expect, it } from 'vitest';
import { MIN_STREAM_AMOUNT, emptyNutrients } from '@/engine/totals';
import type { Nutrients } from '@/engine/types';
import { alcoholBeads, plateBeads } from '@/scene/beats/beadCounts';
import { NUTRIENT_COLOR } from '@/scene/path';

const totals = (over: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...over });

describe('plateBeads', () => {
  it('turns the plate into digested products only, never fibre', () => {
    const groups = plateBeads(totals({ sugar: 4, starch: 20, protein: 9, fat: 12, fibre: 30, caffeine: 80, iron: 5, alcohol: 14 }));
    expect(groups.map((g) => g.kind)).toEqual(['glucose', 'amino', 'fattyAcid']);
    expect(groups.map((g) => g.color)).toEqual([NUTRIENT_COLOR.sugar, NUTRIENT_COLOR.protein, NUTRIENT_COLOR.fat]);
    expect(groups.every((g) => g.fraction === 1)).toBe(true);
  });

  it('caps each kind at 40 beads and grows with the amount', () => {
    const [big] = plateBeads(totals({ starch: 300 }));
    const [small] = plateBeads(totals({ starch: 6 }));
    expect(big.count).toBe(40);
    expect(small.count).toBeLessThan(big.count);
    expect(small.count).toBeGreaterThan(0);
  });

  it('gives no beads to kinds below the stream threshold', () => {
    expect(plateBeads(totals({ sugar: 0.4, starch: 0.4, protein: 0.9, fat: 0.5, fibre: 9 }))).toEqual([]);
    expect(plateBeads(totals({ sugar: 0.6, starch: 0.6 })).map((g) => g.kind)).toEqual(['glucose']);
  });
});

describe('alcoholBeads', () => {
  it('gives no beads below the stream threshold', () => {
    expect(alcoholBeads(0)).toBe(0);
    expect(alcoholBeads(MIN_STREAM_AMOUNT - 0.01)).toBe(0);
    expect(alcoholBeads(Number.NaN)).toBe(0);
  });

  it('clamps to 12..40 and scales with the amount in between', () => {
    expect(alcoholBeads(MIN_STREAM_AMOUNT)).toBe(12);
    expect(alcoholBeads(500)).toBe(40);
    expect(alcoholBeads(10)).toBeLessThan(alcoholBeads(15));
    expect(alcoholBeads(13)).toBeGreaterThan(12);
    expect(alcoholBeads(13)).toBeLessThan(40);
  });
});
