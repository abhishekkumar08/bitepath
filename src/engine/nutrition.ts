import { MIN_STREAM_AMOUNT, plateItems } from '@/engine/totals';
import type { Catalogue, DetailId, Measured, Nutrient, Nutrients, PlateNutrition, Portion, StreamShare } from '@/engine/types';

const SHARE_NUTRIENTS: readonly Nutrient[] = ['sugar', 'starch', 'protein', 'fat', 'fibre', 'alcohol'];

export function plateNutrition(catalogue: Catalogue, portions: Portion[]): PlateNutrition {
  const items = plateItems(catalogue, portions);
  const details: Partial<Record<DetailId, Measured>> = {};
  let energyKcal = 0;
  let grams = 0;
  for (const { food, grams: g } of items) {
    energyKcal += (food.kcalPer100g * g) / 100;
    grams += g;
    for (const [id, per100g] of Object.entries(food.measured ?? {}) as [DetailId, number][]) {
      const entry = details[id] ?? { value: 0, complete: true };
      entry.value += (per100g * g) / 100;
      details[id] = entry;
    }
  }
  for (const [id, entry] of Object.entries(details) as [DetailId, Measured][]) {
    entry.complete = items.every(({ food, grams: g }) => g <= 0 || food.measured?.[id] !== undefined);
  }
  return { energyKcal, details, grams };
}

export function streamShares(totals: Nutrients): StreamShare[] {
  const present = SHARE_NUTRIENTS.filter((n) => totals[n] >= MIN_STREAM_AMOUNT);
  const sum = present.reduce((acc, n) => acc + totals[n], 0);
  return present.map((nutrient) => ({ nutrient, share: totals[nutrient] / sum })).sort((a, b) => b.share - a.share);
}
