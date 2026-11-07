import * as THREE from 'three';
import { glowAfter, lymphPath, pathSample, popSize, portalPath, torsoDepth } from '@/scene/beats/flowPaths';
import { VEIN_COLOR, VEIN_RADIUS, boundsOf, createDots, createFlowTube, createOrganGlow } from '@/scene/beats/flowView';
import type { BeatFactory, FlowDots, FlowTube } from '@/scene/beats/types';
import { fitInto } from '@/scene/framing';
import { NUTRIENT_COLOR } from '@/scene/path';
import type { CameraGoal } from '@/scene/types';

const LYMPH_COLOR = 0xf3dc8a;
const LYMPH_RADIUS = 0.0026;
const LYMPH_OPACITY = 0.85;
const LYMPH_HALO = 0.14;
const PORTAL_OPACITY = 0.22;
const GROUPS = 4;
const PER_GROUP = 5;
const IN_GROUP = 0.02;
const TRAVEL = 0.62;
const DROP_RADIUS = 0.0045;
const POP = 8;
const HEART_GLOW = 0.45;
const VIEW_TURN = 1.0;
const VIEW_MARGIN = 0.03;

export const lymphBeat: BeatFactory = (ctx) => {
  const { body, stage } = ctx;
  const skeleton = new THREE.Box3();
  for (const mesh of body.layers.skeleton) skeleton.expandByObject(mesh);
  if (skeleton.isEmpty()) skeleton.setFromObject(body.root);
  const lymph = lymphPath(body.anchors, body.front, torsoDepth(skeleton, body.front));
  const portal = portalPath(body.anchors, body.front);
  const count = GROUPS * PER_GROUP;
  const colors = new Array<number>(count).fill(NUTRIENT_COLOR.fat);
  const sphere = boundsOf([lymph, portal], new THREE.Box3()).getBoundingSphere(new THREE.Sphere());
  const front = new THREE.Vector3(...body.front).setY(0).normalize();
  const patientLeft = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), front);
  const view = front.clone().multiplyScalar(Math.cos(VIEW_TURN)).addScaledVector(patientLeft, Math.sin(VIEW_TURN));
  const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
  const point = new THREE.Vector3();
  const glow = createOrganGlow(body, 'heart');
  let tubes: FlowTube[] = [];
  let drops: FlowDots | null = null;

  const release = (): void => {
    for (const t of tubes) t.dispose();
    tubes = [];
    drops?.dispose();
    drops = null;
    glow.restore();
  };

  return {
    enter() {
      release();
      const duct = createFlowTube(lymph, { color: LYMPH_COLOR, radius: LYMPH_RADIUS, opacity: LYMPH_OPACITY, halo: LYMPH_HALO });
      duct.group.name = 'lymph-duct';
      const faint = createFlowTube(portal, { color: VEIN_COLOR, radius: VEIN_RADIUS, opacity: PORTAL_OPACITY, halo: 0 });
      faint.group.name = 'portal-faint';
      drops = createDots(colors, DROP_RADIUS);
      drops.mesh.name = 'lymph-drops';
      tubes = [faint, duct];
      stage.scene.add(faint.group, duct.group, drops.mesh);
    },
    update(progress) {
      if (drops) {
        for (let i = 0; i < count; i++) {
          const t = (progress - (Math.floor(i / PER_GROUP) * TRAVEL) / GROUPS) / TRAVEL - (i % PER_GROUP) * IN_GROUP;
          const u = t - Math.floor(t);
          if (t <= 0) {
            drops.hide(i);
            continue;
          }
          drops.place(i, pathSample(lymph, u, point), popSize(u, POP));
        }
        drops.commit();
      }
      glow.set(NUTRIENT_COLOR.fat, HEART_GLOW * glowAfter(progress, TRAVEL));
    },
    exit() {
      release();
    },
    dispose() {
      release();
    },
    camera() {
      return fitInto(goal, sphere.center, sphere.radius + VIEW_MARGIN, view, stage.camera.fov, stage.camera.aspect);
    },
  };
};
