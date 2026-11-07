import { describe, expect, it } from 'vitest';
import { addToMeal, setAmount } from '@/ui/meal';
import type { SearchHit } from '@/catalogue/types';

const rice: SearchHit = { kind: 'dish', id: 'white-rice', name: 'White rice' };
const dal: SearchHit = { kind: 'dish', id: 'toor-dal', name: 'Toor dal' };
const atta: SearchHit = { kind: 'food', id: 'ifct:A019', name: 'Wheat flour, atta' };

describe('meal building', () => {
  it('replaces the item in single-food mode', () => {
    expect(addToMeal(addToMeal([], rice, 'single'), dal, 'single').map((i) => i.hit.id)).toEqual(['toor-dal']);
  });

  it('appends items in meal mode', () => {
    expect(addToMeal(addToMeal([], rice, 'meal'), dal, 'meal').map((i) => i.hit.id)).toEqual(['white-rice', 'toor-dal']);
  });

  it('sets servings for dishes and grams for foods, ignoring non-positive amounts', () => {
    const items = addToMeal(addToMeal([], rice, 'meal'), atta, 'meal');
    expect(setAmount(items, 0, 2)[0].portion).toEqual({ kind: 'dish', dishId: 'white-rice', servings: 2 });
    expect(setAmount(items, 1, 60)[1].portion).toEqual({ kind: 'food', foodId: 'ifct:A019', grams: 60 });
    expect(setAmount(items, 1, 0)).toBe(items);
  });
});
