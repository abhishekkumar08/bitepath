import * as THREE from 'three';
import { spedTag } from '@/scene/beats/drain';
import { CIRCULATION_TARGETS, circulationLoops, dotLoop, dotPhase, dotReachedAt, glowAfter, heartbeat, lowerBodyPoint, pathSample, popSize } from '@/scene/beats/flowPaths';
import { boundsOf, createDots, createFlowTube, createOrganGlow, createRimGlow } from '@/scene/beats/flowView';
import { pulseOrgan, restoreOrgan } from '@/scene/beats/pulse';
import type { BeatFactory, FlowDots, FlowTube, RimGlow } from '@/scene/beats/types';
import { fitInto } from '@/scene/framing';
import { lightenHex, mixHex } from '@/scene/food/stage';
import { NUTRIENT_COLOR } from '@/scene/path';
import type { CameraGoal } from '@/scene/types';

const CAFFEINE_RULE = 'blood-caffeine';
const DOTS = 32;
const DOT_RADIUS = 0.011;
const NARROW_DOT_SCALE = 1.6;
const DOT_LIGHTEN = 0.12;
const POP = 25;
const VESSEL_COLOR = 0xd9534f;
const VESSEL_RADIUS = 0.0035;
const VESSEL_OPACITY = 0.35;
const BRAIN_VESSEL_OPACITY = 0.55;
const HEART_COLOR = 0xff5a5a;
const HEART_GLOW = 0.8;
const HEART_SWELL = 0.05;
const BRAIN_GLOW = 0.8;
const RIM_SCALE = 0.8;
const RIM_STRENGTH = 1;
const RIM_LIGHTEN = 0.25;
const BRAIN_SWELL = 0.04;
const HEIGHT_FIT = 0.8;
const BRAIN = CIRCULATION_TARGETS.indexOf('brain');

export const circulateBeat: BeatFactory = (ctx) => {
  const { body, stage } = ctx;
  const caffeine = ctx.beat.ruleId === CAFFEINE_RULE;
  const minY = new THREE.Box3().setFromObject(body.root).min.y;
  const loops = circulationLoops(body.anchors, lowerBodyPoint(body.anchors, Number.isFinite(minY) ? minY : body.anchors.colon[1]), body.front);
  const hue = caffeine ? NUTRIENT_COLOR.caffeine : NUTRIENT_COLOR.alcohol;
  const dotColor = lightenHex(hue, DOT_LIGHTEN);
  const loopOf = Array.from({ length: DOTS }, (_, i) => dotLoop(i, caffeine));
  const brainAt = dotReachedAt(loopOf.indexOf(BRAIN), DOTS, 0.5);
  const view = new THREE.Vector3(...body.front);
  const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
  const point = new THREE.Vector3();
  const heart = body.organs.heart;
  const brain = body.organs.brain;
  const bounds = boundsOf(loops, new THREE.Box3());
  if (brain) bounds.expandByObject(brain);
  const centre = bounds.getCenter(new THREE.Vector3());
  const radius = (HEIGHT_FIT * (bounds.max.y - bounds.min.y)) / 2;
  const heartGlow = createOrganGlow(body, 'heart');
  const brainGlow = createOrganGlow(body, 'brain');
  let vessels: FlowTube[] = [];
  let dots: FlowDots | null = null;
  let tag: HTMLElement | null = null;
  let rim: RimGlow | null = null;

  const release = (): void => {
    for (const v of vessels) v.dispose();
    vessels = [];
    dots?.dispose();
    dots = null;
    tag?.remove();
    tag = null;
    rim?.dispose();
    rim = null;
    heartGlow.restore();
    brainGlow.restore();
    if (heart) restoreOrgan(heart);
    if (brain) restoreOrgan(brain);
  };

  return {
    enter() {
      release();
      vessels = loops.map((loop, k) =>
        createFlowTube(loop, { color: VESSEL_COLOR, radius: VESSEL_RADIUS, opacity: caffeine && k === BRAIN ? BRAIN_VESSEL_OPACITY : VESSEL_OPACITY, halo: 0 }),
      );
      dots = createDots(new Array<number>(DOTS).fill(dotColor), stage.camera.aspect < 1 ? DOT_RADIUS * NARROW_DOT_SCALE : DOT_RADIUS);
      dots.mesh.name = 'circulate-dots';
      stage.scene.add(...vessels.map((v) => v.group), dots.mesh);
      if (caffeine && brain) {
        const glow = createRimGlow(brain, mixHex(hue, 0xffffff, RIM_LIGHTEN), RIM_SCALE);
        glow.mesh.name = 'brain-rim';
        stage.scene.add(glow.mesh);
        rim = glow;
      }
      const host = stage.renderer.domElement.parentElement;
      if (host) {
        tag = spedTag(host);
        host.append(tag);
      }
    },
    update(progress) {
      if (dots) {
        for (let i = 0; i < DOTS; i++) {
          const phase = dotPhase(i, DOTS, progress);
          if (phase === null) {
            dots.hide(i);
            continue;
          }
          dots.place(i, pathSample(loops[loopOf[i] as number] as THREE.CatmullRomCurve3, phase, point), popSize(phase, POP));
        }
        dots.commit();
      }
      const beat = heartbeat(progress);
      heartGlow.set(HEART_COLOR, HEART_GLOW * beat);
      if (heart) pulseOrgan(heart, 1 + HEART_SWELL * beat);
      if (!caffeine) return;
      const lit = glowAfter(progress, brainAt);
      brainGlow.set(hue, BRAIN_GLOW * lit);
      rim?.setStrength(RIM_STRENGTH * lit);
      if (brain) pulseOrgan(brain, 1 + BRAIN_SWELL * lit);
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
};
