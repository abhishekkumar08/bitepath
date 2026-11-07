import * as THREE from 'three';
import type { OrganRest } from '@/scene/beats/bodyTypes';

const rests = new WeakMap<THREE.Object3D, OrganRest>();
const box = new THREE.Box3();

function restOf(object: THREE.Object3D): OrganRest | null {
  const known = rests.get(object);
  if (known) return known;
  box.setFromObject(object);
  if (box.isEmpty()) return null;
  const centre = box.getCenter(new THREE.Vector3());
  if (object.parent) object.parent.worldToLocal(centre);
  const rest = { position: object.position.clone(), scale: object.scale.clone(), centre };
  rests.set(object, rest);
  return rest;
}

export function pulseOrgan(object: THREE.Object3D, scale: number): void {
  const rest = restOf(object);
  if (!rest) return;
  object.scale.copy(rest.scale).multiplyScalar(scale);
  object.position.copy(rest.position).multiplyScalar(scale).addScaledVector(rest.centre, 1 - scale);
  object.updateMatrixWorld(true);
}

export function restoreOrgan(object: THREE.Object3D): void {
  const rest = rests.get(object);
  if (!rest) return;
  object.position.copy(rest.position);
  object.scale.copy(rest.scale);
  object.updateMatrixWorld(true);
  rests.delete(object);
}
