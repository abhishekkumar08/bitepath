import { describe, expect, it } from 'vitest';
import { applyArmPose, centroid, farthestPoint, humeralHead, isPlausibleArmScale, lateralPoint, poseArm, regionCentroid, rightSideSign, sideByCentroid } from './arms';

const close = (actual: number[], expected: number[]): void => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 9));

describe('humeralHead', () => {
  it('centres the top tenth of a humerus by height', () => {
    const positions: number[] = [];
    for (let y = 0; y < 18; y++) positions.push(0, y, 0);
    positions.push(1, 19, 2, 3, 18, 4);
    close(humeralHead(positions), [2, 18.5, 3]);
  });
});

describe('arm points', () => {
  it('finds the vertex farthest from a point', () => {
    expect(farthestPoint([0, 0, 0, 0, -3, 0, 1, 1, 0], [0, 0, 0])).toEqual([0, -3, 0]);
  });

  it('finds the most lateral vertex on either side', () => {
    const positions = [-0.5, 1, 0, 0.4, 1.2, 0.1, 0, 0, 0];
    expect(lateralPoint(positions, -1)).toEqual([-0.5, 1, 0]);
    expect(lateralPoint(positions, 1)).toEqual([0.4, 1.2, 0.1]);
  });
});

describe('regionCentroid', () => {
  it('averages only the vertices within the radius of the anchor', () => {
    const positions = [1, 0, 0, 0.95, 0.06, 0, 0.95, -0.06, 0, 0.5, 0, 0, 1, 0.5, 0];
    close(regionCentroid(positions, [1, 0, 0], 0.08), [2.9 / 3, 0, 0]);
  });

  it('includes a vertex exactly on the radius', () => {
    close(regionCentroid([0, 0, 0, 0.08, 0, 0], [0, 0, 0], 0.08), [0.04, 0, 0]);
  });
});

describe('poseArm', () => {
  const pose = poseArm([0, 0, 0], [0, -1, 0], [2, 0, 0]);

  it('rotates the fingertip onto the target', () => {
    close(applyArmPose(pose, [0, -1, 0]), [2, 0, 0]);
    expect(pose.angleDegrees).toBeCloseTo(90, 9);
  });

  it('scales the arm uniformly about the pivot', () => {
    expect(pose.scale).toBeCloseTo(2, 9);
    close(applyArmPose(pose, [0, -0.5, 0]), [1, 0, 0]);
    close(applyArmPose(pose, [0, 0, 0]), [0, 0, 0]);
  });

  it('lands the hand on the target about a pivot off the origin', () => {
    const offset = poseArm([1, 2, 3], [1, 1, 3], [3, 2, 3]);
    close(applyArmPose(offset, [1, 1, 3]), [3, 2, 3]);
    close(applyArmPose(offset, [1, 2, 3]), [1, 2, 3]);
    close(applyArmPose(offset, [1, 1.5, 3]), [2, 2, 3]);
  });

  it('accepts arm length ratios only within 0.8 to 1.25', () => {
    expect(isPlausibleArmScale(0.8)).toBe(true);
    expect(isPlausibleArmScale(1.25)).toBe(true);
    expect(isPlausibleArmScale(0.79)).toBe(false);
    expect(isPlausibleArmScale(1.26)).toBe(false);
  });
});

describe('sides', () => {
  it('puts the body right on the side of X where the liver sits', () => {
    expect(rightSideSign(-0.04, 0)).toBe(-1);
    expect(rightSideSign(0.03, 0.01)).toBe(1);
    expect(() => rightSideSign(0, 0)).toThrow('liver');
  });

  it('sides an element by its centroid against the midline', () => {
    expect(sideByCentroid(-0.3, 0, -1)).toBe('right');
    expect(sideByCentroid(0.3, 0, -1)).toBe('left');
    expect(sideByCentroid(0.3, 0.01, 1)).toBe('right');
    expect(() => sideByCentroid(0.01, 0.01, 1)).toThrow('midline');
  });

  it('trusts position over a name that says the other side', () => {
    const mislabelled = { name: 'right flexor pollicis brevis', centroidX: 0.301 };
    expect(sideByCentroid(mislabelled.centroidX, 0, -1)).toBe('left');
  });

  it('averages vertices into a centroid', () => {
    expect(centroid([0, 0, 0, 2, 4, 6])).toEqual([1, 2, 3]);
    expect(() => centroid([])).toThrow();
  });
});
