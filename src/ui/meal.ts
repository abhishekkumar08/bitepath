import { defaultPortion } from '@/catalogue/search';
import type { SearchHit } from '@/catalogue/types';
import type { MealItem, Mode } from '@/ui/types';

export const addToMeal = (items: MealItem[], hit: SearchHit, mode: Mode): MealItem[] => {
  const item = { hit, portion: defaultPortion(hit) };
  return mode === 'single' ? [item] : [...items, item];
};

export function setAmount(items: MealItem[], index: number, amount: number): MealItem[] {
  if (!(amount > 0)) return items;
  return items.map((item, i) => {
    if (i !== index) return item;
    const p = item.portion;
    return { ...item, portion: p.kind === 'dish' ? { ...p, servings: amount } : { ...p, grams: amount } };
  });
}
