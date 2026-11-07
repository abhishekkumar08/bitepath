import type { SearchHit } from '@/catalogue/types';
import type { Catalogue, Portion } from '@/engine/types';

export function searchItems(catalogue: Catalogue, query: string, limit = 20): SearchHit[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (name: string): boolean => tokens.every((t) => name.toLowerCase().includes(t));
  const dishes = Object.values(catalogue.dishes)
    .filter((d) => matches(d.name))
    .map((d): SearchHit => ({ kind: 'dish', id: d.id, name: d.name }));
  const foods = Object.values(catalogue.foods)
    .filter((f) => matches(f.name))
    .map((f): SearchHit => ({ kind: 'food', id: f.id, name: f.name }));
  return [...dishes, ...foods].slice(0, limit);
}

export const DEFAULT_FOOD_GRAMS = 100;

export const defaultPortion = (hit: SearchHit): Portion =>
  hit.kind === 'dish' ? { kind: 'dish', dishId: hit.id, servings: 1 } : { kind: 'food', foodId: hit.id, grams: DEFAULT_FOOD_GRAMS };
