import * as THREE from 'three';
import { gradientTexture, haloMaterial } from '@/scene/lens/materials';
import { createPool } from '@/scene/lens/pool';
import { feedProgress, glowEmitAt, glowParticle, swarmJoin, swarmLeave, wander } from '@/scene/lens/microMotion';
import { GOLDEN, hash01 } from '@/scene/lens/motion';
import type { BacteriaOptions, BacteriaScene, MotionPoint } from '@/scene/lens/types';
import { NUTRIENT_COLOR } from '@/scene/path';

const BACTERIA = 30;
const FEEDERS = 22;
const ROD_RADIUS = 0.03;
const ROD_LENGTH = 0.11;
const ROD_HALF = ROD_LENGTH / 2 + ROD_RADIUS;
const ROD_COLOR = { body: 0xf2cdb8, end: 0x8e5248 };
const STRAND_HALF = 0.72;
const STRAND_RADIUS = 0.05;
const CHUNKS = 30;
const CHUNK = { length: 0.065, radius: 0.04 };
const TWIST = 0.03;
const TURNS = 3;
const GLOWS = 64;
const GLOW_DRIFT = 0.34;
const GLOW_CORE = 0.022;
const GLOW_HALO = 0.062;
const GLOW_COLOR = 0xffb547;
const NIBBLE = 0.014;
const RING = { fibre: 0.78, idle: 0.84 };
const ROAM = 0.2;
const LOOK_AHEAD = 0.3;
const CAMERA = { x: 0, y: 0.05, z: 2.9 };

const strandPoint = (s: number, out: THREE.Vector3): THREE.Vector3 =>
  out.set((2 * s - 1) * STRAND_HALF, -0.02 + 0.07 * Math.sin(2.4 * s + 0.4), 0.06 * Math.sin(3.1 * s));

