import * as THREE from 'three';
import type { Vec3 } from '@/models/types';
import { burstTimes } from '@/scene/beats/bodyMotion';
import { createEmulsifyLensBeat } from '@/scene/beats/emulsifyLens';
import { createObjectGlow } from '@/scene/beats/flowView';
import { pulseOrgan, restoreOrgan } from '@/scene/beats/pulse';
import { createSquirt } from '@/scene/beats/squirt';
import type { BeatEffect, BeatFactory, Squirt } from '@/scene/beats/types';
import { fitInto, framedReach } from '@/scene/framing';
import type { LensOptions } from '@/scene/lens/types';
import { OBSTACLE_GAP } from '@/scene/lens/placement';
import type { CameraGoal, LoadedBody } from '@/scene/types';

const BURSTS = 3;
const PER_BURST = 24;
const BILE_GREEN = 0x7cc22e;
const DROP_RADIUS = 0.0038;
const DROP_SPREAD = 0.0018;
const SPLASH = 1.6;
const DUCT_RADIUS = 0.003;
const DUCT_OPACITY = 0.4;
const DUCT_RENDER_ORDER = 10;
const GLOW_REST = 0.25;
const GLOW_SQUEEZE = 0.75;
const MAX_REACH = 0.15;
const MAX_EXTENT = 0.1;
const NAMED = /gall_?bladder/i;
const UNNAMED_PENALTY = 1;
const FALLBACK_TOWARD_LIVER = 0.6;
const BOW = 0.012;
const SQUEEZE = 0.16;
const SQUEEZE_SHARE = 0.35;
const VIEW_MARGIN = 0.04;

export function findGallbladder(body: LoadedBody, out: THREE.Vector3): THREE.Object3D | null {
  const duodenum = new THREE.Vector3(...body.anchors.duodenum);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  let best: THREE.Object3D | null = null;
  let bestScore = Infinity;
  body.root?.traverse((object) => {
    if (object.userData.organ !== 'gallbladder') return;
    box.setFromObject(object);
    if (box.isEmpty()) return;
    box.getSize(size);
    if (Math.max(size.x, size.y, size.z) > MAX_EXTENT) return;
    box.getCenter(centre);
    if (centre.distanceTo(duodenum) > MAX_REACH) return;
    const score = (NAMED.test(object.name) ? 0 : UNNAMED_PENALTY) + size.x * size.y * size.z;
    if (!(score < bestScore)) return;
    best = object;
    bestScore = score;
    out.copy(centre);
  });
  if (!best) out.copy(duodenum).lerp(new THREE.Vector3(...body.anchors.liver), FALLBACK_TOWARD_LIVER);
  return best;
}

function bileBeat(ctx: Parameters<BeatFactory>[0], lensAnchor: Vec3, lensOptions: LensOptions): BeatEffect {
  const { body, stage } = ctx;
  const source = new THREE.Vector3();
  const gallbladder = findGallbladder(body, source);
  const duodenum = new THREE.Vector3(...body.anchors.duodenum);
  const bow = new THREE.Vector3(...body.front).multiplyScalar(BOW);
  const curve = new THREE.CatmullRomCurve3([source, source.clone().lerp(duodenum, 0.5).add(bow), duodenum]);
  const centre = source.clone().lerp(duodenum, 0.5);
  centre.toArray(lensAnchor);
  const half = source.distanceTo(duodenum) / 2;
  const radius = half + VIEW_MARGIN;
  const canvas = stage.renderer.domElement;
  lensOptions.clearance = framedReach(half, radius, Math.min(canvas.clientWidth, canvas.clientHeight) || 0) + OBSTACLE_GAP;
  const view = new THREE.Vector3(...body.front);
  const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
  const times = new Array<number>(BURSTS).fill(0);
  const glow = createObjectGlow(gallbladder ?? undefined, false);
  let squirt: Squirt | null = null;
  let duct: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial> | null = null;

  const release = (): void => {
    squirt?.dispose();
    squirt = null;
    if (duct) {
      duct.removeFromParent();
      duct.geometry.dispose();
      duct.material.dispose();
      duct = null;
    }
    if (gallbladder) restoreOrgan(gallbladder);
    glow.restore();
  };

  return {
    enter() {
      release();
      squirt = createSquirt({ curve, events: BURSTS, perEvent: PER_BURST, color: BILE_GREEN, radius: DROP_RADIUS, spread: DROP_SPREAD, flare: SPLASH, seed: BURSTS });
      duct = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 32, DUCT_RADIUS, 8, false),
        new THREE.MeshBasicMaterial({ color: BILE_GREEN, transparent: true, opacity: DUCT_OPACITY, depthTest: false, depthWrite: false }),
      );
      duct.name = 'bile-duct';
      duct.renderOrder = DUCT_RENDER_ORDER;
      duct.frustumCulled = false;
      stage.scene.add(duct, squirt.mesh);
    },
    update(progress) {
      burstTimes(progress, BURSTS, times);
      squirt?.update(times);
      if (!gallbladder) return;
      let squeeze = 0;
      for (let k = 0; k < BURSTS; k++) {
        const t = times[k] as number;
        if (t > 0 && t < SQUEEZE_SHARE) squeeze = Math.max(squeeze, Math.sin((Math.PI * t) / SQUEEZE_SHARE));
      }
      pulseOrgan(gallbladder, 1 - SQUEEZE * squeeze);
      glow.set(BILE_GREEN, GLOW_REST + GLOW_SQUEEZE * squeeze);
    },
    exit() {
      release();
    },
    dispose() {
      release();
    },
    camera() {
      return fitInto(goal, centre, radius, view, stage.camera.fov, stage.camera.aspect);
    },
  };
}

export const emulsifyBeat: BeatFactory = (ctx) => {
  const anchor: Vec3 = [0, 0, 0];
  const options: LensOptions = {};
  const bile = bileBeat(ctx, anchor, options);
  const lens = createEmulsifyLensBeat(ctx, options);
  return {
    enter() {
      lens.enter();
      ctx.lens?.setAnchor(anchor);
      bile.enter();
    },
    update(progress, dt) {
      lens.update(progress, dt);
      bile.update(progress, dt);
    },
    exit() {
      lens.exit();
      bile.exit();
    },
    dispose() {
      lens.dispose();
      bile.dispose();
    },
    camera: bile.camera,
  };
};
