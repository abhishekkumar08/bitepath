import { describe, expect, it } from 'vitest';
import {
  FEED_FLOOR,
  LAST_EVENT,
  bileFall,
  blobRadius,
  dropletOffset,
  emulsifyCounts,
  feedProgress,
  glowEmitAt,
  glowParticle,
  splitCount,
  splitWindow,
  swarmJoin,
  swarmLeave,
  wander,
} from '@/scene/lens/microMotion';
import type { MotionPoint } from '@/scene/lens/types';

const point = (): MotionPoint => ({ x: 0, y: 0, z: 0 });
const STEPS = 1000;
const steps = (from = 0, to = 1): number[] => Array.from({ length: STEPS + 1 }, (_, k) => from + ((to - from) * k) / STEPS);
const finite = (p: MotionPoint): boolean => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const length = (p: MotionPoint): number => Math.hypot(p.x, p.y, p.z);
const gap = (a: MotionPoint, b: MotionPoint): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('emulsifyCounts', () => {
  it('uses two or three blobs and more droplets for more fat, within caps', () => {
    let last = 0;
    for (const fat of [1, 5, 10, 20, 40, 80, 500]) {
      const { blobs, droplets } = emulsifyCounts(fat);
      expect([2, 3]).toContain(blobs);
      expect(droplets).toBeGreaterThanOrEqual(last);
      expect(droplets).toBeGreaterThanOrEqual(20);
      expect(droplets).toBeLessThanOrEqual(40);
      last = droplets;
    }
    expect(emulsifyCounts(2).blobs).toBe(2);
    expect(emulsifyCounts(30).blobs).toBe(3);
  });

  it('treats missing or broken amounts as the minimum', () => {
    expect(emulsifyCounts(Number.NaN)).toEqual(emulsifyCounts(0));
    expect(emulsifyCounts(-4)).toEqual(emulsifyCounts(0));
  });
});

describe('splitCount', () => {
  it('rises one piece at a time from 1 to max', () => {
    for (const max of [1, 2, 7, 24, 36]) {
      let last = 1;
      for (const u of steps()) {
        const n = splitCount(u, max);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(last);
        expect(n - last).toBeLessThanOrEqual(1);
        last = n;
      }
      expect(splitCount(0, max)).toBe(1);
      expect(splitCount(1, max)).toBe(max);
      expect(splitCount(5, max)).toBe(max);
    }
  });

  it('is safe for zero, negative or broken input', () => {
    expect(splitCount(0.5, 0)).toBe(0);
    expect(splitCount(0.5, -3)).toBe(0);
    expect(splitCount(Number.NaN, 10)).toBe(1);
    expect(splitCount(0.5, Number.NaN)).toBe(0);
  });
});

describe('splitWindow', () => {
  it('starts every blob whole and finishes every split by the last event', () => {
    for (const blobs of [2, 3]) {
      for (let b = 0; b < blobs; b++) {
        expect(splitWindow(b, blobs, 0)).toBe(0);
        expect(splitWindow(b, blobs, LAST_EVENT)).toBe(1);
        let last = 0;
        for (const p of steps()) {
          const u = splitWindow(b, blobs, p);
          expect(u).toBeGreaterThanOrEqual(last);
          last = u;
        }
      }
    }
    expect(LAST_EVENT).toBeLessThanOrEqual(0.9);
  });

  it('staggers the blobs so they do not split in unison', () => {
    expect(splitWindow(0, 3, 0.3)).toBeGreaterThan(splitWindow(2, 3, 0.3));
  });
});

describe('blobRadius', () => {
  it('shrinks smoothly from full size to nothing', () => {
    expect(blobRadius(0)).toBe(1);
    expect(blobRadius(1)).toBe(0);
    let last = 1;
    for (const u of steps()) {
      const r = blobRadius(u);
      expect(r).toBeLessThanOrEqual(last);
      expect(last - r).toBeLessThan(0.1);
      last = r;
    }
    expect(blobRadius(Number.NaN)).toBe(1);
  });
});

