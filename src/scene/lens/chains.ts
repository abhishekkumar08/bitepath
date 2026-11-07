import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gradientTexture, haloMaterial, rimMaterial } from '@/scene/lens/materials';
import { createPool } from '@/scene/lens/pool';
import {
  DROP_SPAN,
  chainPoint,
  enzymeAlong,
  fragmentOffset,
  jawClosure,
  landingTint,
  planChain,
  residueSize,
  residueTone,
  wallDrop,
} from '@/scene/lens/chainMotion';
import { hash01 } from '@/scene/lens/motion';
import type { ChainOptions, ChainScene, GradientStop, MotionPoint } from '@/scene/lens/types';
import { NUTRIENT_COLOR } from '@/scene/path';

const SEED = 31;
const smoothstep = (v: number, lo: number, hi: number): number => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
const BEAD_RADIUS = 0.062;
const BOND_RADIUS = 0.022;
const BOND_SNAP = 0.025;
const ENZYME_RADIUS = 0.12;
const ENZYME_REACH = 0.8;
const JAW_OPEN = 1.3;
const SPARK_DECAY = 0.02;
const SPARK_SPAN = 0.07;
const SPARK_RAYS = 6;
const SPARK_SIZE = 0.08;
const AWAY = 0.18;
const AWAY_SPAN = 0.1;
const SINK = 0.07;
const SINK_SPAN = 0.3;
const BOB = 0.02;
const WOBBLE = 0.025;
const CHAIN_Y = { pieces: 0.02, wall: 0.25 };
const WALL_TOP = -0.5;
const WALL_X = 0.85;
const WALL_Z = 0.08;
const COLUMNS = 9;
const CELL_PITCH = 0.25;
const CELL_HEIGHT = 0.34;
const CELL_DEPTH = 0.3;
const MICROVILLI_PER_CELL = 6;
const MICROVILLUS_HEIGHT = 0.07;
const PARTICLES = { saliva: 16, acid: 24, plain: 0 };
const CAMERA = { x: 0, y: 0.1, z: 2.9 };
const LOOK = { x: 0, y: -0.02, z: 0 };
const BEADS = { amylase: 11, pepsin: 16, pancreatic: 10 };
const FLUID = {
  saliva: { color: 0xa8d8ff, rim: 0x6ec0ff, opacity: 0.7 },
  acid: { color: 0xffe0ec, rim: 0xffb0cc, opacity: 0.35 },
  plain: { color: 0xffffff, rim: 0xffffff, opacity: 0 },
};

const BACKDROP: Record<ChainOptions['fluid'], { stops: GradientStop[]; fog: number }> = {
  saliva: { stops: [[0, '#160812'], [0.5, '#3a1426'], [1, '#6a2c44']], fog: 0x3a1426 },
  acid: { stops: [[0, '#2a0716'], [0.5, '#5c1338'], [1, '#94305c']], fog: 0x5c1338 },
  plain: { stops: [[0, '#0d0307'], [0.5, '#2a0b12'], [1, '#5e2429']], fog: 0x2a0b12 },
};

const BOND_COLOR = { starch: 0xcbb68a, protein: 0x2f7fb0 };
const ENZYME_LOOK = {
  starch: { shell: 0x3fc7b4, glow: 0x0c4a42, inside: 0x0b2f2a, segments: 28, rings: 12, faceted: false },
  protein: { shell: 0xb58cff, glow: 0x3a1a6a, inside: 0x1e0b3a, segments: 7, rings: 3, faceted: true },
};

