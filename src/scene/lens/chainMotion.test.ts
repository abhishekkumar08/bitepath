import { describe, expect, it } from 'vitest';
import {
  BEAD_SPACING,
  DROP_SPAN,
  LAST_CUT,
  chainBeads,
  chainPoint,
  cutTimes,
  enzymeAlong,
  fragmentOffset,
  jawClosure,
  landingTint,
  planChain,
  residueSize,
  residueTone,
  wallDrop,
} from '@/scene/lens/chainMotion';
import type { ChainPlan, ChainShape, MotionPoint } from '@/scene/lens/types';

const point = (): MotionPoint => ({ x: 0, y: 0, z: 0 });
const SHAPES: ChainShape[] = ['chain', 'folded'];
const STEPS = 2000;
const dist = (a: MotionPoint, b: MotionPoint): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (p: MotionPoint): boolean => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

const placed = (plan: ChainPlan, i: number, t: number): MotionPoint => {
  const o = fragmentOffset(i, plan, t, point());
  return { x: plan.beads[i].x + o.x, y: plan.beads[i].y + o.y, z: plan.beads[i].z + o.z };
};

const pieceGap = (plan: ChainPlan, a: number, b: number, t: number): number => {
  let gap = Infinity;
  plan.piece.forEach((p, i) => {
    if (p !== a) return;
    plan.piece.forEach((q, k) => {
      if (q === b) gap = Math.min(gap, dist(placed(plan, i, t), placed(plan, k, t)));
    });
  });
  return gap;
};

describe('chainBeads', () => {
  it('returns the requested number of finite beads, none for zero', () => {
    for (const shape of SHAPES) {
      expect(chainBeads(0, shape)).toEqual([]);
      const beads = chainBeads(16, shape);
      expect(beads).toHaveLength(16);
      expect(beads.every(finite)).toBe(true);
    }
  });

  it('keeps neighbours evenly spaced', () => {
    for (const shape of SHAPES) {
      const beads = chainBeads(16, shape);
      for (let i = 1; i < beads.length; i++) {
        expect(dist(beads[i], beads[i - 1])).toBeGreaterThan(BEAD_SPACING * 0.85);
        expect(dist(beads[i], beads[i - 1])).toBeLessThan(BEAD_SPACING * 1.15);
      }
    }
  });

  it('lays a chain out long and folds the other back on itself', () => {
    const chain = chainBeads(14, 'chain');
    const length = BEAD_SPACING * 13;
    expect(chain[13].x - chain[0].x).toBeGreaterThan(length * 0.85);
    for (let i = 1; i < chain.length; i++) expect(chain[i].x).toBeGreaterThan(chain[i - 1].x);
    const folded = chainBeads(16, 'folded');
    expect(Math.abs(folded[15].x - folded[0].x)).toBeLessThan((BEAD_SPACING * 15) / 3);
    const c = folded.reduce((a, b) => ({ x: a.x + b.x / 16, y: a.y + b.y / 16, z: a.z + b.z / 16 }), point());
    for (const b of folded) expect(dist(b, c)).toBeLessThan((BEAD_SPACING * 15) / 3);
  });

  it('folds back with a second small turn and stays inside the lens', () => {
    const folded = chainBeads(16, 'folded');
    const c = folded.reduce((a, b) => ({ x: a.x + b.x / 16, y: a.y + b.y / 16, z: a.z + b.z / 16 }), point());
    for (const b of folded) expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeLessThan(0.8);
    let reversals = 0;
    for (let i = 2; i < folded.length; i++) {
      const before = folded[i - 1].x - folded[i - 2].x;
      const after = folded[i].x - folded[i - 1].x;
      if (Math.sign(before) !== Math.sign(after) && Math.abs(after) > 1e-3) reversals++;
    }
    expect(reversals).toBeGreaterThanOrEqual(2);
    const top = folded.filter((b) => b.y > c.y).length;
    expect(top).not.toBe(folded.length - top);
  });

  it('never stacks two beads on top of each other', () => {
    for (const shape of SHAPES) {
      const beads = chainBeads(18, shape);
      for (let i = 0; i < beads.length; i++) for (let j = i + 2; j < beads.length; j++) expect(dist(beads[i], beads[j])).toBeGreaterThan(BEAD_SPACING * 0.75);
    }
  });
});

