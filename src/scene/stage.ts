import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { FrameCallback, Insets, Stage } from '@/scene/types';
import { viewOffsetFor } from '@/scene/viewOffset';

const MAX_FRAME_SECONDS = 0.1;
const TOP_INSET_EASE = 8;
const SNAP_PIXELS = 0.5;

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1116);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const target: Insets = { left: 0, bottom: 0, top: 0 };
  const applied: Insets = { left: 0, bottom: 0, top: 0 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const applyViewOffset = (): void => {
    const { clientWidth: w, clientHeight: h } = container;
    const offset = viewOffsetFor(applied);
    if (offset) camera.setViewOffset(w, h, offset.x, offset.y, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const resize = (): void => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    applyViewOffset();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const callbacks: FrameCallback[] = [];
  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), MAX_FRAME_SECONDS);
    if (applied.top !== target.top) {
      const gap = target.top - applied.top;
      applied.top = Math.abs(gap) < SNAP_PIXELS ? target.top : applied.top + gap * (1 - Math.exp(-dt * TOP_INSET_EASE));
      applyViewOffset();
    }
    for (const cb of callbacks) cb(dt);
    controls.update();
    renderer.render(scene, camera);
  });

  return { renderer, scene, camera, controls,
    onFrame: (cb) => {
      callbacks.push(cb);
      return () => {
        const at = callbacks.indexOf(cb);
        if (at >= 0) callbacks.splice(at, 1);
      };
    },
    setInsets: (next) => {
      target.left = next.left;
      target.bottom = next.bottom;
      target.top = next.top;
      applied.left = next.left;
      applied.bottom = next.bottom;
      if (reducedMotion.matches) applied.top = next.top;
      applyViewOffset();
    },
  };
}
