import { describe, expect, it } from 'vitest';
import {
  BROKEN_FRACTION,
  CAPILLARY_RADIUS,
  CAPILLARY_Y,
  CAPILLARY_Z,
  CELL_PITCH,
  CROSS_FRACTION,
  ENZYME,
  ENZYME_KEEP_OUT,
  MUCUS_TOP,
  WALL_BOTTOM,
  WALL_TOP,
  capillaryDrift,
  enzymePath,
  fragmentAt,
  lumenHome,
  seepSchedule,
  squeezeAt,
  wallCrossPath,
} from '@/scene/lens/liningMotion';
import type { MotionPoint } from '@/scene/lens/types';

const point = (): MotionPoint => ({ x: 0, y: 0, z: 0 });
const LANES = [0, 0.13, 0.37, 0.5, 0.71, 0.99];
const STEPS = 200;
const expectSame = (a: MotionPoint, b: MotionPoint): void => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
  expect(a.z).toBeCloseTo(b.z, 9);
};

describe('lumenHome', () => {
  it('sits in the lumen above the mucus', () => {
    for (const lane of LANES) expect(lumenHome(lane, point()).y).toBeGreaterThan(MUCUS_TOP + 0.1);
  });

  it('keeps clear of the enzyme so waiting beads never look eaten', () => {
    for (let k = 0; k <= STEPS; k++) {
      const home = lumenHome(k / STEPS, point());
      expect(Math.hypot(home.x - ENZYME.x, home.y - ENZYME.y)).toBeGreaterThanOrEqual(ENZYME_KEEP_OUT - 1e-9);
    }
  });

  it('spreads different lanes apart', () => {
    const a = lumenHome(0.13, point());
    const b = lumenHome(0.37, point());
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.1);
  });
});

describe('wallCrossPath', () => {
  it('starts at the lumen home and ends inside the capillary', () => {
    for (const lane of LANES) {
      expectSame(wallCrossPath(0, lane, point()), lumenHome(lane, point()));
      const end = wallCrossPath(1, lane, point());
      expect(end.y).toBeCloseTo(CAPILLARY_Y, 6);
      expect(end.z).toBeCloseTo(CAPILLARY_Z, 6);
    }
  });

  it('passes between cells, never through one', () => {
    for (const lane of LANES) {
      for (let s = 0; s <= STEPS; s++) {
        const p = wallCrossPath(s / STEPS, lane, point());
        if (p.y > WALL_TOP || p.y < CAPILLARY_Y + 0.1) continue;
        const offset = p.x / CELL_PITCH - 0.5;
        expect(Math.abs(offset - Math.round(offset))).toBeLessThan(1e-6);
      }
    }
  });

  it('only ever goes deeper and never jumps', () => {
    for (const lane of LANES) {
      const prev = wallCrossPath(0, lane, point());
      const next = point();
      for (let s = 1; s <= STEPS; s++) {
        wallCrossPath(s / STEPS, lane, next);
        expect(next.y).toBeLessThanOrEqual(prev.y);
        expect(Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z)).toBeLessThan(0.05);
        expect(Number.isFinite(next.x + next.y + next.z)).toBe(true);
        Object.assign(prev, next);
      }
    }
  });

  it('clamps u outside 0..1', () => {
    expectSame(wallCrossPath(-1, 0.3, point()), wallCrossPath(0, 0.3, point()));
    expectSame(wallCrossPath(2, 0.3, point()), wallCrossPath(1, 0.3, point()));
  });
});

describe('capillaryDrift', () => {
  it('continues from the end of the crossing along the capillary', () => {
    for (const lane of LANES) {
      expectSame(capillaryDrift(0, lane, point()), wallCrossPath(1, lane, point()));
      expect(capillaryDrift(0.5, lane, point()).x).toBeGreaterThan(wallCrossPath(1, lane, point()).x);
    }
  });

  it('stays inside the vessel without jumps', () => {
    for (const lane of LANES) {
      const prev = capillaryDrift(0, lane, point());
      const next = point();
      for (let s = 1; s <= STEPS; s++) {
        capillaryDrift(s / STEPS, lane, next);
        expect(Math.hypot(next.y - CAPILLARY_Y, next.z - CAPILLARY_Z)).toBeLessThanOrEqual(CAPILLARY_RADIUS - 0.04);
        expect(Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z)).toBeLessThan(0.05);
        Object.assign(prev, next);
      }
    }
  });

  it('spreads beads of different lanes apart inside the vessel', () => {
    const a = capillaryDrift(0.5, 0.13, point());
    const b = capillaryDrift(0.5, 0.37, point());
    expect(Math.hypot(a.y - b.y, a.z - b.z)).toBeGreaterThan(0.01);
  });
});

