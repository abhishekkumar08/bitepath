import type { Catalogue, Food, Nutrient, Nutrients, Portion } from '@/engine/types';

export const NUTRIENTS: readonly Nutrient[] = ['sugar', 'starch', 'protein', 'fat', 'fibre', 'alcohol', 'caffeine', 'iron'];

export const emptyNutrients = (): Nutrients => ({
  sugar: 0,
  starch: 0,
  protein: 0,
  fat: 0,
  fibre: 0,
  alcohol: 0,
  caffeine: 0,
  iron: 0,
});

export const MIN_STREAM_AMOUNT = 1;

export interface PlateItem {
  food: Food;
  grams: number;
}

export function plateItems(catalogue: Catalogue, portions: Portion[]): PlateItem[] {
  const items: PlateItem[] = [];
  const add = (foodId: string, grams: number): void => {
    const food = catalogue.foods[foodId];
    if (!food) throw new Error(`Unknown food: ${foodId}`);
    items.push({ food, grams });
  };
  for (const p of portions) {
    if (p.kind === 'food') {
      add(p.foodId, p.grams);
      continue;
    }
    const dish = catalogue.dishes[p.dishId];
    if (!dish) throw new Error(`Unknown dish: ${p.dishId}`);
    for (const part of dish.parts) add(part.foodId, part.grams * p.servings);
  }
  return items;
}

export function sumPortions(catalogue: Catalogue, portions: Portion[]): Nutrients {
  const acc = emptyNutrients();
  for (const { food, grams } of plateItems(catalogue, portions)) {
    for (const n of NUTRIENTS) acc[n] += (food.per100g[n] * grams) / 100;
  }
  return acc;
}
