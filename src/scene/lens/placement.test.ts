import { describe, expect, it } from 'vitest';
import { smoothToward } from '@/scene/lens/smoothing';
import { ANCHOR_CLEARANCE, KEEP_OUT_GAP, LENS_MIN_PHONE_SIZE, OBSTACLE_GAP, PLACEMENT_TOLERANCE, PREFERRED_ANGLE, RING_STEP, VIEWPORT_MARGIN, placeLens, pushOut } from '@/scene/lens/placement';
import type { Placement, PlacementInput, Rect } from '@/scene/lens/types';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const PANEL: Rect = { left: 16, top: 16, right: 396, bottom: 884 };
const CREDITS: Rect = { left: 1330, top: 856, right: 1424, bottom: 884 };
const LOADER: Rect = { left: 640, top: 840, right: 800, bottom: 876 };
const SHEET: Rect = { left: 16, top: 448, right: 374, bottom: 828 };
const PHONE_CREDITS: Rect = { left: 16, top: 16, right: 110, bottom: 44 };

const desktop = (anchorX: number, anchorY: number, obstacles: Rect[] = [PANEL, CREDITS, LOADER]): PlacementInput => ({
  anchorScreen: { x: anchorX, y: anchorY },
  viewport: DESKTOP,
  obstacles,
  phone: false,
  size: 280,
});

const phone = (anchorX: number, anchorY: number, obstacles: Rect[] = [SHEET, PHONE_CREDITS], keepOut: Rect[] = []): PlacementInput => ({
  anchorScreen: { x: anchorX, y: anchorY },
  viewport: PHONE,
  obstacles,
  keepOut,
  phone: true,
  size: 200,
});

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function gapTo(placed: Placement, rect: Rect): number {
  const dx = Math.max(rect.left - placed.center.x, 0, placed.center.x - rect.right);
  const dy = Math.max(rect.top - placed.center.y, 0, placed.center.y - rect.bottom);
  return Math.hypot(dx, dy) - placed.size / 2;
}

function expectValid(input: PlacementInput, placed: Placement): void {
  const r = placed.size / 2;
  expect(placed.center.x - r).toBeGreaterThanOrEqual(VIEWPORT_MARGIN - 1e-6);
  expect(placed.center.y - r).toBeGreaterThanOrEqual(VIEWPORT_MARGIN - 1e-6);
  expect(placed.center.x + r).toBeLessThanOrEqual(input.viewport.width - VIEWPORT_MARGIN + 1e-6);
  expect(placed.center.y + r).toBeLessThanOrEqual(input.viewport.height - VIEWPORT_MARGIN + 1e-6);
  for (const rect of input.obstacles) expect(gapTo(placed, rect)).toBeGreaterThanOrEqual(OBSTACLE_GAP - PLACEMENT_TOLERANCE);
  expect(distance(placed.center, input.anchorScreen)).toBeGreaterThan(r);
}