describe('dropletOffset', () => {
  it('stays at the centre until the droplet buds off, then spreads out and stays bounded', () => {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const prev = point();
      const out = point();
      let moved = false;
      for (const u of steps()) {
        dropletOffset(i, count, u, out);
        expect(finite(out)).toBe(true);
        expect(length(out)).toBeLessThanOrEqual(1 + 1e-9);
        if (u > 0) expect(gap(out, prev)).toBeLessThan(0.05);
        if (u < (i + 1) / count - 1e-9) expect(length(out)).toBe(0);
        if (length(out) > 0) moved = true;
        Object.assign(prev, out);
      }
      if (i < count - 1) expect(moved).toBe(true);
    }
  });

  it('sends droplets in different directions', () => {
    const a = dropletOffset(0, 10, 1, point());
    const b = dropletOffset(1, 10, 1, point());
    expect(gap(a, b)).toBeGreaterThan(0.1);
  });

  it('is deterministic and safe for a zero count', () => {
    expect(dropletOffset(3, 12, 0.7, point())).toEqual(dropletOffset(3, 12, 0.7, point()));
    expect(dropletOffset(0, 0, 0.7, point())).toEqual(point());
    expect(finite(dropletOffset(2, 8, Number.NaN, point()))).toBe(true);
  });
});

describe('bileFall', () => {
  it('falls from above and lands by the middle of the beat, continuously', () => {
    const count = 30;
    for (let k = 0; k < count; k++) {
      const prev = point();
      const out = point();
      let landedAt = Infinity;
      for (const p of steps()) {
        const landed = bileFall(k, count, p, out);
        expect(finite(out)).toBe(true);
        expect(landed).toBeGreaterThanOrEqual(0);
        expect(landed).toBeLessThanOrEqual(1);
        expect(out.y).toBeGreaterThanOrEqual(-1e-9);
        if (p > 0) expect(gap(out, prev)).toBeLessThan(0.05);
        if (landed === 1 && landedAt === Infinity) landedAt = p;
        Object.assign(prev, out);
      }
      expect(landedAt).toBeLessThanOrEqual(0.6);
      expect(length(out)).toBe(0);
    }
    expect(bileFall(0, count, 0, point())).toBe(0);
  });

  it('is safe for a zero count', () => {
    const out = point();
    expect(Number.isFinite(bileFall(0, 0, 0.5, out))).toBe(true);
    expect(finite(out)).toBe(true);
  });
});

