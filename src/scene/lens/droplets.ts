import * as THREE from 'three';
import { gradientTexture, haloMaterial } from '@/scene/lens/materials';
import { createPool } from '@/scene/lens/pool';
import { bileFall, blobRadius, dropletOffset, emulsifyCounts, splitCount, splitWindow } from '@/scene/lens/microMotion';
import { hash01 } from '@/scene/lens/motion';
import type { EmulsifyOptions, EmulsifyScene, MotionPoint } from '@/scene/lens/types';
import { NUTRIENT_COLOR } from '@/scene/path';

const BLOBS = {
  2: [
    { x: -0.42, y: -0.08, z: 0, r: 0.34 },
    { x: 0.44, y: -0.14, z: -0.1, r: 0.31 },
  ],
  3: [
    { x: -0.5, y: -0.22, z: 0, r: 0.3 },
    { x: 0.5, y: -0.26, z: -0.1, r: 0.28 },
    { x: 0.02, y: 0.32, z: -0.15, r: 0.27 },
  ],
};
const SPREAD = 0.38;
const DROPLET_RADIUS = 0.03;
const DROPLET_VARY = 0.02;
const GROW = 0.04;
const JIGGLE = 0.014;
const WOBBLE = 0.035;
const BILE_PER_BLOB = 18;
const BILE_RADIUS = 0.028;
const STREAK = 2.6;
const BILE_GAP = 0.03;
const CAMERA = { x: 0, y: 0.05, z: 2.9 };
const BILE_COLOR = 0x86d65e;

export function createEmulsifyScene(opts: EmulsifyOptions): EmulsifyScene {
  const { blobs: blobCount, droplets: perBlob } = emulsifyCounts(opts.fat);
  const layout = BLOBS[blobCount === 3 ? 3 : 2];

  const scene = new THREE.Scene();
  const background = gradientTexture([
    [0, '#0f0408'],
    [0.5, '#2c0c14'],
    [1, '#5c2329'],
  ]);
  scene.background = background;
  scene.fog = new THREE.Fog(0x2c0c14, 3.4, 7);
  scene.add(new THREE.HemisphereLight(0xfff2e6, 0x30101a, 1.1));
  const key = new THREE.DirectionalLight(0xfff4ea, 2.4);
  key.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0xffc79a, 1.1);
  rim.position.set(1.5, 2, -4);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  camera.lookAt(0, 0, 0);

  const { instanced, dispose: disposePool } = createPool(scene);

  const blobs = instanced(new THREE.SphereGeometry(1, 48, 32), haloMaterial({ halo: 0.55, color: NUTRIENT_COLOR.fat, emissiveIntensity: 0.12 }), blobCount);
  const dropletCount = blobCount * perBlob;
  const droplets = instanced(new THREE.IcosahedronGeometry(1, 3), haloMaterial({ halo: 0.7, color: NUTRIENT_COLOR.fat, emissiveIntensity: 0.4 }), dropletCount);
  const dropletSize = Float32Array.from({ length: dropletCount }, (_, i) => DROPLET_RADIUS + DROPLET_VARY * hash01(i, 5));
  const bileCount = blobCount * BILE_PER_BLOB;
  const bile = instanced(new THREE.IcosahedronGeometry(1, 2), haloMaterial({ halo: 0.5, color: BILE_COLOR, emissiveIntensity: 0.45 }), bileCount);
  const bileDir = Array.from({ length: bileCount }, (_, k) => {
    const a = hash01(k, 7) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.8 + 0.25, 0.45 + 0.4 * hash01(k, 11)).normalize();
  });
  const bileReach = Float32Array.from({ length: bileCount }, (_, k) => 0.3 + 0.7 * hash01(k, 13));
  const matrix = new THREE.Matrix4();
  const offset: MotionPoint = { x: 0, y: 0, z: 0 };
  let time = 0;
  let progress = 0;

  const place = (): void => {
    for (let b = 0; b < blobCount; b++) {
      const home = layout[b];
      const u = splitWindow(b, blobCount, progress);
      const radius = home.r * blobRadius(u);
      const wobble = WOBBLE * Math.sin(time * 1.7 + b * 2.1);
      blobs.setMatrixAt(b, matrix.makeScale(radius * (1 + wobble), radius * (1 - wobble), radius).setPosition(home.x, home.y, home.z));

      const pieces = splitCount(u, perBlob);
      for (let d = 0; d < perBlob; d++) {
        const i = b * perBlob + d;
        const out = u >= 1 || d < pieces - 1;
        if (!out) {
          droplets.setMatrixAt(i, matrix.makeScale(0, 0, 0));
          continue;
        }
        dropletOffset(d, perBlob, u, offset);
        const size = dropletSize[i] * Math.min(1, (u - (d + 1) / perBlob) / GROW + 0.35);
        const jx = JIGGLE * Math.sin(time * (1.1 + hash01(i, 19)) + i);
        const jy = JIGGLE * Math.sin(time * (0.9 + hash01(i, 23)) + i * 1.7);
        droplets.setMatrixAt(
          i,
          matrix.makeScale(size, size, size).setPosition(home.x + offset.x * SPREAD + jx, home.y + offset.y * SPREAD + jy, home.z + offset.z * SPREAD),
        );
      }

      for (let k = b; k < bileCount; k += blobCount) {
        const landed = bileFall(k, bileCount, progress, offset);
        const streak = 1 + STREAK * (1 - landed) * (1 - landed);
        const dir = bileDir[k];
        const shell = radius + BILE_GAP + SPREAD * bileReach[k] * Math.min(1, u);
        const jx = JIGGLE * Math.sin(time * 1.3 + k * 2.7);
        bile.setMatrixAt(
          k,
          matrix
            .makeScale(BILE_RADIUS / Math.sqrt(streak), BILE_RADIUS * streak, BILE_RADIUS)
            .setPosition(home.x + dir.x * shell + offset.x + jx, home.y + dir.y * shell + offset.y, home.z + dir.z * shell),
        );
      }
    }
    blobs.instanceMatrix.needsUpdate = true;
    droplets.instanceMatrix.needsUpdate = true;
    bile.instanceMatrix.needsUpdate = true;
  };

  place();

  return {
    scene,
    camera,
    setProgress(p: number): void {
      progress = p;
    },
    update(dt: number): void {
      time += dt;
      place();
    },
    dispose(): void {
      disposePool();
      background.dispose();
    },
  };
}
