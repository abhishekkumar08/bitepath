import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/models/types';
import { organCentre } from '@/scene/beats/anchor';
import type { LoadedBody } from '@/scene/types';

const body = (organ: THREE.Object3D | undefined): LoadedBody =>
  ({ organs: { stomach: organ }, anchors: { stomach: [1, 2, 3], smallIntestine: [4, 5, 6] } }) as unknown as LoadedBody;

describe('organCentre', () => {
  it('uses the bounding-box centre of the organ', () => {
    const organ = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6));
    organ.position.set(10, 20, 30);
    organ.updateMatrixWorld();
    const out: Vec3 = [0, 0, 0];
    expect(organCentre(body(organ), 'stomach', 'stomach', out)).toBe(out);
    expect(out).toEqual([10, 20, 30]);
  });

  it('falls back to the named anchor when the organ is missing', () => {
    expect(organCentre(body(undefined), 'stomach', 'stomach', [0, 0, 0])).toEqual([1, 2, 3]);
    expect(organCentre(body(undefined), 'smallIntestine', 'smallIntestine', [0, 0, 0])).toEqual([4, 5, 6]);
  });

  it('falls back to the named anchor when the organ has no geometry', () => {
    expect(organCentre(body(new THREE.Group()), 'stomach', 'stomach', [0, 0, 0])).toEqual([1, 2, 3]);
  });
});
