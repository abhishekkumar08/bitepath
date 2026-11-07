import { mixHex } from '@/scene/food/stage';
import type { FoodLook } from '@/scene/food/types';

const MAIN_COLOR_WEIGHT = 0.6;
const DARKEN = 0.18;
const LIGHTEN = 0.08;

export const FALLBACK_LOOK: FoodLook = { id: 'food', name: 'food', model: 'chunk', piece: 'morsel', colors: [0xd9c49a], chyme: 0xd8c8a0, liquid: false, share: 1 };

export const allLiquid = (looks: readonly FoodLook[]): boolean => looks.length > 0 && looks.every((l) => l.liquid);

export const isSipped = (look: FoodLook): boolean => look.liquid;

export function blend(looks: FoodLook[]): number {
  const total = looks.reduce((acc, l) => acc + l.share, 0) || 1;
  let out = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const channel = looks.reduce((acc, l) => acc + ((l.chyme >> shift) & 255) * l.share, 0) / total;
    out |= Math.round(channel) << shift;
  }
  return out;
}

function pick(looks: FoodLook[], q: number): FoodLook {
  let sum = 0;
  for (const look of looks) {
    sum += look.share;
    if (q <= sum) return look;
  }
  return looks[looks.length - 1] as FoodLook;
}

export function shareOrder(looks: FoodLook[], count: number, rand: () => number): FoodLook[] {
  const used = looks.length > 0 ? looks : [FALLBACK_LOOK];
  const total = used.reduce((acc, l) => acc + l.share, 0) || 1;
  const scaled = used.map((l) => ({ ...l, share: l.share / total }));
  const order = Array.from({ length: count }, (_, k) => pick(scaled, (k + 0.5) / count));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j] as FoodLook, order[i] as FoodLook];
  }
  return order;
}

export function baseColor(look: FoodLook, rand: () => number): number {
  const { colors } = look;
  const r = rand();
  const index = colors.length < 2 || r < MAIN_COLOR_WEIGHT ? 0 : 1 + Math.floor(((r - MAIN_COLOR_WEIGHT) / (1 - MAIN_COLOR_WEIGHT)) * (colors.length - 1));
  const hex = colors[Math.min(index, colors.length - 1)] ?? (FALLBACK_LOOK.colors[0] as number);
  const shade = rand() * (DARKEN + LIGHTEN) - DARKEN;
  return shade < 0 ? mixHex(hex, 0x000000, -shade) : mixHex(hex, 0xffffff, shade);
}