export function createBacteriaScene(opts: BacteriaOptions): BacteriaScene {
  const feeders = opts.fibre ? FEEDERS : 0;
  const mode = opts.fibre ? 'fibre' : 'idle';

  const scene = new THREE.Scene();
  const background = gradientTexture([
    [0, '#0d0507'],
    [0.5, '#281014'],
    [1, '#4c2424'],
  ]);
  scene.background = background;
  scene.fog = new THREE.Fog(0x281014, 3.4, 7);
  scene.add(new THREE.HemisphereLight(0xfff0e6, 0x2a1014, 1.1));
  const key = new THREE.DirectionalLight(0xfff4ea, 2.3);
  key.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0xffb39a, 1.1);
  rim.position.set(1.5, 2, -4);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  camera.lookAt(0, 0, 0);

  const { instanced, dispose: disposePool } = createPool(scene);

  const rodGeometry = new THREE.CapsuleGeometry(ROD_RADIUS, ROD_LENGTH, 6, 14);
  const rodPositions = rodGeometry.getAttribute('position');
  const rodColors = new Float32Array(rodPositions.count * 3);
  const bodyColor = new THREE.Color(ROD_COLOR.body);
  const endColor = new THREE.Color(ROD_COLOR.end);
  const shade = new THREE.Color();
  for (let v = 0; v < rodPositions.count; v++) {
    const t = Math.min(1, Math.max(0, (rodPositions.getY(v) + ROD_HALF) / (ROD_HALF * 0.9)));
    shade.copy(endColor).lerp(bodyColor, t * t * (3 - 2 * t));
    rodColors[v * 3] = shade.r;
    rodColors[v * 3 + 1] = shade.g;
    rodColors[v * 3 + 2] = shade.b;
  }
  rodGeometry.setAttribute('color', new THREE.BufferAttribute(rodColors, 3));
  const rodMaterial = haloMaterial({ halo: 0.35, vertexGlow: 0.08 });
  rodMaterial.vertexColors = true;
  const rods = instanced(rodGeometry, rodMaterial, BACTERIA);
  const tint = new THREE.Color();
  for (let i = 0; i < BACTERIA; i++) rods.setColorAt(i, tint.setScalar(0.88 + 0.16 * hash01(i, 3)));

  const home = Array.from({ length: BACTERIA }, (_, i) => {
    const a = i * GOLDEN + 0.6;
    const r = RING[mode] * (opts.fibre ? 0.85 + 0.25 * hash01(i, 5) : Math.sqrt((i + 0.5) / BACTERIA));
    return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a) * 0.95, -0.25 + 0.4 * hash01(i, 7));
  });
  const slot = Float32Array.from({ length: feeders }, (_, k) => ((k + 0.5) / feeders + 0.37 * k) % 1);
  const reach = Float32Array.from({ length: feeders }, (_, k) => STRAND_RADIUS + ROD_HALF + 0.02 * hash01(k, 15));
  const spoke = Array.from({ length: feeders }, (_, k) => {
    const a = k * GOLDEN * 1.3 + 0.4;
    return new THREE.Vector3(1.2 * (hash01(k, 9) - 0.5), Math.cos(a), 0.6 * Math.sin(a)).normalize();
  });

  const glowMaterial = (): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const feast = opts.fibre
    ? {
        chunks: instanced(new THREE.IcosahedronGeometry(1, 2), haloMaterial({ halo: 0.45, color: NUTRIENT_COLOR.fibre, emissiveIntensity: 0.18 }), CHUNKS * 2),
        cores: instanced(new THREE.IcosahedronGeometry(1, 2), glowMaterial(), GLOWS),
        halos: instanced(new THREE.IcosahedronGeometry(1, 2), glowMaterial(), GLOWS),
      }
    : null;
  const glowCount = feast ? GLOWS : 0;
  if (feast) {
    feast.cores.renderOrder = 3;
    feast.halos.renderOrder = 2;
  }
  const glowOrigin = new Float32Array(glowCount * 3);
  const strandAt = new THREE.Vector3();
  for (let i = 0; i < glowCount; i++) {
    const at = glowEmitAt(i, glowCount);
    const ready: number[] = [];
    for (let k = 0; k < feeders; k++) if (swarmJoin(k, feeders, at) >= 1 && swarmLeave(k, at) <= 0) ready.push(k);
    const k = ready.length > 0 ? ready[Math.floor(hash01(i, 13) * ready.length)] : 0;
    strandPoint(0.5 + (slot[k] - 0.5) * feedProgress(at), strandAt).addScaledVector(spoke[k], STRAND_RADIUS);
    glowOrigin[i * 3] = strandAt.x;
    glowOrigin[i * 3 + 1] = strandAt.y;
    glowOrigin[i * 3 + 2] = strandAt.z;
  }

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const feeding = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const amber = new THREE.Color(GLOW_COLOR);
  const drift: MotionPoint = { x: 0, y: 0, z: 0 };
  const roam: MotionPoint = { x: 0, y: 0, z: 0 };
  let time = 0;
  let progress = 0;

  const roamAt = (i: number, t: number, out: THREE.Vector3): THREE.Vector3 => {
    wander(t, i, roam);
    return out.set(home[i].x + roam.x * ROAM, home[i].y + roam.y * ROAM, home[i].z + roam.z * ROAM * 0.5);
  };

  const placeStrand = (left: number): void => {
    if (!feast) return;
    const { chunks } = feast;
    const thick = 0.8 + 0.2 * left;
    for (let h = 0; h < 2; h++) {
      for (let c = 0; c < CHUNKS; c++) {
        const i = h * CHUNKS + c;
        const s = (c + 0.5 * h + 0.25) / CHUNKS;
        const edge = (left / 2 - Math.abs(s - 0.5)) * CHUNKS;
        if (edge <= 0) {
          chunks.setMatrixAt(i, matrix.makeScale(0, 0, 0));
          continue;
        }
        const bite = Math.min(1, edge);
        strandPoint(s, position);
        strandPoint(s + 0.01, tangent).sub(position).normalize();
        const twist = s * TURNS * Math.PI * 2 + h * Math.PI;
        position.y += TWIST * Math.cos(twist);
        position.z += TWIST * Math.sin(twist);
        quaternion.setFromUnitVectors(up, tangent);
        const r = CHUNK.radius * thick * bite;
        chunks.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(r, CHUNK.length * bite, r)));
      }
    }
    chunks.instanceMatrix.needsUpdate = true;
  };

  const placeRods = (left: number): void => {
    for (let i = 0; i < BACTERIA; i++) {
      roamAt(i, time, position);
      roamAt(i, time + LOOK_AHEAD, ahead);
      heading.subVectors(ahead, position);
      if (heading.lengthSq() < 1e-10) heading.set(1, 0, 0);
      quaternion.setFromUnitVectors(up, heading.normalize());
      const hold = i < feeders ? swarmJoin(i, feeders, progress) * (1 - swarmLeave(i, progress)) : 0;
      if (hold > 0) {
        const n = spoke[i];
        strandPoint(0.5 + (slot[i] - 0.5) * left, ahead).addScaledVector(n, reach[i] + NIBBLE * (1 + Math.sin(time * 7 + i * 1.3)));
        position.lerp(ahead, hold);
        feeding.setFromUnitVectors(up, n);
        quaternion.slerp(feeding, hold);
      }
      rods.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(1, 1, 1)));
    }
    rods.instanceMatrix.needsUpdate = true;
  };

  const placeGlows = (): void => {
    if (!feast) return;
    const { cores, halos } = feast;
    for (let i = 0; i < glowCount; i++) {
      const glow = glowParticle(i, glowCount, progress, drift);
      if (glow <= 0) {
        cores.setMatrixAt(i, matrix.makeScale(0, 0, 0));
        halos.setMatrixAt(i, matrix.makeScale(0, 0, 0));
        continue;
      }
      position.set(
        glowOrigin[i * 3] + drift.x * GLOW_DRIFT + 0.01 * Math.sin(time * 2.3 + i),
        glowOrigin[i * 3 + 1] + drift.y * GLOW_DRIFT,
        glowOrigin[i * 3 + 2] + drift.z * GLOW_DRIFT,
      );
      const core = GLOW_CORE * (0.6 + 0.4 * glow);
      cores.setMatrixAt(i, matrix.makeScale(core, core, core).setPosition(position));
      cores.setColorAt(i, tint.copy(amber).multiplyScalar(glow));
      halos.setMatrixAt(i, matrix.makeScale(GLOW_HALO, GLOW_HALO, GLOW_HALO).setPosition(position));
      halos.setColorAt(i, tint.copy(amber).multiplyScalar(0.3 * glow));
    }
    cores.instanceMatrix.needsUpdate = true;
    halos.instanceMatrix.needsUpdate = true;
    if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
    if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
  };

  const place = (): void => {
    const left = feast ? feedProgress(progress) : 0;
    placeStrand(left);
    placeGlows();
    placeRods(left);
  };

  for (let i = 0; i < glowCount; i++) {
    feast?.cores.setColorAt(i, tint.setScalar(0));
    feast?.halos.setColorAt(i, tint.setScalar(0));
  }
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
