import { describe, expect, it } from 'vitest';
import { cameraBlend, fitInto, frameSphere, framedReach } from '@/scene/framing';

describe('framing', () => {
  it('backs the camera off far enough to fit the sphere', () => {
    const goal = frameSphere([0, 1, 0], 0.1, [0, 0, 1], 35);
    expect(goal.target).toEqual([0, 1, 0]);
    const distance = goal.position[2];
    expect(distance).toBeGreaterThan(0.1 / Math.sin((35 * Math.PI) / 360));
  });
});

describe('fitInto', () => {
  const centre = { x: 0, y: 1, z: 0 };
  const dir = { x: 0, y: 0, z: 1 };

  it('matches frameSphere on a wide screen and writes into the given goal', () => {
    const out = { position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    expect(fitInto(out, centre, 0.1, dir, 35, 1.6)).toBe(out);
    expect(out.target).toEqual([0, 1, 0]);
    expect(out.position[2]).toBeCloseTo(frameSphere([0, 1, 0], 0.1, [0, 0, 1], 35).position[2], 12);
  });

  it('backs off further on a narrow phone screen so the sphere still fits across', () => {
    const wide = fitInto({ position: [0, 0, 0], target: [0, 0, 0] }, centre, 0.1, dir, 35, 1.6).position[2];
    const narrow = fitInto({ position: [0, 0, 0], target: [0, 0, 0] }, centre, 0.1, dir, 35, 0.46).position[2];
    expect(narrow).toBeGreaterThan(wide * 1.8);
  });
});

describe('framedReach', () => {
  it('is how far from the frame centre a segment of the framed sphere reaches on screen', () => {
    expect(framedReach(0.05, 0.05, 900)).toBeCloseTo(450 / 1.4, 9);
    expect(framedReach(0.025, 0.05, 900)).toBeCloseTo(450 / 1.4 / 2, 9);
  });

  it('grows with the short side of the viewport', () => {
    expect(framedReach(0.03, 0.07, 1200)).toBeGreaterThan(framedReach(0.03, 0.07, 800));
  });
});

describe('cameraBlend', () => {
  it('eases toward the goal normally and lands on it at once under reduced motion', () => {
    expect(cameraBlend(0.1, 3, false)).toBeCloseTo(1 - Math.exp(-0.3), 12);
    expect(cameraBlend(0, 3, false)).toBe(0);
    expect(cameraBlend(0.1, 3, true)).toBe(1);
    expect(cameraBlend(0, 3, true)).toBe(1);
  });
});
