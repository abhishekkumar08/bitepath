import { hash01 } from '@/scene/lens/motion';
import type { ChainCut, ChainCutMode, ChainPlan, ChainShape, MotionPoint } from '@/scene/lens/types';

export const BEAD_SPACING = 0.17;
export const LAST_CUT = 0.85;
export const DROP_SPAN = 0.08;

const SAMPLES = 600;
const CUT_JITTER = 0.3;
const SNAP_WIDTH = 0.03;
const LAND_TINT = 0.04;
const RESIDUE = { size: 0.36, tone: 0.44 };
const DRIFT_TAU = 0.08;
const TRAVEL_FROM = 0.3;
const TRAVEL_TO = 0.8;
const APPROACH = 1.6;
const RETREAT = 1.5;
const POP = 0.06;
const EXPAND: Record<ChainShape, number> = { chain: 0.08, folded: 0.3 };
const LIFT = { min: 0.08, spread: 0.08 };
const JITTER = 0.08;
const FOLD: ReadonlyArray<{ len: number; turn: number }> = [
  { len: 0.45, turn: 0 },
  { len: 0.2 * Math.PI, turn: (Math.PI * 2) / 3 },
  { len: 0.4 * Math.PI, turn: (-Math.PI * 4) / 3 },
  { len: 0.2 * Math.PI, turn: (Math.PI * 2) / 3 },
  { len: 0.35, turn: 0 },
  { len: 0.5 * Math.PI, turn: -Math.PI },
  { len: 1.5, turn: 0 },
  { len: 0.11 * Math.PI, turn: Math.PI / 2 },
];
const FOLD_LENGTH = FOLD.reduce((sum, seg) => sum + seg.len, 0);

const clamp01 = (v: number): number => (v > 1 ? 1 : v > 0 ? v : 0);
const smooth = (s: number): number => s * s * (3 - 2 * s);

const CURVES: Record<ChainShape, (s: number, out: MotionPoint) => void> = {
  chain: (s, out) => {
    const x = 2 * s - 1;
    out.x = x;
    out.y = 0.07 * Math.sin(2.6 * x + 0.5);
    out.z = 0.1 * Math.sin(1.8 * x);
  },
  folded: (s, out) => {
    let left = s * FOLD_LENGTH;
    let x = 0;
    let y = 0;
    let heading = 0;
    for (const seg of FOLD) {
      const d = Math.min(left, seg.len);
      if (seg.turn === 0) {
        x += d * Math.cos(heading);
        y += d * Math.sin(heading);
      } else {
        const k = seg.turn / seg.len;
        const next = heading + k * d;
        x += (Math.sin(next) - Math.sin(heading)) / k;
        y -= (Math.cos(next) - Math.cos(heading)) / k;
        heading = next;
      }
      left -= d;
      if (left <= 0) break;
    }
    out.x = x;
    out.y = y;
    out.z = 0.12 * Math.sin(Math.PI * 2 * s);
  },
};

export function chainBeads(n: number, shape: ChainShape): MotionPoint[] {
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (count === 0) return [];
  const curve = CURVES[shape];
  const samples: MotionPoint[] = [];
  const lengths: number[] = [0];
  for (let k = 0; k <= SAMPLES; k++) {
    const p = { x: 0, y: 0, z: 0 };
    curve(k / SAMPLES, p);
    if (k > 0) {
      const q = samples[k - 1];
      lengths.push(lengths[k - 1] + Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z));
    }
    samples.push(p);
  }
  const total = lengths[SAMPLES];
  const scale = count > 1 ? (BEAD_SPACING * (count - 1)) / total : 1;
  const beads: MotionPoint[] = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const target = count > 1 ? (total * i) / (count - 1) : total / 2;
    while (k < SAMPLES - 1 && lengths[k + 1] < target) k++;
    const span = lengths[k + 1] - lengths[k];
    const f = span > 0 ? clamp01((target - lengths[k]) / span) : 0;
    const a = samples[k];
    const b = samples[k + 1];
    beads.push({ x: (a.x + (b.x - a.x) * f) * scale, y: (a.y + (b.y - a.y) * f) * scale, z: (a.z + (b.z - a.z) * f) * scale });
  }
  const mean = beads.reduce((m, b) => ({ x: m.x + b.x / count, y: m.y + b.y / count, z: m.z + b.z / count }), { x: 0, y: 0, z: 0 });
  for (const b of beads) {
    b.x -= mean.x;
    b.y -= mean.y;
    b.z -= mean.z;
  }
  return beads;
}

export function cutTimes(n: number, seed: number, end = LAST_CUT): number[] {
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const times: number[] = [];
  for (let k = 0; k < count; k++) {
    const jitter = k === count - 1 ? 0 : CUT_JITTER * hash01(k, seed);
    times.push((end * (k + 1 - jitter)) / count);
  }
  return times;
}

function someBonds(n: number, seed: number): number[] {
  const bonds: number[] = [];
  let last = -1;
  for (let k = 0; ; k++) {
    let bond = last + 2 + Math.floor(hash01(k, seed) * 2);
    if (bond > n - 3) {
      if (n - 1 - last <= 4) break;
      bond = last + 2;
    }
    bonds.push(bond);
    last = bond;
  }
  return bonds;
}

