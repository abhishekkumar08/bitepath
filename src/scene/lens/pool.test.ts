import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPool } from '@/scene/lens/pool';

function countDisposals(target: { addEventListener(type: 'dispose', listener: () => void): void }): () => number {
  let n = 0;
  target.addEventListener('dispose', () => {
    n++;
  });
  return () => n;
}

describe('createPool', () => {
  it('adds instanced meshes to the scene with capacity for at least one instance', () => {
    const scene = new THREE.Scene();
    const pool = createPool(scene);
    const mesh = pool.instanced(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 0);
    expect(scene.children).toContain(mesh);
    expect(mesh.count).toBe(0);
    expect(mesh.instanceMatrix.count).toBe(1);
    expect(mesh.frustumCulled).toBe(false);
  });

  it('frees every kept geometry, used material and instanced mesh exactly once', () => {
    const pool = createPool(new THREE.Scene());
    const keptGeometry = pool.keep(new THREE.BoxGeometry());
    const usedMaterial = pool.use(new THREE.MeshBasicMaterial());
    const mesh = pool.instanced(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial(), 4);
    const counts = [
      countDisposals(keptGeometry),
      countDisposals(usedMaterial),
      countDisposals(mesh),
      countDisposals(mesh.geometry),
      countDisposals(mesh.material as THREE.Material),
    ];
    pool.dispose();
    expect(counts.map((c) => c())).toEqual([1, 1, 1, 1, 1]);
  });

  it('a second dispose is harmless', () => {
    const pool = createPool(new THREE.Scene());
    const geometry = pool.keep(new THREE.BoxGeometry());
    const material = pool.use(new THREE.MeshBasicMaterial());
    const mesh = pool.instanced(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial(), 3);
    const counts = [countDisposals(geometry), countDisposals(material), countDisposals(mesh), countDisposals(mesh.geometry)];
    pool.dispose();
    expect(() => pool.dispose()).not.toThrow();
    expect(counts.map((c) => c())).toEqual([1, 1, 1, 1]);
  });
});
