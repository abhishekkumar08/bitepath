import type * as THREE from 'three';

export interface OrganRest {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  centre: THREE.Vector3;
}

export interface HeldDish {
  holder: THREE.Group;
  model: THREE.Group;
  fit: number;
  sip: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
}
