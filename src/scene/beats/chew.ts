import * as THREE from 'three';
import { CHEW_START, chewPulse, intakePath, mouthSqueeze, pourIn, sipPath, sipSettle, sipSqueeze } from '@/scene/beats/bodyMotion';
import type { HeldDish } from '@/scene/beats/bodyTypes';
import { pulseOrgan, restoreOrgan } from '@/scene/beats/pulse';
import type { BeatFactory, IntakePose } from '@/scene/beats/types';
import { fitInto } from '@/scene/framing';
import { createFoodModel, disposeFoodModel } from '@/scene/food/models';
import { allLiquid, isSipped } from '@/scene/food/share';
import type { CameraGoal } from '@/scene/types';

const MAX_MODELS = 3;
const MODEL_SIZE = 0.06;
const SPACING = 0.058;
const START_AHEAD = 0.15;
const START_DROP = 0.055;
const BITE_AHEAD = 0.08;
const ARRIVE_SPREAD = 0.25;
const SPIN_RATE = 0.5;
const TILT = 0.35;
const SCATTER = 1.3;
const BALL = 0.32;
const MOUTH_SQUEEZE = 0.07;
const INTAKE_RADIUS = 0.12;
const CHEW_RADIUS = 0.07;
const VIEW_TURN = 0.9;
const VIEW_RISE = 0.18;
const SIP_BALL = 1;
const SIP_TILT = 1.1;

export const chewBeat: BeatFactory = (ctx) => {
  const { body, streams, stage } = ctx;
  const mouth = new THREE.Vector3(...body.anchors.mouth);
  const front = new THREE.Vector3(...body.front).setY(0).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, front).normalize();
  const view = front.clone().multiplyScalar(Math.cos(VIEW_TURN)).addScaledVector(right, Math.sin(VIEW_TURN)).addScaledVector(up, VIEW_RISE).normalize();
  const intakeCentre = mouth.clone().addScaledVector(front, (START_AHEAD + BITE_AHEAD) / 2).addScaledVector(up, -START_DROP / 2);
  const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
  const pose: IntakePose = { travel: 0, scale: 1, tilt: 0 };
  const sipPose: IntakePose = { travel: 0, scale: 1, tilt: 0 };
  const drink = allLiquid(ctx.looks);
  const upright = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), TILT);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  let held: HeldDish[] = [];
  let spin = 0;

  const build = (): HeldDish[] => {
    const looks = ctx.looks.slice(0, MAX_MODELS);
    return looks.map((look, i) => {
      const model = createFoodModel(look.model, look.colors, i + 1);
      box.setFromObject(model);
      model.position.sub(box.getCenter(size));
      box.getSize(size);
      const fit = MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-6);
      const holder = new THREE.Group();
      holder.name = `bite:${look.model}`;
      holder.add(model);
      holder.rotation.x = TILT;
      const side = i - (looks.length - 1) / 2;
      const from = mouth.clone().addScaledVector(front, START_AHEAD).addScaledVector(up, -START_DROP).addScaledVector(right, side * SPACING);
      const to = mouth.clone().addScaledVector(front, BITE_AHEAD).addScaledVector(right, side * SPACING * ARRIVE_SPREAD);
      stage.scene.add(holder);
      return { holder, model, fit, sip: isSipped(look), from, to };
    });
  };

  const release = (): void => {
    for (const h of held) {
      h.holder.removeFromParent();
      disposeFoodModel(h.model);
    }
    held = [];
  };

  return {
    enter() {
      release();
      held = build();
      spin = 0;
    },
    update(progress, dt) {
      spin += dt * SPIN_RATE;
      intakePath(progress, pose);
      sipPath(progress, sipPose);
      for (const h of held) {
        const own = h.sip ? sipPose : pose;
        h.holder.position.lerpVectors(h.from, h.to, own.travel);
        h.holder.scale.setScalar(h.fit * own.scale);
        if (h.sip) h.holder.quaternion.setFromAxisAngle(right, -SIP_TILT * own.tilt).multiply(upright);
        else h.holder.rotation.y = spin;
        h.holder.visible = own.scale > 0;
      }
      streams.holdModifiers = true;
      if (drink) {
        streams.mod.visible = progress < CHEW_START ? pourIn(progress) : 1;
        streams.mod.swell = SCATTER + (SIP_BALL - SCATTER) * sipSettle(progress);
      } else {
        streams.mod.visible = progress < CHEW_START ? 1 - pose.scale : 1;
        streams.mod.swell = SCATTER + (BALL - SCATTER) * chewPulse(progress);
      }
      const organ = body.organs.mouth;
      if (organ) pulseOrgan(organ, 1 - MOUTH_SQUEEZE * (drink ? sipSqueeze(progress) : mouthSqueeze(progress)));
    },
    exit() {
      release();
      const organ = body.organs.mouth;
      if (organ) restoreOrgan(organ);
    },
    dispose() {
      release();
    },
    camera(progress) {
      const intake = progress < CHEW_START;
      return fitInto(goal, intake ? intakeCentre : mouth, intake ? INTAKE_RADIUS : CHEW_RADIUS, view, stage.camera.fov, stage.camera.aspect);
    },
  };
};
