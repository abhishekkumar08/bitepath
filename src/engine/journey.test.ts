import { describe, expect, it } from 'vitest';
import { buildJourney } from '@/engine/journey';
import { emptyNutrients } from '@/engine/totals';
import { STAR_SECONDS } from '@/scene/timeline';
import type { Catalogue, Food, Nutrients, StationId } from '@/engine/types';

const food = (id: string, values: Partial<Nutrients>): Food => ({
  id,
  name: id,
  source: 'usda',
  kcalPer100g: 0,
  per100g: { ...emptyNutrients(), ...values },
});

const catalogue: Catalogue = {
  foods: {
    rice: food('rice', { starch: 75.7, sugar: 0.69, protein: 7.94, fat: 0.52, fibre: 2.81, iron: 0.65 }),
    beer: food('beer', { alcohol: 3.9, starch: 3.6, protein: 0.5 }),
    coffee: food('coffee', { caffeine: 40, protein: 0.1 }),
    fries: food('fries', { starch: 25, fat: 15, fibre: 3, protein: 3 }),
    blackCoffee: food('blackCoffee', { caffeine: 80, protein: 0.2, fat: 0.04 }),
    traceBeer: food('traceBeer', { alcohol: 0.5 }),
    bran: food('bran', { starch: 20, fibre: 30, protein: 5 }),
  },
  dishes: {},
};

const ids = (stations: { id: StationId }[]) => stations.map((s) => s.id);

