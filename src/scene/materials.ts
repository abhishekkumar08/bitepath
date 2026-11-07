import * as THREE from 'three';
import type { Layer, OrganId } from '@/models/types';

const LAYER_LOOK: Record<Exclude<Layer, 'organs'>, THREE.MeshPhysicalMaterialParameters> = {
  skin: { color: 0xd9a58a, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffc4b0) },
  muscle: { color: 0x9e2b25, roughness: 0.45, clearcoat: 0.2 },
  skeleton: { color: 0xe8dcc4, roughness: 0.7 },
};

const ORGAN_COLOR: Record<OrganId, number> = {
  mouth: 0xc4656b,
  oesophagus: 0xc9706e,
  stomach: 0xd98c84,
  smallIntestine: 0xe0a07a,
  liver: 0x7a2e26,
  gallbladder: 0x5f8f3e,
  pancreas: 0xe3b778,
  colon: 0xc98b6b,
  heart: 0x8f1d1d,
  vessels: 0xb3122e,
  brain: 0xd9a3a8,
};

const SEEN_FROM_INSIDE: readonly OrganId[] = ['stomach', 'colon'];

export function materialFor(layer: Layer, organ: OrganId | null): THREE.MeshPhysicalMaterial {
  if (layer !== 'organs') return new THREE.MeshPhysicalMaterial({ ...LAYER_LOOK[layer], transparent: true });
  return new THREE.MeshPhysicalMaterial({
    color: organ ? ORGAN_COLOR[organ] : 0xb07a6a,
    roughness: 0.35,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    transparent: true,
    side: organ && SEEN_FROM_INSIDE.includes(organ) ? THREE.DoubleSide : THREE.FrontSide,
  });
}
