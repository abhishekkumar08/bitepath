import type { Vec3 } from '@/models/types';
import type { AxisFit, Box, Landmarks } from './types';

const MM_PER_M = 1000;
const MAX_AXIS_SCALE_RATIO = 1.35;
const MIN_FRONT_OFFSET_M = 0.02;
const AXES = [0, 1, 2] as const;

export const bp3dToYUp = (p: Vec3): Vec3 => [p[0] / MM_PER_M, p[2] / MM_PER_M, -p[1] / MM_PER_M];

export function boxOfPositions(positions: number[]): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (const a of AXES) {
      min[a] = Math.min(min[a], positions[i + a]);
      max[a] = Math.max(max[a], positions[i + a]);
    }
  }
  return { min, max };
}

export function unionBox(boxes: Box[]): Box {
  return {
    min: AXES.map((a) => Math.min(...boxes.map((b) => b.min[a]))) as Vec3,
    max: AXES.map((a) => Math.max(...boxes.map((b) => b.max[a]))) as Vec3,
  };
}

export const boxCenter = (b: Box): Vec3 => AXES.map((a) => (b.min[a] + b.max[a]) / 2) as Vec3;

export function fitBoxes(from: Box, to: Box): AxisFit {
  const scale = AXES.map((a) => (to.max[a] - to.min[a]) / (from.max[a] - from.min[a])) as Vec3;
  const offset = AXES.map((a) => to.min[a] - from.min[a] * scale[a]) as Vec3;
  return { scale, offset };
}

export const combineFits = (xz: AxisFit, y: AxisFit): AxisFit => ({
  scale: [xz.scale[0], y.scale[1], xz.scale[2]],
  offset: [xz.offset[0], y.offset[1], xz.offset[2]],
});

export const applyFit = (f: AxisFit, p: Vec3): Vec3 => AXES.map((a) => p[a] * f.scale[a] + f.offset[a]) as Vec3;

export function isPlausibleFit(f: AxisFit): boolean {
  const smallest = Math.min(...f.scale);
  return smallest > 0 && Math.max(...f.scale) / smallest < MAX_AXIS_SCALE_RATIO;
}

const sameSign = (a: number, b: number): number => (Math.sign(a) === Math.sign(b) ? 1 : -1);

export function axisSigns(from: Landmarks, to: Landmarks): Vec3 {
  return [
    sameSign(from.liver[0] - from.pancreas[0], to.liver[0] - to.pancreas[0]),
    sameSign(from.liver[1] - from.pelvis[1], to.liver[1] - to.pelvis[1]),
    sameSign(from.liver[2] - from.spine[2], to.liver[2] - to.spine[2]),
  ];
}

export function assertProperRotation(signs: Vec3): void {
  if (signs[0] * signs[1] * signs[2] < 0) {
    throw new Error(`BodyParts3D axes are mirrored relative to HuBMAP (signs ${signs.join(', ')}); fix bp3dToYUp`);
  }
}

export const applySigns = (signs: Vec3, p: Vec3): Vec3 => [p[0] * signs[0], p[1] * signs[1], p[2] * signs[2]];

export function horizontalFront(gut: Vec3, spine: Vec3): Vec3 {
  const x = gut[0] - spine[0];
  const z = gut[2] - spine[2];
  const length = Math.hypot(x, z);
  if (length < MIN_FRONT_OFFSET_M) throw new Error(`body front is ambiguous: gut is only ${length.toFixed(3)} m from the spine horizontally`);
  return [x / length, 0, z / length];
}
