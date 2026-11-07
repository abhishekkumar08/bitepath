import { describe, expect, it } from 'vitest';
import {
  BEAD_PACE,
  DRIFT_SPEED,
  HERO_REACH,
  LUMEN_LEAD,
  LUMEN_Y,
  LYMPH_Y,
  LYMPH_Z,
  SWAY_AMPLITUDE,
  VEIN_RUN,
  VEIN_Y,
  VEIN_Z,
  VILLI_PER_ROW,
  VILLUS_HEIGHT,
  absorbPath,
  beadPresence,
  beadSchedule,
  frontRowX,
  heroColumns,
  lactealPath,
  paceStarts,
  passHeight,
  swayAt,
  veinExit,
} from '@/scene/lens/motion';
import type { MotionPoint } from '@/scene/lens/types';

const point = (): MotionPoint => ({ x: 0, y: 0, z: 0 });
const LANES = [0, 0.13, 0.37, 0.5, 0.71, 0.99];
const STEPS = 200;
const expectSame = (a: MotionPoint, b: MotionPoint): void => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
  expect(a.z).toBeCloseTo(b.z, 9);
};

describe('swayAt', () => {
  it('stays within the sway amplitude', () => {
    for (let i = 0; i < 60; i++) {
      for (let t = 0; t < 30; t += 0.37) expect(Math.abs(swayAt(t, i))).toBeLessThanOrEqual(SWAY_AMPLITUDE);
    }
  });

  it('gives neighbouring villi different phases', () => {
    expect(swayAt(1.2, 0)).not.toBeCloseTo(swayAt(1.2, 1), 3);
    expect(swayAt(1.2, 1)).not.toBeCloseTo(swayAt(1.2, 2), 3);
  });

  it('moves over time', () => {
    expect(swayAt(0, 3)).not.toBeCloseTo(swayAt(0.5, 3), 3);
  });
});

describe.each([
  ['absorbPath', absorbPath, VEIN_Y, VEIN_Z],
  ['lactealPath', lactealPath, LYMPH_Y, LYMPH_Z],
] as const)('%s', (_name, path, endY, endZ) => {
  it('starts in the lumen above the tip and ends in its vessel under the wall', () => {
    for (const lane of LANES) {
      const start = path(0, lane, point());
      expect(start.y).toBeGreaterThan(VILLUS_HEIGHT);
      expect(start.y).toBeLessThanOrEqual(LUMEN_Y + 0.2);
      const end = path(1, lane, point());
      expect(end.x).toBeCloseTo(0, 6);
      expect(end.y).toBeCloseTo(endY, 6);
      expect(end.z).toBeCloseTo(endZ, 6);
    }
  });

  it('passes through the villus tip', () => {
    for (const lane of LANES) {
      let passed = false;
      for (let s = 0; s <= STEPS; s++) {
        const p = path(s / STEPS, lane, point());
        if (Math.abs(p.y - VILLUS_HEIGHT) < 0.02 && Math.hypot(p.x, p.z) < 0.03) passed = true;
      }
      expect(passed).toBe(true);
    }
  });

  it('only ever goes deeper and never jumps', () => {
    for (const lane of LANES) {
      const prev = path(0, lane, point());
      const next = point();
      for (let s = 1; s <= STEPS; s++) {
        path(s / STEPS, lane, next);
        expect(next.y).toBeLessThan(prev.y);
        expect(Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z)).toBeLessThan(0.05);
        expect(Number.isFinite(next.x + next.y + next.z)).toBe(true);
        Object.assign(prev, next);
      }
    }
  });

  it('clamps u outside 0..1', () => {
    expectSame(path(-1, 0.3, point()), path(0, 0.3, point()));
    expectSame(path(2, 0.3, point()), path(1, 0.3, point()));
  });
});

describe('veinExit', () => {
  it('continues from the end of the capillary along the vein', () => {
    expectSame(veinExit(0, point()), absorbPath(1, 0.4, point()));
    const end = veinExit(1, point());
    expect(end.x).toBeCloseTo(VEIN_RUN, 6);
    expect(end.y).toBeCloseTo(VEIN_Y, 6);
  });

  it('runs the lymph vessel when given its depth', () => {
    expectSame(veinExit(0, point(), LYMPH_Y, LYMPH_Z), lactealPath(1, 0.4, point()));
  });
});

