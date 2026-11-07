import { CatmullRomCurve3, Vector3 } from 'three';
import type { Nutrient } from '@/engine/types';
import type { AnchorId, Anchors } from '@/models/types';
import { gutAnchors, routeAnchors, sharedGut } from '@/scene/route';

export { gutAnchors, routeAnchors } from '@/scene/route';
export { NUTRIENT_COLOR } from '@/scene/nutrientColor';

const GUT_STEPS = sharedGut.length - 1;

const curveThrough = (anchors: Anchors, ids: AnchorId[]): CatmullRomCurve3 =>
  new CatmullRomCurve3(ids.map((id) => new Vector3(...anchors[id])), false, 'catmullrom', 0.5);

export const gutCurve = (anchors: Anchors): CatmullRomCurve3 => curveThrough(anchors, sharedGut);

export const gutTail = (anchors: Anchors): CatmullRomCurve3 => curveThrough(anchors, gutAnchors.slice(GUT_STEPS));

export const routeBranch = (anchors: Anchors, nutrient: Nutrient): CatmullRomCurve3 =>
  curveThrough(anchors, routeAnchors(nutrient).slice(GUT_STEPS));

export function routePointAt(gut: CatmullRomCurve3, branch: CatmullRomCurve3, ids: AnchorId[], u: number, target: Vector3): Vector3 {
  const steps = ids.length - 1;
  const at = Math.min(1, Math.max(0, u)) * steps;
  if (at <= GUT_STEPS) return gut.getPoint(at / GUT_STEPS, target);
  return branch.getPoint((at - GUT_STEPS) / (steps - GUT_STEPS), target);
}
