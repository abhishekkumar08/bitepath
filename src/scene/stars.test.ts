import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { applyStarEffect, starGoal } from '@/scene/stars';
import type { LoadedBody } from '@/scene/types';
import { TEST_ANCHORS as anchors } from '@/scene/testAnchors';
import type { Vec3 } from '@/models/types';
const front: Vec3 = [0, 0, 1];
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('starGoal', () => {
  it('ends the alcohol dive inside the stomach', () => {
    const end = starGoal('alcohol', anchors, front, 1);
    expect(distance(end.position, anchors.stomach)).toBeLessThan(0.02);
    expect(distance(starGoal('alcohol', anchors, front, 0).position, anchors.stomach)).toBeGreaterThan(0.2);
  });

  it('pans from the heart to the brain for caffeine', () => {
    expect(starGoal('caffeine', anchors, front, 0).target).toEqual(anchors.heart);
    expect(starGoal('caffeine', anchors, front, 1).target).toEqual(anchors.brain);
  });

  it('follows fat from the small intestine to the heart', () => {
    expect(starGoal('fat', anchors, front, 0).target).toEqual(anchors.smallIntestine);
    expect(starGoal('fat', anchors, front, 1).target).toEqual(anchors.heart);
  });

  it('ends the fibre dive inside the colon', () => {
    expect(distance(starGoal('fibre', anchors, front, 1).position, anchors.colon)).toBeLessThan(0.02);
  });
});

describe('applyStarEffect', () => {
  const organ = (): THREE.Group => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial()));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial()));
    return group;
  };
  const intensities = (group: THREE.Group): number[] => group.children.map((c) => ((c as THREE.Mesh).material as THREE.MeshPhysicalMaterial).emissiveIntensity);

  it('glows only the star organ and zeroes the other star organs', () => {
    const brain = organ();
    const stomach = organ();
    const body = { organs: { brain, stomach } } as unknown as LoadedBody;
    applyStarEffect(body, 'caffeine', 0.1);
    expect(intensities(brain).every((v) => v > 0)).toBe(true);
    expect(intensities(stomach)).toEqual([0, 0]);
    applyStarEffect(body, null, 0);
    expect(intensities(brain)).toEqual([0, 0]);
  });

  it('walks the organ once, then reuses the cached materials every frame', () => {
    const brain = organ();
    const traverse = vi.spyOn(brain, 'traverse');
    const body = { organs: { brain } } as unknown as LoadedBody;
    for (let i = 0; i < 5; i++) applyStarEffect(body, 'caffeine', i / 5);
    expect(traverse).toHaveBeenCalledTimes(1);
  });
});
