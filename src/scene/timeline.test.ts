import { describe, expect, it } from 'vitest';
import { STAR_SECONDS, TRAVEL_SECONDS, beatTime, buildTimeline, momentAt, playFrom, totalDuration } from '@/scene/timeline';
import { buildJourney } from '@/engine/journey';
import { emptyNutrients } from '@/engine/totals';
import type { Beat, Catalogue, EffectId, Journey, Nutrients, StarId } from '@/engine/types';

const journey: Journey = {
  sex: 'female',
  totals: emptyNutrients(),
  stations: [
    { id: 'mouth', captions: [], streams: [], stars: [], beats: [], dwellSeconds: 4 },
    { id: 'stomach', captions: [], streams: [], stars: ['alcohol'], beats: [], dwellSeconds: 6 },
  ],
};

describe('timeline', () => {
  const timeline = buildTimeline(journey);

  it('adds travel and star time to each stop', () => {
    expect(totalDuration(timeline)).toBe(TRAVEL_SECONDS * 2 + STAR_SECONDS + 4 + 6);
  });

  it('reports travel, star and dwell phases in order', () => {
    expect(momentAt(timeline, 0).phase).toBe('travel');
    const starStart = timeline[1].travelEnd;
    expect(momentAt(timeline, starStart + 0.1)).toMatchObject({ index: 1, phase: 'star', star: 'alcohol' });
    expect(momentAt(timeline, timeline[1].starsEnd + 0.1)).toMatchObject({ index: 1, phase: 'dwell', star: null });
  });

  it('is done after the last stop', () => {
    expect(momentAt(timeline, totalDuration(timeline) + 1)).toMatchObject({ index: 1, done: true, progress: 1 });
  });

  it('reports done with no beat for an empty timeline', () => {
    expect(momentAt([], 0)).toMatchObject({ index: 0, done: true, beatIndex: null, beatEffect: null });
  });

  it('replays from the start once finished, otherwise resumes in place', () => {
    expect(playFrom(timeline, totalDuration(timeline))).toBe(0);
    expect(playFrom(timeline, 3)).toBe(3);
  });
});

describe('station progress', () => {
  const twoStars: Journey = {
    sex: 'female',
    totals: emptyNutrients(),
    stations: [{ id: 'stomach', captions: [], streams: [], stars: ['fat', 'caffeine'], beats: [], dwellSeconds: 6 }],
  };
  const timeline = buildTimeline(twoStars);
  const segment = timeline[0];

  it('resets progress per star and switches star at the boundary', () => {
    const boundary = segment.travelEnd + STAR_SECONDS;
    expect(momentAt(timeline, boundary - 0.01)).toMatchObject({ phase: 'star', star: 'fat' });
    expect(momentAt(timeline, boundary - 0.01).progress).toBeGreaterThan(0.95);
    expect(momentAt(timeline, boundary + 0.01)).toMatchObject({ phase: 'star', star: 'caffeine' });
    expect(momentAt(timeline, boundary + 0.01).progress).toBeLessThan(0.05);
  });

  it('rises monotonically across both stars and the dwell', () => {
    const samples = Array.from({ length: 100 }, (_, i) => (segment.end * i) / 100);
    const values = [...samples, segment.end].map((t) => momentAt(timeline, t).stationProgress);
    values.forEach((v, i) => {
      if (i > 0) expect(v).toBeGreaterThanOrEqual(values[i - 1]);
    });
    expect(momentAt(timeline, segment.travelEnd - 0.01).stationProgress).toBe(0);
    expect(momentAt(timeline, segment.starsEnd).stationProgress).toBeGreaterThan(0.5);
    expect(momentAt(timeline, segment.end - 0.001).stationProgress).toBeGreaterThan(0.99);
    expect(values.at(-1)).toBe(1);
  });
});

