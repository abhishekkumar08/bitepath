import { Quaternion, Vector3 } from 'three';
import type { Vec3 } from '@/models/types';
import { boxCenter, boxOfPositions } from './align';
import type { ArmPose, Side } from './types';

const HEAD_FRACTION = 0.1;
const MIN_ARM_SCALE = 0.8;
const MAX_ARM_SCALE = 1.25;
const DEGREES_PER_RADIAN = 180 / Math.PI;

const vertexAt = (positions: number[], i: number): Vec3 => [positions[i], positions[i + 1], positions[i + 2]];

export function humeralHead(positions: number[]): Vec3 {
  const heights: number[] = [];
  for (let i = 1; i < positions.length; i += 3) heights.push(positions[i]);
  heights.sort((a, b) => b - a);
  const cutoff = heights[Math.max(0, Math.ceil(heights.length * HEAD_FRACTION) - 1)];
  const head: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i + 1] >= cutoff) head.push(...vertexAt(positions, i));
  }
  return boxCenter(boxOfPositions(head));
}

export function farthestPoint(positions: number[], from: Vec3): Vec3 {
  if (positions.length === 0) throw new Error('No vertices to search');
  let best = 0;
  let bestDistance = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const distance = Math.hypot(positions[i] - from[0], positions[i + 1] - from[1], positions[i + 2] - from[2]);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return vertexAt(positions, best);
}

export function lateralPoint(positions: number[], direction: 1 | -1): Vec3 {
  if (positions.length === 0) throw new Error('No vertices to search');
  let best = 0;
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i] * direction > positions[best] * direction) best = i;
  }
  return vertexAt(positions, best);
}

export function poseArm(pivot: Vec3, fingertip: Vec3, target: Vec3): ArmPose {
  const origin = new Vector3(...pivot);
  const from = new Vector3(...fingertip).sub(origin);
  const to = new Vector3(...target).sub(origin);
  return {
    pivot,
    rotation: new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()),
    scale: to.length() / from.length(),
    angleDegrees: from.angleTo(to) * DEGREES_PER_RADIAN,
  };
}

export function applyArmPose(pose: ArmPose, p: Vec3): Vec3 {
  const v = new Vector3(p[0] - pose.pivot[0], p[1] - pose.pivot[1], p[2] - pose.pivot[2])
    .applyQuaternion(pose.rotation)
    .multiplyScalar(pose.scale);
  return [v.x + pose.pivot[0], v.y + pose.pivot[1], v.z + pose.pivot[2]];
}

export const isPlausibleArmScale = (scale: number): boolean => scale >= MIN_ARM_SCALE && scale <= MAX_ARM_SCALE;

export function rightSideSign(liverX: number, bodyCenterX: number): 1 | -1 {
  if (liverX === bodyCenterX) throw new Error('Cannot tell the body right from the liver: it sits on the midline');
  return liverX < bodyCenterX ? -1 : 1;
}

export function sideByCentroid(centroidX: number, midlineX: number, rightSign: 1 | -1): Side {
  if (centroidX === midlineX) throw new Error('Element sits on the midline; cannot tell its side');
  return Math.sign(centroidX - midlineX) === rightSign ? 'right' : 'left';
}

export function centroid(positions: number[]): Vec3 {
  if (positions.length === 0) throw new Error('No vertices to average');
  const sum: Vec3 = [0, 0, 0];
  for (let i = 0; i < positions.length; i += 3) {
    sum[0] += positions[i];
    sum[1] += positions[i + 1];
    sum[2] += positions[i + 2];
  }
  const count = positions.length / 3;
  return [sum[0] / count, sum[1] / count, sum[2] / count];
}

export function regionCentroid(positions: number[], anchor: Vec3, radius: number): Vec3 {
  const region: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const p = vertexAt(positions, i);
    if (Math.hypot(p[0] - anchor[0], p[1] - anchor[1], p[2] - anchor[2]) <= radius) region.push(...p);
  }
  return centroid(region);
}
