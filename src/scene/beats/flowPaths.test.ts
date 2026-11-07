import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import {
  CIRCULATION_TARGETS,
  circulationLoops,
  dotLoop,
  dotPhase,
  dotReachedAt,
  glowAfter,
  glowStrength,
  glowTone,
  heartbeat,
  lowerBodyPoint,
  lymphPath,
  pathSample,
  popSize,
  portalColors,
  portalPath,
  torsoDepth,
} from '@/scene/beats/flowPaths';
import { NUTRIENT_COLOR } from '@/scene/path';
import type { Vec3 } from '@/models/types';
import { TEST_ANCHORS as anchors } from '@/scene/testAnchors';

const FRONT: Vec3 = [0, 0, 1];
const DEPTH = 0.3;
const at = (v: Vec3): THREE.Vector3 => new THREE.Vector3(...v);

describe('portalPath', () => {
  it('runs from the small intestine to the liver and bows away from the straight line', () => {
    const curve = portalPath(anchors, FRONT);
    expect(curve.getPoint(0).distanceTo(at(anchors.smallIntestine))).toBeLessThan(1e-9);
    expect(curve.getPoint(1).distanceTo(at(anchors.liver))).toBeLessThan(1e-9);
    const chord = at(anchors.smallIntestine).lerp(at(anchors.liver), 0.5);
    expect(curve.getPoint(0.5).distanceTo(chord)).toBeGreaterThan(0.02);
  });
});

describe('lymphPath', () => {
  it('runs from the small intestine to the heart, behind the gut, clearly apart from the portal vein', () => {
    const lymph = lymphPath(anchors, FRONT, DEPTH);
    expect(lymph.getPoint(0).distanceTo(at(anchors.smallIntestine))).toBeLessThan(1e-9);
    expect(lymph.getPoint(1).distanceTo(at(anchors.heart))).toBeLessThan(1e-9);
    const mid = lymph.getPoint(0.5);
    expect(mid.distanceTo(portalPath(anchors, FRONT).getPoint(0.5))).toBeGreaterThan(0.06);
    expect(mid.z).toBeLessThan(Math.min(anchors.smallIntestine[2], anchors.heart[2]) - 0.05);
  });

  it('goes deeper for a deeper torso', () => {
    const shallow = lymphPath(anchors, FRONT, 0.1).getPoint(0.5).z;
    expect(lymphPath(anchors, FRONT, 0.4).getPoint(0.5).z).toBeLessThan(shallow);
  });
});

describe('torsoDepth', () => {
  it('measures a box along the front direction', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, -0.8, -0.2), new THREE.Vector3(0.5, 0.9, 0.1));
    expect(torsoDepth(box, FRONT)).toBeCloseTo(0.3, 9);
    expect(torsoDepth(box, [1, 0, 0])).toBeCloseTo(1, 9);
    expect(torsoDepth(new THREE.Box3(), FRONT)).toBe(0);
  });
});

describe('lowerBodyPoint', () => {
  it('sits below the colon, part way to the feet', () => {
    const lower = lowerBodyPoint(anchors, -0.8);
    expect(lower[1]).toBeLessThan(anchors.colon[1] - 0.1);
    expect(lower[1]).toBeGreaterThan(-0.8);
    expect(lower[0]).toBe(anchors.colon[0]);
  });
});

describe('circulationLoops', () => {
  const lower = lowerBodyPoint(anchors, -0.8);
  const loops = circulationLoops(anchors, lower, FRONT);

  it('has one closed loop per target that starts and ends at the heart and reaches its target half way', () => {
    expect(loops).toHaveLength(CIRCULATION_TARGETS.length);
    const heart = at(anchors.heart);
    loops.forEach((loop, k) => {
      expect(loop.getPoint(0).distanceTo(heart)).toBeLessThan(1e-9);
      expect(loop.getPoint(1).distanceTo(heart)).toBeLessThan(1e-9);
      const target = CIRCULATION_TARGETS[k] === 'lower' ? at(lower) : at(anchors[CIRCULATION_TARGETS[k] as 'brain']);
      expect(loop.getPoint(0.5).distanceTo(target)).toBeLessThan(1e-9);
    });
  });

  it('goes out on one side and comes back on the other', () => {
    for (const loop of loops) expect(loop.getPoint(0.25).distanceTo(loop.getPoint(0.75))).toBeGreaterThan(0.01);
  });
});