describe('beat slots', () => {
  const beat = (ruleId: string, effect: EffectId | null, seconds: number, star: StarId | null = null): Beat => ({ ruleId, effect, seconds, star });
  const journey: Journey = {
    sex: 'female',
    totals: emptyNutrients(),
    stations: [
      {
        id: 'mouth',
        captions: [],
        streams: [],
        stars: [],
        beats: [beat('a', 'chew', 5), beat('b', 'amylase', 6), beat('c', null, 0)],
        dwellSeconds: 22,
      },
      {
        id: 'stomach',
        captions: [],
        streams: [],
        stars: ['alcohol'],
        beats: [beat('e', 'seep', 6, 'alcohol'), beat('d', 'pepsin', 6), beat('f', 'drain', 5)],
        dwellSeconds: 11,
      },
      { id: 'liver', captions: [], streams: [], stars: [], beats: [], dwellSeconds: 5 },
    ],
  };
  const timeline = buildTimeline(journey);
  const [mouth, stomach, liver] = timeline;

  it('spreads dwell beats over the dwell in proportion to their seconds', () => {
    expect(mouth.beatStarts[0]).toBeCloseTo(mouth.starsEnd);
    expect(mouth.beatStarts[1]).toBeCloseTo(mouth.starsEnd + (22 * 5) / 11);
    expect(stomach.beatStarts[1]).toBeCloseTo(stomach.starsEnd);
    expect(stomach.beatStarts[2]).toBeCloseTo(stomach.starsEnd + 6);
  });

  it('starts a star beat with its star and a text-only beat with the last animated beat', () => {
    expect(stomach.beatStarts[0]).toBeCloseTo(stomach.travelEnd);
    expect(mouth.beatStarts[2]).toBeCloseTo(mouth.beatStarts[1]);
    expect(liver.beatStarts).toEqual([]);
  });

  it('reports the active dwell beat with its own progress at start, middle and end', () => {
    const first = mouth.beatStarts[0];
    const second = mouth.beatStarts[1];
    expect(momentAt(timeline, first)).toMatchObject({ beatIndex: 0, beatEffect: 'chew', beatProgress: 0 });
    expect(momentAt(timeline, (first + second) / 2)).toMatchObject({ beatIndex: 0, beatEffect: 'chew' });
    expect(momentAt(timeline, (first + second) / 2).beatProgress).toBeCloseTo(0.5);
    expect(momentAt(timeline, second - 0.001).beatProgress).toBeGreaterThan(0.99);
    expect(momentAt(timeline, second)).toMatchObject({ beatIndex: 1, beatEffect: 'amylase', beatProgress: 0 });
    expect(momentAt(timeline, (second + mouth.end) / 2).beatProgress).toBeCloseTo(0.5);
    expect(momentAt(timeline, mouth.end - 0.001)).toMatchObject({ beatIndex: 1, beatEffect: 'amylase' });
    expect(momentAt(timeline, mouth.end - 0.001).beatProgress).toBeGreaterThan(0.99);
  });

  it('never makes a text-only beat the active one', () => {
    for (let i = 0; i < 100; i++) expect(momentAt(timeline, (mouth.end * i) / 100).beatIndex).not.toBe(2);
  });

  it('plays the star beat across the star window with the star progress', () => {
    const m = momentAt(timeline, stomach.travelEnd + STAR_SECONDS / 2);
    expect(m).toMatchObject({ phase: 'star', star: 'alcohol', beatIndex: 0, beatEffect: 'seep' });
    expect(m.beatProgress).toBeCloseTo(0.5);
    expect(momentAt(timeline, stomach.travelEnd)).toMatchObject({ beatIndex: 0, beatProgress: 0 });
  });

  it('plays the dwell beats after the star window', () => {
    expect(momentAt(timeline, stomach.starsEnd + 0.1)).toMatchObject({ phase: 'dwell', beatIndex: 1, beatEffect: 'pepsin' });
    expect(momentAt(timeline, stomach.beatStarts[2] + 0.1)).toMatchObject({ beatIndex: 2, beatEffect: 'drain' });
  });

  it('has no beat during travel', () => {
    expect(momentAt(timeline, 1)).toMatchObject({ phase: 'travel', beatIndex: null, beatEffect: null, beatProgress: 0 });
    expect(momentAt(timeline, stomach.start + 1)).toMatchObject({ phase: 'travel', beatIndex: null, beatEffect: null });
  });

  it('holds the last animated beat at full progress when done', () => {
    const after = totalDuration(timeline) + 1;
    expect(momentAt(buildTimeline({ ...journey, stations: journey.stations.slice(0, 2) }), after)).toMatchObject({
      done: true,
      beatIndex: 2,
      beatEffect: 'drain',
      beatProgress: 1,
    });
  });

  it('has no beat for a stop with empty beats', () => {
    expect(momentAt(timeline, liver.travelEnd + 1)).toMatchObject({ index: 2, phase: 'dwell', beatIndex: null, beatEffect: null, beatProgress: 0 });
    expect(momentAt(timeline, totalDuration(timeline) + 1)).toMatchObject({ done: true, beatIndex: null, beatEffect: null });
  });

  it('copes with beats that all have zero seconds', () => {
    const zero = buildTimeline({
      ...journey,
      stations: [{ id: 'mouth', captions: [], streams: [], stars: [], beats: [beat('x', null, 0)], dwellSeconds: 4 }],
    });
    expect(zero[0].beatStarts.every(Number.isFinite)).toBe(true);
    expect(momentAt(zero, zero[0].starsEnd + 1)).toMatchObject({ beatIndex: null, beatEffect: null });
  });

  it('seeks a beat by rule id so momentAt lands inside it at that progress', () => {
    for (const [seg, rule, index, progress] of [[mouth, 'a', 0, 0.5], [mouth, 'b', 1, 0.25], [stomach, 'd', 1, 0.8], [stomach, 'e', 0, 0.6], [stomach, 'f', 2, 0.5]] as const) {
      const at = beatTime(seg, rule, progress);
      expect(at).not.toBeNull();
      const moment = momentAt(timeline, at ?? 0);
      expect(moment).toMatchObject({ beatIndex: index });
      expect(moment.beatProgress).toBeCloseTo(progress, 2);
    }
    expect(momentAt(timeline, beatTime(stomach, 'e', 0.5) ?? 0)).toMatchObject({ phase: 'star', star: 'alcohol' });
  });

  it('keeps a seek to progress 1 inside the beat and ignores unknown rules', () => {
    expect(momentAt(timeline, beatTime(mouth, 'b', 1) ?? 0)).toMatchObject({ index: 0, beatIndex: 1 });
    expect(momentAt(timeline, beatTime(stomach, 'e', 1) ?? 0)).toMatchObject({ index: 1, phase: 'star' });
    expect(beatTime(mouth, 'nope', 0.5)).toBeNull();
  });
});

