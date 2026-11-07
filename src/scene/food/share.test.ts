import { describe, expect, it } from 'vitest';
import { random } from '@/scene/food/modelParts';
import { FALLBACK_LOOK, allLiquid, baseColor, blend, isSipped, shareOrder } from '@/scene/food/share';
import type { FoodLook } from '@/scene/food/types';

const look = (id: string, share: number, colors: number[], chyme: number): FoodLook => ({ id, name: id, model: 'chunk', piece: 'morsel', colors, chyme, liquid: false, share });
const RICE = look('rice', 0.7, [0xf4efe2], 0xece3cc);
const DAL = look('dal', 0.3, [0xe0a928, 0xb8741f], 0xd4b46a);

describe('shareOrder', () => {
  it('splits pieces by gram share and keeps the total', () => {
    const order = shareOrder([RICE, DAL], 100, random(3));
    expect(order).toHaveLength(100);
    expect(order.filter((l) => l.id === 'rice')).toHaveLength(70);
    expect(order.filter((l) => l.id === 'dal')).toHaveLength(30);
  });

  it('shuffles so a share is not one contiguous run', () => {
    const order = shareOrder([RICE, DAL], 100, random(3));
    expect(order.slice(0, 70).every((l) => l.id === 'rice')).toBe(false);
  });

  it('gives every piece to a single look', () => {
    expect(shareOrder([DAL], 37, random(1)).every((l) => l.id === 'dal')).toBe(true);
  });

  it('falls back to a neutral look when there are none', () => {
    const order = shareOrder([], 12, random(1));
    expect(order).toHaveLength(12);
    expect(order.every((l) => l.id === FALLBACK_LOOK.id)).toBe(true);
  });
});

describe('blend', () => {
  it('weights the chyme colours by share', () => {
    expect(blend([RICE])).toBe(RICE.chyme);
    const mixed = blend([look('a', 0.5, [0], 0x000000), look('b', 0.5, [0], 0xfefefe)]);
    expect(mixed).toBe(0x7f7f7f);
  });
});

describe('baseColor', () => {
  it('stays near one of the look colours', () => {
    const rand = random(5);
    for (let i = 0; i < 50; i++) {
      const hex = baseColor(DAL, rand);
      expect(hex).toBeGreaterThanOrEqual(0);
      expect(hex).toBeLessThanOrEqual(0xffffff);
      const g = (hex >> 8) & 255;
      expect(g).toBeGreaterThan(0x50);
      expect(g).toBeLessThan(0xb8);
    }
  });
});

describe('intake mode per dish', () => {
  const COFFEE: FoodLook = { ...look('coffee', 0.4, [0x3b2417], 0x6b4a32), model: 'cup-hot', liquid: true };
  const SAMOSA = look('samosa', 0.6, [0xd29a4a], 0xd8b878);

  it('sips liquid vessels and bites solids, dish by dish', () => {
    expect([SAMOSA, COFFEE].map(isSipped)).toEqual([false, true]);
  });

  it('keeps the all-liquid and all-solid plates uniform', () => {
    expect(allLiquid([COFFEE, COFFEE])).toBe(true);
    expect([COFFEE, COFFEE].every(isSipped)).toBe(true);
    expect([SAMOSA, RICE].some(isSipped)).toBe(false);
    expect(allLiquid([SAMOSA, COFFEE])).toBe(false);
  });
});
