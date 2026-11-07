import { describe, expect, it } from 'vitest';
import { defaultPortion, searchItems } from '@/catalogue/search';
import { emptyNutrients } from '@/engine/totals';
import type { Catalogue } from '@/engine/types';

const catalogue: Catalogue = {
  foods: {
    'ifct:A015': { id: 'ifct:A015', name: 'Rice, raw, milled', source: 'ifct', kcalPer100g: 356, per100g: emptyNutrients() },
    'ifct:A013': { id: 'ifct:A013', name: 'Rice, raw, brown', source: 'ifct', kcalPer100g: 356, per100g: emptyNutrients() },
  },
  dishes: { 'white-rice': { id: 'white-rice', name: 'White rice (1 plate)', parts: [{ foodId: 'ifct:A015', grams: 75 }] } },
};

describe('searchItems', () => {
  it('lists dishes before raw foods', () => {
    expect(searchItems(catalogue, 'rice').map((h) => h.kind)).toEqual(['dish', 'food', 'food']);
  });

  it('matches every word, in any order, ignoring case', () => {
    expect(searchItems(catalogue, 'BROWN rice').map((h) => h.id)).toEqual(['ifct:A013']);
  });

  it('returns dishes first for an empty query and respects the limit', () => {
    expect(searchItems(catalogue, '', 1)).toEqual([{ kind: 'dish', id: 'white-rice', name: 'White rice (1 plate)' }]);
  });
});

describe('defaultPortion', () => {
  it('uses one serving for dishes and 100 g for foods', () => {
    expect(defaultPortion({ kind: 'dish', id: 'white-rice', name: '' })).toEqual({ kind: 'dish', dishId: 'white-rice', servings: 1 });
    expect(defaultPortion({ kind: 'food', id: 'ifct:A015', name: '' })).toEqual({ kind: 'food', foodId: 'ifct:A015', grams: 100 });
  });
});
