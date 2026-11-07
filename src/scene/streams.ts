import * as THREE from 'three';
import type { Journey, Nutrient } from '@/engine/types';
import type { AnchorId, Anchors } from '@/models/types';
import { massParticles, routeParam, swellAt } from '@/scene/flow';
import { createFoodMass } from '@/scene/food/mass';
import { dropletMix } from '@/scene/food/stage';
import type { FoodLook } from '@/scene/food/types';
import { NUTRIENT_COLOR, gutCurve, gutTail, routeAnchors, routeBranch, routePointAt } from '@/scene/path';
import type { RouteArgs, StreamModifier, Streams } from '@/scene/types';

const DROPLET_RADIUS = 0.0045;
const STRAND_RADIUS = 0.0016;
const STRAND_LENGTH = 0.009;
const FIBRE_STRAND = 0x7d7a3a;
const MASS_SEED = 7;
const TURN = Math.PI * 2;
const TUBE_RENDER_ORDER = 9;
const TRACER_RENDER_ORDER = 10;
const CLOUD_RADIUS = 0.03;
const SPREAD = 0.3;
const TUBE_RADIUS = 0.006;
const TUBE_SEGMENTS = 96;
const TUBE_COLOR = 0xffe2b8;
const TUBE_OPACITY = 0.45;
const EASE_TAU = 0.08;
const EASE_SNAP = 0.01;
const TANGENT_STEP = 0.01;

interface NutrientStream {
  total: number;
  mesh: THREE.InstancedMesh;
  ids: AnchorId[];
  branch: THREE.CatmullRomCurve3;
  offsets: number[];
  jitter: THREE.Vector3[];
  turn: THREE.Quaternion[];
  first: number;
}

function inBall(random: () => number): THREE.Vector3 {
  const z = 2 * random() - 1;
  const phi = 2 * Math.PI * random();
  const ring = Math.sqrt(1 - z * z);
  return new THREE.Vector3(ring * Math.cos(phi), ring * Math.sin(phi), z).multiplyScalar(CLOUD_RADIUS * Math.cbrt(random()));
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function createStreams(anchors: Anchors, journey: Journey, looks: FoodLook[] = []): Streams {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(DROPLET_RADIUS, 10, 8);
  const strand = new THREE.CapsuleGeometry(STRAND_RADIUS, STRAND_LENGTH, 2, 6);
  const random = seeded(42);
  const gut = gutCurve(anchors);
  const journeyStations = journey.stations.map((s) => s.id);

  const tubeMaterial = new THREE.MeshBasicMaterial({ color: TUBE_COLOR, transparent: true, opacity: TUBE_OPACITY, depthTest: false, depthWrite: false });
  const tubeGeometries = [gut, gutTail(anchors)].map((curve) => new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, 8, false));
  for (const tube of tubeGeometries) {
    const mesh = new THREE.Mesh(tube, tubeMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = TUBE_RENDER_ORDER;
    group.add(mesh);
  }

  const mass = massParticles(journey.totals);
  let first = 0;
  const streams: NutrientStream[] = (Object.keys(mass) as Nutrient[]).map((nutrient) => {
    const count = mass[nutrient] ?? 0;
    const fibre = nutrient === 'fibre';
    const color = fibre ? FIBRE_STRAND : NUTRIENT_COLOR[nutrient];
    const mesh = new THREE.InstancedMesh(
      fibre ? strand : geometry,
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: fibre ? 0.35 : 0.7, transparent: true, depthTest: false, depthWrite: false }),
      count,
    );
    mesh.name = `droplet:${nutrient}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = TRACER_RENDER_ORDER;
    mesh.count = 0;
    mesh.visible = false;
    group.add(mesh);
    const stream: NutrientStream = {
      total: count,
      mesh,
      ids: routeAnchors(nutrient),
      branch: routeBranch(anchors, nutrient),
      offsets: Array.from({ length: count }, () => (random() - 0.5) * SPREAD),
      jitter: Array.from({ length: count }, () => inBall(random)),
      turn: Array.from({ length: count }, () => new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * TURN, random() * TURN, random() * TURN))),
      first,
    };
    first += count;
    return stream;
  });
  const food = createFoodMass(looks, first, MASS_SEED);
  group.add(food.paste, ...food.meshes);

  const matrix = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const before = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const spun = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const mod: StreamModifier = { swell: 1, visible: 1, advance: null, swirl: 0 };
  let restProgress = 0;
  const args: RouteArgs = { routeAnchors: [], journeyStations, index: 0, phase: 'dwell', progress: 0, stationProgress: 0 };

  const settle = (value: number, target: number, k: number): number => {
    const next = value + (target - value) * k;
    return Math.abs(next - target) < EASE_SNAP ? target : next;
  };

  const result: Streams = {
    group,
    mod,
    holdModifiers: false,
    update(index, moment) {
      restProgress = moment.stationProgress;
      args.index = index;
      args.phase = moment.phase;
      args.progress = moment.progress;
      args.stationProgress = moment.stationProgress;
      food.begin();
      for (let n = 0; n < streams.length; n++) {
        const s = streams[n];
        args.routeAnchors = s.ids;
        const u = routeParam(args, mod.advance);
        const swell = swellAt(s.ids, u) * mod.swell;
        const steps = s.ids.length - 1;
        const spin = mod.swirl !== 0;
        if (spin) {
          routePointAt(gut, s.branch, s.ids, u + TANGENT_STEP, axis);
          routePointAt(gut, s.branch, s.ids, u - TANGENT_STEP, before);
          axis.sub(before);
        }
        const spinning = spin && axis.lengthSq() > 1e-12;
        if (spinning) axis.normalize();
        const shown = Number.isNaN(mod.visible) ? s.total : Math.min(s.total, Math.max(0, Math.round(s.total * mod.visible)));
        let drops = 0;
        for (let i = 0; i < shown; i++) {
          const jitter = spinning ? spun.copy(s.jitter[i]).applyAxisAngle(axis, mod.swirl) : s.jitter[i];
          const at = u * steps + s.offsets[i] * mod.swell;
          routePointAt(gut, s.branch, s.ids, at / steps, point).addScaledVector(jitter, swell);
          const mix = dropletMix(at);
          if (mix < 1) food.piece(s.first + i, point, at, 1 - mix, swell);
          if (mix > 0) {
            s.mesh.setMatrixAt(drops, matrix.compose(point, s.turn[i], scale.setScalar(mix)));
            drops += 1;
          }
        }
        s.mesh.count = drops;
        s.mesh.visible = drops > 0;
        s.mesh.instanceMatrix.needsUpdate = true;
      }
      food.end();
    },
    resetModifiers() {
      mod.swell = 1;
      mod.visible = 1;
      mod.advance = null;
      mod.swirl = 0;
      result.holdModifiers = false;
    },
    easeModifiers(dt) {
      if (result.holdModifiers || dt <= 0) return;
      const k = 1 - Math.exp(-dt / EASE_TAU);
      mod.swell = settle(mod.swell, 1, k);
      mod.visible = settle(mod.visible, 1, k);
      mod.swirl = settle(mod.swirl, 0, k);
      if (mod.advance !== null) {
        const next = settle(mod.advance, restProgress, k);
        mod.advance = next === restProgress ? null : next;
      }
    },
    dispose() {
      geometry.dispose();
      strand.dispose();
      food.dispose();
      tubeMaterial.dispose();
      for (const tube of tubeGeometries) tube.dispose();
      for (const s of streams) {
        (s.mesh.material as THREE.Material).dispose();
        s.mesh.dispose();
      }
      group.removeFromParent();
    },
  };
  return result;
}
