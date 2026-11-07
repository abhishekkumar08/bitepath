import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  BROKEN_FRACTION,
  CAPILLARY_RADIUS,
  CAPILLARY_Y,
  CAPILLARY_Z,
  CELL_PITCH,
  CROSS_FRACTION,
  ENZYME,
  MUCUS_TOP,
  WALL_TOP,
  capillaryDrift,
  enzymePath,
  fragmentAt,
  lumenHome,
  seepSchedule,
  squeezeAt,
  wallCrossPath,
} from '@/scene/lens/liningMotion';
import { gradientTexture, haloMaterial, rimMaterial } from '@/scene/lens/materials';
import { createPool } from '@/scene/lens/pool';
import { hash01 } from '@/scene/lens/motion';
import type { LiningOptions, LiningScene, MotionPoint, SeepOutcome } from '@/scene/lens/types';
import { NUTRIENT_COLOR } from '@/scene/path';

const COLUMNS = 9;
const DEPTH_ROWS = 3;
const ROW_STEP_Z = 0.34;
const CELL_WIDTH = 0.24;
const TOP_CELL_HEIGHT = 0.28;
const DEEP_CELL_SIZE = 0.15;
const DEEP_CELL_Y = -0.38;
const CAPILLARY_HALF_LENGTH = 2;
const RED_CELLS = 12;
const RED_CELL_SPEED = 0.12;
const BEAD_RADIUS = 0.05;
const FRAGMENT_RADIUS = 0.036;
const FRAGMENTS_PER_BEAD = 3;
const ENZYME_RADIUS = 0.15;
const JAW_OPEN = 0.95;
const SEED = 23;
const START_SCALE = 0.9;
const CROSS_SPAN = 0.19;
const FLOW_SPAN = 0.8;
const BREAK_SPAN = 0.1;
const FRAGMENT_SPAN = 0.12;
const CHOMP_WIDTH = 0.035;
const BOB = 0.035;
const WANDER = 0.06;
const CAMERA = { x: 0, y: 0.25, z: 2.75 };
const LOOK = { x: 0, y: -0.13, z: -0.1 };

const OUTCOME_CODE: Record<SeepOutcome, number> = { cross: 0, broken: 1, stay: 2 };

