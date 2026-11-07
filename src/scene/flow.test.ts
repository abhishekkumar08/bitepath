import { describe, expect, it } from 'vitest';
import { MIN_STREAM_AMOUNT, NUTRIENTS, emptyNutrients } from '@/engine/totals';
import type { Nutrient, Nutrients, StationId } from '@/engine/types';
import { massParticles, routeParam, swellAt } from '@/scene/flow';
import { routeAnchors } from '@/scene/route';
import type { Phase, RouteArgs } from '@/scene/types';

const JOURNEY: StationId[] = ['mouth', 'oesophagus', 'stomach', 'smallIntestine', 'liver', 'largeIntestine'];

const args = (nutrient: Nutrient, index: number, phase: Phase, progress: number, stationProgress: number): RouteArgs => ({
  routeAnchors: routeAnchors(nutrient),
  journeyStations: JOURNEY,
  index,
  phase,
  progress,
  stationProgress,
});

const steps = (nutrient: Nutrient): number => routeAnchors(nutrient).length - 1;
const anchorIndex = (nutrient: Nutrient, id: string): number => routeAnchors(nutrient).indexOf(id as never);

describe('routeParam', () => {
  it('replaces the station progress with an advance override outside travel', () => {
    const base = args('starch', 1, 'dwell', 0.1, 0.1);
    expect(routeParam(base, 0.8)).toBeCloseTo(routeParam({ ...base, stationProgress: 0.8 }), 10);
    expect(routeParam(base, null)).toBeCloseTo(routeParam(base), 10);
    expect(routeParam(base, 0.8)).toBeGreaterThan(routeParam(base));
  });

  it('keeps a liver-bound nutrient at the liver while the colon stop plays', () => {
    const liver = anchorIndex('starch', 'liver') / steps('starch');
    const values = [
      routeParam(args('starch', 5, 'travel', 0, 0)),
      routeParam(args('starch', 5, 'travel', 0.7, 0)),
      routeParam(args('starch', 5, 'dwell', 0.5, 0.5)),
      routeParam(args('starch', 5, 'dwell', 1, 1)),
    ];
    values.forEach((v) => expect(v).toBeCloseTo(liver, 10));
  });

  it('holds fibre at the small intestine while the liver plays, then carries it to the colon', () => {
    const smallIntestine = anchorIndex('fibre', 'smallIntestine') / steps('fibre');
    expect(routeParam(args('fibre', 4, 'travel', 0, 0))).toBeCloseTo(smallIntestine, 10);
    expect(routeParam(args('fibre', 4, 'dwell', 1, 1))).toBeCloseTo(smallIntestine, 10);
    expect(routeParam(args('fibre', 5, 'travel', 0, 0))).toBeCloseTo(smallIntestine, 10);
    expect(routeParam(args('fibre', 5, 'travel', 1, 0))).toBeCloseTo(1, 10);
    expect(routeParam(args('fibre', 5, 'dwell', 0.3, 0.3))).toBeCloseTo(1, 10);
  });

  it('moves across both anchors of a two-anchor station', () => {
    const top = anchorIndex('sugar', 'oesophagusTop') / steps('sugar');
    const bottom = anchorIndex('sugar', 'oesophagusBottom') / steps('sugar');
    expect(routeParam(args('sugar', 1, 'star', 0, 0))).toBeCloseTo(top, 10);
    expect(routeParam(args('sugar', 1, 'dwell', 1, 1))).toBeCloseTo(bottom, 10);
    const mid = routeParam(args('sugar', 1, 'dwell', 0.5, 0.5));
    expect(mid).toBeGreaterThan(top);
    expect(mid).toBeLessThan(bottom);
  });

  it('never moves backwards and stays within 0..1 over a whole journey', () => {
    for (const nutrient of NUTRIENTS) {
      let previous = 0;
      JOURNEY.forEach((_, index) => {
        const samples: RouteArgs[] = [];
        for (let k = 0; k <= 20; k += 1) samples.push(args(nutrient, index, 'travel', k / 20, 0));
        for (let k = 0; k <= 20; k += 1) samples.push(args(nutrient, index, 'dwell', k / 20, k / 20));
        for (const sample of samples) {
          const u = routeParam(sample);
          expect(u).toBeGreaterThanOrEqual(0);
          expect(u).toBeLessThanOrEqual(1);
          expect(u).toBeGreaterThanOrEqual(previous - 1e-9);
          previous = u;
        }
      });
    }
  });
});

describe('swellAt', () => {
  const ids = routeAnchors('starch');
  const atAnchor = (id: string): number => swellAt(ids, ids.indexOf(id as never) / (ids.length - 1));

  it('is positive and continuous', () => {
    let previous = swellAt(ids, 0);
    for (let k = 0; k <= 200; k += 1) {
      const value = swellAt(ids, k / 200);
      expect(value).toBeGreaterThan(0);
      expect(Math.abs(value - previous)).toBeLessThanOrEqual(0.1);
      previous = value;
    }
  });

  it('widens in the stomach and the small intestine', () => {
    expect(atAnchor('stomach')).toBeGreaterThan(atAnchor('oesophagusBottom'));
    expect(atAnchor('stomach')).toBeGreaterThan(atAnchor('mouth'));
    expect(atAnchor('smallIntestine')).toBeGreaterThan(atAnchor('liver'));
  });
});

const totals = (partial: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...partial });

describe('massParticles', () => {
  it('turns a cup of black coffee into a 36-particle caffeine mass', () => {
    expect(massParticles(totals({ caffeine: 95 }))).toEqual({ caffeine: 36 });
  });

  it('gives a fatty plate more fat than protein particles', () => {
    const mass = massParticles(totals({ fat: 30, protein: 10, starch: 20 }));
    expect(mass.fat ?? 0).toBeGreaterThan(mass.protein ?? 0);
  });

  it('keeps the total within bounds when gram nutrients are present', () => {
    const plates = [totals({ sugar: 2 }), totals({ sugar: 10, starch: 60, protein: 25, fat: 20, fibre: 8, alcohol: 14, caffeine: 80, iron: 3 }), totals({ starch: 900, protein: 400 })];
    for (const plate of plates) {
      const total = Object.values(massParticles(plate)).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(36);
      expect(total).toBeLessThanOrEqual(158);
    }
  });

  it('adds four caffeine and iron flecks to a gram mass', () => {
    const mass = massParticles(totals({ starch: 50, caffeine: 40, iron: 2 }));
    expect(mass.caffeine).toBe(4);
    expect(mass.iron).toBe(4);
  });

  it('is empty for an empty or trace plate', () => {
    expect(massParticles(emptyNutrients())).toEqual({});
    const trace = MIN_STREAM_AMOUNT / 2;
    expect(massParticles(totals({ sugar: trace, caffeine: trace }))).toEqual({});
  });
});
