import { describe, expect, it } from 'vitest';
import { applyFit, applySigns, assertProperRotation, axisSigns, bp3dToYUp, boxCenter, boxOfPositions, combineFits, fitBoxes, horizontalFront, isPlausibleFit, unionBox } from './align';
import type { Landmarks } from './types';

const facingPlusZ: Landmarks = { liver: [-0.08, 1.22, 0.02], pancreas: [0.03, 1.15, -0.02], pelvis: [0, 0.95, 0], spine: [0, 1.2, -0.08] };
const turned = (l: Landmarks, flip: [number, number, number]): Landmarks => ({
  liver: applySigns(flip, l.liver),
  pancreas: applySigns(flip, l.pancreas),
  pelvis: applySigns(flip, l.pelvis),
  spine: applySigns(flip, l.spine),
});

describe('align', () => {
  it('converts BodyParts3D millimetres, Z-up, into metres, Y-up', () => {
    expect(bp3dToYUp([1000, 2000, 3000])).toEqual([1, 3, -2]);
  });

  it('builds, unions and centres boxes', () => {
    const a = boxOfPositions([0, 0, 0, 1, 2, 3]);
    const b = boxOfPositions([-1, 5, 0, 0, 6, 1]);
    expect(unionBox([a, b])).toEqual({ min: [-1, 0, 0], max: [1, 6, 3] });
    expect(boxCenter(a)).toEqual([0.5, 1, 1.5]);
  });

  it('maps one box exactly onto another', () => {
    const fit = fitBoxes({ min: [0, 0, 0], max: [1, 2, 4] }, { min: [10, 10, 10], max: [12, 14, 18] });
    expect(applyFit(fit, [0, 0, 0])).toEqual([10, 10, 10]);
    expect(applyFit(fit, [1, 2, 4])).toEqual([12, 14, 18]);
    expect(isPlausibleFit(fit)).toBe(true);
  });

  it('combines X and Z from one fit with Y from another', () => {
    const xz = { scale: [1, 2, 3] as [number, number, number], offset: [4, 5, 6] as [number, number, number] };
    const y = { scale: [7, 8, 9] as [number, number, number], offset: [10, 11, 12] as [number, number, number] };
    expect(combineFits(xz, y)).toEqual({ scale: [1, 8, 3], offset: [4, 11, 6] });
  });

  it('rejects a fit that stretches one axis far more than the others', () => {
    expect(isPlausibleFit(fitBoxes({ min: [0, 0, 0], max: [1, 1, 1] }, { min: [0, 0, 0], max: [1, 3, 1] }))).toBe(false);
  });

  it('finds no flips when both bodies face the same way', () => {
    expect(axisSigns(facingPlusZ, facingPlusZ)).toEqual([1, 1, 1]);
  });

  it('accepts a body turned around (two flips is a rotation)', () => {
    const signs = axisSigns(facingPlusZ, turned(facingPlusZ, [-1, 1, -1]));
    expect(signs).toEqual([-1, 1, -1]);
    expect(() => assertProperRotation(signs)).not.toThrow();
  });

  it('refuses a mirrored body (one flip)', () => {
    const signs = axisSigns(facingPlusZ, turned(facingPlusZ, [-1, 1, 1]));
    expect(() => assertProperRotation(signs)).toThrow('mirrored');
  });

  it('points the front from the spine through the gut, ignoring height', () => {
    const [x, y, z] = horizontalFront([0.001, 1.2, 0.058], [0, 1.4, 0]);
    expect(y).toBe(0);
    expect(Math.hypot(x, z)).toBeCloseTo(1);
    expect(z).toBeGreaterThan(0.99);
  });

  it('refuses an ambiguous front when gut and spine line up', () => {
    expect(() => horizontalFront([0.01, 1.2, 0.01], [0, 1.4, 0])).toThrow(/ambiguous/);
  });
});
