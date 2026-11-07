import { ORGANS, type OrganId, type Vec3 } from '@/models/types';
import type { Box } from './types';

const AXES = [0, 1, 2] as const;
const BYTES_PER_MB = 1024 * 1024;

export const MAX_MODEL_BYTES = 30 * BYTES_PER_MB;

export function assertBudget(bytes: number, label: string): void {
  if (bytes > MAX_MODEL_BYTES) {
    throw new Error(`${label} is ${(bytes / BYTES_PER_MB).toFixed(1)} MB, over the ${MAX_MODEL_BYTES / BYTES_PER_MB} MB budget`);
  }
}

export const boxInside = (inner: Box, outer: Box, tolerance: number): boolean =>
  AXES.every((a) => inner.min[a] >= outer.min[a] - tolerance && inner.max[a] <= outer.max[a] + tolerance);

export const boxGap = (a: Box, b: Box): number =>
  Math.hypot(...AXES.map((i) => Math.max(b.min[i] - a.max[i], 0, a.min[i] - b.max[i])));

export const pointBoxGap = (p: Vec3, b: Box): number => boxGap({ min: p, max: p }, b);

export const missingOrgans = (tagged: Set<OrganId>): OrganId[] => ORGANS.filter((o) => !tagged.has(o));