describe('dots', () => {
  it('keeps every launched phase inside [0,1) and hides dots before they leave the heart', () => {
    const count = 24;
    for (let i = 0; i < count; i++) {
      for (let p = 0; p <= 1; p += 0.01) {
        const phase = dotPhase(i, count, p);
        if (phase === null) continue;
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(1);
      }
    }
    expect(dotPhase(0, count, 0)).toBe(0);
    expect(dotPhase(count - 1, count, 0.05)).toBeNull();
    expect(dotPhase(count - 1, count, 0.9)).not.toBeNull();
  });

  it('is a pure function of progress', () => {
    expect(dotPhase(5, 24, 0.63)).toBe(dotPhase(5, 24, 0.63));
  });

  it('reports when a dot reaches a phase, consistent with dotPhase', () => {
    const p = dotReachedAt(0, 24, 0.5);
    expect(p).toBeGreaterThan(0.1);
    expect(p).toBeLessThan(0.5);
    expect(dotPhase(0, 24, p)).toBeCloseTo(0.5, 9);
  });

  it('sends half of the dots to the brain when the brain is emphasised, a quarter otherwise', () => {
    const brain = CIRCULATION_TARGETS.indexOf('brain');
    const share = (emphasise: boolean): number => Array.from({ length: 24 }, (_, i) => dotLoop(i, emphasise)).filter((k) => k === brain).length / 24;
    expect(share(true)).toBe(0.5);
    expect(share(false)).toBe(0.25);
    expect(dotLoop(0, true)).toBe(brain);
    const all = new Set(Array.from({ length: 8 }, (_, i) => dotLoop(i, false)));
    expect(all.size).toBe(CIRCULATION_TARGETS.length);
  });
});

describe('pathSample', () => {
  it('clamps to the ends of the curve', () => {
    const curve = portalPath(anchors, FRONT);
    const out = new THREE.Vector3();
    expect(pathSample(curve, -1, out).distanceTo(at(anchors.smallIntestine))).toBeLessThan(1e-9);
    expect(pathSample(curve, 2, out).distanceTo(at(anchors.liver))).toBeLessThan(1e-9);
  });
});

