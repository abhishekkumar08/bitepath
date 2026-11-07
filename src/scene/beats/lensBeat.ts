import * as THREE from 'three';
import type { Vec3 } from '@/models/types';
import { organCentre } from '@/scene/beats/anchor';
import type { BeatContext, BeatEffect, LensBeatSpec } from '@/scene/beats/types';
import { fitInto } from '@/scene/framing';
import type { LensScene } from '@/scene/lens/types';
import type { CameraGoal } from '@/scene/types';

export function lensBeat<S extends LensScene & { setProgress: (p: number) => void }>(ctx: BeatContext, spec: LensBeatSpec<S>): BeatEffect {
  const anchor: Vec3 = [0, 0, 0];
  let anchored = false;
  let shown = false;
  let scene: S | null = null;
  const build = (): S => {
    scene = spec.build();
    return scene;
  };
  const framed = ((): (() => CameraGoal | null) | undefined => {
    if (!spec.frame) return undefined;
    const organ = ctx.body.organs[spec.organ];
    const box = organ ? new THREE.Box3().setFromObject(organ) : null;
    if (!box || box.isEmpty()) return undefined;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const view = new THREE.Vector3(...ctx.body.front);
    const goal: CameraGoal = { position: [0, 0, 0], target: [0, 0, 0] };
    return () => fitInto(goal, sphere.center, sphere.radius, view, ctx.stage.camera.fov, ctx.stage.camera.aspect);
  })();
  return {
    enter() {
      if (!ctx.lens) return;
      if (!anchored) {
        organCentre(ctx.body, spec.organ, spec.organ, anchor);
        anchored = true;
      }
      ctx.lens.show(build, anchor, spec.options);
      shown = true;
    },
    update(progress) {
      scene?.setProgress(progress);
    },
    exit() {
      scene = null;
      if (!shown) return;
      shown = false;
      ctx.lens?.hide();
    },
    dispose() {},
    ...(framed ? { camera: framed } : {}),
  };
}
