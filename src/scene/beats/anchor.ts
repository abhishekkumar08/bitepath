import * as THREE from 'three';
import type { AnchorId, OrganId, Vec3 } from '@/models/types';
import type { LoadedBody } from '@/scene/types';

export function organCentre(body: LoadedBody, organ: OrganId, fallback: AnchorId, out: Vec3): Vec3 {
  const object = body.organs[organ];
  const box = object ? new THREE.Box3().setFromObject(object) : null;
  if (!box || box.isEmpty()) {
    const [x, y, z] = body.anchors[fallback];
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  }
  const centre = box.getCenter(new THREE.Vector3());
  out[0] = centre.x;
  out[1] = centre.y;
  out[2] = centre.z;
  return out;
}