export function createChainScene(opts: ChainOptions): ChainScene {
  const toWall = opts.endBeads !== 'pieces';
  const shape = opts.enzyme === 'pepsin' ? 'folded' : 'chain';
  const seed = opts.kind === 'protein' ? SEED + 6 : SEED;
  const plan = planChain(BEADS[opts.enzyme], shape, toWall ? 'all' : 'some', seed);
  const n = plan.beads.length;
  const chainY = toWall ? CHAIN_Y.wall : CHAIN_Y.pieces;
  const backdrop = BACKDROP[opts.fluid];

  const scene = new THREE.Scene();
  const background = gradientTexture(backdrop.stops);
  scene.background = background;
  scene.fog = new THREE.Fog(backdrop.fog, 3.4, 7);
  scene.add(new THREE.HemisphereLight(0xffeef0, 0x30101a, 1.1));
  const key = new THREE.DirectionalLight(0xfff4ea, 2.3);
  key.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0xffb39a, 1.1);
  rim.position.set(1.5, 2, -4);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  camera.lookAt(LOOK.x, LOOK.y, LOOK.z);

  const { keep, use, instanced, dispose: disposePool } = createPool(scene);

  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const view = new THREE.Vector3(0, 0, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const local: MotionPoint = { x: 0, y: 0, z: 0 };
  const from: MotionPoint = { x: 0, y: 0, z: 0 };
  const ahead: MotionPoint = { x: 0, y: 0, z: 0 };
  const behind: MotionPoint = { x: 0, y: 0, z: 0 };
  const wall: MotionPoint = { x: 0, y: 0, z: 0 };

  if (toWall) {
    const cells = instanced(
      new RoundedBoxGeometry(CELL_PITCH - 0.015, CELL_HEIGHT, CELL_DEPTH, 2, 0.06),
      new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      COLUMNS * 2,
    );
    const microvilli = instanced(
      new THREE.CylinderGeometry(0.011, 0.013, MICROVILLUS_HEIGHT, 6).translate(0, MICROVILLUS_HEIGHT / 2, 0),
      new THREE.MeshStandardMaterial({ color: 0xf8c2cb, emissive: 0x3a1a20, roughness: 0.6 }),
      COLUMNS * MICROVILLI_PER_CELL * 2,
    );
    let m = 0;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const x = (c - (COLUMNS - 1) / 2) * CELL_PITCH;
        const z = -r * (CELL_DEPTH + 0.02) - 0.1;
        const k = r * COLUMNS + c;
        cells.setMatrixAt(k, matrix.makeTranslation(x, WALL_TOP - CELL_HEIGHT / 2, z));
        cells.setColorAt(k, tint.setHex(r === 0 ? 0xe98a99 : 0xc96878).multiplyScalar(0.9 + 0.2 * hash01(k, 3)));
        if (r > 0) continue;
        for (let v = 0; v < MICROVILLI_PER_CELL * 2; v++) {
          const vx = x + ((v % MICROVILLI_PER_CELL) / (MICROVILLI_PER_CELL - 1) - 0.5) * (CELL_PITCH - 0.06);
          const vz = z + (v < MICROVILLI_PER_CELL ? 0.08 : -0.04);
          microvilli.setMatrixAt(m++, matrix.makeTranslation(vx, WALL_TOP, vz));
        }
      }
    }
  }

  const particleCount = PARTICLES[opts.fluid];
  const particles =
    particleCount > 0
      ? instanced(
          new THREE.IcosahedronGeometry(1, 2),
          rimMaterial({ color: FLUID[opts.fluid].color, rimColor: FLUID[opts.fluid].rim, opacity: FLUID[opts.fluid].opacity, glow: 1.3, roughness: 0.1, rimAlpha: 0.95 }),
          particleCount,
        )
      : null;
  particles?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const seedA = Float32Array.from({ length: particleCount }, (_, i) => hash01(i, 41));
  const seedB = Float32Array.from({ length: particleCount }, (_, i) => hash01(i, 43));
  const seedC = Float32Array.from({ length: particleCount }, (_, i) => hash01(i, 47));

  const beadColor = opts.kind === 'starch' ? NUTRIENT_COLOR.starch : NUTRIENT_COLOR.protein;
  const endColor = new THREE.Color(opts.endBeads === 'glucose' ? NUTRIENT_COLOR.sugar : beadColor);
  const startColor = new THREE.Color(beadColor);
  const residues = opts.kind === 'protein';
  const size = Float32Array.from({ length: n }, (_, i) => BEAD_RADIUS * (residues ? residueSize(i, seed) : 1));
  const beads = instanced(new THREE.IcosahedronGeometry(1, 3), haloMaterial({ halo: 0.7, vertexGlow: 0.35 }), n);
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < n; i++) beads.setColorAt(i, tint.copy(startColor).offsetHSL(0, 0, residues ? residueTone(i, seed) : 0));
  const bonds = instanced(
    new THREE.CylinderGeometry(BOND_RADIUS, BOND_RADIUS, 1, 8),
    new THREE.MeshStandardMaterial({ color: BOND_COLOR[opts.kind], roughness: 0.5 }),
    Math.max(0, n - 1),
  );
  bonds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const placed = new Float32Array(n * 3);

  const look = ENZYME_LOOK[opts.kind];
  const jawGeometry = keep(new THREE.SphereGeometry(ENZYME_RADIUS, look.segments, look.rings, 0, Math.PI * 2, 0, Math.PI / 2));
  const lowerGeometry = keep(jawGeometry.clone().rotateX(Math.PI));
  const shell = use(new THREE.MeshStandardMaterial({ color: look.shell, emissive: look.glow, roughness: 0.45, flatShading: look.faceted }));
  const inside = use(new THREE.MeshStandardMaterial({ color: look.inside, roughness: 0.8, side: THREE.BackSide, flatShading: look.faceted }));
  const enzymes = Array.from({ length: plan.enzymes }, () => {
    const body = new THREE.Group();
    const jaw = (geometry: THREE.BufferGeometry): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.add(new THREE.Mesh(geometry, shell), new THREE.Mesh(geometry, inside));
      body.add(pivot);
      return pivot;
    };
    const upper = jaw(jawGeometry);
    const lower = jaw(lowerGeometry);
    scene.add(body);
    return { body, upper, lower };
  });

  const sparkMaterial = use(
    new THREE.MeshBasicMaterial({ color: 0xfff3b8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
  );
  const cores = instanced(new THREE.IcosahedronGeometry(1, 2), sparkMaterial, plan.enzymes);
  const rays = instanced(new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0), sparkMaterial, plan.enzymes * SPARK_RAYS);
  cores.renderOrder = 3;
  rays.renderOrder = 3;
  cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rays.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  let time = 0;
  let progress = 0;

  const placeParticles = (): void => {
    if (!particles) return;
    for (let i = 0; i < particleCount; i++) {
      const a = seedA[i];
      const b = seedB[i];
      const c = seedC[i];
      let x: number;
      let y: number;
      let radius: number;
      if (opts.fluid === 'saliva') {
        x = ((a * 2.8 + time * (0.04 + 0.05 * b)) % 2.8) - 1.4;
        y = (b * 2 - 1) * 0.85 + 0.05 * Math.sin(time * 0.8 + a * 9);
        radius = 0.035 + 0.06 * c;
      } else {
        x = (a * 2 - 1) * 1.2 + 0.03 * Math.sin(time * 1.3 + b * 7);
        y = ((b * 2.4 + time * (0.06 + 0.08 * c)) % 2.4) - 1.2;
        radius = 0.014 + 0.03 * c;
      }
      particles.setMatrixAt(i, matrix.makeScale(radius, radius, radius).setPosition(x, y, -0.9 + 1.1 * c));
    }
    particles.instanceMatrix.needsUpdate = true;
  };

  const placeBeads = (lift: number): void => {
    for (let i = 0; i < n; i++) {
      const base = plan.beads[i];
      const freed = plan.release[i];
      const since = progress - freed;
      if (toWall) {
        from.x = base.x;
        from.y = base.y + lift;
        from.z = base.z;
        if (since > 0) {
          wall.x = Math.max(-WALL_X, Math.min(WALL_X, base.x));
          wall.y = WALL_TOP + BEAD_RADIUS * 0.9 - SINK * smoothstep(since - DROP_SPAN, 0, SINK_SPAN);
          wall.z = WALL_Z + 0.06 * (hash01(i, 53) - 0.5);
          wallDrop(since / DROP_SPAN, from, wall, local);
        } else {
          local.x = from.x;
          local.y = from.y;
          local.z = from.z;
        }
        if (!residues) beads.setColorAt(i, tint.copy(startColor).lerp(endColor, landingTint(since)));
      } else {
        fragmentOffset(i, plan, progress, local);
        const loose = since > 0 ? Math.min(1, since / 0.1) : 0;
        const piece = plan.piece[i];
        local.x += base.x + loose * WOBBLE * Math.sin(time * 0.9 + piece * 2.3);
        local.y += base.y + lift + loose * WOBBLE * Math.sin(time * 1.3 + piece * 1.7);
        local.z += base.z;
      }
      placed[i * 3] = local.x;
      placed[i * 3 + 1] = local.y;
      placed[i * 3 + 2] = local.z;
      beads.setMatrixAt(i, matrix.makeScale(size[i], size[i], size[i]).setPosition(local.x, local.y, local.z));
    }
    beads.instanceMatrix.needsUpdate = true;
    if (beads.instanceColor) beads.instanceColor.needsUpdate = true;

    for (let b = 0; b < n - 1; b++) {
      const cut = plan.bondCut[b];
      const hold = progress < cut ? 1 : Math.max(0, 1 - (progress - cut) / BOND_SNAP);
      position.set(placed[b * 3], placed[b * 3 + 1], placed[b * 3 + 2]);
      axis.set(placed[b * 3 + 3], placed[b * 3 + 4], placed[b * 3 + 5]).sub(position);
      const length = axis.length();
      if (hold <= 0 || length < 1e-6) {
        bonds.setMatrixAt(b, matrix.makeScale(0, 0, 0));
        continue;
      }
      position.addScaledVector(axis, 0.5);
      quaternion.setFromUnitVectors(up, axis.divideScalar(length));
      bonds.setMatrixAt(b, matrix.compose(position, quaternion, scale.set(hold, length * hold, hold)));
    }
    bonds.instanceMatrix.needsUpdate = true;
  };

  const placeEnzymes = (lift: number): void => {
    for (let e = 0; e < enzymes.length; e++) {
      const { body, upper, lower } = enzymes[e];
      let last = -1;
      for (let k = 0; k < plan.cuts.length; k++) if (plan.cuts[k].enzyme === e && plan.cuts[k].time <= progress) last = k;
      let finished = true;
      for (let k = last + 1; k < plan.cuts.length; k++) if (plan.cuts[k].enzyme === e) finished = false;
      const since = last < 0 ? Infinity : progress - plan.cuts[last].time;
      const along = enzymeAlong(progress, plan, e);
      chainPoint(plan.beads, along, local);
      chainPoint(plan.beads, along + 0.5, ahead);
      chainPoint(plan.beads, along - 0.5, behind);
      normal.set(behind.y - ahead.y, ahead.x - behind.x, 0).normalize();
      normal.z = 0.45;
      normal.normalize();
      const away = finished && last >= 0 ? AWAY * smoothstep(since, 0.02, AWAY_SPAN) : 0;
      body.position.set(local.x, local.y + lift, local.z).addScaledVector(normal, ENZYME_RADIUS * ENZYME_REACH + away);
      body.position.y += 0.012 * Math.sin(time * 1.7 + e * 2);
      axis.copy(normal).negate();
      side.copy(view).addScaledVector(axis, -view.dot(axis)).normalize();
      normal.crossVectors(side, axis);
      body.quaternion.setFromRotationMatrix(matrix.makeBasis(axis, normal, side));
      const open = JAW_OPEN * (1 - jawClosure(progress, plan, e)) * (0.85 + 0.15 * Math.sin(time * 3 + e));
      upper.rotation.z = open / 2;
      lower.rotation.z = -open / 2;

      const flash = since < SPARK_SPAN ? Math.exp(-since / SPARK_DECAY) : 0;
      if (flash <= 0.02) {
        cores.setMatrixAt(e, matrix.makeScale(0, 0, 0));
        for (let r = 0; r < SPARK_RAYS; r++) rays.setMatrixAt(e * SPARK_RAYS + r, matrix.makeScale(0, 0, 0));
        continue;
      }
      chainPoint(plan.beads, plan.cuts[last].bond + 0.5, local);
      position.set(local.x, local.y + lift, local.z + 0.1);
      const core = SPARK_SIZE * 0.6 * flash;
      cores.setMatrixAt(e, matrix.makeScale(core, core, core).setPosition(position));
      const reach = SPARK_SIZE * (0.7 + 0.8 * (1 - flash));
      for (let r = 0; r < SPARK_RAYS; r++) {
        quaternion.setFromAxisAngle(view, (r / SPARK_RAYS) * Math.PI * 2 + 0.3);
        rays.setMatrixAt(e * SPARK_RAYS + r, matrix.compose(position, quaternion, scale.set(reach, 0.022 * flash + 0.006, 0.02)));
      }
    }
    cores.instanceMatrix.needsUpdate = true;
    rays.instanceMatrix.needsUpdate = true;
  };

  const place = (): void => {
    const lift = chainY + BOB * Math.sin(time * 0.9);
    placeParticles();
    placeBeads(lift);
    placeEnzymes(lift);
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