export function createLiningScene(opts: LiningOptions): LiningScene {
  const scene = new THREE.Scene();
  const background = gradientTexture([
    [0, '#12040a'],
    [0.5, '#2c0a14'],
    [1, '#4a1620'],
  ]);
  scene.background = background;
  scene.fog = new THREE.Fog(0x3a0f18, 3.2, 6.5);
  scene.add(new THREE.HemisphereLight(0xffe9e2, 0x3a1018, 1.15));
  const key = new THREE.DirectionalLight(0xfff4ea, 2.3);
  key.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0xff9d7a, 1.2);
  rim.position.set(1.5, 2, -4);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  camera.lookAt(LOOK.x, LOOK.y, LOOK.z);

  const { keep, use, instanced, dispose: disposePool } = createPool(scene);

  const tissue = new THREE.Mesh(keep(new THREE.PlaneGeometry(8, 2.4)), use(new THREE.MeshStandardMaterial({ color: 0x6a2230, roughness: 0.9 })));
  tissue.position.set(0, WALL_TOP - 1.2, -0.95);
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(8, 2)), use(new THREE.MeshStandardMaterial({ color: 0x4e1520, roughness: 0.9 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, CAPILLARY_Y - CAPILLARY_RADIUS - 0.04, 0);
  const mucus = new THREE.Mesh(
    keep(new THREE.BoxGeometry(CAPILLARY_HALF_LENGTH * 2, MUCUS_TOP - WALL_TOP, DEPTH_ROWS * ROW_STEP_Z + 0.1)),
    use(new THREE.MeshStandardMaterial({ color: 0xf3d4e0, emissive: 0x4a2a36, roughness: 0.2, transparent: true, opacity: 0.32, depthWrite: false })),
  );
  mucus.position.set(0, (MUCUS_TOP + WALL_TOP) / 2, -((DEPTH_ROWS - 1) * ROW_STEP_Z) / 2);
  mucus.renderOrder = 2;
  const vessel = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(CAPILLARY_RADIUS, CAPILLARY_RADIUS, CAPILLARY_HALF_LENGTH * 2, 20, 1, true).rotateZ(Math.PI / 2)),
    use(rimMaterial({ color: 0xc0122c, opacity: 0.42, rimColor: 0xff3a50, glow: 0.9, roughness: 0.6, rimAlpha: 0.95 })),
  );
  vessel.position.set(0, CAPILLARY_Y, CAPILLARY_Z);
  vessel.renderOrder = 2;
  scene.add(tissue, floor, mucus, vessel);

  const cellCount = COLUMNS * DEPTH_ROWS;
  const topCells = instanced(
    new RoundedBoxGeometry(CELL_WIDTH, TOP_CELL_HEIGHT, CELL_WIDTH, 2, 0.07),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    cellCount,
  );
  const deepCells = instanced(
    new RoundedBoxGeometry(DEEP_CELL_SIZE, DEEP_CELL_SIZE, DEEP_CELL_SIZE, 2, 0.07),
    new THREE.MeshStandardMaterial({ roughness: 0.75 }),
    cellCount,
  );
  const nuclei = instanced(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0x5a2350, roughness: 0.5 }), COLUMNS * 2);
  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  let n = 0;
  for (let r = 0; r < DEPTH_ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      const x = (c - (COLUMNS - 1) / 2) * CELL_PITCH;
      const z = -r * ROW_STEP_Z;
      const shade = 0.9 + 0.2 * hash01(n, 3);
      topCells.setMatrixAt(n, matrix.makeTranslation(x, WALL_TOP - TOP_CELL_HEIGHT / 2, z));
      topCells.setColorAt(n, tint.setHex(0xee93a0).multiplyScalar(shade));
      deepCells.setMatrixAt(n, matrix.makeTranslation(x, DEEP_CELL_Y + 0.02 * (hash01(n, 5) - 0.5), z));
      deepCells.setColorAt(n, tint.setHex(0xc96878).multiplyScalar(shade));
      if (r === 0) {
        nuclei.setMatrixAt(c, matrix.makeScale(0.05, 0.06, 0.02).setPosition(x, WALL_TOP - TOP_CELL_HEIGHT * 0.62, CELL_WIDTH / 2));
        nuclei.setMatrixAt(COLUMNS + c, matrix.makeScale(0.045, 0.045, 0.02).setPosition(x, DEEP_CELL_Y, DEEP_CELL_SIZE / 2));
      }
      n++;
    }
  }

  const redCells = instanced(
    new THREE.CylinderGeometry(1, 1, 0.4, 14),
    new THREE.MeshStandardMaterial({ color: 0xd8172e, emissive: 0x7a0614, roughness: 0.5 }),
    RED_CELLS,
  );
  redCells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const redTurn = Array.from({ length: RED_CELLS }, (_, i) =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(hash01(i, 11) * Math.PI, 0, Math.PI / 2 + hash01(i, 13) * 1.2)),
  );
  const redOffset = Float32Array.from({ length: RED_CELLS }, (_, i) => (CAPILLARY_RADIUS * 0.45) * (hash01(i, 17) - 0.5));

  const sex = opts.female ? 'female' : 'male';
  const slots = seepSchedule(opts.beads, CROSS_FRACTION[sex], BROKEN_FRACTION[sex], SEED);
  const total = slots.length;
  const start = Float32Array.from(slots, (s) => s.start * START_SCALE);
  const outcome = Uint8Array.from(slots, (s) => OUTCOME_CODE[s.outcome]);
  const lane = Float32Array.from(slots, (_, i) => hash01(i, SEED + 1));
  const brokenIndex: number[] = [];
  for (let i = 0; i < total; i++) if (outcome[i] === OUTCOME_CODE.broken) brokenIndex.push(i);

  const beads = instanced(new THREE.IcosahedronGeometry(1, 2), haloMaterial({ halo: 0.8, color: NUTRIENT_COLOR.alcohol, emissiveIntensity: 0.45 }), total);
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beads.renderOrder = 1;
  const bits = instanced(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xb4b2b8, emissive: 0x55545a, roughness: 0.5, flatShading: true }),
    brokenIndex.length * FRAGMENTS_PER_BEAD,
  );
  bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bits.renderOrder = 1;

  const enzyme = new THREE.Group();
  const jawGeometry = keep(new THREE.SphereGeometry(ENZYME_RADIUS, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2));
  const lowerGeometry = keep(jawGeometry.clone().rotateX(Math.PI));
  const shell = use(new THREE.MeshStandardMaterial({ color: 0x3fc7b4, emissive: 0x0c4a42, roughness: 0.45 }));
  const inside = use(new THREE.MeshStandardMaterial({ color: 0x0b2f2a, roughness: 0.8, side: THREE.BackSide }));
  const jaw = (geometry: THREE.BufferGeometry): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(geometry, shell), new THREE.Mesh(geometry, inside));
    enzyme.add(pivot);
    return pivot;
  };
  const upperJaw = jaw(jawGeometry);
  const lowerJaw = jaw(lowerGeometry);
  enzyme.position.set(ENZYME.x, ENZYME.y, ENZYME.z);
  enzyme.rotation.set(0.55, 0, Math.PI / 2 - 0.55);
  scene.add(enzyme);

  const local: MotionPoint = { x: 0, y: 0, z: 0 };
  const position = new THREE.Vector3();
  const redScale = new THREE.Vector3(0.05, 0.05, 0.05);
  let time = 0;
  let progress = 0;

  const hide = (mesh: THREE.InstancedMesh, i: number): void => {
    mesh.setMatrixAt(i, matrix.makeScale(0, 0, 0));
  };
  const put = (mesh: THREE.InstancedMesh, i: number, sx: number, sy: number): void => {
    mesh.setMatrixAt(i, matrix.makeScale(sx, sy, sx).setPosition(local.x, local.y, local.z));
  };

  const placeRedCells = (): void => {
    const run = CAPILLARY_HALF_LENGTH * 2;
    for (let i = 0; i < RED_CELLS; i++) {
      const along = (i / RED_CELLS + time * RED_CELL_SPEED) % 1;
      position.set(along * run - CAPILLARY_HALF_LENGTH, CAPILLARY_Y + redOffset[i], CAPILLARY_Z + redOffset[(i + 3) % RED_CELLS]);
      redCells.setMatrixAt(i, matrix.compose(position, redTurn[i], redScale));
    }
    redCells.instanceMatrix.needsUpdate = true;
  };

  const placeBeads = (): void => {
    for (let i = 0; i < total; i++) {
      const since = progress - start[i];
      const code = outcome[i];
      if (code === OUTCOME_CODE.stay || since < 0) {
        const fade = code === OUTCOME_CODE.stay ? 1 : Math.min(1, -since * 5);
        lumenHome(lane[i], local);
        local.x += fade * WANDER * Math.sin(time * 0.6 + lane[i] * 13);
        local.y += fade * BOB * Math.sin(time * 1.4 + lane[i] * 9);
        put(beads, i, BEAD_RADIUS, BEAD_RADIUS);
      } else if (code === OUTCOME_CODE.cross) {
        if (since < CROSS_SPAN) {
          wallCrossPath(since / CROSS_SPAN, lane[i], local);
          const squeeze = squeezeAt(local.y);
          put(beads, i, BEAD_RADIUS * (1 - 0.28 * squeeze), BEAD_RADIUS * (1 + 0.3 * squeeze));
        } else {
          const along = (since - CROSS_SPAN) / FLOW_SPAN;
          if (along >= 1) {
            hide(beads, i);
            continue;
          }
          capillaryDrift(along, lane[i], local);
          put(beads, i, BEAD_RADIUS, BEAD_RADIUS);
        }
      } else if (since < BREAK_SPAN) {
        const u = since / BREAK_SPAN;
        enzymePath(u, lane[i], local);
        const shrink = u > 0.75 ? 1 - 1.6 * (u - 0.75) : 1;
        put(beads, i, BEAD_RADIUS * shrink, BEAD_RADIUS * shrink);
      } else {
        hide(beads, i);
      }
    }
    beads.instanceMatrix.needsUpdate = true;

    let chomp = 0;
    for (let b = 0; b < brokenIndex.length; b++) {
      const i = brokenIndex[b];
      const since = progress - start[i] - BREAK_SPAN;
      chomp = Math.max(chomp, Math.exp(-((since / CHOMP_WIDTH) ** 2)));
      for (let k = 0; k < FRAGMENTS_PER_BEAD; k++) {
        const slot = b * FRAGMENTS_PER_BEAD + k;
        if (since < 0) {
          hide(bits, slot);
          continue;
        }
        fragmentAt(since / FRAGMENT_SPAN, k, lane[i], local);
        local.y += 0.02 * Math.sin(time * 1.8 + slot);
        put(bits, slot, FRAGMENT_RADIUS, FRAGMENT_RADIUS);
      }
    }
    bits.instanceMatrix.needsUpdate = true;

    const open = JAW_OPEN * (1 - chomp) * (0.85 + 0.15 * Math.sin(time * 3));
    upperJaw.rotation.z = open / 2;
    lowerJaw.rotation.z = -open / 2;
    enzyme.position.y = ENZYME.y + 0.015 * Math.sin(time * 1.7);
  };

  placeRedCells();
  placeBeads();

  return {
    scene,
    camera,
    setProgress(p: number): void {
      progress = p;
    },
    update(dt: number): void {
      time += dt;
      placeRedCells();
      placeBeads();
    },
    dispose(): void {
      disposePool();
      background.dispose();
    },
  };
}