describe('squeezeAt', () => {
  it('is 0 in the lumen and the capillary, 1 inside the wall, and changes smoothly', () => {
    expect(squeezeAt(MUCUS_TOP + 0.2)).toBe(0);
    expect(squeezeAt(CAPILLARY_Y)).toBe(0);
    expect(squeezeAt((WALL_TOP + WALL_BOTTOM) / 2)).toBe(1);
    for (let y = CAPILLARY_Y; y < MUCUS_TOP + 0.2; y += 0.002) expect(Math.abs(squeezeAt(y + 0.002) - squeezeAt(y))).toBeLessThan(0.06);
  });
});

describe('enzymePath', () => {
  it('runs from the lumen home to the enzyme without jumps', () => {
    for (const lane of LANES) {
      expectSame(enzymePath(0, lane, point()), lumenHome(lane, point()));
      expectSame(enzymePath(1, lane, point()), { x: ENZYME.x, y: ENZYME.y, z: ENZYME.z });
      const prev = enzymePath(0, lane, point());
      const next = point();
      for (let s = 1; s <= STEPS; s++) {
        enzymePath(s / STEPS, lane, next);
        expect(Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z)).toBeLessThan(0.05);
        Object.assign(prev, next);
      }
    }
  });
});

describe('fragmentAt', () => {
  it('starts at the enzyme and scatters the bits apart', () => {
    for (let k = 0; k < 3; k++) expectSame(fragmentAt(0, k, 0.4, point()), { x: ENZYME.x, y: ENZYME.y, z: ENZYME.z });
    const a = fragmentAt(1, 0, 0.4, point());
    const b = fragmentAt(1, 1, 0.4, point());
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.1);
    expect(Number.isFinite(a.x + a.y + a.z)).toBe(true);
  });
});

describe('seepSchedule', () => {
  const tally = (count: number, cross: number, broken: number, seed = 7): Record<string, number> => {
    const out: Record<string, number> = { cross: 0, broken: 0, stay: 0 };
    for (const slot of seepSchedule(count, cross, broken, seed)) out[slot.outcome]++;
    return out;
  };

  it('gives exact counts for the requested fractions', () => {
    expect(tally(24, 0.25, 0.25)).toEqual({ cross: 6, broken: 6, stay: 12 });
    expect(tally(40, 0.25, 0.1)).toEqual({ cross: 10, broken: 4, stay: 26 });
    expect(tally(10, 0, 0)).toEqual({ cross: 0, broken: 0, stay: 10 });
    expect(tally(10, 0.5, 0.8)).toEqual({ cross: 5, broken: 5, stay: 0 });
  });

  it('ships fractions true to the captions: a minority crosses, women break down about a quarter as much', () => {
    for (const count of [12, 26, 40]) {
      const male = tally(count, CROSS_FRACTION.male, BROKEN_FRACTION.male, 5);
      const female = tally(count, CROSS_FRACTION.female, BROKEN_FRACTION.female, 5);
      expect(female.broken).toBeGreaterThan(0);
      expect(female.broken).toBeLessThanOrEqual(0.35 * male.broken);
      expect(female.cross).toBeGreaterThanOrEqual(male.cross);
      expect(male.cross).toBeLessThan(count / 2);
      expect(female.cross).toBeLessThan(count / 2);
    }
    expect(CROSS_FRACTION.male).toBeLessThan(0.5);
    expect(CROSS_FRACTION.female).toBeLessThan(0.5);
  });

  it('is deterministic for a seed and varies with the seed', () => {
    expect(seepSchedule(30, 0.25, 0.2, 3)).toEqual(seepSchedule(30, 0.25, 0.2, 3));
    expect(seepSchedule(30, 0.25, 0.2, 3)).not.toEqual(seepSchedule(30, 0.25, 0.2, 4));
  });

  it('spreads starts over 0..0.8 in order and lets the last bead act', () => {
    const slots = seepSchedule(40, 0.25, 0.25, 11);
    for (let i = 0; i < slots.length; i++) {
      expect(slots[i].start).toBeGreaterThanOrEqual(0);
      expect(slots[i].start).toBeLessThanOrEqual(0.8);
      if (i > 0) expect(slots[i].start).toBeGreaterThan(slots[i - 1].start);
    }
    const acting = slots.filter((s) => s.outcome !== 'stay');
    expect(acting[acting.length - 1].start).toBeGreaterThan(0.7);
  });

  it('is safe for a zero, negative or broken count or fraction', () => {
    expect(seepSchedule(0, 0.25, 0.25, 1)).toEqual([]);
    expect(seepSchedule(-3, 0.25, 0.25, 1)).toEqual([]);
    expect(seepSchedule(Number.NaN, 0.25, 0.25, 1)).toEqual([]);
    const slots = seepSchedule(10, Number.NaN, Number.NaN, 1);
    expect(slots).toHaveLength(10);
    expect(slots.every((s) => s.outcome === 'stay' && Number.isFinite(s.start))).toBe(true);
    expect(tally(10, 5, 5)).toEqual({ cross: 10, broken: 0, stay: 0 });
  });
});
