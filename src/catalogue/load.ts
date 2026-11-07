import dishList from '@/data/dishes.json';
import type { Catalogue, Dish, Food } from '@/engine/types';

export async function loadCatalogue(): Promise<Catalogue> {
  const res = await fetch('/data/foods.json');
  if (!res.ok) throw new Error(`Could not load foods: HTTP ${res.status}`);
  const foods = (await res.json()) as Food[];
  return {
    foods: Object.fromEntries(foods.map((f) => [f.id, f])),
    dishes: Object.fromEntries((dishList as Dish[]).map((d) => [d.id, d])),
  };
}