describe('beadSchedule', () => {
  const crossing = (count: number, fraction: number): number => beadSchedule(count, fraction, 7).filter((b) => b.crosses).length;

  it('crosses exactly the requested fraction', () => {
    expect(crossing(24, 0)).toBe(0);
    expect(crossing(24, 1)).toBe(24);
    expect(crossing(24, 0.25)).toBe(6);
    expect(crossing(40, 0.3)).toBe(12);
    expect(crossing(7, 1)).toBe(7);
  });

  it('is deterministic for a seed and varies with the seed', () => {
    expect(beadSchedule(30, 0.4, 3)).toEqual(beadSchedule(30, 0.4, 3));
    expect(beadSchedule(30, 0.4, 3)).not.toEqual(beadSchedule(30, 0.4, 4));
  });

  it('spreads starts over 0..1 in order', () => {
    const slots = beadSchedule(40, 1, 11);
    expect(slots).toHaveLength(40);
    for (let i = 0; i < slots.length; i++) {
      expect(slots[i].start).toBeGreaterThanOrEqual(0);
      expect(slots[i].start).toBeLessThan(1);
      if (i > 0) expect(slots[i].start).toBeGreaterThan(slots[i - 1].start);
    }
  });

  it('is safe for a zero, negative or broken count or fraction', () => {
    expect(beadSchedule(0, 1, 1)).toEqual([]);
    expect(beadSchedule(-3, 1, 1)).toEqual([]);
    expect(beadSchedule(Number.NaN, 1, 1)).toEqual([]);
    const slots = beadSchedule(10, Number.NaN, 1);
    expect(slots).toHaveLength(10);
    expect(slots.every((b) => !b.crosses && Number.isFinite(b.start))).toBe(true);
    expect(crossing(10, 5)).toBe(10);
  });
});

describe.each([
  ['steady flagship', BEAD_PACE.steady, 40, 1],
  ['steady partial', BEAD_PACE.steady, 24, 0.25],
  ['fast', BEAD_PACE.fast, 24, 1],
] as const)('bead flow (%s)', (_name, pace, count, fraction) => {
  const slots = paceStarts(count, fraction, 17, pace.span);
  const visibleAt = (p: number): number => slots.filter((s) => beadPresence(p - s.start, pace.cross, pace.exit, true) > 0).length;
  const windows = Array.from({ length: 10 }, (_, w) => {
    let sum = 0;
    for (let k = 0; k < 10; k++) sum += visibleAt(w / 10 + k / 100);
    return sum / 10;
  });

  it('keeps the last bead crossing until near the end of the beat', () => {
    const last = slots[slots.length - 1].start;
    expect(last + pace.cross + pace.exit).toBeGreaterThanOrEqual(0.9);
    expect(last + pace.cross).toBeLessThanOrEqual(1);
  });

  it('keeps a steady flow instead of a burst that thins out', () => {
    const peak = Math.max(...windows);
    for (let w = 0; w < 9; w++) expect(windows[w]).toBeGreaterThanOrEqual(0.25 * peak);
  });
});

describe('beadPresence', () => {
  it('fades in only near the start and out after the vessel run', () => {
    expect(beadPresence(-LUMEN_LEAD - 0.01, 0.1, 0.1, true)).toBe(0);
    expect(beadPresence(-LUMEN_LEAD + 0.01, 0.1, 0.1, true)).toBeGreaterThan(0);
    expect(beadPresence(0.1, 0.1, 0.1, true)).toBe(1);
    expect(beadPresence(0.21, 0.1, 0.1, true)).toBe(0);
    expect(beadPresence(5, 0.1, 0.1, false)).toBe(1);
  });
});

describe('passHeight', () => {
  it('touches the tip at the pass, lifts off after it and settles in the lumen', () => {
    expect(passHeight(0)).toBeCloseTo(0, 9);
    expect(passHeight(-1)).toBeCloseTo(1, 6);
    expect(passHeight(3)).toBeCloseTo(1, 3);
    expect(Math.max(passHeight(0.08), passHeight(0.12), passHeight(0.16))).toBeGreaterThan(1.3);
    for (let s = -0.5; s < 0.5; s += 0.005) {
      expect(Number.isFinite(passHeight(s))).toBe(true);
      expect(Math.abs(passHeight(s + 0.005) - passHeight(s))).toBeLessThan(0.2);
      expect(passHeight(s)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('hero villi', () => {
  it('are the six front-row villi nearest the middle, mirrored about it', () => {
    const columns = heroColumns();
    expect(columns).toHaveLength(6);
    const xs = columns.map(frontRowX);
    for (const x of xs) expect(Math.abs(x)).toBeLessThanOrEqual(HERO_REACH);
    expect(xs.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9);
    const outside = Array.from({ length: VILLI_PER_ROW }, (_, c) => c).filter((c) => !columns.includes(c));
    for (const c of outside) expect(Math.abs(frontRowX(c))).toBeGreaterThan(HERO_REACH);
  });
});

describe('lumen lead', () => {
  it('never starts a bead farther from its villus than the hero reach', () => {
    expect(LUMEN_LEAD * DRIFT_SPEED).toBeLessThanOrEqual(HERO_REACH);
  });
});
