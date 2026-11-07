import * as THREE from 'three';
import {
  CAPILLARY_X,
  DRIFT_SPEED,
  FOOT,
  LYMPH_Y,
  LYMPH_Z,
  SHOULDER,
  VEIN_Y,
  VEIN_Z,
  VILLI_PER_ROW,
  VILLI_SPACING_X,
  VILLUS_HEIGHT,
  BEAD_PACE,
  absorbPath,
  beadPresence,
  frontRowX,
  hash01,
  heroColumns,
  lactealPath,
  paceStarts,
  passHeight,
  swayAt,
  veinExit,
} from '@/scene/lens/motion';
import { gradientTexture, haloMaterial, rimMaterial } from '@/scene/lens/materials';
import { createPool } from '@/scene/lens/pool';
import type { BeadTrack, MotionPoint, VilliOptions, VilliScene } from '@/scene/lens/types';

const ROWS = 6;
const ROW_STEP_Z = 0.44;
const BEAD_RADIUS = 0.05;
const FAT_SCALE = 1.2;
const BOB = 0.04;
const PASS_CLEARANCE = 0.02;
const CAMERA_HEIGHT = 1.8;
const CAMERA_DISTANCE = 3;
const LOOK_Y = 0.15;
const LOOK_Z = -0.6;
const DRIFT_RANGE = 0.6;

const villusProfile = (): THREE.Vector2[] => {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -0.04), new THREE.Vector2(0.16, -0.04), new THREE.Vector2(0.125, 0.06)];
  const neck = VILLUS_HEIGHT - 0.09;
  for (let k = 1; k <= 4; k++) {
    const f = k / 4;
    points.push(new THREE.Vector2(0.125 - 0.035 * f + 0.008 * Math.sin(f * Math.PI), 0.06 + (neck - 0.06) * f));
  }
  for (let k = 1; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2);
    points.push(new THREE.Vector2(0.09 * Math.cos(a), neck + 0.09 * Math.sin(a)));
  }
  return points;
};

const capillaryCurve = (): THREE.CatmullRomCurve3 => {
  const leg = (side: number): THREE.Vector3[] => [
    new THREE.Vector3(0, VEIN_Y, VEIN_Z),
    new THREE.Vector3(side * CAPILLARY_X * 0.6, VEIN_Y + FOOT * 0.6, VEIN_Z * 0.3),
    new THREE.Vector3(side * CAPILLARY_X, VEIN_Y + FOOT, 0),
    new THREE.Vector3(side * CAPILLARY_X, 0.35, 0),
    new THREE.Vector3(side * CAPILLARY_X, VILLUS_HEIGHT - SHOULDER, 0),
    new THREE.Vector3(side * CAPILLARY_X * 0.6, VILLUS_HEIGHT - 0.1, 0),
  ];
  const left = leg(-1);
  const right = leg(1).reverse();
  return new THREE.CatmullRomCurve3([...left, new THREE.Vector3(0, VILLUS_HEIGHT - 0.075, 0), ...right], false, 'centripetal');
};

const lactealCurve = (): THREE.CatmullRomCurve3 =>
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, VILLUS_HEIGHT - 0.2, 0),
    new THREE.Vector3(0, 0.3, 0),
    new THREE.Vector3(0, LYMPH_Y + FOOT, 0),
    new THREE.Vector3(0, LYMPH_Y + FOOT * 0.4, LYMPH_Z * 0.6),
    new THREE.Vector3(0, LYMPH_Y, LYMPH_Z),
  ]);

const membrane = (color: number, opacity: number, rimColor: number, glow: number): THREE.MeshStandardMaterial =>
  rimMaterial({ color, opacity, rimColor, glow, roughness: 0.85, rimAlpha: 0.97 });

