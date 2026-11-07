import * as THREE from 'three';
import { glowAfter, glowStrength, glowTone, pathSample, popSize, portalColors, portalPath } from '@/scene/beats/flowPaths';
import { VEIN_COLOR, VEIN_RADIUS, boundsOf, createDots, createFlowTube, createOrganGlow } from '@/scene/beats/flowView';
import { pulseOrgan, restoreOrgan } from '@/scene/beats/pulse';
import type { BeatFactory, FlowDots, FlowTube } from '@/scene/beats/types';
import { fitInto } from '@/scene/framing';
import { random } from '@/scene/food/modelParts';
import type { CameraGoal } from '@/scene/types';

const PORTAL_PARTICLES = 24;
const VEIN_OPACITY = 0.85;
const VEIN_HALO = 0.22;
const DOT_RADIUS = 0.0048;
const JITTER = 0.0035;
const TRAVEL = 0.64;
const POP = 8;
const LIVER_GLOW = 0.6;
const LIVER_SWELL = 0.035;
const VIEW_MARGIN = 0.03;
const SEED = 23;
const FADE_TO = 0.35;
const FADE_BY = 0.12;

const smooth = (v: number): number => {
  const t = Math.min(1, Math.max(0, v));
  return t * t * (3 - 2 * t);
};

export const portalBeat: BeatFactory = (ctx) => {
  const { body, stage } = ctx;
  const curve = portalPath(body.anchors, body.front);
  const colors = portalColors(ctx.journey.totals, PORTAL_PARTICLES);
  const glowColor = glowTone(colors, VEIN_COLOR);
  const glowMax = glowStrength(glowColor, LIVER_GLOW);
  const rand = random(SEED);
  const jitter = colors.map(() => new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(JITTER));
  const sphere = boundsOf([curve], new THREE.Box3()).getBoundingSphere(new THREE.Sphere());
  const view = new THREE.Vector3(...body.front);
  const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
  const point = new THREE.Vector3();
  const liver = body.organs.liver;
  const glow = createOrganGlow(body, 'liver');
  let vein: FlowTube | null = null;
  let dots: FlowDots | null = null;

  const release = (): void => {
    vein?.dispose();
    vein = null;
    dots?.dispose();
    dots = null;
    glow.restore();
    if (liver) restoreOrgan(liver);
  };

  return {
    enter() {
      release();
      vein = createFlowTube(curve, { color: VEIN_COLOR, radius: VEIN_RADIUS, opacity: VEIN_OPACITY, halo: VEIN_HALO });
      vein.group.name = 'portal-vein';
      dots = createDots(colors, DOT_RADIUS);
      dots.mesh.name = 'portal-dots';
      stage.scene.add(vein.group, dots.mesh);
    },
    update(progress) {
      if (dots) {
        for (let i = 0; i < PORTAL_PARTICLES; i++) {
          const t = (progress - (TRAVEL * i) / PORTAL_PARTICLES) / TRAVEL;
          const u = t - Math.floor(t);
          if (t <= 0) {
            dots.hide(i);
            continue;
          }
          pathSample(curve, u, point).addScaledVector(jitter[i] as THREE.Vector3, Math.sin(Math.PI * u));
          dots.place(i, point, popSize(u, POP));
        }
        dots.commit();
      }
      ctx.streams.holdModifiers = true;
      ctx.streams.mod.visible = 1 - (1 - FADE_TO) * smooth(progress / FADE_BY);
      const g = glowAfter(progress, TRAVEL);
      glow.set(glowColor, glowMax * g);
      if (liver) pulseOrgan(liver, 1 + LIVER_SWELL * g);
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
