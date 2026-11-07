import { describe, expect, it } from 'vitest';
import { emptyNutrients, sumPortions } from '@/engine/totals';
import type { Catalogue, Nutrients } from '@/engine/types';

const n = (values: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...values });

const catalogue: Catalogue = {
  foods: {
    'ifct:A015': {
      id: 'ifct:A015',
      name: 'Rice, raw, milled',
      source: 'ifct',
      kcalPer100g: 356,
      per100g: n({ starch: 75.7, sugar: 0.69, protein: 7.94, fat: 0.52, fibre: 2.81, iron: 0.65 }),
    },
    'usda:173227': { id: 'usda:173227', name: 'Tea, brewed', source: 'usda', kcalPer100g: 1, per100g: n({ caffeine: 20 }) },
  },
  dishes: { chai: { id: 'chai', name: 'Chai', parts: [{ foodId: 'usda:173227', grams: 120 }] } },
};

describe('sumPortions', () => {
  it('scales a food by grams', () => {
    const totals = sumPortions(catalogue, [{ kind: 'food', foodId: 'ifct:A015', grams: 50 }]);
    expect(totals.starch).toBeCloseTo(37.85);
    expect(totals.iron).toBeCloseTo(0.325);
  });

  it('expands a dish by servings', () => {
    expect(sumPortions(catalogue, [{ kind: 'dish', dishId: 'chai', servings: 2 }]).caffeine).toBeCloseTo(48);
  });

  it('adds portions together', () => {
    const totals = sumPortions(catalogue, [
      { kind: 'food', foodId: 'ifct:A015', grams: 100 },
      { kind: 'dish', dishId: 'chai', servings: 1 },
    ]);
    expect(totals.starch).toBeCloseTo(75.7);
    expect(totals.caffeine).toBeCloseTo(24);
  });

  it('throws on unknown ids', () => {
    expect(() => sumPortions(catalogue, [{ kind: 'food', foodId: 'nope', grams: 1 }])).toThrow('Unknown food: nope');
    expect(() => sumPortions(catalogue, [{ kind: 'dish', dishId: 'nope', servings: 1 }])).toThrow('Unknown dish: nope');
  });
});
