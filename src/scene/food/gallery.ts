import * as THREE from 'three';
import { DISH_LOOKS } from '@/scene/food/look';
import { FOOD_MODEL_IDS, createFoodModel, disposeFoodModel } from '@/scene/food/models';
import type { FoodModelId } from '@/scene/food/types';

const COLUMNS = 7;
const SPACING = 0.1;
const ROW_SPACING = 0.13;
const SPIN = 0.35;
const MODEL_FIT = 0.075;
const LABEL_AHEAD = 0.045;
const ANGLES: [number, number][] = [[0.3, 0.2], [0.7, 2.3], [1.25, -0.9]];

const EXTRA: { id: FoodModelId; name: string; colors: number[] }[] = [
  { id: 'cubes', name: 'vegetables', colors: [0xe08a3a, 0x7aa03f] },
  { id: 'bread', name: 'cake', colors: [0xc9966b, 0x8a5a3a] },
  { id: 'fruit', name: 'orange', colors: [0xf08c1a] },
  { id: 'meat', name: 'meat', colors: [0xb4604f, 0xd9a58f] },
  { id: 'fish', name: 'fish', colors: [0xe8a58c, 0xf2d6c4] },
  { id: 'chunk', name: 'nuts', colors: [0xb98a52, 0x8a5e30] },
];

function entries(only: FoodModelId | null): { id: FoodModelId; name: string; colors: number[] }[] {
  const all = [...Object.entries(DISH_LOOKS).map(([name, look]) => ({ id: look.model, name, colors: look.colors })), ...EXTRA];
  const ordered = FOOD_MODEL_IDS.flatMap((id) => all.filter((e) => e.id === id));
  return only ? ordered.filter((e) => e.id === only) : ordered;
}

export function showFoodGallery(host: HTMLElement, only: FoodModelId | null, angle: number): void {
  const root = document.createElement('div');
  root.setAttribute('style', 'position:fixed;inset:0;z-index:1000;background:#14171c');
  host.append(root);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  root.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14171c);
  const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
  key.position.set(0.6, 1.2, 0.9);
  const rim = new THREE.DirectionalLight(0xc8d8ff, 1.1);
  rim.position.set(-0.8, 0.7, -1);
  scene.add(new THREE.HemisphereLight(0xeef2ff, 0x3a3128, 1.3), key, rim);
  const floorGeometry = new THREE.PlaneGeometry(4, 4);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.95 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const list = entries(only);
  const columns = only ? list.length : COLUMNS;
  const rows = Math.ceil(list.length / columns);
  const models = list.map((entry, i) => {
    const model = createFoodModel(entry.id, entry.colors, i + 1);
    const col = i % columns;
    const row = Math.floor(i / columns);
    model.position.set((col - (columns - 1) / 2) * SPACING, 0, (row - (rows - 1) / 2) * ROW_SPACING);
    scene.add(model);
    const label = document.createElement('div');
    label.textContent = `${entry.id} · ${entry.name}`;
    label.setAttribute('style', 'position:absolute;transform:translate(-50%,0);color:#cfd6df;font:600 12px/1.2 system-ui,sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000');
    if (!only) root.append(label);
    return { model, label };
  });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.005, 20);
  const [elevation, azimuth] = only ? (ANGLES[angle] as [number, number]) : [0.75, 0];
  const halfWidth = only ? Math.max(columns * SPACING * 0.5, MODEL_FIT) : (columns * SPACING) / 2;
  const halfDepth = only ? MODEL_FIT : (rows * ROW_SPACING) / 2;
  const target = new THREE.Vector3(0, only ? 0.028 : 0, only ? 0 : 0.012);
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const projected = new THREE.Vector3();
  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    const distance = Math.max(halfWidth / (half * camera.aspect), halfDepth / half) * 1.08;
    camera.position.set(Math.sin(azimuth) * Math.cos(elevation) * distance, Math.sin(elevation) * distance + target.y, Math.cos(azimuth) * Math.cos(elevation) * distance + target.z);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    for (const { model, label } of models) {
      projected.set(model.position.x, 0, model.position.z + LABEL_AHEAD).project(camera);
      label.style.left = `${((projected.x + 1) / 2) * window.innerWidth}px`;
      label.style.top = `${((1 - projected.y) / 2) * window.innerHeight}px`;
    }
  };
  window.addEventListener('resize', resize);
  resize();

  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (!only) for (const { model } of models) model.rotation.y += dt * SPIN;
    renderer.render(scene, camera);
  });

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    for (const { model } of models) disposeFoodModel(model);
    floorGeometry.dispose();
    floorMaterial.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  });
}