function planCuts(n: number, mode: ChainCutMode, seed: number): { cuts: ChainCut[]; enzymes: number } {
  if (n < 2) return { cuts: [], enzymes: 1 };
  if (mode === 'some') {
    const bonds = someBonds(n, seed);
    const times = cutTimes(bonds.length, seed);
    return { cuts: bonds.map((bond, k) => ({ bond, time: times[k], enzyme: 0 })), enzymes: 1 };
  }
  const bonds = n - 1;
  const left = Math.ceil(bonds / 2);
  const right = bonds - left;
  const cuts: ChainCut[] = cutTimes(left, seed).map((time, k) => ({ bond: k, time, enzyme: 0 }));
  cutTimes(right, seed + 1, (LAST_CUT * right) / left).forEach((time, k) => cuts.push({ bond: n - 2 - k, time, enzyme: 1 }));
  return { cuts, enzymes: right > 0 ? 2 : 1 };
}

export function planChain(n: number, shape: ChainShape, mode: ChainCutMode, seed: number): ChainPlan {
  const beads = chainBeads(n, shape);
  const count = beads.length;
  const { cuts, enzymes } = planCuts(count, mode, seed);
  const bondCut = Array.from({ length: Math.max(0, count - 1) }, () => Infinity);
  for (const c of cuts) bondCut[c.bond] = c.time;
  const piece: number[] = [];
  for (let i = 0; i < count; i++) piece.push(i === 0 ? 0 : piece[i - 1] + (bondCut[i - 1] < Infinity ? 1 : 0));
  const pieces = count > 0 ? piece[count - 1] + 1 : 0;
  const release: number[] = [];
  const drift: MotionPoint[] = [];
  for (let j = 0; j < pieces; j++) {
    const first = piece.indexOf(j);
    const last = piece.lastIndexOf(j);
    const before = first > 0 ? bondCut[first - 1] : -Infinity;
    const after = last < count - 1 ? bondCut[last] : -Infinity;
    const freed = Math.max(before, after);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = first; i <= last; i++) {
      cx += beads[i].x / (last - first + 1);
      cy += beads[i].y / (last - first + 1);
      cz += beads[i].z / (last - first + 1);
    }
    const outward = shape === 'chain' ? j % 2 === 0 : cy >= 0;
    const lift = (outward ? 1 : -1) * (LIFT.min + LIFT.spread * hash01(j, seed + 5));
    const d = {
      x: cx * EXPAND[shape] + JITTER * (hash01(j, seed + 7) - 0.5),
      y: cy * EXPAND[shape] + lift,
      z: cz * EXPAND[shape] + JITTER * (hash01(j, seed + 9) - 0.5),
    };
    for (let i = first; i <= last; i++) {
      release.push(freed === -Infinity ? Infinity : freed);
      drift.push(d);
    }
  }
  return { beads, cuts, enzymes, bondCut, piece, release, drift };
}

export function fragmentOffset(i: number, plan: ChainPlan, t: number, out: MotionPoint): MotionPoint {
  const r = plan.release[i];
  const d = plan.drift[i];
  if (!(t >= r) || !d) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const s = 1 - Math.exp(-(t - r) / DRIFT_TAU);
  out.x = d.x * s;
  out.y = d.y * s;
  out.z = d.z * s;
  return out;
}

const travel = (from: number, to: number, t0: number, t1: number, p: number, wait: number): number => {
  const u = t1 > t0 ? (p - t0) / (t1 - t0) : 1;
  return from + (to - from) * smooth(clamp01((u - wait) / (TRAVEL_TO - wait)));
};

export function enzymeAlong(p: number, plan: ChainPlan, e: number): number {
  const n = plan.beads.length;
  const dir = e === 0 ? 1 : -1;
  let s = e === 0 ? -APPROACH : n - 1 + APPROACH;
  let t = 0;
  for (const cut of plan.cuts) {
    if (cut.enzyme !== e) continue;
    if (p <= cut.time) return travel(s, cut.bond + 0.5, t, cut.time, p, t > 0 ? TRAVEL_FROM : 0);
    s = cut.bond + 0.5;
    t = cut.time;
  }
  return t > 0 ? travel(s, s - dir * RETREAT, t, 1, p, TRAVEL_FROM) : s;
}

export function jawClosure(p: number, plan: ChainPlan, e: number): number {
  let shut = 0;
  for (const cut of plan.cuts) {
    if (cut.enzyme !== e) continue;
    shut = Math.max(shut, Math.exp(-(((p - cut.time) / SNAP_WIDTH) ** 2)));
  }
  return shut;
}

export function chainPoint(beads: MotionPoint[], s: number, out: MotionPoint): MotionPoint {
  const n = beads.length;
  if (n === 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  if (n === 1) {
    out.x = beads[0].x;
    out.y = beads[0].y;
    out.z = beads[0].z;
    return out;
  }
  const i = Math.min(n - 2, Math.max(0, Math.floor(s)));
  const f = s - i;
  const a = beads[i];
  const b = beads[i + 1];
  out.x = a.x + (b.x - a.x) * f;
  out.y = a.y + (b.y - a.y) * f;
  out.z = a.z + (b.z - a.z) * f;
  return out;
}

export function wallDrop(u: number, from: MotionPoint, wall: MotionPoint, out: MotionPoint): MotionPoint {
  const t = clamp01(u);
  const e = smooth(t);
  out.x = from.x + (wall.x - from.x) * e;
  out.y = wall.y + (from.y - wall.y) * (1 - t * t) + POP * Math.sin(Math.PI * t) * (1 - t);
  out.z = from.z + (wall.z - from.z) * e;
  return out;
}

export function residueSize(i: number, seed: number): number {
  return 1 - RESIDUE.size / 2 + RESIDUE.size * hash01(i, seed + 101);
}

export function residueTone(i: number, seed: number): number {
  return RESIDUE.tone * (hash01(i, seed + 103) - 0.5);
}

export function landingTint(since: number): number {
  return smooth(clamp01((since - DROP_SPAN) / LAND_TINT));
}
