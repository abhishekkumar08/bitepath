import type { HeapPoint, ProfilePoint } from '@/scene/food/types';

export const HEAP_RISE = 0.6;
const HEAP_GAP = 0.55;
const HEAP_SHELL = 0.45;
const HEAP_TRIES = 400;

export function random(seed: number): () => number {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lattice(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const u = fade(x - ix);
  const v = fade(y - iy);
  const w = fade(z - iz);
  const corner = (dx: number, dy: number, dz: number): number => lattice(ix + dx, iy + dy, iz + dz, seed);
  return mix(
    mix(mix(corner(0, 0, 0), corner(1, 0, 0), u), mix(corner(0, 1, 0), corner(1, 1, 0), u), v),
    mix(mix(corner(0, 0, 1), corner(1, 0, 1), u), mix(corner(0, 1, 1), corner(1, 1, 1), u), v),
    w,
  );
}

export function blobDisplace(positions: Float32Array, seed: number, amount: number, frequency: number): void {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] as number;
    const y = positions[i + 1] as number;
    const z = positions[i + 2] as number;
    const r = Math.hypot(x, y, z);
    if (r === 0 || amount === 0) continue;
    const scale = (r + amount * noise3(x * frequency, y * frequency, z * frequency, seed)) / r;
    positions[i] = x * scale;
    positions[i + 1] = y * scale;
    positions[i + 2] = z * scale;
  }
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

export function lathePoints(profile: ProfilePoint[], steps: number): ProfilePoint[] {
  if (profile.length < 2) return profile.map((p) => ({ ...p }));
  const at = (i: number): ProfilePoint => profile[Math.min(Math.max(i, 0), profile.length - 1)] as ProfilePoint;
  const out: ProfilePoint[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ r: Math.max(0, catmull(p0.r, p1.r, p2.r, p3.r, t)), y: catmull(p0.y, p1.y, p2.y, p3.y, t) });
    }
  }
  const last = at(profile.length - 1);
  out.push({ r: Math.max(0, last.r), y: last.y });
  return out;
}

export function shellProfile(outer: ProfilePoint[], thickness: number): ProfilePoint[] {
  const at = (i: number): ProfilePoint => outer[Math.min(Math.max(i, 0), outer.length - 1)] as ProfilePoint;
  const inner = outer.map((p, i) => {
    const tr = at(i + 1).r - at(i - 1).r;
    const ty = at(i + 1).y - at(i - 1).y;
    const length = Math.hypot(tr, ty) || 1;
    const r = i === 0 ? 0 : Math.max(0, p.r - (ty / length) * thickness);
    return { r, y: p.y + (tr / length) * thickness };
  });
  return [...outer.map((p) => ({ ...p })), ...inner.reverse()];
}

export function heapSpacing(count: number, radius: number): number {
  const volume = (2 / 3) * Math.PI * radius * radius * radius * HEAP_RISE;
  return HEAP_GAP * Math.cbrt(volume / Math.max(count, 1));
}

export function heapPositions(count: number, radius: number, seed: number): HeapPoint[] {
  const rand = random(seed);
  const gap = heapSpacing(count, radius);
  const points: HeapPoint[] = [];
  const nearest = (p: HeapPoint): number => points.reduce((best, q) => Math.min(best, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)), Infinity);
  const sample = (): HeapPoint => {
    const dy = Math.sqrt(rand());
    const ring = Math.sqrt(1 - dy * dy);
    const phi = rand() * Math.PI * 2;
    const depth = 1 - HEAP_SHELL * rand();
    return { x: ring * Math.cos(phi) * depth * radius, y: dy * depth * radius * HEAP_RISE, z: ring * Math.sin(phi) * depth * radius };
  };
  while (points.length < count) {
    let best = sample();
    let bestGap = nearest(best);
    for (let tries = 1; bestGap < gap && tries < HEAP_TRIES; tries++) {
      const candidate = sample();
      const distance = nearest(candidate);
      if (distance > bestGap) {
        best = candidate;
        bestGap = distance;
      }
    }
    points.push(best);
  }
  return points;
}