export function createVilliScene(opts: VilliOptions): VilliScene {
  const scene = new THREE.Scene();
  const background = gradientTexture([
    [0, '#0d0307'],
    [0.45, '#2a0b12'],
    [1, '#5e2429'],
  ]);
  scene.background = background;
  scene.fog = new THREE.Fog(0x5e2429, 3.4, 8.5);
  scene.add(new THREE.HemisphereLight(0xffe7df, 0x40121a, 1.1));
  const key = new THREE.DirectionalLight(0xfff4ea, 2.4);
  key.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0xff9d7a, 1.6);
  rim.position.set(1.5, 2, -4);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 30);

  const { keep, use, instanced, dispose: disposePool } = createPool(scene);

  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 9)), use(new THREE.MeshStandardMaterial({ color: 0x8a3340, roughness: 0.85 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.2 - 4.5);
  const cavity = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 1.6)), use(new THREE.MeshStandardMaterial({ color: 0x2a0a10, roughness: 0.9 })));
  cavity.position.set(0, -0.8, -0.3);
  const vesselGeometry = keep(new THREE.CylinderGeometry(1, 1, 14, 18, 1, true).rotateZ(Math.PI / 2));
  const vein = new THREE.Mesh(vesselGeometry, use(membrane(0xc0122c, 0.3, 0xff3a50, 0.9)));
  vein.scale.set(1, 0.1, 0.1);
  vein.position.set(0, VEIN_Y, VEIN_Z);
  const lymph = new THREE.Mesh(vesselGeometry, use(membrane(0xe8cf7a, 0.3, 0xffe08a, 0.7)));
  lymph.scale.set(1, 0.075, 0.075);
  lymph.position.set(0, LYMPH_Y, LYMPH_Z);
  scene.add(floor, cavity, vein, lymph);

  const total = ROWS * VILLI_PER_ROW;
  const baseX = new Float32Array(total);
  const baseZ = new Float32Array(total);
  const height = new Float32Array(total);
  const girth = new Float32Array(total);
  const hero: number[] = [];
  const heroSlots = new Set(heroColumns());
  let n = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    const spacing = VILLI_SPACING_X * (1 + 0.22 * r);
    for (let c = 0; c < VILLI_PER_ROW; c++) {
      const jitter = r === 0 ? 0 : 1;
      baseX[n] = r === 0 ? frontRowX(c) : (c - (VILLI_PER_ROW - 1) / 2 + (r % 2) * 0.5) * spacing + jitter * (hash01(n, 3) - 0.5) * 0.12;
      baseZ[n] = -r * ROW_STEP_Z + jitter * (hash01(n, 5) - 0.5) * 0.1;
      height[n] = r === 0 ? 1 : 0.85 + 0.27 * hash01(n, 7);
      girth[n] = r === 0 ? 1 : 0.9 + 0.2 * hash01(n, 9);
      if (r === 0 && heroSlots.has(c)) hero.push(n);
      n++;
    }
  }

  const skin = instanced(new THREE.LatheGeometry(villusProfile(), 10), membrane(0xf07888, 0.38, 0xff9ea8, 0.5), total);
  skin.renderOrder = 1;
  const capillary = instanced(
    new THREE.TubeGeometry(capillaryCurve(), 32, 0.017, 4),
    new THREE.MeshStandardMaterial({ color: 0xe01a32, emissive: 0xb00c20, roughness: 0.45 }),
    total,
  );
  const lacteal = instanced(new THREE.TubeGeometry(lactealCurve(), 16, 0.024, 6), new THREE.MeshBasicMaterial({ color: 0xffe27a }), total);

  const tracks: BeadTrack[] = [];
  opts.beads.forEach((group, kindIndex) => {
    const pace = group.kind === 'caffeine' ? BEAD_PACE.fast : BEAD_PACE.steady;
    const seed = 17 + kindIndex * 31;
    paceStarts(group.count, group.fraction, seed, pace.span).forEach((slot, i) => {
      tracks.push({
        start: slot.start,
        crosses: slot.crosses,
        lane: hash01(i, seed + 1),
        villus: hero.length === 0 ? 0 : hero[(i * 5 + kindIndex * 2) % hero.length],
        lacteal: group.kind === 'fattyAcid',
        size: BEAD_RADIUS * (group.kind === 'fattyAcid' ? FAT_SCALE : 1),
        cross: pace.cross,
        exit: pace.exit,
        color: group.color,
      });
    });
  });
  const beads = instanced(new THREE.IcosahedronGeometry(1, 2), haloMaterial({ halo: 0.9, vertexGlow: 0.6, transparent: true }), tracks.length);
  beads.renderOrder = 2;
  const tint = new THREE.Color();
  tracks.forEach((track, i) => beads.setColorAt(i, tint.setHex(track.color)));

  const villusMatrices = Array.from({ length: total }, () => new THREE.Matrix4());
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const world = new THREE.Vector3();
  const local: MotionPoint = { x: 0, y: 0, z: 0 };
  const look = new THREE.Vector3();
  let time = 0;
  let progress = 0;

  const poseVilli = (): void => {
    for (let i = 0; i < total; i++) {
      euler.set(0.5 * swayAt(time * 0.8 + 3, i + 31), 0, swayAt(time, i));
      quaternion.setFromEuler(euler);
      position.set(baseX[i], 0, baseZ[i]);
      scale.set(girth[i], height[i], girth[i]);
      villusMatrices[i].compose(position, quaternion, scale);
      skin.setMatrixAt(i, villusMatrices[i]);
      capillary.setMatrixAt(i, villusMatrices[i]);
      lacteal.setMatrixAt(i, villusMatrices[i]);
    }
    skin.instanceMatrix.needsUpdate = true;
    capillary.instanceMatrix.needsUpdate = true;
    lacteal.instanceMatrix.needsUpdate = true;
  };

  const toWorld = (villus: number): THREE.Vector3 => world.set(local.x, local.y, local.z).applyMatrix4(villusMatrices[villus]);

  const placeBeads = (): void => {
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const since = progress - t.start;
      const presence = beadPresence(since, t.cross, t.exit, t.crosses);
      if (presence === 0) {
        beads.setMatrixAt(i, matrix.makeScale(0, 0, 0));
        continue;
      }
      const path = t.lacteal ? lactealPath : absorbPath;
      if (!t.crosses) {
        path(0, t.lane, local);
        local.y = VILLUS_HEIGHT + PASS_CLEARANCE + (local.y - VILLUS_HEIGHT - PASS_CLEARANCE) * passHeight(since);
        toWorld(t.villus).x += since * DRIFT_SPEED;
      } else if (since < 0) {
        path(0, t.lane, local);
        toWorld(t.villus).x += since * DRIFT_SPEED;
        world.y += BOB * Math.sin(progress * 14 + t.lane * 9) * Math.min(1, -since * 5);
      } else if (since < t.cross) {
        path(since / t.cross, t.lane, local);
        toWorld(t.villus);
      } else {
        const along = (since - t.cross) / t.exit;
        if (t.lacteal) veinExit(along, local, LYMPH_Y, LYMPH_Z);
        else veinExit(along, local);
        world.set(baseX[t.villus] + local.x, local.y, baseZ[t.villus] + local.z);
      }
      const size = t.size * presence;
      beads.setMatrixAt(i, matrix.makeScale(size, size, size).setPosition(world));
    }
    beads.instanceMatrix.needsUpdate = true;
  };

  const placeCamera = (): void => {
    const x = opts.flagship ? (progress - 0.5) * DRIFT_RANGE : 0;
    camera.position.set(x, CAMERA_HEIGHT, CAMERA_DISTANCE);
    camera.lookAt(look.set(x, LOOK_Y, LOOK_Z));
  };

  poseVilli();
  placeBeads();
  placeCamera();

  return {
    scene,
    camera,
    setProgress(p: number): void {
      progress = p;
      placeCamera();
    },
    update(dt: number): void {
      time += dt;
      poseVilli();
      placeBeads();
    },
    dispose(): void {
      disposePool();
      background.dispose();
    },
  };
}
