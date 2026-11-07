import { describe, expect, it } from 'vitest';
import { smoothToward } from '@/scene/lens/smoothing';

describe('smoothToward', () => {
  it('snaps to the target when no time passes', () => {
    expect(smoothToward(10, 50, 0, 12)).toBe(50);
  });

  it('moves part of the way and never overshoots', () => {
    const next = smoothToward(0, 100, 1 / 60, 12);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(100);
    expect(smoothToward(0, 100, 10, 12)).toBeLessThanOrEqual(100);
    expect(smoothToward(100, 0, 10, 12)).toBeGreaterThanOrEqual(0);
  });

  it('converges within a second of frames', () => {
    let value = 0;
    for (let i = 0; i < 60; i++) value = smoothToward(value, 100, 1 / 60, 12);
    expect(value).toBe(100);
  });

  it('is frame-rate independent', () => {
    let fine = 0;
    for (let i = 0; i < 60; i++) fine = smoothToward(fine, 100, 1 / 120, 12);
    expect(fine).toBeCloseTo(smoothToward(0, 100, 0.5, 12), 3);
  });
});
