import { MIN_STREAM_AMOUNT } from '@/engine/totals';
import type { Nutrients } from '@/engine/types';
import type { BeadGroup, BeadKind } from '@/scene/lens/types';
import { NUTRIENT_COLOR } from '@/scene/nutrientColor';

const MAX_BEADS = 40;
const MIN_BEADS = 3;
const MIN_ALCOHOL_BEADS = 12;
const ALCOHOL_BEADS_PER_GRAM = 2;

export function plateBeads(totals: Nutrients): BeadGroup[] {
  const groups: BeadGroup[] = [];
  const add = (kind: BeadKind, color: number, amount: number): void => {
    if (amount < MIN_STREAM_AMOUNT) return;
    groups.push({ kind, color, count: Math.min(MAX_BEADS, Math.max(MIN_BEADS, Math.round(amount))), fraction: 1 });
  };
  add('glucose', NUTRIENT_COLOR.sugar, totals.sugar + totals.starch);
  add('amino', NUTRIENT_COLOR.protein, totals.protein);
  add('fattyAcid', NUTRIENT_COLOR.fat, totals.fat);
  return groups;
}

export const alcoholBeads = (grams: number): number =>
  grams >= MIN_STREAM_AMOUNT ? Math.min(MAX_BEADS, Math.max(MIN_ALCOHOL_BEADS, Math.round(grams * ALCOHOL_BEADS_PER_GRAM))) : 0;
