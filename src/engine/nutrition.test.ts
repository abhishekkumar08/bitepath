import { describe, expect, it } from 'vitest';
import { plateNutrition, streamShares } from '@/engine/nutrition';
import { emptyNutrients } from '@/engine/totals';
import type { Catalogue, Food, Nutrients } from '@/engine/types';

const n = (values: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...values });

const food = (id: string, kcalPer100g: number, measured?: Food['measured']): Food => ({
  id,
  name: id,
  source: 'usda',
  kcalPer100g,
  per100g: n({}),
  measured,
});

const catalogue: Catalogue = {
  foods: {
    milk: food('milk', 60, { calcium: 120, protein: 3.2, sodium: 0 }),
    oats: food('oats', 380, { protein: 13 }),
    salt: food('salt', 0),
  },
  dishes: {
    porridge: {
      id: 'porridge',
      name: 'Porridge',
      parts: [
        { foodId: 'milk', grams: 200 },
        { foodId: 'oats', grams: 40 },
      ],
    },
    saltOnly: { id: 'saltOnly', name: 'Salt only', parts: [{ foodId: 'salt', grams: 5 }] },
  },
};

describe('plateNutrition', () => {
  it('scales one food by grams', () => {
    const plate = plateNutrition(catalogue, [{ kind: 'food', foodId: 'milk', grams: 250 }]);
    expect(plate.details.calcium).toEqual({ value: 300, complete: true });
    expect(plate.details.protein?.value).toBeCloseTo(8);
    expect(plate.grams).toBe(250);
  });

  it('flags a dish as incomplete when one part lacks the nutrient and sums the measured part', () => {
    const plate = plateNutrition(catalogue, [{ kind: 'dish', dishId: 'porridge', servings: 2 }]);
    expect(plate.details.calcium).toEqual({ value: 480, complete: false });
    expect(plate.details.protein?.value).toBeCloseTo(2 * (6.4 + 5.2));
    expect(plate.details.protein?.complete).toBe(true);
    expect(plate.grams).toBe(480);
  });

  it('leaves the key out when no ingredient measured it', () => {
    const plate = plateNutrition(catalogue, [{ kind: 'dish', dishId: 'saltOnly', servings: 1 }]);
    expect(plate.details.calcium).toBeUndefined();
    expect('calcium' in plate.details).toBe(false);
  });

  it('keeps a measured zero as zero and complete', () => {
    const plate = plateNutrition(catalogue, [{ kind: 'food', foodId: 'milk', grams: 100 }]);
    expect(plate.details.sodium).toEqual({ value: 0, complete: true });
  });

  it('sums energy across portions', () => {
    const plate = plateNutrition(catalogue, [
      { kind: 'food', foodId: 'milk', grams: 100 },
      { kind: 'dish', dishId: 'porridge', servings: 1 },
    ]);
    expect(plate.energyKcal).toBeCloseTo(60 + 120 + 152);
    expect(plate.grams).toBe(340);
  });

  it('throws on unknown ids', () => {
    expect(() => plateNutrition(catalogue, [{ kind: 'food', foodId: 'nope', grams: 1 }])).toThrow('Unknown food: nope');
    expect(() => plateNutrition(catalogue, [{ kind: 'dish', dishId: 'nope', servings: 1 }])).toThrow('Unknown dish: nope');
  });
});

describe('streamShares', () => {
  it('sums to one and sorts largest first', () => {
    const shares = streamShares(n({ starch: 30, protein: 10, fat: 6, sugar: 4 }));
    expect(shares.map((s) => s.nutrient)).toEqual(['starch', 'protein', 'fat', 'sugar']);
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 6);
    expect(shares[0].share).toBeCloseTo(0.6);
    for (let i = 1; i < shares.length; i++) expect(shares[i - 1].share).toBeGreaterThanOrEqual(shares[i].share);
  });

  it('drops trace amounts and non-gram nutrients', () => {
    const shares = streamShares(n({ starch: 10, fat: 0.4, caffeine: 80, iron: 5 }));
    expect(shares).toEqual([{ nutrient: 'starch', share: 1 }]);
  });

  it('returns nothing for an empty plate', () => {
    expect(streamShares(emptyNutrients())).toEqual([]);
  });
});
