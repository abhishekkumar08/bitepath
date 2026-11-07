import type { Nutrients } from '@/engine/types';
import type { IntakePose } from '@/scene/beats/types';

export const CHEW_START = 0.4;
const TRAVEL_START = 0.02;
const TRAVEL_END = 0.24;
const BITE_STARTS = [0.25, 0.29, 0.33];
const BITE_LENGTH = 0.03;
const PRESS_STARTS = [0.44, 0.59, 0.74];
const PRESS_LENGTH = 0.12;
const SIP_TILT_START = 0.24;
const SIP_TILT_END = 0.33;
const CUP_LEAVE_START = 0.34;
const CUP_LEAVE_END = 0.4;
const POUR_START = 0.26;
const POUR_END = 0.4;
const SETTLE_END = 0.9;
const SWALLOW_START = 0.78;
const SWALLOW_LENGTH = 0.16;
const SWALLOW_SQUEEZE = 0.5;

const WAVE_START = 0.05;
const WAVE_END = 0.9;
const RING_GAP = 0.18;
const BALL_LAG = 0.06;
const SURGES = 3;
const SURGE_DEPTH = 0.9;

const DRAIN_START = 0.05;
const DRAIN_END = 0.9;
const MIN_FALL = 0.35;
const MAX_FALL = 0.8;
const MIN_RATE = 0.3;
const FAT_DRAG = 1.4;
const PROTEIN_DRAG = 0.5;
const KCAL_FAT = 9;
const KCAL_OTHER = 4;
const EMPTY_LEVEL = 0.08;
const MIN_PULSES = 3;
const MAX_PULSES = 5;

const PULSE_FROM = 0.1;
const PULSE_LENGTH = 0.3;
const BURST_FROM = 0.08;
const BURST_LENGTH = 0.3;
const EVENTS_END = 0.9;

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
const linear = (lo: number, hi: number, v: number): number => clamp01((v - lo) / (hi - lo));
const ease = (lo: number, hi: number, v: number): number => {
  const t = linear(lo, hi, v);
  return t * t * (3 - 2 * t);
};
const bump = (lo: number, length: number, v: number): number => {
  if (v <= lo || v >= lo + length) return 0;
  return Math.sin(Math.PI * ((v - lo) / length));
};
const steps = (starts: number[], length: number, v: number): number => {
  let done = 0;
  for (const start of starts) done += ease(start, start + length, v);
  return done / starts.length;
};

export function intakePath(p: number, out: IntakePose): IntakePose {
  out.travel = ease(TRAVEL_START, TRAVEL_END, p);
  out.scale = 1 - steps(BITE_STARTS, BITE_LENGTH, p);
  out.tilt = 0;
  return out;
}

export function sipPath(p: number, out: IntakePose): IntakePose {
  out.travel = ease(TRAVEL_START, TRAVEL_END, p);
  out.tilt = ease(SIP_TILT_START, SIP_TILT_END, p);
  out.scale = 1 - ease(CUP_LEAVE_START, CUP_LEAVE_END, p);
  return out;
}

export const pourIn = (p: number): number => ease(POUR_START, POUR_END, p);

export const sipSettle = (p: number): number => ease(CHEW_START, SETTLE_END, p);

export const sipSqueeze = (p: number): number => SWALLOW_SQUEEZE * bump(SWALLOW_START, SWALLOW_LENGTH, p);

export const chewPulse = (p: number): number => steps(PRESS_STARTS, PRESS_LENGTH, p);

export function mouthSqueeze(p: number): number {
  let squeeze = 0;
  for (const start of BITE_STARTS) squeeze += bump(start, BITE_LENGTH, p);
  for (const start of PRESS_STARTS) squeeze += bump(start, PRESS_LENGTH, p);
  return clamp01(squeeze);
}

const wave = (p: number, rings: number): number => (1 + (rings - 1) * RING_GAP + BALL_LAG) * linear(WAVE_START, WAVE_END, p);

export function ringPositions(p: number, rings: number, out: number[]): number[] {
  const w = wave(p, rings);
  for (let i = 0; i < rings; i++) out[i] = clamp01(w - i * RING_GAP);
  return out;
}

export function surgeProgress(p: number, rings: number): number {
  const w = wave(p, rings);
  const surge = (SURGE_DEPTH / (2 * Math.PI * SURGES)) * Math.sin(2 * Math.PI * SURGES * w);
  return clamp01(w - BALL_LAG - surge);
}

export function drainRate(totals: Nutrients): number {
  const fat = totals.fat * KCAL_FAT;
  const protein = totals.protein * KCAL_OTHER;
  const energy = fat + protein + (totals.sugar + totals.starch) * KCAL_OTHER;
  if (!(energy > 0)) return 1;
  const rate = 1 - (FAT_DRAG * fat + PROTEIN_DRAG * protein) / energy;
  return Math.min(1, Math.max(MIN_RATE, rate));
}

export const drainLevel = (p: number, rate: number): number => 1 - (MIN_FALL + (MAX_FALL - MIN_FALL) * clamp01(rate)) * ease(DRAIN_START, DRAIN_END, p);

export function drain4hLevel(p: number, start = 1): number {
  const from = Number.isNaN(start) ? 1 : Math.min(Math.max(start, EMPTY_LEVEL), 1);
  return from - (from - EMPTY_LEVEL) * linear(DRAIN_START, DRAIN_END, p);
}

export const pulseCount = (rate: number): number => MIN_PULSES + Math.round((MAX_PULSES - MIN_PULSES) * linear(MIN_RATE, 1, rate));

function windows(p: number, count: number, from: number, length: number, out: number[]): number[] {
  const gap = count > 1 ? (EVENTS_END - length - from) / (count - 1) : 0;
  for (let k = 0; k < count; k++) {
    const end = EVENTS_END - (count - 1 - k) * gap;
    out[k] = linear(end - length, end, p);
  }
  return out;
}

export const pulseTimes = (p: number, count: number, out: number[]): number[] => windows(p, count, PULSE_FROM, PULSE_LENGTH, out);

export const burstTimes = (p: number, bursts: number, out: number[]): number[] => windows(p, bursts, BURST_FROM, BURST_LENGTH, out);
