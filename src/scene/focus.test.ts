import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { OrganId } from '@/models/types';
import { applyFocus } from '@/scene/focus';
import type { LoadedBody } from '@/scene/types';

const organ = (): THREE.Mesh => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true }));

function fakeBody(): { body: LoadedBody; meshes: Record<'stomach' | 'liver' | 'heart' | 'vessels', THREE.Mesh> } {
  const meshes = { stomach: organ(), liver: organ(), heart: organ(), vessels: organ() };
  meshes.vessels.material = Object.assign(new THREE.MeshBasicMaterial({ transparent: true }), { opacity: 0.35, depthWrite: false });
  const body = { organs: meshes as Partial<Record<OrganId, THREE.Object3D>> } as LoadedBody;
  return { body, meshes };
}

const opacityOf = (mesh: THREE.Mesh): number => (mesh.material as THREE.Material).opacity;

describe('applyFocus', () => {
  it('dims every organ except the focused one, the kept one and the vessels', () => {
    const { body, meshes } = fakeBody();
    applyFocus(body, 'stomach', 'heart');
    expect(opacityOf(meshes.stomach)).toBe(1);
    expect(opacityOf(meshes.heart)).toBe(1);
    expect(opacityOf(meshes.liver)).toBe(0.5);
    expect((meshes.liver.material as THREE.Material).depthWrite).toBe(false);
    expect(opacityOf(meshes.vessels)).toBe(0.35);
  });

  it('is idempotent and follows the focus as it moves', () => {
    const { body, meshes } = fakeBody();
    applyFocus(body, 'stomach', null);
    applyFocus(body, 'stomach', null);
    expect(opacityOf(meshes.liver)).toBe(0.5);
    applyFocus(body, 'liver', null);
    expect(opacityOf(meshes.liver)).toBe(1);
    expect(opacityOf(meshes.stomach)).toBe(0.5);
    expect((meshes.liver.material as THREE.Material).depthWrite).toBe(true);
  });

  it('restores exactly the organs it dimmed', () => {
    const { body, meshes } = fakeBody();
    applyFocus(body, 'stomach', null);
    applyFocus(body, null, null);
    expect(opacityOf(meshes.stomach)).toBe(1);
    expect(opacityOf(meshes.liver)).toBe(1);
    expect(opacityOf(meshes.heart)).toBe(1);
    expect(opacityOf(meshes.vessels)).toBe(0.35);
    expect((meshes.vessels.material as THREE.Material).depthWrite).toBe(false);
  });
});