describe('portalColors', () => {
  it('uses only the water-soluble nutrients that are present, weighted by amount and interleaved', () => {
    const colors = portalColors({ ...emptyNutrients(), starch: 30, protein: 6, fat: 15, fibre: 5 }, 24);
    expect(colors).toHaveLength(24);
    expect(new Set(colors)).toEqual(new Set([NUTRIENT_COLOR.sugar, NUTRIENT_COLOR.protein]));
    const starch = colors.filter((c) => c === NUTRIENT_COLOR.sugar).length;
    expect(starch).toBeGreaterThan(colors.length / 2);
    expect(colors.slice(0, 8)).toContain(NUTRIENT_COLOR.protein);
  });

  it('shows digested starch in the glucose hue, never the cream starch colour', () => {
    const colors = portalColors({ ...emptyNutrients(), starch: 40 }, 24);
    expect(new Set(colors)).toEqual(new Set([NUTRIENT_COLOR.sugar]));
    expect(colors).not.toContain(NUTRIENT_COLOR.starch);
  });

  it('never shows sugar for black coffee', () => {
    const colors = portalColors({ ...emptyNutrients(), caffeine: 95, protein: 0.3 }, 24);
    expect(new Set(colors)).toEqual(new Set([NUTRIENT_COLOR.caffeine]));
  });

  it('gives every present nutrient a visible share', () => {
    const colors = portalColors({ ...emptyNutrients(), sugar: 40, alcohol: 14, caffeine: 95 }, 24);
    for (const n of ['sugar', 'alcohol', 'caffeine'] as const) expect(colors.filter((c) => c === NUTRIENT_COLOR[n]).length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to a neutral colour when nothing water-soluble is present', () => {
    const colors = portalColors({ ...emptyNutrients(), fat: 20 }, 10);
    expect(colors).toHaveLength(10);
    expect(new Set(colors).size).toBe(1);
    expect(Object.values(NUTRIENT_COLOR)).not.toContain(colors[0]);
  });
});

describe('glow curves', () => {
  it('stays dark before the arrival, then pulses inside (0,1]', () => {
    expect(glowAfter(0.5, 0.6)).toBe(0);
    let lo = 1;
    let hi = 0;
    for (let p = 0.65; p <= 1; p += 0.01) {
      const g = glowAfter(p, 0.6);
      expect(g).toBeGreaterThan(0);
      expect(g).toBeLessThanOrEqual(1);
      lo = Math.min(lo, g);
      hi = Math.max(hi, g);
    }
    expect(hi - lo).toBeGreaterThan(0.2);
  });

  it('beats the heart several times with rests in between', () => {
    let peaks = 0;
    let prev = 0;
    let rising = false;
    for (let p = 0; p <= 1; p += 0.002) {
      const h = heartbeat(p);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
      if (h < prev && rising && prev > 0.9) peaks += 1;
      rising = h > prev;
      prev = h;
    }
    expect(peaks).toBeGreaterThanOrEqual(4);
    expect(heartbeat(0)).toBe(0);
  });
});

describe('glow tone', () => {
  const VEIN = 0x6f9dff;

  it('glows the liver in the most saturated arriving colour, or the vein blue when every colour is pale or dull', () => {
    const starch = portalColors({ ...emptyNutrients(), starch: 40 }, 24);
    expect(glowTone(starch, VEIN)).not.toBe(NUTRIENT_COLOR.starch);
    expect(glowTone(starch, VEIN)).toBe(NUTRIENT_COLOR.sugar);
    expect(glowStrength(glowTone(starch, VEIN), 0.6)).toBeGreaterThan(0.2);
    expect(glowTone(portalColors({ ...emptyNutrients(), caffeine: 95 }, 24), VEIN)).toBe(VEIN);
    expect(glowTone(portalColors({ ...emptyNutrients(), iron: 5 }, 24), VEIN)).toBe(VEIN);
    expect(glowTone(portalColors({ ...emptyNutrients(), starch: 28, protein: 4.6 }, 24), VEIN)).toBe(NUTRIENT_COLOR.sugar);
    expect(glowTone(portalColors({ ...emptyNutrients(), sugar: 35, caffeine: 30 }, 24), VEIN)).toBe(NUTRIENT_COLOR.sugar);
  });

  it('gives light colours a lower glow than saturated darker ones, within the cap', () => {
    expect(glowStrength(NUTRIENT_COLOR.starch, 0.6)).toBeLessThan(glowStrength(NUTRIENT_COLOR.alcohol, 0.6));
    expect(glowStrength(VEIN, 0.6)).toBeLessThan(glowStrength(NUTRIENT_COLOR.alcohol, 0.6));
    expect(glowStrength(0xffffff, 0.6)).toBe(0);
    expect(glowStrength(0x000000, 0.6)).toBe(0.6);
  });
});

describe('popSize', () => {
  it('grows from nothing and shrinks to nothing, so a wrapping dot never pops', () => {
    expect(popSize(0, 25)).toBe(0);
    expect(popSize(1, 25)).toBe(0);
    expect(popSize(0.5, 25)).toBe(1);
    expect(Math.abs(popSize(0.9999, 25) - popSize(0.0001, 25))).toBeLessThan(0.01);
  });
});
