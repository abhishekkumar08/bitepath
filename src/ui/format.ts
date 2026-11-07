import { COPY } from '@/copy';
import type { DetailId, Measured, Nutrient, PlateNutrition, StreamShare, Unit } from '@/engine/types';
import type { RowText } from '@/ui/types';

export const LEGEND_UNIT: Record<Nutrient, Unit> = {
  sugar: 'g',
  starch: 'g',
  protein: 'g',
  fat: 'g',
  fibre: 'g',
  alcohol: 'g',
  caffeine: 'mg',
  iron: 'mg',
};

const LEGEND_DETAIL: Partial<Record<Nutrient, DetailId>> = {
  sugar: 'sugar',
  fibre: 'fibre',
  protein: 'protein',
  fat: 'fat',
  iron: 'iron',
};

export function formatAmount(value: number, unit: Unit): string {
  if (value === 0) return `0 ${unit}`;
  if (value < 0.1) return `<0.1 ${unit}`;
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${unit}`;
}

export const formatEnergy = (kcal: number): string => `${Math.round(kcal)} kcal`;

export function formatPercent(share: number): string {
  const pct = Math.round(share * 100);
  return pct < 1 ? `<1${COPY.NUTRITION.PERCENT}` : `${pct}${COPY.NUTRITION.PERCENT}`;
}

export function rowFor(measured: Measured | undefined, unit: Unit): RowText {
  if (!measured || (measured.value === 0 && !measured.complete)) return { text: COPY.NUTRITION.NOT_MEASURED, partial: false, missing: true };
  const amount = formatAmount(measured.value, unit);
  return measured.complete
    ? { text: amount, partial: false, missing: false }
    : { text: `${COPY.NUTRITION.AT_LEAST} ${amount}`, partial: true, missing: false };
}

export function legendAmount(nutrient: Nutrient, amount: number, details: PlateNutrition['details']): string {
  const text = formatAmount(amount, LEGEND_UNIT[nutrient]);
  const detail = LEGEND_DETAIL[nutrient];
  return detail !== undefined && details[detail]?.complete === false ? `${COPY.NUTRITION.AT_LEAST} ${text}` : text;
}

export function mixLabel(shares: StreamShare[]): string {
  const parts = shares.map(({ nutrient, share }) => `${COPY.NUTRIENTS[nutrient]} ${formatPercent(share)}`);
  return `${COPY.NUTRITION.MIX_TITLE}: ${parts.join(', ')}`;
}
