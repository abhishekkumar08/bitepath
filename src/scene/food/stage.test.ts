import { describe, expect, it } from 'vitest';
import { CREAM, chymeColor, dropletMix, foodStage, lightenHex } from '@/scene/food/stage';
import type { FoodStage } from '@/scene/food/types';

const samples = (from: number, to: number, n = 400): number[] => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
const channels = (hex: number): number[] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

describe('foodStage', () => {
  it('hits the endpoint values at the anchors', () => {
    expect(foodStage(0)).toEqual({ morsel: 1, paste: 0, cream: 0 });
    const stomach = foodStage(3);
    expect(stomach.morsel).toBeCloseTo(0.5);
    expect(stomach.paste).toBe(1);
    expect(stomach.cream).toBe(0);
    expect(foodStage(4).morsel).toBeCloseTo(0.25);
    expect(foodStage(5).cream).toBe(1);
  });

  it('clamps outside the gut', () => {
    expect(foodStage(-2)).toEqual(foodStage(0));
    expect(foodStage(9)).toEqual(foodStage(5));
  });

  it('is monotone: morsels shrink, paste and cream only grow', () => {
    let last = foodStage(-0.5);
    for (const at of samples(-0.5, 6)) {
      const next = foodStage(at);
      expect(next.morsel).toBeLessThanOrEqual(last.morsel + 1e-12);
      expect(next.paste).toBeGreaterThanOrEqual(last.paste - 1e-12);
      expect(next.cream).toBeGreaterThanOrEqual(last.cream - 1e-12);
      last = next;
    }
  });

  it('is continuous', () => {
    const step = 6.5 / 4000;
    for (const at of samples(-0.5, 6, 4000)) {
      const a = foodStage(at);
      const b = foodStage(at + step);
      expect(Math.abs(a.morsel - b.morsel)).toBeLessThan(0.01);
      expect(Math.abs(a.paste - b.paste)).toBeLessThan(0.01);
      expect(Math.abs(a.cream - b.cream)).toBeLessThan(0.01);
    }
  });

  it('writes into the given object instead of allocating', () => {
    const out: FoodStage = { morsel: 0, paste: 0, cream: 0 };
    expect(foodStage(3, out)).toBe(out);
    expect(out.paste).toBe(1);
  });
});

describe('chymeColor', () => {
  const base = 0x2f6b2c;
  const chyme = 0x8f9a5e;

  it('keeps the food colour at the mouth, reaches the chyme in the stomach and cream in the small intestine', () => {
    expect(chymeColor(base, chyme, foodStage(0))).toBe(base);
    expect(chymeColor(base, chyme, foodStage(3))).toBe(chyme);
    expect(chymeColor(base, chyme, foodStage(5))).toBe(CREAM);
  });

  it('always returns a valid 24-bit colour between its sources', () => {
    for (const at of samples(0, 5, 50)) {
      const hex = chymeColor(base, chyme, foodStage(at));
      expect(Number.isInteger(hex)).toBe(true);
      expect(hex).toBeGreaterThanOrEqual(0);
      expect(hex).toBeLessThanOrEqual(0xffffff);
      const c = channels(hex);
      const lo = [base, chyme, CREAM].map(channels);
      for (let k = 0; k < 3; k++) {
        expect(c[k]).toBeGreaterThanOrEqual(Math.min(...lo.map((l) => l[k] as number)));
        expect(c[k]).toBeLessThanOrEqual(Math.max(...lo.map((l) => l[k] as number)));
      }
    }
  });
});

describe('dropletMix', () => {
  it('switches from food to droplets around the small-intestine anchor', () => {
    expect(dropletMix(0)).toBe(0);
    expect(dropletMix(4.8)).toBe(0);
    expect(dropletMix(5)).toBeCloseTo(0.5);
    expect(dropletMix(5.2)).toBe(1);
    expect(dropletMix(7)).toBe(1);
  });

  it('never decreases', () => {
    let last = 0;
    for (const at of samples(4, 6)) {
      expect(dropletMix(at)).toBeGreaterThanOrEqual(last);
      last = dropletMix(at);
    }
  });
});

describe('lightenHex', () => {
  const hsl = (hex: number): { h: number; s: number; l: number } => {
    const [r, g, b] = channels(hex).map((v) => v / 255);
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    const l = (hi + lo) / 2;
    const d = hi - lo;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const h = d === 0 ? 0 : hi === r ? (((g - b) / d + 6) % 6) * 60 : hi === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
    return { h, s, l };
  };

  it.each([0x9c6644, 0xb5179e, 0x4ea8de, 0xff9f1c])('keeps hue and saturation of %s while raising lightness', (hex) => {
    const before = hsl(hex);
    const after = hsl(lightenHex(hex, 0.35));
    expect(Math.abs(after.h - before.h)).toBeLessThan(2);
    expect(Math.abs(after.s - before.s)).toBeLessThan(0.02);
    expect(after.l).toBeGreaterThan(before.l);
  });

  it('is the identity at 0, white at 1, and mixes greys toward white', () => {
    expect(lightenHex(0x9c6644, 0)).toBe(0x9c6644);
    expect(lightenHex(0x9c6644, 1)).toBe(0xffffff);
    expect(lightenHex(0x808080, 0.5)).toBe(0xc0c0c0);
  });

  it('keeps caffeine brown rather than beige', () => {
    expect(hsl(lightenHex(0x9c6644, 0.35)).s).toBeGreaterThan(0.35);
  });
});
