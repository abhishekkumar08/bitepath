import * as THREE from 'three';
import { MIN_STREAM_AMOUNT } from '@/engine/totals';
import type { Nutrient, Nutrients } from '@/engine/types';
import type { Anchors, Vec3 } from '@/models/types';
import type { CirculationTarget } from '@/scene/beats/types';
import { massParticles } from '@/scene/flow';
import { NUTRIENT_COLOR } from '@/scene/path';

const PORTAL_BOW = 0.3;
const SPINE_SHARE = 0.33;
const CISTERN_BACK = 0.7;
const CISTERN_RISE = 0.15;
const THORAX_AT = 0.85;
const THORAX_BACK = 0.8;
const LOWER_SHARE = 0.25;
const LOOP_WIDTH = 0.18;
const MIN_LOOP_WIDTH = 0.012;
const LAPS = 1.6;
const LAUNCH_SPAN = 0.4;
const MIN_SHARE = 3;
const NEUTRAL_PORTAL = 0x9fd3ff;
const GLOW_RISE = 0.06;
const GLOW_FLOOR = 0.55;
const GLOW_BEATS = 3;
const HEARTBEATS = 6;
const BEAT_SHARPNESS = 6;
const MIN_GLOW_CHROMA = 0.4;
const WATER_SOLUBLE: Nutrient[] = ['sugar', 'starch', 'protein', 'iron', 'alcohol', 'caffeine'];

export const CIRCULATION_TARGETS: readonly CirculationTarget[] = ['brain', 'liver', 'smallIntestine', 'lower'];

const UP = new THREE.Vector3(0, 1, 0);
const vec = (v: Vec3): THREE.Vector3 => new THREE.Vector3(...v);

export function portalPath(anchors: Anchors, front: Vec3): THREE.CatmullRomCurve3 {
  const from = vec(anchors.smallIntestine);
  const to = vec(anchors.liver);
  const patientLeft = new THREE.Vector3().crossVectors(UP, vec(front)).normalize();
  const bow = from.clone().lerp(to, 0.5).addScaledVector(patientLeft, PORTAL_BOW * from.distanceTo(to));
  return new THREE.CatmullRomCurve3([from, bow, to], false, 'centripetal');
}

export function lymphPath(anchors: Anchors, front: Vec3, depth: number): THREE.CatmullRomCurve3 {
  const from = vec(anchors.smallIntestine);
  const heart = vec(anchors.heart);
  const back = vec(front).negate().multiplyScalar(SPINE_SHARE * depth);
  const rise = (heart.y - from.y) * CISTERN_RISE;
  return new THREE.CatmullRomCurve3(
    [
      from,
      from.clone().addScaledVector(back, CISTERN_BACK).addScaledVector(UP, rise),
      from.clone().lerp(heart, 0.5).add(back),
      from.clone().lerp(heart, THORAX_AT).addScaledVector(back, THORAX_BACK),
      heart,
    ],
    false,
    'centripetal',
  );
}

export function torsoDepth(box: THREE.Box3, front: Vec3): number {
  if (box.isEmpty()) return 0;
  const size = box.getSize(new THREE.Vector3());
  return size.x * Math.abs(front[0]) + size.y * Math.abs(front[1]) + size.z * Math.abs(front[2]);
}

export function lowerBodyPoint(anchors: Anchors, minY: number): Vec3 {
  const [x, y, z] = anchors.colon;
  return [x, y + LOWER_SHARE * (minY - y), z];
}

export function circulationLoops(anchors: Anchors, lower: Vec3, front: Vec3): THREE.CatmullRomCurve3[] {
  const heart = vec(anchors.heart);
  const facing = vec(front);
  return CIRCULATION_TARGETS.map((id) => {
    const target = vec(id === 'lower' ? lower : anchors[id]);
    const dir = target.clone().sub(heart);
    const side = new THREE.Vector3().crossVectors(dir, facing);
    if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
    side.normalize().multiplyScalar(Math.max(MIN_LOOP_WIDTH, LOOP_WIDTH * dir.length()));
    const middle = heart.clone().lerp(target, 0.5);
    return new THREE.CatmullRomCurve3([heart, middle.clone().add(side), target, middle.clone().sub(side)], true, 'centripetal');
  });
}