describe('wander', () => {
  it('stays inside the unit box and moves smoothly', () => {
    for (let i = 0; i < 30; i++) {
      const prev = wander(0, i, point());
      const out = point();
      for (let t = 0.02; t < 120; t += 0.02) {
        wander(t, i, out);
        expect(Math.abs(out.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(out.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(out.z)).toBeLessThanOrEqual(1);
        expect(gap(out, prev)).toBeLessThan(0.02);
        Object.assign(prev, out);
      }
    }
  });

  it('is deterministic and differs between bacteria', () => {
    expect(wander(3.7, 5, point())).toEqual(wander(3.7, 5, point()));
    expect(gap(wander(3.7, 5, point()), wander(3.7, 6, point()))).toBeGreaterThan(0.01);
    expect(finite(wander(Number.NaN, 2, point()))).toBe(true);
  });
});

describe('feedProgress', () => {
  it('eats the strand from whole down to a small remnant by the last event', () => {
    expect(feedProgress(0)).toBe(1);
    let last = 1;
    for (const u of steps()) {
      const left = feedProgress(u);
      expect(left).toBeLessThanOrEqual(last);
      expect(left).toBeGreaterThanOrEqual(FEED_FLOOR);
      last = left;
    }
    expect(feedProgress(LAST_EVENT)).toBeLessThanOrEqual(0.2);
    expect(feedProgress(1)).toBeCloseTo(FEED_FLOOR);
    expect(feedProgress(Number.NaN)).toBe(1);
  });
});

describe('swarmJoin', () => {
  it('brings every bacterium to the strand by the middle of the beat, some already there', () => {
    const count = 20;
    let early = 0;
    for (let k = 0; k < count; k++) {
      let last = 0;
      for (const p of steps()) {
        const j = swarmJoin(k, count, p);
        expect(j).toBeGreaterThanOrEqual(last);
        expect(j).toBeLessThanOrEqual(1);
        last = j;
      }
      expect(swarmJoin(k, count, 0.6)).toBe(1);
      if (swarmJoin(k, count, 0) === 1) early++;
    }
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(count);
    expect(Number.isFinite(swarmJoin(0, 0, 0.5))).toBe(true);
  });
});

describe('swarmLeave', () => {
  it('sends some bacteria away once the strand is mostly eaten and keeps the rest feeding', () => {
    const count = 22;
    let stay = 0;
    for (let k = 0; k < count; k++) {
      let last = 0;
      for (const p of steps()) {
        const gone = swarmLeave(k, p);
        expect(gone).toBeGreaterThanOrEqual(last);
        expect(gone).toBeLessThanOrEqual(1);
        last = gone;
      }
      expect(swarmLeave(k, 0.5)).toBe(0);
      expect([0, 1]).toContain(swarmLeave(k, 0.9));
      if (swarmLeave(k, 1) === 0) stay++;
    }
    expect(stay).toBeGreaterThan(2);
    expect(stay).toBeLessThan(count - 2);
    expect(swarmLeave(0, Number.NaN)).toBe(0);
  });
});

describe('glowParticle', () => {
  const count = 48;

  it('glows only for a short while after its emission and drifts away smoothly', () => {
    for (let i = 0; i < count; i++) {
      const prev = point();
      const out = point();
      let lit = false;
      let prevGlow = 0;
      for (const u of steps()) {
        const glow = glowParticle(i, count, u, out);
        expect(glow).toBeGreaterThanOrEqual(0);
        expect(glow).toBeLessThanOrEqual(1);
        expect(finite(out)).toBe(true);
        expect(length(out)).toBeLessThanOrEqual(1 + 1e-9);
        if (u > 0) {
          expect(gap(out, prev)).toBeLessThan(0.05);
          expect(Math.abs(glow - prevGlow)).toBeLessThan(0.1);
        }
        if (glow > 0) lit = true;
        Object.assign(prev, out);
        prevGlow = glow;
      }
      expect(lit).toBe(true);
      expect(glowParticle(i, count, 0, point())).toBe(0);
    }
  });

  it('emits the last particle by the last event and still has particles glowing at the end', () => {
    for (let i = 0; i < count; i++) {
      const out = point();
      glowParticle(i, count, LAST_EVENT + 1e-6, out);
      expect(length(out)).toBeGreaterThan(0);
    }
    const alive = (u: number): number => Array.from({ length: count }, (_, i) => glowParticle(i, count, u, point())).filter((g) => g > 0.05).length;
    expect(alive(0.95)).toBeGreaterThanOrEqual(4);
    expect(alive(0.5)).toBeGreaterThanOrEqual(4);
  });

  it('emits in order, after the first bacteria arrive and no later than the last event', () => {
    let last = 0;
    for (let i = 0; i < count; i++) {
      const at = glowEmitAt(i, count);
      expect(at).toBeGreaterThan(last);
      expect(at).toBeLessThanOrEqual(LAST_EVENT);
      expect(glowParticle(i, count, at, point())).toBe(0);
      last = at;
    }
    expect(glowEmitAt(0, count)).toBeGreaterThan(0);
  });

  it('is deterministic and safe for a zero count', () => {
    expect(glowParticle(5, count, 0.6, point())).toBe(glowParticle(5, count, 0.6, point()));
    expect(glowParticle(0, 0, 0.6, point())).toBe(0);
    expect(glowParticle(0, count, Number.NaN, point())).toBe(0);
  });
});
