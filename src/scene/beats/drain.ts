import * as THREE from 'three';
import { COPY } from '@/copy';
import { drain4hLevel, drainLevel, drainRate, pulseCount, pulseTimes } from '@/scene/beats/bodyMotion';
import { createSquirt } from '@/scene/beats/squirt';
import type { BeatContext, BeatEffect, BeatFactory, Squirt } from '@/scene/beats/types';
import { fitInto } from '@/scene/framing';
import { FALLBACK_LOOK, blend } from '@/scene/food/share';
import { CREAM, mixHex } from '@/scene/food/stage';
import type { CameraGoal } from '@/scene/types';

const PER_PULSE = 10;
const PULSE_RADIUS = 0.0048;
const PULSE_SPREAD = 0.006;
const CHYME_MIX = 0.55;
const SWIRL = 0.6 * 2 * Math.PI;
const BEYOND_DUODENUM = 0.6;
const VIEW_MARGIN = 0.035;
const MIN_VIEW_RADIUS = 0.095;
const TAG_CLASS = 'lens-tag body-tag';

export function spedTag(host: HTMLElement): HTMLElement {
  const tag = host.ownerDocument.createElement('span');
  tag.className = TAG_CLASS;
  tag.textContent = COPY.LENS.SPED_UP;
  return tag;
}

function drainBeat(ctx: BeatContext, level: (progress: number) => number, swirlFrom: number, sped: boolean): BeatEffect {
  const { body, streams, stage } = ctx;
  const stomach = new THREE.Vector3(...body.anchors.stomach);
  const duodenum = new THREE.Vector3(...body.anchors.duodenum);
  const beyond = duodenum.clone().lerp(new THREE.Vector3(...body.anchors.smallIntestine), BEYOND_DUODENUM);
  const curve = new THREE.CatmullRomCurve3([stomach, duodenum, beyond]);
  const count = pulseCount(drainRate(ctx.journey.totals));
  const times = new Array<number>(count).fill(0);
  const centre = stomach.clone().lerp(duodenum, 0.5);
  const radius = Math.max(MIN_VIEW_RADIUS, stomach.distanceTo(duodenum) / 2 + VIEW_MARGIN);
  const view = new THREE.Vector3(...body.front);
  const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
  const color = mixHex(blend(ctx.looks.length > 0 ? ctx.looks : [FALLBACK_LOOK]), CREAM, CHYME_MIX);
  let squirt: Squirt | null = null;
  let tag: HTMLElement | null = null;

  const release = (): void => {
    squirt?.dispose();
    squirt = null;
    tag?.remove();
    tag = null;
  };

  return {
    enter() {
      release();
      squirt = createSquirt({ curve, events: count, perEvent: PER_PULSE, color, radius: PULSE_RADIUS, spread: PULSE_SPREAD, flare: 0, seed: count });
      stage.scene.add(squirt.mesh);
      const host = stage.renderer.domElement.parentElement;
      if (sped && host) {
        tag = spedTag(host);
        host.append(tag);
      }
    },
    update(progress) {
      const l = level(progress);
      streams.holdModifiers = true;
      streams.mod.visible = l;
      streams.mod.swell = Math.cbrt(l);
      streams.mod.swirl = swirlFrom + SWIRL * progress;
      squirt?.update(pulseTimes(progress, count, times));
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

export const stomachDrainBeat: BeatFactory = (ctx) => {
  const rate = drainRate(ctx.journey.totals);
  return drainBeat(ctx, (p) => drainLevel(p, rate), 0, false);
};

export const fourHourDrainBeat: BeatFactory = (ctx) => {
  const follows = ctx.station.beats.slice(0, ctx.beatIndex).some((b) => b.effect === 'drain');
  const start = follows ? drainLevel(1, drainRate(ctx.journey.totals)) : 1;
  return drainBeat(ctx, (p) => drain4hLevel(p, start), follows ? SWIRL : 0, true);
};