describe('cutTimes', () => {
  it('is empty for zero cuts', () => {
    expect(cutTimes(0, 3)).toEqual([]);
  });

  it('rises strictly inside the beat and ends near the last cut time', () => {
    for (const n of [1, 4, 6, 11]) {
      const times = cutTimes(n, 7);
      expect(times).toHaveLength(n);
      for (let k = 0; k < n; k++) {
        expect(times[k]).toBeGreaterThan(0);
        expect(times[k]).toBeLessThanOrEqual(LAST_CUT);
        if (k > 0) expect(times[k]).toBeGreaterThan(times[k - 1]);
      }
      expect(times[n - 1]).toBeGreaterThan(LAST_CUT - 0.1);
      expect(LAST_CUT).toBeLessThanOrEqual(0.9);
    }
  });

  it('is deterministic per seed', () => {
    expect(cutTimes(6, 11)).toEqual(cutTimes(6, 11));
    expect(cutTimes(6, 11)).not.toEqual(cutTimes(6, 12));
  });
});

describe('planChain', () => {
  it('handles empty and single-bead chains', () => {
    for (const mode of ['some', 'all'] as const) {
      expect(planChain(0, 'chain', mode, 1).cuts).toEqual([]);
      const one = planChain(1, 'chain', mode, 1);
      expect(one.cuts).toEqual([]);
      const o = fragmentOffset(0, one, 1, point());
      expect(o).toEqual({ x: 0, y: 0, z: 0 });
      expect(Number.isFinite(enzymeAlong(0.5, one, 0))).toBe(true);
    }
  });

  it('cuts some bonds into pieces of two to four beads', () => {
    for (const shape of SHAPES) {
      for (let n = 6; n <= 22; n++) {
        for (let seed = 1; seed <= 8; seed++) {
          const plan = planChain(n, shape, 'some', seed);
          expect(plan.cuts.length).toBeGreaterThan(0);
          const sizes = new Map<number, number>();
          for (const p of plan.piece) sizes.set(p, (sizes.get(p) ?? 0) + 1);
          for (const size of sizes.values()) {
            expect(size).toBeGreaterThanOrEqual(2);
            expect(size).toBeLessThanOrEqual(4);
          }
        }
      }
    }
  });

  it('cuts every bond into single beads with two enzymes', () => {
    const plan = planChain(12, 'chain', 'all', 5);
    expect(plan.cuts).toHaveLength(11);
    expect(plan.enzymes).toBe(2);
    expect(new Set(plan.piece).size).toBe(12);
  });

  it('frees every piece by the last cut and visits each enzyme cut in time order', () => {
    for (const mode of ['some', 'all'] as const) {
      const plan = planChain(14, 'folded', mode, 9);
      for (const r of plan.release) expect(r).toBeLessThanOrEqual(LAST_CUT);
      for (let e = 0; e < plan.enzymes; e++) {
        const times = plan.cuts.filter((c) => c.enzyme === e).map((c) => c.time);
        for (let k = 1; k < times.length; k++) expect(times[k]).toBeGreaterThan(times[k - 1]);
      }
    }
  });

  it('is deterministic per seed', () => {
    expect(planChain(14, 'chain', 'some', 4)).toEqual(planChain(14, 'chain', 'some', 4));
  });
});

