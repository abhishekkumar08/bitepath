import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VEIN_Y } from '@/scene/lens/motion';
import type { VilliScene } from '@/scene/lens/types';
import { createVilliScene } from '@/scene/lens/villi';
import { NUTRIENT_COLOR } from '@/scene/path';

const BEADS = [{ kind: 'glucose' as const, color: NUTRIENT_COLOR.sugar, count: 40, fraction: 1 }];
const FULL = 0.045;

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function beadMesh(scene: VilliScene): THREE.InstancedMesh {
  return scene.scene.children.find((c) => c instanceof THREE.InstancedMesh && c.renderOrder === 2) as THREE.InstancedMesh;
}

describe('villi lens framing', () => {
  it('keeps most of the bead run along the vein inside the frame, so a longer VEIN_RUN or wider HERO_REACH shows up here', () => {
    const scene = createVilliScene({ beads: BEADS, flagship: true });
    const mesh = beadMesh(scene);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const turn = new THREE.Quaternion();
    let onVein = 0;
    let inside = 0;
    for (let k = 0; k <= 100; k++) {
      scene.setProgress(k / 100);
      scene.update(0);
      scene.camera.updateMatrixWorld();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix).decompose(position, turn, scale);
        if (scale.x < FULL || position.y > VEIN_Y + 0.05) continue;
        onVein++;
        if (Math.abs(position.clone().project(scene.camera).x) <= 1) inside++;
      }
    }
    expect(onVein).toBeGreaterThan(100);
    expect(inside / onVein).toBeGreaterThan(0.7);
    scene.dispose();
  });
});