describe('placeLens', () => {
  it('sits right of the panel, near the anchor, without covering it', () => {
    const input = desktop(900, 450);
    const placed = placeLens(input);
    expect(placed.size).toBe(280);
    expect(placed.center.x - 140).toBeGreaterThanOrEqual(PANEL.right);
    expect(distance(placed.center, input.anchorScreen)).toBeLessThanOrEqual(140 + ANCHOR_CLEARANCE.desktop + 2 * RING_STEP);
    expectValid(input, placed);
  });

  it('moves clear of the panel when the anchor sits under it', () => {
    const input = desktop(200, 450);
    const placed = placeLens(input);
    expect(placed.center.x - 140).toBeGreaterThanOrEqual(PANEL.right);
    expectValid(input, placed);
  });

  it('avoids the credits and the loader near the bottom corner and edge', () => {
    for (const [x, y] of [[1300, 800], [720, 780], [1380, 840]]) {
      const input = desktop(x, y);
      expectValid(input, placeLens(input));
    }
  });

  it('ignores obstacles with no area', () => {
    const zero: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(placeLens(desktop(500, 120, [PANEL, zero]))).toEqual(placeLens(desktop(500, 120, [PANEL])));
  });

  it('uses the area above the bottom sheet on a phone', () => {
    const input = phone(195, 340);
    const placed = placeLens(input);
    expect(placed.size).toBe(200);
    expect(placed.center.y).toBeLessThan(input.anchorScreen.y);
    expect(placed.center.y + 100).toBeLessThanOrEqual(SHEET.top - OBSTACLE_GAP);
    expectValid(input, placed);
  });

  it('shrinks to the phone minimum when the full size does not fit', () => {
    const tight: Rect = { ...SHEET, top: 200 };
    const input = phone(195, 600, [tight, PHONE_CREDITS]);
    const placed = placeLens(input);
    expect(placed.size).toBe(LENS_MIN_PHONE_SIZE);
    expectValid(input, placed);
  });

  it('never shrinks on desktop', () => {
    expect(placeLens(desktop(900, 450)).size).toBe(280);
  });

  it('never overlaps an obstacle or the anchor across the viewport', () => {
    for (let x = 420; x <= 1420; x += 125) {
      for (let y = 40; y <= 860; y += 82) {
        const input = desktop(x, y);
        expectValid(input, placeLens(input));
      }
    }
    for (let x = 30; x <= 360; x += 55) {
      for (let y = 230; y <= 440; y += 30) {
        const input = phone(x, y);
        expectValid(input, placeLens(input));
      }
    }
  });

  it('never touches a hard keep-out rect on a phone, even when a tall sheet leaves almost no room', () => {
    const creditsAt: Rect = { left: 16, top: 16, right: 150, bottom: 48 };
    for (const sheetTop of [180, 220, 300, 448]) {
      const sheet: Rect = { ...SHEET, top: sheetTop };
      for (let x = 20; x <= 370; x += 15) {
        for (let y = 20; y <= 800; y += 14) {
          const placed = placeLens(phone(x, y, [sheet, creditsAt], [creditsAt]));
          expect(gapTo(placed, creditsAt)).toBeGreaterThanOrEqual(KEEP_OUT_GAP - 1e-6);
          expect(placed.size).toBeGreaterThanOrEqual(LENS_MIN_PHONE_SIZE);
        }
      }
    }
  });

  it('never touches a keep-out rect on desktop either (credits bottom-right)', () => {
    for (let x = 420; x <= 1420; x += 50) {
      for (let y = 40; y <= 880; y += 40) {
        const placed = placeLens({ ...desktop(x, y), keepOut: [CREDITS] });
        expect(gapTo(placed, CREDITS)).toBeGreaterThanOrEqual(KEEP_OUT_GAP - 1e-6);
      }
    }
  });

  it('when every candidate is blocked, picks the least-overlapping spot and the smaller phone size', () => {
    const wall: Rect = { left: 0, top: 0, right: PHONE.width, bottom: 700 };
    const placed = placeLens(phone(195, 300, [], [wall]));
    expect(placed.size).toBe(LENS_MIN_PHONE_SIZE);
    expect(placed.center.y).toBeCloseTo(PHONE.height - VIEWPORT_MARGIN - LENS_MIN_PHONE_SIZE / 2, 6);
  });

  it('ignores keep-out rects with no area and behaves as before without any', () => {
    const zero: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(placeLens(phone(195, 340, [SHEET, PHONE_CREDITS], [zero]))).toEqual(placeLens(phone(195, 340)));
  });

  it('clamps into a viewport smaller than the lens', () => {
    const input: PlacementInput = { anchorScreen: { x: 100, y: 150 }, viewport: { width: 200, height: 300 }, obstacles: [], phone: false, size: 280 };
    const placed = placeLens(input);
    expect(placed.size).toBeLessThanOrEqual(200 - 2 * VIEWPORT_MARGIN);
    expect(placed.center.x - placed.size / 2).toBeGreaterThanOrEqual(VIEWPORT_MARGIN - 1e-6);
    expect(placed.center.x + placed.size / 2).toBeLessThanOrEqual(200 - VIEWPORT_MARGIN + 1e-6);
    expect(placed.center.y - placed.size / 2).toBeGreaterThanOrEqual(VIEWPORT_MARGIN - 1e-6);
    expect(placed.center.y + placed.size / 2).toBeLessThanOrEqual(300 - VIEWPORT_MARGIN + 1e-6);
  });

  it('writes into the object it is given', () => {
    const out: Placement = { center: { x: 0, y: 0 }, size: 0 };
    expect(placeLens(desktop(900, 450), out)).toBe(out);
    expect(out.size).toBe(280);
  });

  it('keeps the best-effort result inside the viewport and off the anchor when nothing fits', () => {
    const squeezed: Rect = { ...SHEET, top: 300 };
    const input = phone(195, 150, [squeezed, PHONE_CREDITS]);
    const placed = placeLens(input);
    const r = placed.size / 2;
    expect(placed.center.x - r).toBeGreaterThanOrEqual(VIEWPORT_MARGIN - 1e-6);
    expect(placed.center.x + r).toBeLessThanOrEqual(PHONE.width - VIEWPORT_MARGIN + 1e-6);
    expect(placed.center.y - r).toBeGreaterThanOrEqual(VIEWPORT_MARGIN - 1e-6);
    expect(placed.center.y + r).toBeLessThanOrEqual(PHONE.height - VIEWPORT_MARGIN + 1e-6);
    expect(distance(placed.center, input.anchorScreen)).toBeGreaterThan(r);
  });

  it('places a lens for an anchor high in the organ on a phone', () => {
    const input = phone(163, 202, [SHEET, { left: 16, top: 16, right: 140, bottom: 48 }]);
    const placed = placeLens(input);
    expect(placed.size).toBeGreaterThanOrEqual(LENS_MIN_PHONE_SIZE);
    expectValid(input, placed);
  });

  it('keeps a larger clearance around the anchor when asked', () => {
    const base = placeLens(desktop(900, 450));
    const wide = placeLens({ ...desktop(900, 450), clearance: 260 });
    expect(distance(wide.center, { x: 900, y: 450 })).toBeGreaterThanOrEqual(140 + 260 - PLACEMENT_TOLERANCE);
    expect(distance(wide.center, { x: 900, y: 450 })).toBeGreaterThan(distance(base.center, { x: 900, y: 450 }));
  });

  it('never uses less than the default clearance', () => {
    expect(placeLens({ ...desktop(900, 450), clearance: 10 })).toEqual(placeLens(desktop(900, 450)));
  });

  describe('continuity', () => {
    const layouts: Rect[][] = [[PANEL, CREDITS, LOADER], [PANEL], []];

    function free(input: PlacementInput, candidate: { x: number; y: number }): boolean {
      const r = input.size / 2;
      const inside = candidate.x - r >= VIEWPORT_MARGIN + 1 && candidate.x + r <= input.viewport.width - VIEWPORT_MARGIN - 1
        && candidate.y - r >= VIEWPORT_MARGIN + 1 && candidate.y + r <= input.viewport.height - VIEWPORT_MARGIN - 1;
      return inside && input.obstacles.every((rect) => gapTo({ center: candidate, size: input.size } as Placement, rect) >= OBSTACLE_GAP + 1);
    }

    it('follows a slowly drifting anchor smoothly while no constraint binds', () => {
      const step = 0.3;
      for (const obstacles of layouts) {
        for (const [from, to, y, isPhone] of [[420, 1400, 450, false], [420, 1400, 360, false], [30, 360, 330, true]] as const) {
          let previous: Placement | null = null;
          let unconstrained = 0;
          for (let x = from; x <= to; x += step) {
            const input = isPhone ? phone(x, y, obstacles.length ? [SHEET, PHONE_CREDITS] : []) : desktop(x, y, obstacles);
            const reach = input.size / 2 + (isPhone ? ANCHOR_CLEARANCE.phone : ANCHOR_CLEARANCE.desktop);
            const angle = isPhone ? PREFERRED_ANGLE.phone : PREFERRED_ANGLE.desktop;
            const candidate = { x: x + reach * Math.cos(angle), y: y + reach * Math.sin(angle) };
            const placed = placeLens(input);
            if (free(input, candidate)) {
              unconstrained++;
              expect(distance(placed.center, candidate)).toBeLessThan(1e-6);
              if (previous) expect(distance(placed.center, previous.center)).toBeLessThanOrEqual(step + 2);
              previous = placed;
            } else previous = null;
          }
          expect(unconstrained).toBeGreaterThan(100);
        }
      }
    });
  });
});

