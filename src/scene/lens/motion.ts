import type { BeadSlot, MotionPoint } from '@/scene/lens/types';

export const VILLUS_HEIGHT = 1;
export const CAPILLARY_X = 0.062;
export const SHOULDER = 0.16;
export const FOOT = 0.08;
export const VEIN_Y = -0.14;
export const VEIN_Z = 0.12;
export const LYMPH_Y = -0.32;
export const LYMPH_Z = 0.12;
export const LUMEN_Y = 1.24;
export const VEIN_RUN = 1.5;
export const SWAY_AMPLITUDE = 0.1;

export const BEAD_PACE = {
  steady: { span: 0.85, cross: 0.12, exit: 0.1 },
  fast: { span: 0.8, cross: 0.1, exit: 0.1 },
};
export const DRIFT_SPEED = 3.5;
export const LUMEN_LEAD = 1.05 / DRIFT_SPEED;
export const VILLI_PER_ROW = 10;
export const VILLI_SPACING_X = 0.42;
export const HERO_REACH = 1.1;

const ENTRY = 0.35;
const FADE = 0.04;
const PASS_APPROACH = 0.12;
const PASS_REBOUND = 0.08;
const PASS_LIFT = 1;
const LUMEN_REACH_X = 0.42;
const LUMEN_REACH_Z = 0.22;
const LUMEN_SPREAD_Y = 0.08;
export const GOLDEN = 2.399963;

const clamp01 = (v: number): number => (v > 1 ? 1 : v > 0 ? v : 0);

export const hash01 = (i: number, seed: number): number => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const frontRowX = (column: number): number => (column - (VILLI_PER_ROW - 1) / 2) * VILLI_SPACING_X;

export function heroColumns(): number[] {
  const columns: number[] = [];
  for (let c = 0; c < VILLI_PER_ROW; c++) if (Math.abs(frontRowX(c)) <= HERO_REACH) columns.push(c);
  return columns;
}

export function swayAt(t: number, i: number): number {
  const phase = i * GOLDEN;
  return SWAY_AMPLITUDE * (0.7 * Math.sin(t * 1.3 + phase) + 0.3 * Math.sin(t * 2.1 + phase * 1.7));
}

function lumenToTip(s: number, lane: number, out: MotionPoint): MotionPoint {
  const angle = lane * Math.PI * 2;
  const y0 = LUMEN_Y + LUMEN_SPREAD_Y * Math.sin(angle * 2 + 1);
  const ease = 1 - s * (2 - s);
  out.x = LUMEN_REACH_X * Math.cos(angle) * ease;
  out.y = y0 * (1 - s) + VILLUS_HEIGHT * s;
  out.z = LUMEN_REACH_Z * Math.sin(angle) * ease;
  return out;
}

function tipToVessel(s: number, legX: number, endY: number, endZ: number, out: MotionPoint): MotionPoint {
  const y = VILLUS_HEIGHT * (1 - s) + endY * s;
  const shoulder = clamp01((VILLUS_HEIGHT - y) / SHOULDER);
  const foot = clamp01((y - endY) / FOOT);
  out.x = legX * shoulder * foot;
  out.y = y;
  out.z = endZ * (1 - foot);
  return out;
}

function travel(u: number, lane: number, legX: number, endY: number, endZ: number, out: MotionPoint): MotionPoint {
  const t = clamp01(u);
  if (t < ENTRY) return lumenToTip(t / ENTRY, lane, out);
  return tipToVessel((t - ENTRY) / (1 - ENTRY), legX, endY, endZ, out);
}

export function absorbPath(u: number, lane: number, out: MotionPoint): MotionPoint {
  return travel(u, lane, lane < 0.5 ? -CAPILLARY_X : CAPILLARY_X, VEIN_Y, VEIN_Z, out);
}

export function lactealPath(u: number, lane: number, out: MotionPoint): MotionPoint {
  return travel(u, lane, 0, LYMPH_Y, LYMPH_Z, out);
}

export function veinExit(u: number, out: MotionPoint, y = VEIN_Y, z = VEIN_Z): MotionPoint {
  out.x = clamp01(u) * VEIN_RUN;
  out.y = y;
  out.z = z;
  return out;
}

export function beadSchedule(count: number, fraction: number, seed: number): BeadSlot[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const crossing = Math.round((Number.isFinite(fraction) ? clamp01(fraction) : 0) * n);
  const slots: BeadSlot[] = [];
  for (let i = 0; i < n; i++) {
    slots.push({
      start: (i + 0.15 + 0.7 * hash01(i, seed)) / n,
      crosses: Math.floor(((i + 1) * crossing) / n) > Math.floor((i * crossing) / n),
    });
  }
  return slots;
}

export function paceStarts(count: number, fraction: number, seed: number, span: number): BeadSlot[] {
  return beadSchedule(count, fraction, seed).map((slot) => ({ start: slot.start * span, crosses: slot.crosses }));
}

export function beadPresence(since: number, cross: number, exit: number, crosses: boolean): number {
  if (since < -LUMEN_LEAD) return 0;
  const grow = clamp01((since + LUMEN_LEAD) / FADE);
  return crosses ? Math.min(grow, clamp01((cross + exit - since) / FADE)) : grow;
}

export function passHeight(since: number): number {
  if (since <= 0) return 1 - Math.exp(-((since / PASS_APPROACH) ** 2));
  const k = since / PASS_REBOUND;
  return 1 - Math.exp(-(k ** 2)) + PASS_LIFT * k * Math.exp(1 - k);
}
