import { describe, expect, it } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import type { Nutrients } from '@/engine/types';
import {
  CHEW_START,
  burstTimes,
  chewPulse,
  drain4hLevel,
  drainLevel,
  drainRate,
  intakePath,
  mouthSqueeze,
  pourIn,
  pulseCount,
  pulseTimes,
  ringPositions,
  sipPath,
  sipSettle,
  sipSqueeze,
  surgeProgress,
} from '@/scene/beats/bodyMotion';
import type { IntakePose } from '@/scene/beats/types';

const STEPS = 400;
const samples = (): number[] => Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);
const totals = (over: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...over });

const expectMonotone = (values: number[], direction: 1 | -1): void => {
  for (let i = 1; i < values.length; i++) expect(direction * ((values[i] as number) - (values[i - 1] as number))).toBeGreaterThanOrEqual(-1e-12);
};
const expectContinuous = (values: number[], maxJump: number): void => {
  for (let i = 1; i < values.length; i++) expect(Math.abs((values[i] as number) - (values[i - 1] as number))).toBeLessThan(maxJump);
};
const expectBounded = (values: number[]): void => {
  for (const v of values) {
    expect(Number.isNaN(v)).toBe(false);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
};

describe('intakePath', () => {
  const pose = (p: number): IntakePose => intakePath(p, { travel: 0, scale: 0, tilt: 1 });

  it('floats the dish from in front of the face to the mouth, then bites it away before the chew starts', () => {
    expect(pose(0)).toEqual({ travel: 0, scale: 1, tilt: 0 });
    expect(pose(0.15).travel).toBeGreaterThan(0.2);
    expect(pose(0.15).travel).toBeLessThan(0.9);
    expect(pose(0.15).scale).toBe(1);
    expect(pose(CHEW_START)).toEqual({ travel: 1, scale: 0, tilt: 0 });
    expect(pose(1)).toEqual({ travel: 1, scale: 0, tilt: 0 });
  });

  it('eases in and out, never moves backwards and shrinks in three bites', () => {
    const travel = samples().map((p) => pose(p).travel);
    const scale = samples().map((p) => pose(p).scale);
    expectBounded(travel);
    expectBounded(scale);
    expectMonotone(travel, 1);
    expectMonotone(scale, -1);
    expectContinuous(travel, 0.05);
    expectContinuous(scale, 0.12);
    expect(travel[1] as number).toBeLessThan(0.001);
    const plateaus = new Set(scale.map((s) => Math.round(s * 1000) / 1000).filter((s) => s > 0 && s < 1));
    expect([...plateaus].some((s) => Math.abs(s - 2 / 3) < 1e-3)).toBe(true);
    expect([...plateaus].some((s) => Math.abs(s - 1 / 3) < 1e-3)).toBe(true);
  });

  it('never tilts a bitten dish', () => {
    for (const p of samples()) expect(pose(p).tilt).toBe(0);
  });

  it('only bites once the dish has arrived', () => {
    for (const p of samples()) {
      const { travel, scale } = pose(p);
      if (scale < 1) expect(travel).toBe(1);
    }
  });
});

describe('sipPath (drinks)', () => {
  const pose = (p: number): IntakePose => sipPath(p, { travel: 0, scale: 0, tilt: 0 });

  it('floats the cup to the mouth on the same path as a dish, tilts it to the lips, then takes it away before the swallow', () => {
    for (const p of samples()) expect(pose(p).travel).toBe(intakePath(p, { travel: 0, scale: 0, tilt: 0 }).travel);
    expect(pose(0)).toEqual({ travel: 0, scale: 1, tilt: 0 });
    expect(pose(0.2).tilt).toBe(0);
    expect(pose(0.3).tilt).toBeGreaterThan(0.5);
    expect(pose(0.3).scale).toBe(1);
    expect(pose(CHEW_START)).toEqual({ travel: 1, scale: 0, tilt: 1 });
  });

  it('tilts only after arriving, never bites in steps, and is continuous and monotone', () => {
    const tilt = samples().map((p) => pose(p).tilt);
    const scale = samples().map((p) => pose(p).scale);
    expectBounded(tilt);
    expectMonotone(tilt, 1);
    expectMonotone(scale, -1);
    expectContinuous(tilt, 0.12);
    for (const p of samples()) if (pose(p).tilt > 0) expect(pose(p).travel).toBe(1);
    const plateaus = new Set(scale.map((s) => Math.round(s * 1000) / 1000).filter((s) => s > 0 && s < 1));
    expect([...plateaus].some((s) => Math.abs(s - 2 / 3) < 1e-3)).toBe(false);
  });

  it('pours the liquid in while the cup tilts, settles it gently and swallows once', () => {
    expect(pourIn(0.2)).toBe(0);
    expect(pourIn(CHEW_START)).toBe(1);
    expectMonotone(samples().map(pourIn), 1);
    expect(sipSettle(CHEW_START)).toBe(0);
    expect(sipSettle(0.95)).toBe(1);
    const squeeze = samples().map(sipSqueeze);
    expect(Math.max(...squeeze)).toBeLessThanOrEqual(0.5);
    expect(Math.max(...samples().map(mouthSqueeze))).toBeGreaterThan(0.9);
    const peaks = squeeze.filter((v, i) => i > 0 && v > (squeeze[i - 1] as number) && v >= (squeeze[i + 1] ?? 0)).length;
    expect(peaks).toBe(1);
    for (const p of samples()) if (p < 0.7) expect(sipSqueeze(p)).toBe(0);
  });
});

describe('chewPulse', () => {
  it('stays scattered during the intake, compacts in three presses and holds at one', () => {
    const c = samples().map(chewPulse);
    expectBounded(c);
    expectMonotone(c, 1);
    expectContinuous(c, 0.05);
    expect(chewPulse(0)).toBe(0);
    expect(chewPulse(CHEW_START)).toBe(0);
    expect(chewPulse(0.9)).toBe(1);
    expect(chewPulse(1)).toBe(1);
    const plateaus = new Set(c.map((v) => Math.round(v * 1000) / 1000));
    expect(plateaus.has(0.333)).toBe(true);
    expect(plateaus.has(0.667)).toBe(true);
  });
});

describe('mouthSqueeze', () => {
  it('bumps once per bite and once per press, resting at zero between and after', () => {
    const s = samples().map(mouthSqueeze);
    expectBounded(s);
    expectContinuous(s, 0.3);
    let bumps = 0;
    for (let i = 1; i < s.length; i++) if ((s[i - 1] as number) === 0 && (s[i] as number) > 0) bumps += 1;
    expect(bumps).toBe(6);
    expect(Math.max(...s)).toBeGreaterThan(0.95);
    expect(mouthSqueeze(0)).toBe(0);
    expect(mouthSqueeze(0.95)).toBe(0);
    expect(mouthSqueeze(1)).toBe(0);
  });
});

describe('ringPositions and surgeProgress', () => {
  const RINGS = 3;
  const rings = (p: number): number[] => ringPositions(p, RINGS, [0, 0, 0]).slice();

  it('fills the given array with each ring from the top (0) to the bottom (1), the first ring in front', () => {
    const out = [9, 9, 9];
    expect(ringPositions(0.5, RINGS, out)).toBe(out);
    for (const p of samples()) {
      const r = rings(p);
      expectBounded(r);
      expect(r[0] as number).toBeGreaterThanOrEqual(r[1] as number);
      expect(r[1] as number).toBeGreaterThanOrEqual(r[2] as number);
    }
    expect(rings(0)).toEqual([0, 0, 0]);
    expect(rings(0.9)).toEqual([1, 1, 1]);
    const mid = rings(0.5);
    expect(new Set(mid).size).toBe(3);
  });

  it('moves every ring steadily down, finishing by 0.9', () => {
    for (let i = 0; i < RINGS; i++) {
      const track = samples().map((p) => rings(p)[i] as number);
      expectMonotone(track, 1);
      expectContinuous(track, 0.02);
    }
  });

  it('carries the ball down from top to bottom, never ahead of the front ring and always ahead of the second', () => {
    const s = samples().map((p) => surgeProgress(p, RINGS));
    expectBounded(s);
    expectMonotone(s, 1);
    expectContinuous(s, 0.02);
    expect(surgeProgress(0, RINGS)).toBe(0);
    expect(surgeProgress(0.9, RINGS)).toBe(1);
    for (const p of samples()) {
      const ball = surgeProgress(p, RINGS);
      const [front, second] = rings(p) as [number, number];
      if (front > 0 && front < 1) expect(ball).toBeLessThan(front);
      if (front > 0.2 && front < 1) expect(front - ball).toBeLessThan(0.12);
      if (ball > 0 && second < 1) expect(ball).toBeGreaterThan(second);
    }
  });

  it('surges: the ball speeds up and slows down several times on the way', () => {
    const speeds = samples().slice(1).map((p, i) => surgeProgress(p, RINGS) - surgeProgress(i / STEPS, RINGS));
    let surges = 0;
    for (let i = 1; i < speeds.length - 1; i++) {
      const v = speeds[i] as number;
      if (v > (speeds[i - 1] as number) && v >= (speeds[i + 1] as number) && v > 0) surges += 1;
    }
    expect(surges).toBeGreaterThanOrEqual(3);
  });
});

describe('drainRate', () => {
  it('drains a carbohydrate-only plate fastest and a fatty plate slowest, within bounds', () => {
    const rice = drainRate(totals({ starch: 60 }));
    const samosa = drainRate(totals({ starch: 28, protein: 4.6, fat: 15 }));
    const fatty = drainRate(totals({ fat: 40 }));
    expect(rice).toBe(1);
    expect(samosa).toBeLessThan(rice);
    expect(fatty).toBeLessThanOrEqual(samosa);
    for (const r of [rice, samosa, fatty]) {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('treats a plate with no energy (coffee, water) as quick and never returns NaN', () => {
    expect(drainRate(totals({ caffeine: 80 }))).toBe(1);
    expect(drainRate(totals({ fat: Number.NaN }))).toBe(1);
  });

  it('is deterministic', () => {
    const t = totals({ starch: 20, fat: 7, protein: 9 });
    expect(drainRate(t)).toBe(drainRate(t));
  });
});

describe('drainLevel and drain4hLevel', () => {
  it('falls from full, faster for a quicker rate, and holds after 0.9', () => {
    for (const rate of [drainRate(totals({ fat: 40 })), 0.6, 1]) {
      const level = samples().map((p) => drainLevel(p, rate));
      expectBounded(level);
      expectMonotone(level, -1);
      expectContinuous(level, 0.02);
      expect(drainLevel(0, rate)).toBe(1);
      expect(drainLevel(0.9, rate)).toBe(drainLevel(1, rate));
    }
    expect(drainLevel(1, 1)).toBeLessThan(drainLevel(1, drainRate(totals({ fat: 40 }))) - 0.3);
    expect(drainLevel(0.5, 1)).toBeLessThan(drainLevel(0.5, 0.5));
    expect(Number.isNaN(drainLevel(0.5, Number.NaN))).toBe(false);
  });

  it('empties the stomach steadily to almost nothing over the four hours', () => {
    const level = samples().map((p) => drain4hLevel(p));
    expectBounded(level);
    expectMonotone(level, -1);
    expectContinuous(level, 0.01);
    expect(drain4hLevel(0)).toBe(1);
    expect(drain4hLevel(0.9)).toBeLessThan(0.12);
    expect(drain4hLevel(0.9)).toBeGreaterThan(0);
    expect(drain4hLevel(1)).toBe(drain4hLevel(0.9));
  });

  it('carries on from where the emptying-order beat left the level, for fatty, carbohydrate-only and mixed plates', () => {
    for (const plate of [{ fat: 40 }, { starch: 60 }, { starch: 28, protein: 4.6, fat: 15 }, { starch: 20, protein: 12, fat: 6 }]) {
      const end = drainLevel(1, drainRate(totals(plate)));
      expect(drain4hLevel(0, end)).toBe(end);
      const level = samples().map((p) => drain4hLevel(p, end));
      expectBounded(level);
      expectMonotone(level, -1);
      expectContinuous(level, 0.01);
      expect(drain4hLevel(0.9, end)).toBeLessThan(0.12);
      expect(drain4hLevel(1, end)).toBeCloseTo(drain4hLevel(1), 12);
    }
    expect(drain4hLevel(0.5, Number.NaN)).toBe(drain4hLevel(0.5));
    expect(drain4hLevel(0.5, 7)).toBe(drain4hLevel(0.5));
    expect(drain4hLevel(0.5, -1)).toBeCloseTo(drain4hLevel(1), 12);
    expect(drain4hLevel(0.5, Number.POSITIVE_INFINITY)).toBe(drain4hLevel(0.5));
    expect(drain4hLevel(0.5, Number.NEGATIVE_INFINITY)).toBeCloseTo(drain4hLevel(1), 12);
  });
});

describe('pulseCount, pulseTimes and burstTimes', () => {
  it('sends more pulses through the pylorus for quicker plates, 3 to 5', () => {
    expect(pulseCount(1)).toBe(5);
    expect(pulseCount(0)).toBe(3);
    expect(pulseCount(Number.NaN)).toBe(3);
    expect(pulseCount(0.6)).toBeGreaterThanOrEqual(3);
    expect(pulseCount(0.6)).toBeLessThanOrEqual(5);
  });

  it.each([
    ['pulseTimes', pulseTimes, 5],
    ['pulseTimes', pulseTimes, 3],
    ['burstTimes', burstTimes, 3],
  ] as const)('%s(%i): each event runs 0..1 in order, one after another, all done by 0.9', (_name, times, count) => {
    const out = new Array<number>(count).fill(0);
    expect(times(0.5, count, out)).toBe(out);
    const tracks = Array.from({ length: count }, (_, k) => samples().map((p) => times(p, count, out)[k] as number));
    for (const track of tracks) {
      expectBounded(track);
      expectMonotone(track, 1);
      expectContinuous(track, 0.05);
      expect(track[0]).toBe(0);
    }
    for (const p of samples()) {
      const t = times(p, count, out).slice();
      for (let k = 1; k < count; k++) expect(t[k] as number).toBeLessThanOrEqual(t[k - 1] as number);
    }
    expect(times(0.9, count, out).every((v) => v === 1)).toBe(true);
    const starts = tracks.map((track) => track.findIndex((v) => v > 0));
    for (let k = 1; k < count; k++) expect(starts[k] as number).toBeGreaterThan(starts[k - 1] as number);
  });
});
