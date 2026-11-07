import type { FoodStage } from '@/scene/food/types';
import { sharedGut } from '@/scene/route';

export const CREAM = 0xf3e1b4;
export const SWITCH_AT = sharedGut.length - 1;
const SWITCH_HALF = 0.15;
const STOMACH = sharedGut.indexOf('stomach');
const MORSEL_KNOTS: [number, number][] = [[0, 1], [STOMACH, 0.5], [STOMACH + 1, 0.25], [SWITCH_AT, 0.15]];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smoothstep = (lo: number, hi: number, v: number): number => {
  const t = clamp01((v - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

function morselAt(at: number): number {
  const first = MORSEL_KNOTS[0] as [number, number];
  if (at <= first[0]) return first[1];
  for (let i = 1; i < MORSEL_KNOTS.length; i++) {
    const [x1, y1] = MORSEL_KNOTS[i] as [number, number];
    if (at <= x1) {
      const [x0, y0] = MORSEL_KNOTS[i - 1] as [number, number];
      return y0 + ((y1 - y0) * (at - x0)) / (x1 - x0);
    }
  }
  return (MORSEL_KNOTS[MORSEL_KNOTS.length - 1] as [number, number])[1];
}

export function foodStage(at: number, out: FoodStage = { morsel: 0, paste: 0, cream: 0 }): FoodStage {
  out.morsel = morselAt(at);
  out.paste = smoothstep(0, STOMACH, at);
  out.cream = smoothstep(STOMACH, SWITCH_AT, at);
  return out;
}

export const mixHex = (a: number, b: number, t: number): number => {
  let out = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    out |= Math.round(x + (y - x) * t) << shift;
  }
  return out;
};

export function chymeColor(base: number, chyme: number, stage: FoodStage): number {
  return mixHex(mixHex(base, chyme, stage.paste), CREAM, stage.cream);
}

export const dropletMix = (at: number): number => smoothstep(SWITCH_AT - SWITCH_HALF, SWITCH_AT + SWITCH_HALF, at);

export function lightenHex(hex: number, t: number): number {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const l = (hi + lo) / 2;
  const d = hi - lo;
  if (d === 0) return mixHex(hex, 0xffffff, t);
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (hi === r) h = ((g - b) / d + 6) % 6;
  else if (hi === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  const nl = l + (1 - l) * t;
  const c = (1 - Math.abs(2 * nl - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = nl - c / 2;
  const [pr, pg, pb] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
  return (Math.round((pr + m) * 255) << 16) | (Math.round((pg + m) * 255) << 8) | Math.round((pb + m) * 255);
}
