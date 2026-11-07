import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pulseOrgan, restoreOrgan } from '@/scene/beats/pulse';

const centre = (object: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
const size = (object: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());

function worldSpaceOrgan(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(2, 4, 6).translate(5, -3, 8);
  const mesh = new THREE.Mesh(geometry);
  mesh.updateMatrixWorld();
  return mesh;
}

function quantizedOrgan(): { parent: THREE.Group; organ: THREE.Group } {
  const parent = new THREE.Group();
  parent.position.set(0.5, 1, -2);
  parent.scale.setScalar(0.5);
  const organ = new THREE.Group();
  organ.position.set(3, 2, 1);
  organ.scale.setScalar(0.25);
  organ.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2).translate(1, 1, 1)));
  parent.add(organ);
  parent.updateMatrixWorld(true);
  return { parent, organ };
}

const close = (a: THREE.Vector3, b: THREE.Vector3): void => {
  expect(a.x).toBeCloseTo(b.x, 10);
  expect(a.y).toBeCloseTo(b.y, 10);
  expect(a.z).toBeCloseTo(b.z, 10);
};

describe('pulseOrgan', () => {
  it('scales an organ whose vertices sit away from the origin about its own bounding-box centre', () => {
    const organ = worldSpaceOrgan();
    const before = centre(organ);
    pulseOrgan(organ, 0.8);
    close(centre(organ), before);
    close(size(organ), new THREE.Vector3(1.6, 3.2, 4.8));
  });

  it('keeps the centre for an organ under a scaled, moved parent', () => {
    const { organ } = quantizedOrgan();
    const before = centre(organ);
    const span = size(organ);
    pulseOrgan(organ, 1.2);
    close(centre(organ), before);
    close(size(organ), span.multiplyScalar(1.2));
  });

  it('is idempotent: the result depends only on the latest scale', () => {
    const a = worldSpaceOrgan();
    const b = worldSpaceOrgan();
    pulseOrgan(a, 0.7);
    pulseOrgan(a, 0.9);
    pulseOrgan(a, 0.9);
    pulseOrgan(b, 0.9);
    close(a.position, b.position);
    close(a.scale, b.scale);
  });

  it('restores the exact original transform, and restoring twice or without a pulse is harmless', () => {
    const { organ } = quantizedOrgan();
    const position = organ.position.clone();
    const scale = organ.scale.clone();
    restoreOrgan(organ);
    pulseOrgan(organ, 0.85);
    pulseOrgan(organ, 1.1);
    restoreOrgan(organ);
    restoreOrgan(organ);
    expect(organ.position.equals(position)).toBe(true);
    expect(organ.scale.equals(scale)).toBe(true);
  });

  it('measures the centre again after a restore', () => {
    const organ = worldSpaceOrgan();
    pulseOrgan(organ, 0.9);
    restoreOrgan(organ);
    organ.geometry.translate(10, 0, 0);
    organ.updateMatrixWorld();
    const moved = centre(organ);
    pulseOrgan(organ, 0.5);
    close(centre(organ), moved);
  });

  it('leaves an organ with no geometry where it is', () => {
    const empty = new THREE.Group();
    empty.position.set(1, 2, 3);
    pulseOrgan(empty, 0.5);
    expect(empty.position.toArray()).toEqual([1, 2, 3]);
    expect(empty.scale.toArray()).toEqual([1, 1, 1]);
  });
});