describe('pushOut', () => {
  const link: Rect = { left: 300, top: 400, right: 400, bottom: 430 };
  const gap = (c: { x: number; y: number }, r: number): number =>
    Math.hypot(Math.max(link.left - c.x, 0, c.x - link.right), Math.max(link.top - c.y, 0, c.y - link.bottom)) - r;

  it('moves a circle that overlaps the rect out to exactly the keep-out gap, and leaves a clear one alone', () => {
    const near = { x: 350, y: 380 };
    pushOut(near, 100, link);
    expect(gap(near, 100)).toBeCloseTo(KEEP_OUT_GAP, 9);
    const far = { x: 100, y: 100 };
    pushOut(far, 50, link);
    expect(far).toEqual({ x: 100, y: 100 });
  });

  it('pushes a centre that sits inside the rect out through the nearest edge', () => {
    const inside = { x: 395, y: 415 };
    pushOut(inside, 40, link);
    expect(gap(inside, 40)).toBeGreaterThanOrEqual(KEEP_OUT_GAP - 1e-9);
    expect(inside.x).toBeCloseTo(link.right + 40 + KEEP_OUT_GAP, 9);
  });

  it('ignores a rect with no area', () => {
    const point = { x: 5, y: 5 };
    pushOut(point, 100, { left: 0, top: 0, right: 0, bottom: 0 });
    expect(point).toEqual({ x: 5, y: 5 });
  });

  it('keeps the gap at every step while a smoothed lens glides from one side of the link to the other', () => {
    const radius = 100;
    const target = { x: 600, y: 380 };
    const free = { x: 120, y: 410 };
    const pushed = { x: 120, y: 410 };
    let freeOverlaps = 0;
    for (let step = 0; step < 240; step++) {
      free.x = smoothToward(free.x, target.x, 1 / 60, 12);
      free.y = smoothToward(free.y, target.y, 1 / 60, 12);
      if (gap(free, radius) < KEEP_OUT_GAP - 1e-6) freeOverlaps++;
      pushed.x = smoothToward(pushed.x, target.x, 1 / 60, 12);
      pushed.y = smoothToward(pushed.y, target.y, 1 / 60, 12);
      pushOut(pushed, radius, link);
      expect(gap(pushed, radius)).toBeGreaterThanOrEqual(KEEP_OUT_GAP - 1e-6);
    }
    expect(freeOverlaps).toBeGreaterThan(0);
    expect(Math.hypot(pushed.x - target.x, pushed.y - target.y)).toBeLessThan(1);
  });
});
