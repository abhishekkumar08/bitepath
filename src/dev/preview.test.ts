import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import dishList from '@/data/dishes.json';
import { defaultPlate, parsePreviewQuery, resolvePlate } from '@/dev/preview';
import { buildJourney } from '@/engine/journey';
import { RULES } from '@/engine/rules';
import type { Catalogue, Dish, Food, Sex } from '@/engine/types';

const foods = JSON.parse(readFileSync('public/data/foods.json', 'utf8')) as Food[];
const catalogue: Catalogue = {
  foods: Object.fromEntries(foods.map((f) => [f.id, f])),
  dishes: Object.fromEntries((dishList as Dish[]).map((d) => [d.id, d])),
};

describe('parsePreviewQuery', () => {
  it('defaults when the query is empty', () => {
    expect(parsePreviewQuery('')).toEqual({ beat: null, sex: 'female', plate: [], at: 0.5, lens: null, foods: false, model: null, angle: 0 });
  });

  it('reads every field', () => {
    expect(parsePreviewQuery('?beat=si-villi&sex=male&plate=samosa,beer&at=0.25&lens=cube&foods=gallery&model=rice&angle=2')).toEqual({
      beat: 'si-villi',
      sex: 'male',
      plate: ['samosa', 'beer'],
      at: 0.25,
      lens: 'cube',
      foods: true,
      model: 'rice',
      angle: 2,
    });
  });

  it('falls back to female for an unknown sex', () => {
    expect(parsePreviewQuery('?sex=robot').sex).toBe('female');
  });

  it('defaults a missing or unparsable at, and clamps out-of-range values', () => {
    expect(parsePreviewQuery('?at=abc').at).toBe(0.5);
    expect(parsePreviewQuery('?at=').at).toBe(0.5);
    expect(parsePreviewQuery('?at=7').at).toBe(1);
    expect(parsePreviewQuery('?at=-3').at).toBe(0);
  });

  it('splits and trims the plate and drops empty entries', () => {
    expect(parsePreviewQuery('?plate=%20samosa%20,,%20black%20coffee%20,').plate).toEqual(['samosa', 'black coffee']);
  });

  it('reads the lens preview only for cube or emulsify', () => {
    expect(parsePreviewQuery('?lens=cube').lens).toBe('cube');
    expect(parsePreviewQuery('?lens=emulsify').lens).toBe('emulsify');
    expect(parsePreviewQuery('?lens=other').lens).toBeNull();
    expect(parsePreviewQuery('?lens=').lens).toBeNull();
  });

  it('turns the food gallery on only for foods=gallery', () => {
    expect(parsePreviewQuery('?foods=gallery').foods).toBe(true);
    expect(parsePreviewQuery('?foods=other').foods).toBe(false);
    expect(parsePreviewQuery('?foods=').foods).toBe(false);
  });

  it('treats an empty model as none and keeps the angle a whole number from 0 to 2', () => {
    expect(parsePreviewQuery('?model=').model).toBeNull();
    expect(parsePreviewQuery('?angle=1').angle).toBe(1);
    expect(parsePreviewQuery('?angle=1.7').angle).toBe(1);
    expect(parsePreviewQuery('?angle=9').angle).toBe(2);
    expect(parsePreviewQuery('?angle=-1').angle).toBe(0);
    expect(parsePreviewQuery('?angle=abc').angle).toBe(0);
  });

  it('treats an empty beat as none', () => {
    expect(parsePreviewQuery('?beat=').beat).toBeNull();
  });
});

describe('default plates', () => {
  it.each(RULES.map((r) => r.id))('%s shows up on its default plate for at least one sex', (ruleId) => {
    const { portions, unknown } = resolvePlate(catalogue, defaultPlate(ruleId));
    expect(unknown).toEqual([]);
    const shown = (['female', 'male'] as Sex[]).some((sex) =>
      buildJourney(catalogue, sex, portions).stations.some((s) => s.beats.some((b) => b.ruleId === ruleId)),
    );
    expect(shown).toBe(true);
  });

  it('falls back to a name search for plate entries that are not dish ids', () => {
    expect(resolvePlate(catalogue, ['samosa', 'zzzz']).unknown).toEqual(['zzzz']);
    expect(resolvePlate(catalogue, ['black coffee']).portions).toHaveLength(1);
  });
});
