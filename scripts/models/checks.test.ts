import { describe, expect, it } from 'vitest';
import { ORGANS } from '@/models/types';
import { MAX_MODEL_BYTES, assertBudget, boxGap, boxInside, missingOrgans, pointBoxGap } from './checks';

const unit = { min: [0, 0, 0] as [number, number, number], max: [1, 1, 1] as [number, number, number] };

describe('checks', () => {
  it('passes the budget at the limit and throws above it', () => {
    expect(() => assertBudget(MAX_MODEL_BYTES, 'x')).not.toThrow();
    expect(() => assertBudget(MAX_MODEL_BYTES + 1, 'female.glb')).toThrow('female.glb');
  });

  it('tests containment with a tolerance', () => {
    expect(boxInside({ min: [-0.01, 0, 0], max: [1, 1, 1] }, unit, 0.02)).toBe(true);
    expect(boxInside({ min: [-0.05, 0, 0], max: [1, 1, 1] }, unit, 0.02)).toBe(false);
  });

  it('measures gaps between boxes and from points', () => {
    expect(boxGap(unit, { min: [0.5, 0.5, 0.5], max: [2, 2, 2] })).toBe(0);
    expect(boxGap(unit, { min: [3, 1, 1], max: [4, 2, 2] })).toBe(2);
    expect(pointBoxGap([0.5, 0.5, 0.5], unit)).toBe(0);
    expect(pointBoxGap([1, 1, 4], unit)).toBe(3);
  });

  it('lists organs nobody tagged', () => {
    expect(missingOrgans(new Set(ORGANS))).toEqual([]);
    expect(missingOrgans(new Set(ORGANS.filter((o) => o !== 'stomach')))).toEqual(['stomach']);
  });
});