describe('fragmentOffset', () => {
  it('holds every bead still before its piece is free', () => {
    const plan = planChain(14, 'chain', 'some', 2);
    plan.beads.forEach((_, i) => {
      expect(fragmentOffset(i, plan, plan.release[i] - 1e-6, point())).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  it('drifts neighbouring pieces apart and keeps them apart', () => {
    for (const shape of SHAPES) {
      const plan = planChain(16, shape, 'some', 3);
      const pieces = Math.max(...plan.piece) + 1;
      for (let j = 1; j < pieces; j++) {
        expect(pieceGap(plan, j - 1, j, 1)).toBeGreaterThan(pieceGap(plan, j - 1, j, 0) + 0.05);
      }
    }
  });

  it('is bounded, finite and continuous', () => {
    for (const shape of SHAPES) {
      const plan = planChain(16, shape, 'some', 8);
      const prev = point();
      const o = point();
      plan.beads.forEach((_, i) => {
        fragmentOffset(i, plan, 0, prev);
        for (let s = 1; s <= STEPS; s++) {
          fragmentOffset(i, plan, s / STEPS, o);
          expect(finite(o)).toBe(true);
          expect(Math.hypot(o.x, o.y, o.z)).toBeLessThan(0.6);
          expect(dist(o, prev)).toBeLessThan(0.01);
          prev.x = o.x;
          prev.y = o.y;
          prev.z = o.z;
        }
      });
    }
  });
});

describe('enzymeAlong', () => {
  it('sits on the bond at the moment it cuts', () => {
    for (const mode of ['some', 'all'] as const) {
      const plan = planChain(14, 'chain', mode, 6);
      for (const cut of plan.cuts) expect(enzymeAlong(cut.time, plan, cut.enzyme)).toBeCloseTo(cut.bond + 0.5, 6);
    }
  });

  it('never jumps and starts off the end of the chain', () => {
    for (const mode of ['some', 'all'] as const) {
      const plan = planChain(14, 'folded', mode, 6);
      for (let e = 0; e < plan.enzymes; e++) {
        const start = enzymeAlong(0, plan, e);
        expect(start < 0 || start > 13).toBe(true);
        let prev = start;
        for (let s = 1; s <= STEPS; s++) {
          const u = enzymeAlong(s / STEPS, plan, e);
          expect(Number.isFinite(u)).toBe(true);
          expect(Math.abs(u - prev)).toBeLessThan(0.05);
          prev = u;
        }
      }
    }
  });
});

describe('jawClosure', () => {
  it('snaps shut at each cut and is open between cuts', () => {
    const plan = planChain(14, 'chain', 'some', 6);
    for (const cut of plan.cuts) expect(jawClosure(cut.time, plan, cut.enzyme)).toBeCloseTo(1, 6);
    const [a, b] = plan.cuts;
    expect(jawClosure((a.time + b.time) / 2, plan, 0)).toBeLessThan(0.05);
    for (let s = 0; s <= STEPS; s++) {
      const v = jawClosure(s / STEPS, plan, 0);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('chainPoint', () => {
  it('returns bead positions at whole indices and extends past the ends', () => {
    const beads = chainBeads(10, 'chain');
    expect(dist(chainPoint(beads, 3, point()), beads[3])).toBeLessThan(1e-9);
    expect(chainPoint(beads, -1, point()).x).toBeLessThan(beads[0].x);
    expect(chainPoint(beads, 10, point()).x).toBeGreaterThan(beads[9].x);
    expect(chainPoint([], 2, point())).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('wallDrop', () => {
  const from = { x: 0.3, y: 0.3, z: 0.1 };
  const wall = { x: 0.35, y: -0.5, z: 0.05 };

  it('leaves from the chain and lands on the wall', () => {
    expect(dist(wallDrop(0, from, wall, point()), from)).toBeLessThan(1e-9);
    expect(dist(wallDrop(1, from, wall, point()), wall)).toBeLessThan(1e-9);
    expect(dist(wallDrop(3, from, wall, point()), wall)).toBeLessThan(1e-9);
  });

  it('never dips below the wall and never jumps', () => {
    const prev = wallDrop(0, from, wall, point());
    for (let s = 1; s <= STEPS; s++) {
      const p = wallDrop(s / STEPS, from, wall, point());
      expect(p.y).toBeGreaterThanOrEqual(wall.y - 1e-9);
      expect(dist(p, prev)).toBeLessThan(0.01);
      Object.assign(prev, p);
    }
  });
});

describe('residues', () => {
  const sizes = Array.from({ length: 12 }, (_, i) => residueSize(i, 37));
  const tones = Array.from({ length: 12 }, (_, i) => residueTone(i, 37));

  it('gives each amino residue its own bounded size and tone', () => {
    for (const s of sizes) {
      expect(s).toBeGreaterThanOrEqual(0.8);
      expect(s).toBeLessThanOrEqual(1.2);
    }
    for (const t of tones) expect(Math.abs(t)).toBeLessThanOrEqual(0.25);
    expect(new Set(sizes.map((s) => s.toFixed(3))).size).toBeGreaterThan(6);
    expect(new Set(tones.map((t) => t.toFixed(3))).size).toBeGreaterThan(6);
  });

  it('is deterministic per seed', () => {
    expect(Array.from({ length: 12 }, (_, i) => residueSize(i, 37))).toEqual(sizes);
    expect(Array.from({ length: 12 }, (_, i) => residueTone(i, 37))).toEqual(tones);
    expect(Array.from({ length: 12 }, (_, i) => residueSize(i, 38))).not.toEqual(sizes);
  });
});

describe('landingTint', () => {
  it('stays starch while falling and turns to glucose on landing', () => {
    expect(landingTint(-1)).toBe(0);
    expect(landingTint(0)).toBe(0);
    expect(landingTint(DROP_SPAN)).toBe(0);
    expect(landingTint(DROP_SPAN + 1e-6)).toBeGreaterThan(0);
    expect(landingTint(DROP_SPAN + 1)).toBe(1);
    let prev = 0;
    for (let s = 0; s <= STEPS; s++) {
      const v = landingTint((s / STEPS) * 0.5);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });
});
