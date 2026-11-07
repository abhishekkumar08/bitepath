import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import dishList from '@/data/dishes.json';
import { buildJourney } from '@/engine/journey';
import type { Catalogue, Dish, Food, Sex, StationId } from '@/engine/types';

const dishes = dishList as Dish[];
const foods = JSON.parse(readFileSync('public/data/foods.json', 'utf8')) as Food[];
const foodIds = new Set(foods.map((f) => f.id));
const catalogue: Catalogue = {
  foods: Object.fromEntries(foods.map((f) => [f.id, f])),
  dishes: Object.fromEntries(dishes.map((d) => [d.id, d])),
};
const journey = (dishId: string, sex: Sex = 'male') => buildJourney(catalogue, sex, [{ kind: 'dish', dishId, servings: 1 }]);
const starsAt = (dishId: string, station: StationId) => journey(dishId).stations.find((s) => s.id === station)?.stars ?? [];

describe('dishes', () => {
  it('uses only ingredients that exist in the catalogue', () => {
    for (const dish of dishes) for (const part of dish.parts) expect(foodIds.has(part.foodId), `${dish.id}: ${part.foodId}`).toBe(true);
  });

  it('has unique ids and positive grams', () => {
    expect(new Set(dishes.map((d) => d.id)).size).toBe(dishes.length);
    for (const dish of dishes) for (const part of dish.parts) expect(part.grams).toBeGreaterThan(0);
  });

  it('builds a journey for every dish and both bodies', () => {
    for (const dish of dishes) {
      for (const sex of ['male', 'female'] as const) expect(journey(dish.id, sex).stations[0]?.id, `${dish.id}/${sex}`).toBe('mouth');
    }
  });

  it('lets the real food data drive the star moments', () => {
    expect(starsAt('beer', 'stomach')).toContain('alcohol');
    expect(starsAt('black-coffee', 'bloodstream')).toContain('caffeine');
    expect(starsAt('palak', 'smallIntestine')).toContain('iron');
    expect(starsAt('samosa', 'bloodstream')).toContain('fat');
    expect(starsAt('white-rice', 'stomach')).toEqual([]);
  });
});
