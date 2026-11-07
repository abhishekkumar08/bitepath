import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { gutAnchors, gutCurve, routeAnchors, routeBranch, routePointAt } from '@/scene/path';
import { TEST_ANCHORS as anchors } from '@/scene/testAnchors';

describe('routes', () => {
  it('sends fat to the heart and fibre to the colon', () => {
    expect(routeAnchors('fat').at(-1)).toBe('heart');
    expect(routeAnchors('fibre').at(-1)).toBe('colon');
  });

  it('passes through every anchor of the route', () => {
    const gut = gutCurve(anchors);
    for (const nutrient of ['sugar', 'alcohol', 'fat', 'fibre'] as const) {
      const ids = routeAnchors(nutrient);
      const branch = routeBranch(anchors, nutrient);
      ids.forEach((id, i) => {
        const point = routePointAt(gut, branch, ids, i / (ids.length - 1), new Vector3());
        expect(point.distanceTo(new Vector3(...anchors[id]))).toBeLessThan(1e-9);
      });
    }
  });

  it('follows the identical gut curve for every nutrient until the small intestine', () => {
    const gut = gutCurve(anchors);
    const gutSteps = routeAnchors('sugar').indexOf('smallIntestine');
    for (const nutrient of ['sugar', 'fat', 'fibre'] as const) {
      const ids = routeAnchors(nutrient);
      const point = routePointAt(gut, routeBranch(anchors, nutrient), ids, 3.4 / (ids.length - 1), new Vector3());
      expect(point.distanceTo(gut.getPoint(3.4 / gutSteps))).toBeLessThan(1e-9);
    }
  });

  it('draws the gut path on to the colon', () => {
    expect(gutAnchors.at(-1)).toBe('colon');
  });
});
