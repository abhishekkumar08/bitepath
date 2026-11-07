import type { Sex } from '@/engine/types';
import { hash01 } from '@/scene/lens/motion';
import type { MotionPoint, SeepSlot } from '@/scene/lens/types';

export const CELL_PITCH = 0.34;
export const WALL_TOP = 0;
export const MUCUS_TOP = 0.08;
export const WALL_BOTTOM = -0.46;
export const CAPILLARY_Y = -0.62;
export const CAPILLARY_Z = 0;
export const CAPILLARY_RADIUS = 0.09;
export const ENZYME = { x: -0.58, y: MUCUS_TOP + 0.1, z: 0.16 };
export const ENZYME_KEEP_OUT = 0.36;
export const CROSS_FRACTION: Readonly<Record<Sex, number>> = { male: 0.25, female: 0.28 };
export const BROKEN_FRACTION: Readonly<Record<Sex, number>> = { male: 0.25, female: 0.0625 };

const LUMEN_LOW = 0.28;
const LUMEN_HIGH = 0.64;
const LUMEN_HALF_WIDTH = 1;
const LUMEN_BACK = -0.4;
const LUMEN_DEPTH = 0.6;
const FIRST_GAP = -1;
const LAST_GAP = 1;
const ENTRY = 0.4;
const START_SPAN = 0.8;
const FRAGMENT_REACH = 0.22;
const FRAGMENT_RISE = 0.05;
const FRAGMENT_FAN = 3;
const CAPILLARY_RUN = 1.1;
const DRIFT_JITTER = 0.04;
const DRIFT_SETTLE = 0.12;
const SQUEEZE_RAMP = 0.08;

const clamp01 = (v: number): number => (v > 1 ? 1 : v > 0 ? v : 0);
const smooth = (s: number): number => s * s * (3 - 2 * s);
const frac = (v: number): number => v - Math.floor(v);

export function lumenHome(lane: number, out: MotionPoint): MotionPoint {
  out.x = LUMEN_HALF_WIDTH * (2 * lane - 1);
  out.y = LUMEN_LOW + (LUMEN_HIGH - LUMEN_LOW) * frac(lane * 7.31 + 0.17);
  out.z = LUMEN_BACK + LUMEN_DEPTH * frac(lane * 3.77 + 0.41);
  const dx = out.x - ENZYME.x;
  if (Math.abs(dx) < ENZYME_KEEP_OUT) out.y = Math.max(out.y, ENZYME.y + Math.sqrt(ENZYME_KEEP_OUT * ENZYME_KEEP_OUT - dx * dx));
  return out;
}

function gapX(lane: number): number {
  const k = Math.round((LUMEN_HALF_WIDTH * (2 * lane - 1)) / CELL_PITCH - 0.5);
  return (Math.min(LAST_GAP, Math.max(FIRST_GAP, k)) + 0.5) * CELL_PITCH;
}

export function wallCrossPath(u: number, lane: number, out: MotionPoint): MotionPoint {
  const t = clamp01(u);
  const gx = gapX(lane);
  if (t >= ENTRY) {
    out.x = gx;
    out.y = MUCUS_TOP + (CAPILLARY_Y - MUCUS_TOP) * ((t - ENTRY) / (1 - ENTRY));
    out.z = CAPILLARY_Z;
    return out;
  }
  lumenHome(lane, out);
  const e = smooth(t / ENTRY);
  out.x += (gx - out.x) * e;
  out.y += (MUCUS_TOP - out.y) * e;
  out.z += (CAPILLARY_Z - out.z) * e;
  return out;
}

export function capillaryDrift(along: number, lane: number, out: MotionPoint): MotionPoint {
  const a = clamp01(along);
  const settle = DRIFT_JITTER * smooth(clamp01(a / DRIFT_SETTLE));
  const angle = frac(lane * 5.17) * Math.PI * 2;
  out.x = gapX(lane) + a * CAPILLARY_RUN * (0.75 + 0.5 * frac(lane * 9.13));
  out.y = CAPILLARY_Y + settle * Math.sin(angle);
  out.z = CAPILLARY_Z + settle * Math.cos(angle);
  return out;
}

export function squeezeAt(y: number): number {
  return smooth(clamp01((MUCUS_TOP - y) / SQUEEZE_RAMP)) * smooth(clamp01((y - WALL_BOTTOM) / SQUEEZE_RAMP));
}

export function enzymePath(u: number, lane: number, out: MotionPoint): MotionPoint {
  lumenHome(lane, out);
  const e = smooth(clamp01(u));
  out.x += (ENZYME.x - out.x) * e;
  out.y += (ENZYME.y - out.y) * e;
  out.z += (ENZYME.z - out.z) * e;
  return out;
}

export function fragmentAt(u: number, k: number, lane: number, out: MotionPoint): MotionPoint {
  const t = clamp01(u);
  const reach = FRAGMENT_REACH * (0.7 + 0.6 * frac(lane * 11.3 + k * 0.37)) * (1 - (1 - t) * (1 - t));
  const angle = (Math.PI * (k + 0.5)) / FRAGMENT_FAN + (lane - 0.5) * 0.6;
  out.x = ENZYME.x + Math.cos(angle) * reach;
  out.y = ENZYME.y + 0.6 * Math.sin(angle) * reach + FRAGMENT_RISE * t;
  out.z = ENZYME.z + 0.4 * Math.cos(angle * 1.7) * reach;
  return out;
}

const spreads = (i: number, picked: number, total: number): boolean => Math.floor(((i + 1) * picked) / total) > Math.floor((i * picked) / total);

export function seepSchedule(count: number, crossFraction: number, brokenFraction: number, seed: number): SeepSlot[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const crossing = Math.round(clamp01(crossFraction) * n);
  const rest = n - crossing;
  const broken = Math.min(rest, Math.round(clamp01(brokenFraction) * n));
  const slots: SeepSlot[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const start = (START_SPAN * (i + 0.2 + 0.6 * hash01(i, seed))) / n;
    if (spreads(i, crossing, n)) slots.push({ start, outcome: 'cross' });
    else slots.push({ start, outcome: spreads(j++, broken, rest) ? 'broken' : 'stay' });
  }
  return slots;
}
