import * as THREE from 'three';
import type { Journey, StationId } from '@/engine/types';
import type { Vec3 } from '@/models/types';
import { createBeatPlayer } from '@/scene/beats/player';
import type { BeatPlayer } from '@/scene/beats/types';
import { applyLayers } from '@/scene/body';
import { STATION_FOCUS, applyFocus } from '@/scene/focus';
import { cameraBlend, frameSphere } from '@/scene/framing';
import { looksFor } from '@/scene/food/look';
import type { Lens } from '@/scene/lens/types';
import { applyStarEffect, starOrgan } from '@/scene/stars';
import { createStreams } from '@/scene/streams';
import { beatTime, buildTimeline, momentAt, playFrom } from '@/scene/timeline';
import type { CameraGoal, Director, DirectorHandlers, LoadedBody, Plate, StarGoalFn, Stage } from '@/scene/types';

const CAMERA_EASE = 3;
const FULL_PEEL = 3;

export function createDirector(
  stage: Stage,
  body: LoadedBody,
  journey: Journey,
  handlers: DirectorHandlers,
  starGoal: StarGoalFn,
  lens: Lens,
  plate: Plate,
): Director {
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const timeline = buildTimeline(journey);
  const looks = looksFor(plate.catalogue, plate.portions);
  const streams = createStreams(body.anchors, journey, looks);
  const { front } = body;
  stage.scene.add(streams.group);
  applyLayers(body, FULL_PEEL, true);

  const sphere = new THREE.Sphere();
  const focusGoals = new Map<StationId, CameraGoal>();
  for (const id of Object.keys(STATION_FOCUS) as StationId[]) {
    const organ = body.organs[STATION_FOCUS[id]];
    if (!organ) continue;
    new THREE.Box3().setFromObject(organ).getBoundingSphere(sphere);
    focusGoals.set(id, frameSphere(sphere.center.toArray() as Vec3, sphere.radius, front, stage.camera.fov));
  }

  const goalPosition = new THREE.Vector3();
  const goalTarget = new THREE.Vector3();
  let t = 0;
  let lastIndex = -1;
  let lastBeat: number | null = null;
  let beatPlayer: BeatPlayer | null = null;
  let reported = 0;
  let snapPending = false;
  let finished = false;
  let disposed = false;

  const reportFailures = (): void => {
    if (!beatPlayer) return;
    const { failures } = beatPlayer;
    while (reported < failures.length) handlers.onBeatError?.(failures[reported++]);
  };

  const dropPlayer = (): void => {
    beatPlayer?.dispose();
    reportFailures();
    beatPlayer = null;
    reported = 0;
  };

  const frame = (dt: number): void => {
    if (disposed || (finished && !director.playing)) return;
    const step = director.playing ? dt : 0;
    t += step;
    const moment = momentAt(timeline, t);
    const segment = timeline[moment.index];
    if (moment.index !== lastIndex) {
      lastIndex = moment.index;
      lastBeat = null;
      dropPlayer();
      lens.endStation();
      beatPlayer = createBeatPlayer({ stage, body, journey, station: segment.station, streams, lens, looks });
      streams.holdModifiers = false;
      handlers.onStation(moment.index, segment.station);
      handlers.onBeat(null);
    }
    if (moment.beatIndex !== lastBeat) {
      lastBeat = moment.beatIndex;
      handlers.onBeat(lastBeat);
    }
    if (moment.phase === 'travel') streams.holdModifiers = false;
    applyFocus(body, segment.station.id, moment.star ? starOrgan(moment.star) : null);
    applyStarEffect(body, moment.star, moment.progress);
    const beatGoal = beatPlayer ? beatPlayer.update(moment, step) : null;
    reportFailures();
    streams.easeModifiers(step);
    streams.update(moment.index, moment);
    const goal =
      (moment.phase === 'travel' ? null : beatGoal) ??
      (moment.star ? starGoal(moment.star, body.anchors, front, moment.progress) : focusGoals.get(segment.station.id));
    if (goal && snapPending) {
      stage.camera.position.set(...goal.position);
      stage.controls.target.set(...goal.target);
    } else if (goal && director.playing) {
      const k = cameraBlend(step, CAMERA_EASE, reducedMotion?.matches === true);
      stage.camera.position.lerp(goalPosition.set(...goal.position), k);
      stage.controls.target.lerp(goalTarget.set(...goal.target), k);
    }
    snapPending = false;
    stage.camera.updateMatrixWorld();
    lens.update(step);
    if (moment.done && director.playing) {
      director.pause();
      dropPlayer();
      lens.endStation();
      finished = true;
      lastIndex = -1;
      handlers.onFinish();
    }
  };

  const director: Director = {
    journey,
    playing: false,
    play() {
      finished = false;
      t = playFrom(timeline, t);
      director.playing = true;
      stage.controls.enabled = false;
    },
    pause() {
      director.playing = false;
      stage.controls.enabled = true;
    },
    jump(index: number) {
      const clamped = Math.min(Math.max(index, 0), timeline.length - 1);
      t = timeline[clamped].start;
      director.play();
    },
    seekBeat(ruleId: string, progress: number) {
      for (let i = 0; i < timeline.length; i++) {
        const at = beatTime(timeline[i], ruleId, progress);
        if (at === null) continue;
        director.pause();
        finished = false;
        streams.resetModifiers();
        for (const prior of timeline[i].station.beats) {
          if (prior.ruleId === ruleId) break;
          if (prior.effect === null) continue;
          t = beatTime(timeline[i], prior.ruleId, 1) ?? at;
          frame(0);
        }
        t = at;
        snapPending = true;
        frame(0);
        return;
      }
    },
    dispose() {
      disposed = true;
      unsubscribe();
      dropPlayer();
      lens.dispose();
      streams.dispose();
      applyStarEffect(body, null, 0);
      applyFocus(body, null, null);
      stage.controls.enabled = true;
    },
  };

  const unsubscribe = stage.onFrame(frame);

  return director;
}
