import { describe, expect, it } from 'vitest';
import { HEAP_RISE, blobDisplace, heapPositions, heapSpacing, lathePoints, noise3, random, shellProfile } from '@/scene/food/modelParts';
import type { HeapPoint, ProfilePoint } from '@/scene/food/types';

const CUP: ProfilePoint[] = [
  { r: 0, y: 0 },
  { r: 0.02, y: 0 },
  { r: 0.024, y: 0.03 },
  { r: 0.026, y: 0.05 },
];

describe('random', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = random(7);
    const b = random(7);
    for (let i = 0; i < 200; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs between seeds, including seed 0', () => {
    expect(random(0)()).not.toBe(random(1)());
    expect(new Set(Array.from({ length: 20 }, random(0))).size).toBe(20);
  });
});

describe('lathePoints', () => {
  it('passes through every control point and fills steps between them', () => {
    const points = lathePoints(CUP, 4);
    expect(points).toHaveLength((CUP.length - 1) * 4 + 1);
    CUP.forEach((p, i) => {
      expect(points[i * 4]?.r).toBeCloseTo(p.r, 9);
      expect(points[i * 4]?.y).toBeCloseTo(p.y, 9);
    });
  });

  it('never returns a negative radius', () => {
    const dip: ProfilePoint[] = [{ r: 0, y: 0 }, { r: 0.001, y: 0.02 }, { r: 0.03, y: 0.021 }];
    for (const p of lathePoints(dip, 8)) expect(p.r).toBeGreaterThanOrEqual(0);
  });

  it('returns a copy of a single point profile', () => {
    expect(lathePoints([{ r: 1, y: 2 }], 5)).toEqual([{ r: 1, y: 2 }]);
  });
});

describe('shellProfile', () => {
  const shell = shellProfile(CUP, 0.002);

  it('walks up the outside and back down the inside, closed on the axis', () => {
    expect(shell).toHaveLength(CUP.length * 2);
    expect(shell[0]).toEqual({ r: 0, y: 0 });
    expect(shell[shell.length - 1]?.r).toBe(0);
    expect(shell[shell.length - 1]?.y).toBeCloseTo(0.002, 9);
  });

  it('keeps the inner wall inside the outer wall by about the thickness', () => {
    for (let i = 0; i < CUP.length; i++) {
      const outer = shell[i] as ProfilePoint;
      const inner = shell[shell.length - 1 - i] as ProfilePoint;
      expect(inner.r).toBeLessThanOrEqual(outer.r);
      expect(inner.r).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(outer.r - inner.r, outer.y - inner.y)).toBeLessThan(0.002 * 1.5);
    }
    const midOuter = shell[2] as ProfilePoint;
    const midInner = shell[shell.length - 3] as ProfilePoint;
    expect(midOuter.r - midInner.r).toBeGreaterThan(0.0015);
  });
});

describe('noise3', () => {
  it('is deterministic and bounded', () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37;
      const v = noise3(x, x * 0.5, -x, 3);
      expect(v).toBe(noise3(x, x * 0.5, -x, 3));
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  it('is smooth: nearby points give nearby values', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.113;
      expect(Math.abs(noise3(x, 1.3, 2.1, 5) - noise3(x + 0.001, 1.3, 2.1, 5))).toBeLessThan(0.02);
    }
  });

  it('varies in space and between seeds', () => {
    const values = Array.from({ length: 50 }, (_, i) => noise3(i * 0.71, 0.2, 0.4, 1));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
    expect(noise3(0.5, 0.5, 0.5, 1)).not.toBe(noise3(0.5, 0.5, 0.5, 2));
  });
});

describe('blobDisplace', () => {
  const sphere = (): Float32Array => {
    const out: number[] = [];
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      out.push(Math.cos(t), Math.sin(t) * 0.5, Math.sin(t));
    }
    return new Float32Array(out);
  };

  it('moves each vertex radially by at most the amount', () => {
    const before = sphere();
    const after = sphere();
    blobDisplace(after, 4, 0.1, 3);
    let moved = 0;
    for (let i = 0; i < before.length; i += 3) {
      const r0 = Math.hypot(before[i] as number, before[i + 1] as number, before[i + 2] as number);
      const r1 = Math.hypot(after[i] as number, after[i + 1] as number, after[i + 2] as number);
      expect(Math.abs(r1 - r0)).toBeLessThanOrEqual(0.1 + 1e-6);
      const cross = Math.hypot(
        (before[i + 1] as number) * (after[i + 2] as number) - (before[i + 2] as number) * (after[i + 1] as number),
        (before[i + 2] as number) * (after[i] as number) - (before[i] as number) * (after[i + 2] as number),
        (before[i] as number) * (after[i + 1] as number) - (before[i + 1] as number) * (after[i] as number),
      );
      expect(cross).toBeLessThan(1e-5);
      if (Math.abs(r1 - r0) > 1e-4) moved++;
    }
    expect(moved).toBeGreaterThan(32);
  });

  it('moves duplicate seam vertices identically and is deterministic', () => {
    const a = new Float32Array([0.3, 0.2, 0.1, 0.3, 0.2, 0.1]);
    const b = new Float32Array([0.3, 0.2, 0.1, 0.3, 0.2, 0.1]);
    blobDisplace(a, 9, 0.05, 6);
    blobDisplace(b, 9, 0.05, 6);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a[0]).toBe(a[3]);
  });

  it('leaves the origin and a zero amount untouched', () => {
    const a = new Float32Array([0, 0, 0, 1, 1, 1]);
    blobDisplace(a, 1, 0, 2);
    expect(Array.from(a)).toEqual([0, 0, 0, 1, 1, 1]);
    const b = new Float32Array([0, 0, 0]);
    blobDisplace(b, 1, 0.5, 2);
    expect(Array.from(b)).toEqual([0, 0, 0]);
  });
});

describe('heapPositions', () => {
  it.each([[5, 0.02], [14, 0.025], [120, 0.022], [180, 0.024]])('places %i items deterministically, inside the heap, never too close', (count, radius) => {
    const points = heapPositions(count, radius, 11);
    expect(points).toEqual(heapPositions(count, radius, 11));
    expect(points).toHaveLength(count);
    const gap = heapSpacing(count, radius);
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      const shape = (p.x / radius) ** 2 + (p.y / (radius * HEAP_RISE)) ** 2 + (p.z / radius) ** 2;
      expect(shape).toBeLessThanOrEqual(1 + 1e-9);
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i] as HeapPoint;
        const b = points[j] as HeapPoint;
        expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThanOrEqual(gap);
      }
    }
  });

  it('changes with the seed', () => {
    expect(heapPositions(10, 0.02, 1)).not.toEqual(heapPositions(10, 0.02, 2));
  });

  it('returns nothing for a zero count', () => {
    expect(heapPositions(0, 0.02, 1)).toEqual([]);
  });
});
