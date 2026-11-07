import type { Vec3 } from '@/models/types';
import { along } from '@/models/vec';
import type { CameraGoal, Point3 } from '@/scene/types';

const FRAME_MARGIN = 1.4;

export const framedReach = (extent: number, radius: number, shortSidePx: number): number => (extent / (radius * FRAME_MARGIN)) * (shortSidePx / 2);

export const cameraBlend = (step: number, ease: number, reducedMotion: boolean): number => (reducedMotion ? 1 : 1 - Math.exp(-step * ease));

export function frameSphere(center: Vec3, radius: number, front: Vec3, fovDeg: number): CameraGoal {
  const distance = (radius * FRAME_MARGIN) / Math.sin((fovDeg * Math.PI) / 360);
  return { target: center, position: along(center, front, distance) };
}

export function fitInto(out: CameraGoal, centre: Point3, radius: number, dir: Point3, fovDeg: number, aspect: number): CameraGoal {
  const half = Math.min((fovDeg * Math.PI) / 360, Math.atan(Math.tan((fovDeg * Math.PI) / 360) * aspect));
  const distance = (radius * FRAME_MARGIN) / Math.sin(half);
  out.target[0] = centre.x;
  out.target[1] = centre.y;
  out.target[2] = centre.z;
  out.position[0] = centre.x + dir.x * distance;
  out.position[1] = centre.y + dir.y * distance;
  out.position[2] = centre.z + dir.z * distance;
  return out;
}
