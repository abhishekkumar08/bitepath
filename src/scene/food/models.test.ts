import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DISH_LOOKS } from '@/scene/food/look';
import { FOOD_MODEL_IDS, createFoodModel, disposeFoodModel } from '@/scene/food/models';
import type { FoodModelId } from '@/scene/food/types';

const MAX_TRIANGLES = 4000;
const MAX_EXTENT = 0.1;

const sampleColors = (id: FoodModelId): number[] => Object.values(DISH_LOOKS).find((look) => look.model === id)?.colors ?? [0xb4604f, 0xd9a58f];

const triangles = (geometry: THREE.BufferGeometry): number => (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;

function meshes(group: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) found.push(object);
  });
  return found;
}

describe('createFoodModel', () => {
  it('knows every model id once', () => {
    expect(new Set(FOOD_MODEL_IDS).size).toBe(FOOD_MODEL_IDS.length);
    expect(FOOD_MODEL_IDS).toContain('samosa');
    expect(FOOD_MODEL_IDS).toContain('chunk');
  });

  it.each(FOOD_MODEL_IDS)('%s sits on its base centre at food scale', (id) => {
    const group = createFoodModel(id, sampleColors(id), 3);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 6);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 6);
    const size = box.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(0.02);
    expect(Math.max(size.x, size.y, size.z)).toBeLessThan(MAX_EXTENT);
    disposeFoodModel(group);
  });

  it.each(FOOD_MODEL_IDS)('%s stays within the triangle budget (instances aside)', (id) => {
    const group = createFoodModel(id, sampleColors(id), 3);
    const total = meshes(group).filter((m) => !(m instanceof THREE.InstancedMesh)).reduce((acc, m) => acc + triangles(m.geometry), 0);
    expect(total).toBeLessThan(MAX_TRIANGLES);
    disposeFoodModel(group);
  });

  it.each(FOOD_MODEL_IDS)('%s is deterministic per seed', (id) => {
    const snapshot = (seed: number): number[] =>
      meshes(createFoodModel(id, sampleColors(id), seed)).flatMap((m) => Array.from(m.geometry.getAttribute('position').array).slice(0, 60));
    expect(snapshot(5)).toEqual(snapshot(5));
  });

  it('takes its colours from the look', () => {
    const tint = (colors: number[]): number[] =>
      meshes(createFoodModel('cubes', colors, 1)).flatMap((m) => Array.from(m.geometry.getAttribute('color')?.array ?? []).slice(0, 3));
    expect(tint([0xf7f3e6])).not.toEqual(tint([0xe08a3a, 0x7aa03f]));
  });
});

describe('disposeFoodModel', () => {
  it.each(FOOD_MODEL_IDS)('%s frees every geometry and material', (id) => {
    const group = createFoodModel(id, sampleColors(id), 2);
    const pending = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    for (const m of meshes(group)) {
      const owned = [m.geometry, ...(Array.isArray(m.material) ? m.material : [m.material])];
      for (const item of owned) {
        pending.add(item);
        item.addEventListener('dispose', () => pending.delete(item));
      }
    }
    disposeFoodModel(group);
    expect(pending.size).toBe(0);
  });
});
