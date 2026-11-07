import { describe, expect, it } from 'vitest';
import { COPY } from '@/copy';
import { LAYER_STEPS, nextLabel, peelAt, stepBy } from '@/ui/layers';

describe('stepBy', () => {
  it('moves one step and stays inside the range', () => {
    expect(stepBy(0, 1)).toBe(1);
    expect(stepBy(2, -1)).toBe(1);
    expect(stepBy(0, -1)).toBe(0);
    expect(stepBy(LAYER_STEPS.length - 1, 1)).toBe(LAYER_STEPS.length - 1);
  });
});

describe('LAYER_STEPS', () => {
  it('goes from skin down to organs, one layer per step', () => {
    expect(LAYER_STEPS).toEqual(['skin', 'muscle', 'skeleton', 'organs']);
  });
});

describe('peelAt', () => {
  it('starts at the old step and ends exactly on the new one', () => {
    expect(peelAt(0, 1, 0)).toBe(0);
    expect(peelAt(0, 1, 1)).toBe(1);
    expect(peelAt(3, 2, 1)).toBe(2);
  });

  it('eases in the middle and stays between the two steps', () => {
    const mid = peelAt(0, 2, 0.5);
    expect(mid).toBeCloseTo(1);
    const early = peelAt(0, 2, 0.25);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.5);
  });

  it('clamps time outside 0..1', () => {
    expect(peelAt(1, 2, -3)).toBe(1);
    expect(peelAt(1, 2, 9)).toBe(2);
  });
});

describe('nextLabel', () => {
  it('names the step that comes next', () => {
    expect(nextLabel(0)).toBe(`${COPY.PEEL_NEXT} ${COPY.LAYER_NAMES.muscle}`);
    expect(nextLabel(2)).toBe(`${COPY.PEEL_NEXT} ${COPY.LAYER_NAMES.organs}`);
  });

  it('is empty on the last step', () => {
    expect(nextLabel(LAYER_STEPS.length - 1)).toBeUndefined();
  });
});
