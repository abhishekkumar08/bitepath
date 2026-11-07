import * as THREE from 'three';
import { ringPositions, surgeProgress } from '@/scene/beats/bodyMotion';
import type { BeatFactory } from '@/scene/beats/types';
import { fitInto } from '@/scene/framing';
import { gutCurve } from '@/scene/path';
import { sharedGut } from '@/scene/route';
import type { CameraGoal } from '@/scene/types';

const RINGS = 3;
const RING_RENDER_ORDER = 8;
const RING_COLOR = 0xc8324a;
const RING_GLOW = 0x5a0d1c;
const RING_RADIUS = 0.012;
const RING_TUBE = 0.0032;
const RING_FADE = 0.06;
const BALL = 0.3;
const SQUEEZE_IN = 0.06;
const VIEW_RADIUS = 0.085;
const VIEW_TURN = 0.45;
const TOP = sharedGut.indexOf('oesophagusTop');
const BOTTOM = sharedGut.indexOf('oesophagusBottom');
const GUT_STEPS = sharedGut.length - 1;
const TANGENT_STEP = 1e-4;

const smooth = (u: number): number => u * u * (3 - 2 * u);
const gutT = (s: number): number => (TOP + (BOTTOM - TOP) * smooth(s)) / GUT_STEPS;

export const peristalsisBeat: BeatFactory = (ctx) => {
  const { body, streams, stage } = ctx;
  const gut = gutCurve(body.anchors);
  const front = new THREE.Vector3(...body.front).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), front).normalize();
  const view = front.clone().multiplyScalar(Math.cos(VIEW_TURN)).addScaledVector(right, Math.sin(VIEW_TURN));
  const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
  const positions = new Array<number>(RINGS).fill(0);
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 0, 1);
  let geometry: THREE.TorusGeometry | null = null;
  let material: THREE.MeshStandardMaterial | null = null;
  let rings: THREE.Mesh[] = [];

  const release = (): void => {
    for (const ring of rings) ring.removeFromParent();
    rings = [];
    geometry?.dispose();
    material?.dispose();
    geometry = null;
    material = null;
  };

  return {
    enter() {
      release();
      const g = new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 12, 40);
      const m = new THREE.MeshStandardMaterial({ color: RING_COLOR, emissive: RING_GLOW, emissiveIntensity: 1, roughness: 0.45, metalness: 0, transparent: true, depthTest: false, depthWrite: false });
      geometry = g;
      material = m;
      rings = positions.map((_, i) => {
        const ring = new THREE.Mesh(g, m);
        ring.name = `peristalsis-ring:${i}`;
        ring.renderOrder = RING_RENDER_ORDER;
        ring.frustumCulled = false;
        stage.scene.add(ring);
        return ring;
      });
    },
    update(progress) {
      ringPositions(progress, RINGS, positions);
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i] as THREE.Mesh;
        const r = positions[i] as number;
        const t = gutT(r);
        gut.getPoint(t, ring.position);
        gut.getPoint(Math.min(1, t + TANGENT_STEP), ahead);
        gut.getPoint(Math.max(0, t - TANGENT_STEP), tangent);
        tangent.subVectors(ahead, tangent).normalize();
        ring.quaternion.setFromUnitVectors(axis, tangent);
        const fade = Math.min(1, r / RING_FADE, (1 - r) / RING_FADE);
        ring.scale.setScalar(Math.max(1e-4, smooth(Math.max(0, fade))));
        ring.visible = fade > 0;
      }
      streams.holdModifiers = true;
      streams.mod.advance = surgeProgress(progress, RINGS);
      streams.mod.swell = 1 + (BALL - 1) * smooth(Math.min(1, progress / SQUEEZE_IN));
      streams.mod.visible = 1;
    },
    exit() {
      release();
    },
    dispose() {
      release();
    },
    camera(progress) {
      gut.getPoint(gutT(surgeProgress(progress, RINGS)), point);
      return fitInto(goal, point, VIEW_RADIUS, view, stage.camera.fov, stage.camera.aspect);
    },
  };
};
