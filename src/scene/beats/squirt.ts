import * as THREE from 'three';
import type { Squirt, SquirtOptions } from '@/scene/beats/types';
import { random } from '@/scene/food/modelParts';

const SQUIRT_RENDER_ORDER = 11;
const TRAIN = 0.45;
const POP = 4;

export function createSquirt(options: SquirtOptions): Squirt {
  const { curve, events, perEvent, color, radius, spread, flare } = options;
  const rand = random(options.seed);
  const total = events * perEvent;
  const geometry = new THREE.SphereGeometry(1, 12, 8);
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0, transparent: true, depthTest: false, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geometry, material, total);
  mesh.name = 'squirt';
  mesh.renderOrder = SQUIRT_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.count = 0;
  const jitter = Array.from({ length: total }, () => new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1));
  const size = Array.from({ length: total }, () => 0.7 + 0.6 * rand());
  const matrix = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const turn = new THREE.Quaternion();

  return {
    mesh,
    update(times) {
      let shown = 0;
      for (let k = 0; k < events; k++) {
        const t = times[k] ?? 0;
        if (t <= 0 || t >= 1) continue;
        for (let j = 0; j < perEvent; j++) {
          const u = t * (1 + TRAIN) - (j / perEvent) * TRAIN;
          if (u <= 0 || u >= 1) continue;
          const i = k * perEvent + j;
          const arc = Math.sin(Math.PI * u);
          curve.getPoint(u, point).addScaledVector(jitter[i] as THREE.Vector3, spread * (arc + flare * u * u));
          const s = radius * (size[i] as number) * Math.min(1, POP * arc);
          mesh.setMatrixAt(shown, matrix.compose(point, turn, scale.setScalar(s)));
          shown += 1;
        }
      }
      mesh.count = shown;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
