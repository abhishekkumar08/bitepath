import type * as THREE from 'three';
import type { StationId } from '@/engine/types';
import type { OrganId } from '@/models/types';
import { meshesOf } from '@/scene/stars';
import type { LoadedBody } from '@/scene/types';

export const STATION_FOCUS: Record<StationId, OrganId> = {
  mouth: 'mouth',
  oesophagus: 'oesophagus',
  stomach: 'stomach',
  smallIntestine: 'smallIntestine',
  liver: 'liver',
  bloodstream: 'heart',
  largeIntestine: 'colon',
};

const DIMMED_OPACITY = 0.5;

interface FocusState {
  ids: OrganId[];
  meshes: Map<OrganId, THREE.Mesh[]>;
  dimmed: Set<OrganId>;
}

const states = new WeakMap<LoadedBody, FocusState>();

function stateOf(body: LoadedBody): FocusState {
  let state = states.get(body);
  if (!state) {
    const ids = (Object.keys(body.organs) as OrganId[]).filter((id) => id !== 'vessels');
    state = { ids, meshes: new Map(ids.map((id) => [id, meshesOf(body.organs[id])])), dimmed: new Set() };
    states.set(body, state);
  }
  return state;
}

function setOrganOpacity(meshes: THREE.Mesh[], opacity: number): void {
  for (const mesh of meshes) {
    const material = mesh.material as THREE.MeshPhysicalMaterial;
    material.opacity = opacity;
    material.depthWrite = opacity >= 1;
  }
}

export function applyFocus(body: LoadedBody, station: StationId | null, keep: OrganId | null): void {
  const { ids, meshes, dimmed } = stateOf(body);
  const focused = station ? STATION_FOCUS[station] : null;
  const dimAll = station !== null || keep !== null;
  for (const id of ids) {
    const shouldDim = dimAll && id !== focused && id !== keep;
    if (shouldDim) {
      if (dimmed.has(id)) continue;
      setOrganOpacity(meshes.get(id) ?? [], DIMMED_OPACITY);
      dimmed.add(id);
    } else if (dimmed.delete(id)) {
      setOrganOpacity(meshes.get(id) ?? [], 1);
    }
  }
}