describe('buildJourney', () => {
  it('walks plain rice through every stop except the bloodstream', () => {
    const j = buildJourney(catalogue, 'female', [{ kind: 'food', foodId: 'rice', grams: 75 }]);
    expect(ids(j.stations)).toEqual(['mouth', 'oesophagus', 'stomach', 'smallIntestine', 'liver', 'largeIntestine']);
  });

  it('sends fibre to the colon and keeps fat out of the liver', () => {
    const j = buildJourney(catalogue, 'male', [{ kind: 'food', foodId: 'fries', grams: 150 }]);
    const liver = j.stations.find((s) => s.id === 'liver');
    const colon = j.stations.find((s) => s.id === 'largeIntestine');
    expect(liver?.streams.map((s) => s.nutrient)).not.toContain('fat');
    expect(colon?.streams.map((s) => s.nutrient)).toEqual(['fibre']);
  });

  it('triggers the alcohol star and a blood stop for both sexes, with the extra fact only for women', () => {
    const bloodRules = (sex: 'male' | 'female') =>
      buildJourney(catalogue, sex, [{ kind: 'food', foodId: 'beer', grams: 330 }])
        .stations.find((s) => s.id === 'bloodstream')
        ?.captions.map((c) => c.ruleId);
    const female = buildJourney(catalogue, 'female', [{ kind: 'food', foodId: 'beer', grams: 330 }]);
    expect(female.stations.find((s) => s.id === 'stomach')?.stars).toEqual(['alcohol']);
    expect(bloodRules('female')).toEqual(['blood-alcohol', 'blood-alcohol-female']);
    expect(bloodRules('male')).toEqual(['blood-alcohol']);
  });

  it('triggers the caffeine star in the bloodstream', () => {
    const j = buildJourney(catalogue, 'male', [{ kind: 'food', foodId: 'coffee', grams: 200 }]);
    expect(j.stations.find((s) => s.id === 'bloodstream')?.stars).toEqual(['caffeine']);
  });

  it('holds a fatty meal longer in the stomach than plain rice', () => {
    const dwell = (foodId: string, grams: number) =>
      buildJourney(catalogue, 'male', [{ kind: 'food', foodId, grams }]).stations.find((s) => s.id === 'stomach')?.dwellSeconds ?? 0;
    expect(dwell('fries', 150)).toBeGreaterThan(dwell('rice', 75));
  });

  it('shows no protein or fat stream for black coffee', () => {
    const j = buildJourney(catalogue, 'male', [{ kind: 'food', foodId: 'blackCoffee', grams: 100 }]);
    const nutrients = j.stations.flatMap((s) => s.streams.map((x) => x.nutrient));
    expect(nutrients).not.toContain('protein');
    expect(nutrients).not.toContain('fat');
    expect(nutrients).toContain('caffeine');
  });

  it('gives a trace of alcohol no caption and no star, but 12.9 g still gets both for either sex', () => {
    for (const sex of ['male', 'female'] as const) {
      const trace = buildJourney(catalogue, sex, [{ kind: 'food', foodId: 'traceBeer', grams: 100 }]);
      const traceRules = trace.stations.flatMap((s) => s.captions.map((c) => c.ruleId));
      expect(traceRules.filter((r) => r.includes('alcohol'))).toEqual([]);
      expect(trace.stations.flatMap((s) => s.stars)).not.toContain('alcohol');
      const real = buildJourney(catalogue, sex, [{ kind: 'food', foodId: 'beer', grams: 330 }]);
      expect(real.totals.alcohol).toBeCloseTo(12.87);
      expect(real.stations.flatMap((s) => s.stars)).toContain('alcohol');
      expect(real.stations.find((s) => s.id === 'stomach')?.captions.map((c) => c.ruleId)).toContain(`stomach-alcohol-${sex}`);
    }
  });

  it('holds a high-fibre plate longer in the large intestine', () => {
    const stay = (foodId: string, grams: number) => {
      const s = buildJourney(catalogue, 'male', [{ kind: 'food', foodId, grams }]).stations.find((x) => x.id === 'largeIntestine');
      return s ? s.stars.length * STAR_SECONDS + s.dwellSeconds : 0;
    };
    expect(stay('bran', 100)).toBeGreaterThan(stay('rice', 100));
    expect(stay('rice', 100)).toBeGreaterThan(stay('rice', 20));
  });

  it('after a star window with no dwell beat, holds its last frame 2 s plus the food bonus, never over 5 s', () => {
    const station = (foodId: string, grams: number, id: StationId) =>
      buildJourney(catalogue, 'male', [{ kind: 'food', foodId, grams }]).stations.find((s) => s.id === id);
    const caffeine = station('blackCoffee', 100, 'bloodstream');
    expect(caffeine?.beats.filter((b) => b.effect !== null).every((b) => b.star !== null)).toBe(true);
    expect(caffeine?.dwellSeconds).toBe(2);
    const fibre = station('bran', 100, 'largeIntestine');
    expect(fibre?.stars).toEqual(['fibre']);
    expect(fibre?.beats.filter((b) => b.effect !== null).every((b) => b.star !== null)).toBe(true);
    expect(fibre?.dwellSeconds).toBe(5);
  });

  it('rounds dwell to one decimal', () => {
    const j = buildJourney(catalogue, 'male', [{ kind: 'food', foodId: 'fries', grams: 77 }]);
    for (const s of j.stations) expect(Math.round(s.dwellSeconds * 10) / 10).toBe(s.dwellSeconds);
  });

  it('carries one beat per caption, in play order: star windows first, then dwell beats, text-only last', () => {
    const plate = [
      { kind: 'food' as const, foodId: 'fries', grams: 150 },
      { kind: 'food' as const, foodId: 'beer', grams: 330 },
      { kind: 'food' as const, foodId: 'coffee', grams: 200 },
    ];
    for (const sex of ['male', 'female'] as const) {
      for (const s of buildJourney(catalogue, sex, plate).stations) {
        expect(s.beats.map((b) => b.ruleId).sort(), s.id).toEqual(s.captions.map((c) => c.ruleId).sort());
        const firstTextOnly = s.beats.findIndex((b) => b.effect === null);
        if (firstTextOnly >= 0) expect(s.beats.slice(firstTextOnly).every((b) => b.effect === null)).toBe(true);
        const animated = s.beats.filter((b) => b.effect !== null);
        const firstDwell = animated.findIndex((b) => b.star === null);
        if (firstDwell >= 0) expect(animated.slice(firstDwell).every((b) => b.star === null), s.id).toBe(true);
        const starOrder = animated.flatMap((b) => (b.star === null ? [] : [s.stars.indexOf(b.star)]));
        expect(starOrder, s.id).toEqual([...starOrder].sort((a, b) => a - b));
      }
    }
  });

  it('attaches star windows to the stations that own the stars, and only those', () => {
    const j = buildJourney(catalogue, 'female', [
      { kind: 'food', foodId: 'fries', grams: 150 },
      { kind: 'food', foodId: 'beer', grams: 330 },
      { kind: 'food', foodId: 'coffee', grams: 200 },
    ]);
    for (const s of j.stations) {
      const starred = s.beats.filter((b) => b.star !== null).map((b) => b.star);
      for (const star of starred) expect(s.stars, s.id).toContain(star);
    }
    const stomach = j.stations.find((s) => s.id === 'stomach');
    expect(stomach?.beats.find((b) => b.ruleId === 'stomach-alcohol-female')?.star).toBe('alcohol');
  });

  it('gives each stop at least the time its dwell beats need', () => {
    const plates = [
      [{ kind: 'food' as const, foodId: 'rice', grams: 75 }],
      [{ kind: 'food' as const, foodId: 'blackCoffee', grams: 100 }],
      [
        { kind: 'food' as const, foodId: 'fries', grams: 150 },
        { kind: 'food' as const, foodId: 'beer', grams: 330 },
      ],
    ];
    for (const plate of plates) {
      for (const s of buildJourney(catalogue, 'female', plate).stations) {
        const needed = s.beats.filter((b) => b.star === null).reduce((sum, b) => sum + b.seconds, 0);
        expect(s.dwellSeconds, s.id).toBeGreaterThanOrEqual(needed);
      }
    }
  });

  it('refuses an empty plate', () => {
    expect(() => buildJourney(catalogue, 'male', [])).toThrow('Nothing to digest');
  });
});
