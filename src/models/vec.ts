import type { Vec3 } from '@/models/types';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const lerp = (a: Vec3, b: Vec3, u: number): Vec3 => add(a, scale(sub(b, a), u));
export const along = (p: Vec3, dir: Vec3, d: number): Vec3 => add(p, scale(dir, d));