describe('beat index through a real station', () => {
  const food = (id: string, values: Partial<Nutrients>) => ({
    id,
    name: id,
    source: 'usda' as const,
    kcalPer100g: 0,
    per100g: { ...emptyNutrients(), ...values },
  });
  const catalogue: Catalogue = {
    foods: {
      beer: food('beer', { alcohol: 3.9, starch: 3.6, protein: 0.5 }),
      rice: food('rice', { starch: 75.7, sugar: 0.69, protein: 7.94, fat: 0.52, fibre: 2.81, iron: 6 }),
    },
    dishes: {},
  };

  for (const [name, foodId, grams, stationId, star] of [
    ['stomach with alcohol', 'beer', 330, 'stomach', 'alcohol'],
    ['small intestine with iron', 'rice', 300, 'smallIntestine', 'iron'],
  ] as const) {
    it(`never decreases across the ${name}`, () => {
      const journey = buildJourney(catalogue, 'female', [{ kind: 'food', foodId, grams }]);
      const timeline = buildTimeline(journey);
      const segment = timeline.find((s) => s.station.id === stationId);
      expect(segment?.station.stars).toContain(star);
      if (!segment) return;
      let previous = -1;
      const samples = 400;
      for (let i = 0; i <= samples; i++) {
        const { beatIndex } = momentAt(timeline, segment.start + ((segment.end - segment.start) * i) / samples - (i === samples ? 0.001 : 0));
        if (beatIndex === null) continue;
        expect(beatIndex).toBeGreaterThanOrEqual(previous);
        previous = beatIndex;
      }
      expect(segment.station.beats[0].star).toBe(star);
      expect(previous).toBeGreaterThan(0);
    });
  }
});
