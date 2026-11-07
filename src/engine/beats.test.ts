import { describe, expect, it } from 'vitest';
import { BEAT_SECONDS, CHEW_SECONDS, FLAGSHIP_SECONDS, LENS_BEAT_SECONDS, LENS_EFFECTS, STAR_BEATS, beatsFor } from '@/engine/beats';
import { RULES } from '@/engine/rules';
import type { EffectId } from '@/engine/types';

const CATALOGUE: Record<string, EffectId | null> = {
  'mouth-bolus': 'chew',
  'mouth-amylase': 'amylase',
  'oesophagus-peristalsis': 'peristalsis',
  'stomach-pepsin': 'pepsin',
  'stomach-emptying-order': 'drain',
  'stomach-four-hours': 'drain4h',
  'stomach-female-emptying': null,
  'stomach-alcohol-female': 'seep',
  'stomach-alcohol-male': 'seep',
  'si-carbs': 'chop-carbs',
  'si-protein': 'chop-protein',
  'si-bile': 'emulsify',
  'si-villi': 'villi',
  'si-caffeine': 'absorb-fast',
  'si-iron': 'absorb-partial',
  'si-iron-female': null,
  'liver-portal': 'portal',
  'blood-fat-lymph': 'lymph',
  'blood-caffeine': 'circulate',
  'blood-alcohol': 'circulate',
  'blood-alcohol-female': null,
  'colon-fibre': 'ferment',
  'colon-no-fibre': 'idle-bacteria',
  'colon-female-transit': null,
};

describe('rule effects', () => {
  it('gives every rule an effect field matching the catalogue', () => {
    for (const rule of RULES) {
      expect('effect' in rule, `${rule.id} has an effect field`).toBe(true);
      expect(rule.effect, rule.id).toBe(CATALOGUE[rule.id]);
    }
  });

  it('has no catalogue entry without a rule and no rule without a catalogue entry', () => {
    expect(RULES.map((r) => r.id).sort()).toEqual(Object.keys(CATALOGUE).sort());
  });
});

describe('beatsFor', () => {
  it('keeps caption order for animated beats', () => {
    expect(beatsFor(['mouth-bolus', 'mouth-amylase'], []).map((b) => b.ruleId)).toEqual(['mouth-bolus', 'mouth-amylase']);
  });

  it('puts star-window beats first in star order, then dwell beats, then text-only', () => {
    const rules = ['blood-alcohol', 'blood-caffeine', 'blood-fat-lymph', 'blood-alcohol-female'];
    const beats = beatsFor(rules, ['fat', 'caffeine']);
    expect(beats.map((b) => b.ruleId)).toEqual(['blood-fat-lymph', 'blood-caffeine', 'blood-alcohol', 'blood-alcohol-female']);
    expect(beats.map((b) => b.star)).toEqual(['fat', 'caffeine', null, null]);
    expect(beatsFor(rules, ['caffeine', 'fat']).slice(0, 2).map((b) => b.ruleId)).toEqual(['blood-caffeine', 'blood-fat-lymph']);
  });

  it('keeps rule order within one star', () => {
    const ids = ['stomach-alcohol-male', 'stomach-alcohol-female'];
    expect(beatsFor(ids, ['alcohol']).map((b) => b.ruleId)).toEqual(ids);
  });

  it('moves text-only beats last, with zero seconds and no effect', () => {
    const beats = beatsFor(['stomach-pepsin', 'stomach-female-emptying', 'stomach-four-hours'], []);
    expect(beats.map((b) => b.ruleId)).toEqual(['stomach-pepsin', 'stomach-four-hours', 'stomach-female-emptying']);
    expect(beats.at(-1)).toEqual({ ruleId: 'stomach-female-emptying', effect: null, seconds: 0, star: null });
  });

  it('sets seconds by scale: body 5, lens 7, villi 9, intake and chew 8, idle bacteria body length', () => {
    const seconds = (id: string) => beatsFor([id], [])[0].seconds;
    expect(seconds('mouth-bolus')).toBe(CHEW_SECONDS);
    expect(CHEW_SECONDS).toBe(8);
    expect(seconds('oesophagus-peristalsis')).toBe(BEAT_SECONDS);
    expect(seconds('stomach-emptying-order')).toBe(BEAT_SECONDS);
    expect(seconds('mouth-amylase')).toBe(LENS_BEAT_SECONDS);
    expect(seconds('colon-fibre')).toBe(LENS_BEAT_SECONDS);
    expect(seconds('si-villi')).toBe(FLAGSHIP_SECONDS);
    expect(BEAT_SECONDS).toBe(5);
    expect(LENS_BEAT_SECONDS).toBe(7);
    expect(seconds('colon-no-fibre')).toBe(BEAT_SECONDS);
    expect(FLAGSHIP_SECONDS).toBe(9);
  });

  it('marks exactly the lens effects as lens scale', () => {
    for (const rule of RULES) {
      if (!rule.effect || rule.effect === 'villi' || rule.effect === 'chew' || rule.effect === 'idle-bacteria') continue;
      const expected = LENS_EFFECTS.has(rule.effect) ? LENS_BEAT_SECONDS : BEAT_SECONDS;
      expect(beatsFor([rule.id], [])[0].seconds, rule.id).toBe(expected);
    }
  });

  it('assigns the star window for female and male alcohol, iron, sugar, fat, caffeine and fibre', () => {
    expect(beatsFor(['stomach-alcohol-female'], ['alcohol'])[0].star).toBe('alcohol');
    expect(beatsFor(['stomach-alcohol-male'], ['alcohol'])[0].star).toBe('alcohol');
    expect(beatsFor(['si-iron'], ['iron'])[0].star).toBe('iron');
    expect(beatsFor(['liver-portal'], ['sugar'])[0].star).toBe('sugar');
    expect(beatsFor(['blood-fat-lymph'], ['fat'])[0].star).toBe('fat');
    expect(beatsFor(['blood-caffeine'], ['caffeine'])[0].star).toBe('caffeine');
    expect(beatsFor(['colon-fibre'], ['fibre'])[0].star).toBe('fibre');
  });

  it('plays in the dwell when the star is absent or belongs to another beat', () => {
    expect(beatsFor(['stomach-alcohol-female'], [])[0].star).toBeNull();
    expect(beatsFor(['si-iron'], ['sugar'])[0].star).toBeNull();
    expect(beatsFor(['blood-alcohol'], ['caffeine'])[0].star).toBeNull();
    expect(beatsFor(['blood-caffeine', 'blood-alcohol'], ['caffeine']).map((b) => b.star)).toEqual(['caffeine', null]);
  });

  it('lists the star beats exactly as the catalogue does', () => {
    expect(STAR_BEATS).toEqual({
      alcohol: ['stomach-alcohol-female', 'stomach-alcohol-male'],
      iron: ['si-iron'],
      sugar: ['liver-portal'],
      fat: ['blood-fat-lymph'],
      caffeine: ['blood-caffeine'],
      fibre: ['colon-fibre'],
    });
  });

  it('fails loudly on an unknown rule id', () => {
    expect(() => beatsFor(['nope'], [])).toThrow('Unknown rule: nope');
  });
});
