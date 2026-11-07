import { GOLDEN, hash01 } from '@/scene/lens/motion';
import type { MotionPoint } from '@/scene/lens/types';

export const LAST_EVENT = 0.88;
export const FEED_FLOOR = 0.15;
export const FALL_HEIGHT = 1.4;

const MIN_DROPLETS = 20;
const MAX_DROPLETS = 40;
const DROPLETS_BASE = 18;
const DROPLETS_PER_GRAM = 0.8;
const THREE_BLOBS_FROM = 12;
const SPLIT_START = 0.14;
const SPLIT_STAGGER = 0.14;
const SHRINK = 0.7;
const SPREAD_TAU = 0.15;
const REACH_MIN = 0.15;
const DEPTH = 0.45;
const BILE_SPREAD = 0.38;
const BILE_JITTER = 0.03;
const FALL = 0.16;
const SWAY = 0.08;
const FEED_START = 0.04;
const JOIN_FROM = -0.2;
const JOIN_SPREAD = 0.55;
const JOIN_SPAN = 0.14;
const STAY_FRACTION = 0.3;
const LEAVE_FROM = 0.5;
const LEAVE_SPREAD = 0.26;
const LEAVE_SPAN = 0.12;
const GLOW_FROM = 0.1;
const GLOW_LIFE = 0.2;
const GLOW_RISE = 5;

const clamp01 = (v: number): number => (v > 1 ? 1 : v > 0 ? v : 0);
const smooth = (s: number): number => s * s * (3 - 2 * s);
const zero = (out: MotionPoint): MotionPoint => {
  out.x = 0;
  out.y = 0;
  out.z = 0;
  return out;
};

export function emulsifyCounts(fat: number): { blobs: number; droplets: number } {
  const grams = Number.isFinite(fat) && fat > 0 ? fat : 0;
  return {
    blobs: grams >= THREE_BLOBS_FROM ? 3 : 2,
    droplets: Math.min(MAX_DROPLETS, Math.max(MIN_DROPLETS, Math.round(DROPLETS_BASE + grams * DROPLETS_PER_GRAM))),
  };
}

export function splitWindow(b: number, blobs: number, p: number): number {
  const start = SPLIT_START + (SPLIT_STAGGER * b) / Math.max(1, blobs - 1);
  const u = (p - start) / (LAST_EVENT - start);
  return u > 0 ? u : 0;
}

export function splitCount(u: number, max: number): number {
  const m = Number.isFinite(max) ? Math.floor(max) : 0;
  if (m <= 0) return 0;
  const v = clamp01(u);
  return v >= 1 ? m : Math.min(m, Math.floor(v * m) + 1);
}

export const blobRadius = (u: number): number => (1 - clamp01(u)) ** SHRINK;

export function dropletOffset(i: number, count: number, u: number, out: MotionPoint): MotionPoint {
  if (!(count > 0)) return zero(out);
  const since = (Number.isFinite(u) ? Math.max(0, u) : 0) - (i + 1) / count;
  if (since < 0) return zero(out);
  const reach = (REACH_MIN + (1 - REACH_MIN) * hash01(i, 71)) * (1 - Math.exp(-since / SPREAD_TAU));
  const y = 1 - (2 * (i + 0.5)) / count;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = i * GOLDEN + hash01(i, 73);
  out.x = reach * ring * Math.cos(angle);
  out.y = reach * y;
  out.z = reach * ring * Math.sin(angle) * DEPTH;
  return out;
}

export function bileFall(k: number, count: number, p: number, out: MotionPoint): number {
  const start = (BILE_SPREAD * k) / Math.max(1, count) + BILE_JITTER * hash01(k, 79);
  const u = clamp01(((Number.isFinite(p) ? p : 0) - start) / FALL);
  const rest = (1 - u) ** 3;
  out.x = SWAY * rest * Math.sin(k * 2.3 + u * 4);
  out.y = FALL_HEIGHT * rest;
  out.z = 0;
  return u;
}

export function wander(t: number, i: number, out: MotionPoint): MotionPoint {
  const v = (Number.isFinite(t) ? t : 0) * (0.8 + 0.5 * hash01(i, 61));
  const ph = i * GOLDEN;
  out.x = 0.6 * Math.sin(v * 0.23 + ph) + 0.4 * Math.sin(v * 0.37 + ph * 2.1);
  out.y = 0.6 * Math.sin(v * 0.19 + ph * 1.3) + 0.4 * Math.sin(v * 0.41 + ph * 0.7);
  out.z = 0.6 * Math.sin(v * 0.17 + ph * 1.7) + 0.4 * Math.sin(v * 0.29 + ph * 2.9);
  return out;
}

export function feedProgress(u: number): number {
  const w = clamp01((clamp01(u) - FEED_START) / (LAST_EVENT - FEED_START));
  return 1 - (1 - FEED_FLOOR) * 0.5 * (w + smooth(w));
}

export function swarmJoin(k: number, count: number, p: number): number {
  const at = JOIN_FROM + (JOIN_SPREAD * k) / Math.max(1, count);
  return smooth(clamp01(((Number.isFinite(p) ? p : 0) - at) / JOIN_SPAN));
}

export function swarmLeave(k: number, p: number): number {
  if (hash01(k, 109) < STAY_FRACTION) return 0;
  const at = LEAVE_FROM + LEAVE_SPREAD * hash01(k, 113);
  return smooth(clamp01(((Number.isFinite(p) ? p : 0) - at) / LEAVE_SPAN));
}

export const glowEmitAt = (i: number, count: number): number => GLOW_FROM + ((LAST_EVENT - GLOW_FROM) * (i + hash01(i, 83))) / Math.max(1, count);

export function glowParticle(i: number, count: number, u: number, out: MotionPoint): number {
  zero(out);
  if (!(count > 0)) return 0;
  const age = ((Number.isFinite(u) ? u : 0) - glowEmitAt(i, count)) / GLOW_LIFE;
  if (age <= 0) return 0;
  const a = Math.min(age, 1);
  const drift = 1 - (1 - a) * (1 - a);
  const dx = hash01(i, 89) - 0.5;
  const dy = (hash01(i, 97) < 0.5 ? -1 : 1) * (0.55 + 0.45 * hash01(i, 101));
  const dz = (hash01(i, 103) - 0.5) * 0.6;
  const scale = drift / Math.hypot(dx, dy, dz);
  out.x = dx * scale;
  out.y = dy * scale;
  out.z = dz * scale;
  return age >= 1 ? 0 : Math.min(1, age * GLOW_RISE) * (1 - age);
}
