import * as THREE from 'three';
import type { StarId } from '@/engine/types';
import type { AnchorId, Anchors, OrganId, Vec3 } from '@/models/types';
import { along, lerp } from '@/models/vec';
import { NUTRIENT_COLOR } from '@/scene/path';
import type { CameraGoal, LoadedBody, StarGoalFn } from '@/scene/types';

const OUTSIDE = 0.3;
const INSIDE = 0.01;

const smooth = (u: number): number => u * u * (3 - 2 * u);

const dive = (at: Vec3, front: Vec3, u: number): CameraGoal => ({
  target: at,
  position: along(at, front, OUTSIDE + (INSIDE - OUTSIDE) * smooth(u)),
});

const pan = (from: Vec3, to: Vec3, front: Vec3, u: number): CameraGoal => {
  const target = lerp(from, to, smooth(u));
  return { target, position: along(target, front, OUTSIDE) };
};

const PANS: Partial<Record<StarId, [AnchorId, AnchorId]>> = {
  iron: ['duodenum', 'duodenum'],
  sugar: ['duodenum', 'liver'],
  fat: ['smallIntestine', 'heart'],
  caffeine: ['heart', 'brain'],
};

const DIVES: Partial<Record<StarId, AnchorId>> = { alcohol: 'stomach', fibre: 'colon' };

export const starGoal: StarGoalFn = (star, anchors: Anchors, front, progress) => {
  const diveAt = DIVES[star];
  if (diveAt) return dive(anchors[diveAt], front, progress);
  const [from, to] = PANS[star] ?? ['heart', 'heart'];
  return pan(anchors[from], anchors[to], front, progress);
};

const STAR_ORGAN: Record<StarId, OrganId> = {
  alcohol: 'stomach',
  iron: 'smallIntestine',
  sugar: 'liver',
  fat: 'heart',
  caffeine: 'brain',
  fibre: 'colon',
};

export const STAR_ORGANS: readonly OrganId[] = Object.values(STAR_ORGAN);

export function meshesOf(object: THREE.Object3D | undefined): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  object?.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  return meshes;
}

export const starOrgan = (star: StarId): OrganId => STAR_ORGAN[star];

const materialCache = new WeakMap<THREE.Object3D, THREE.MeshPhysicalMaterial[]>();

function materialsOf(organ: THREE.Object3D | undefined): readonly THREE.MeshPhysicalMaterial[] {
  if (!organ) return [];
  let materials = materialCache.get(organ);
  if (!materials) {
    materials = meshesOf(organ).map((mesh) => mesh.material as THREE.MeshPhysicalMaterial);
    materialCache.set(organ, materials);
  }
  return materials;
}

export function applyStarEffect(body: LoadedBody, star: StarId | null, progress: number): void {
  for (const id of STAR_ORGANS) {
    for (const material of materialsOf(body.organs[id])) material.emissiveIntensity = 0;
  }
  if (!star) return;
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(progress * Math.PI * 3));
  for (const material of materialsOf(body.organs[STAR_ORGAN[star]])) {
    material.emissive.setHex(NUTRIENT_COLOR[star]);
    material.emissiveIntensity = pulse;
  }
}
