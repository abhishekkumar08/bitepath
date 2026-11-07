import type { Placement, PlacementInput, Point, Rect } from '@/scene/lens/types';

export const PHONE_MAX_WIDTH = 640;
export const LENS_SIZE = { desktop: 280, phone: 200 };
export const LENS_MIN_PHONE_SIZE = 160;
export const LENS_PHONE_TOP_INSET = 232;
export const VIEWPORT_MARGIN = 16;
export const OBSTACLE_GAP = 12;
export const KEEP_OUT_GAP = 4;
export const ANCHOR_CLEARANCE = { desktop: 110, phone: 100 };
export const RING_STEP = 16;
export const PLACEMENT_TOLERANCE = 0.5;
export const PREFERRED_ANGLE = { desktop: (-35 * Math.PI) / 180, phone: -Math.PI / 2 };

const ANGLE_COUNT = 36;
const ANGLE_STEP = (Math.PI * 2) / ANGLE_COUNT;
const COVER_WEIGHT = 4;
const KEEP_OUT_WEIGHT = 10000;
const NO_RECTS: Rect[] = [];

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const gapFrom = (o: Rect, cx: number, cy: number): number => Math.hypot(Math.max(o.left - cx, 0, cx - o.right), Math.max(o.top - cy, 0, cy - o.bottom));

function keepOutOverlap(rects: Rect[], cx: number, cy: number, r: number): number {
  let overlap = 0;
  for (let i = 0; i < rects.length; i++) {
    const o = rects[i];
    if (o.right > o.left && o.bottom > o.top) overlap += Math.max(0, r + KEEP_OUT_GAP - gapFrom(o, cx, cy));
  }
  return overlap;
}

export function pushOut(point: Point, radius: number, rect: Rect): void {
  if (rect.right <= rect.left || rect.bottom <= rect.top) return;
  const reach = radius + KEEP_OUT_GAP;
  const nx = clamp(point.x, rect.left, rect.right);
  const ny = clamp(point.y, rect.top, rect.bottom);
  const dx = point.x - nx;
  const dy = point.y - ny;
  const gap = Math.hypot(dx, dy);
  if (gap >= reach) return;
  if (gap > 0) {
    point.x = nx + (dx / gap) * reach;
    point.y = ny + (dy / gap) * reach;
    return;
  }
  const toLeft = point.x - rect.left;
  const toRight = rect.right - point.x;
  const toTop = point.y - rect.top;
  const toBottom = rect.bottom - point.y;
  const nearest = Math.min(toLeft, toRight, toTop, toBottom);
  if (nearest === toLeft) point.x = rect.left - reach;
  else if (nearest === toRight) point.x = rect.right + reach;
  else if (nearest === toTop) point.y = rect.top - reach;
  else point.y = rect.bottom + reach;
}

function scan(input: PlacementInput, size: number, out: Placement): number {
  const { anchorScreen, viewport, obstacles, phone } = input;
  const keepOut = input.keepOut ?? NO_RECTS;
  const r = size / 2;
  const reach = r + Math.max(phone ? ANCHOR_CLEARANCE.phone : ANCHOR_CLEARANCE.desktop, input.clearance ?? 0);
  const minX = Math.min(VIEWPORT_MARGIN + r, viewport.width / 2);
  const maxX = Math.max(viewport.width - VIEWPORT_MARGIN - r, viewport.width / 2);
  const minY = Math.min(VIEWPORT_MARGIN + r, viewport.height / 2);
  const maxY = Math.max(viewport.height - VIEWPORT_MARGIN - r, viewport.height / 2);
  const base = phone ? PREFERRED_ANGLE.phone : PREFERRED_ANGLE.desktop;
  const farthest = Math.hypot(viewport.width, viewport.height) + reach;
  let bestPenalty = Infinity;
  let bestX = clamp(anchorScreen.x, minX, maxX);
  let bestY = clamp(anchorScreen.y, minY, maxY);

  search: for (let d = reach; d <= farthest; d += RING_STEP) {
    for (let k = 0; k < ANGLE_COUNT; k++) {
      const turn = (k + 1) >> 1;
      const angle = base + (k % 2 === 1 ? turn : -turn) * ANGLE_STEP;
      const cx = clamp(anchorScreen.x + d * Math.cos(angle), minX, maxX);
      const cy = clamp(anchorScreen.y + d * Math.sin(angle), minY, maxY);
      const gapToAnchor = Math.hypot(cx - anchorScreen.x, cy - anchorScreen.y);
      let penalty = Math.max(0, reach - gapToAnchor) + COVER_WEIGHT * Math.max(0, r - gapToAnchor) + KEEP_OUT_WEIGHT * keepOutOverlap(keepOut, cx, cy, r);
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.right <= o.left || o.bottom <= o.top) continue;
        const gap = gapFrom(o, cx, cy);
        penalty += Math.max(0, r + OBSTACLE_GAP - gap);
      }
      if (penalty < PLACEMENT_TOLERANCE) {
        bestPenalty = 0;
        bestX = cx;
        bestY = cy;
        break search;
      }
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestX = cx;
        bestY = cy;
      }
    }
  }

  out.center.x = bestX;
  out.center.y = bestY;
  out.size = size;
  return bestPenalty;
}

export function placeLens(input: PlacementInput, out?: Placement): Placement {
  const placed = out ?? { center: { x: 0, y: 0 }, size: 0 };
  const { viewport, phone } = input;
  const fit = Math.max(Math.min(input.size, viewport.width - 2 * VIEWPORT_MARGIN, viewport.height - 2 * VIEWPORT_MARGIN), 1);
  const penalty = scan(input, fit, placed);
  if (penalty > 0 && phone && fit > LENS_MIN_PHONE_SIZE) {
    const { x, y } = placed.center;
    if (scan(input, LENS_MIN_PHONE_SIZE, placed) >= penalty) {
      placed.center.x = x;
      placed.center.y = y;
      placed.size = fit;
    }
  }
  return placed;
}