const launchOf = (i: number, count: number): number => (LAUNCH_SPAN * i) / count;

export function dotPhase(i: number, count: number, p: number): number | null {
  const t = (p - launchOf(i, count)) * LAPS;
  if (t < 0) return null;
  return t - Math.floor(t);
}

export const dotReachedAt = (i: number, count: number, phase: number): number => launchOf(i, count) + phase / LAPS;

export function dotLoop(i: number, emphasiseBrain: boolean): number {
  const loops = CIRCULATION_TARGETS.length;
  if (!emphasiseBrain) return i % loops;
  return i % 2 === 0 ? 0 : 1 + ((i >> 1) % (loops - 1));
}

export const pathSample = (curve: THREE.Curve<THREE.Vector3>, u: number, target: THREE.Vector3): THREE.Vector3 =>
  curve.getPoint(Math.min(1, Math.max(0, u)), target);

const portalHue = (n: Nutrient): number => NUTRIENT_COLOR[n === 'starch' ? 'sugar' : n];

export function portalColors(totals: Nutrients, count: number): number[] {
  const mass = massParticles(totals);
  const present = WATER_SOLUBLE.filter((n) => totals[n] >= MIN_STREAM_AMOUNT && (mass[n] ?? 0) > 0);
  if (present.length === 0) return new Array<number>(count).fill(NEUTRAL_PORTAL);
  const floor = Math.min(MIN_SHARE, Math.floor(count / present.length));
  const weight = present.map((n) => mass[n] ?? 0);
  const sum = weight.reduce((a, b) => a + b, 0);
  const spare = count - floor * present.length;
  const exact = weight.map((w) => (spare * w) / sum);
  const shares = exact.map((e) => floor + Math.floor(e));
  const order = exact.map((e, k) => [e - Math.floor(e), k] as const).sort((a, b) => b[0] - a[0]);
  for (let r = count - shares.reduce((a, b) => a + b, 0), j = 0; r > 0; r--, j++) shares[order[j % order.length][1]] += 1;
  const credit = shares.map(() => 0);
  const colors: number[] = [];
  for (let k = 0; k < count; k++) {
    let best = 0;
    for (let n = 0; n < shares.length; n++) {
      credit[n] += shares[n];
      if (credit[n] > credit[best]) best = n;
    }
    credit[best] -= count;
    colors.push(portalHue(present[best]));
  }
  return colors;
}

export function glowAfter(p: number, from: number): number {
  if (p <= from) return 0;
  const rise = Math.min(1, (p - from) / GLOW_RISE);
  const beat = Math.abs(Math.sin(Math.PI * GLOW_BEATS * (p - from)));
  return rise * (GLOW_FLOOR + (1 - GLOW_FLOOR) * beat);
}

export const heartbeat = (p: number): number => Math.abs(Math.sin(Math.PI * HEARTBEATS * p)) ** BEAT_SHARPNESS;

function channels(hex: number): [number, number] {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return [Math.max(r, g, b), Math.min(r, g, b)];
}

export function glowTone(colors: number[], fallback: number): number {
  let best = fallback;
  let bestChroma = MIN_GLOW_CHROMA;
  for (const hex of new Set(colors)) {
    const [hi, lo] = channels(hex);
    if (hi - lo >= bestChroma) {
      best = hex;
      bestChroma = hi - lo;
    }
  }
  return best;
}

export function glowStrength(hex: number, max: number): number {
  const [hi, lo] = channels(hex);
  return max * (1 - (hi + lo) / 2);
}

export const popSize = (u: number, pop: number): number => Math.max(0, Math.min(1, pop * u, pop * (1 - u)));
