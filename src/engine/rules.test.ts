import { describe, expect, it } from 'vitest';
import { RULES, captionsFor } from '@/engine/rules';
import { SOURCES } from '@/engine/sources';
import { emptyNutrients } from '@/engine/totals';
import type { Nutrients, RuleContext, Sex } from '@/engine/types';

const ctx = (sex: Sex, totals: Partial<Nutrients>): RuleContext => ({ sex, totals: { ...emptyNutrients(), ...totals } });

describe('rules', () => {
  it('cites a known source for every rule', () => {
    for (const rule of RULES) {
      expect(rule.sourceIds.length, rule.id).toBeGreaterThan(0);
      for (const id of rule.sourceIds) expect(SOURCES[id], `${rule.id} cites ${id}`).toBeDefined();
    }
  });

  it('has unique rule ids', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it('gives every source an https url and matching id', () => {
    for (const [key, source] of Object.entries(SOURCES)) {
      expect(source.id).toBe(key);
      expect(source.url).toMatch(/^https:\/\//);
    }
  });

  it('only sends alcohol to the liver when there is enough to animate', () => {
    const portal = (alcohol: number): boolean => captionsFor('liver', ctx('female', { alcohol })).some((c) => c.ruleId === 'liver-portal');
    expect(portal(0.4)).toBe(false);
    expect(portal(12.9)).toBe(true);
  });

  it('explains alcohol differently by sex', () => {
    const female = captionsFor('stomach', ctx('female', { alcohol: 13 })).map((c) => c.ruleId);
    const male = captionsFor('stomach', ctx('male', { alcohol: 13 })).map((c) => c.ruleId);
    expect(female).toContain('stomach-alcohol-female');
    expect(female).not.toContain('stomach-alcohol-male');
    expect(male).toContain('stomach-alcohol-male');
  });

  it('mentions the fat amount when the food is fatty', () => {
    const caption = captionsFor('stomach', ctx('male', { fat: 22.4 })).find((c) => c.ruleId === 'stomach-emptying-order');
    expect(caption?.text).toContain('22 g');
  });

  it('skips the emptying-order caption for a drink like coffee', () => {
    const ids = captionsFor('stomach', ctx('male', { caffeine: 80, protein: 0.2 })).map((c) => c.ruleId);
    expect(ids).not.toContain('stomach-emptying-order');
    expect(ids).toContain('stomach-four-hours');
  });

  it('keeps the emptying-order branches for solid foods', () => {
    const fat = captionsFor('stomach', ctx('male', { fat: 20 })).find((c) => c.ruleId === 'stomach-emptying-order');
    expect(fat?.text).toContain('fat');
    const carb = captionsFor('stomach', ctx('male', { starch: 30 })).find((c) => c.ruleId === 'stomach-emptying-order');
    expect(carb?.text).toContain('Carbohydrate-heavy');
  });

  it('only talks about starch in the small intestine when there is starch', () => {
    expect(captionsFor('smallIntestine', ctx('male', { sugar: 10 })).map((c) => c.ruleId)).not.toContain('si-carbs');
    expect(captionsFor('smallIntestine', ctx('male', { starch: 10 })).map((c) => c.ruleId)).toContain('si-carbs');
  });

  it('describes the bolus in drink-neutral words', () => {
    const text = RULES.find((r) => r.id === 'mouth-bolus')?.text(ctx('male', {}));
    expect(text).toBe('Your tongue and saliva shape what you take in into a soft mass called a bolus, ready to swallow.');
  });

  it('adds the female transit facts only for the female body', () => {
    expect(captionsFor('largeIntestine', ctx('female', {})).map((c) => c.ruleId)).toContain('colon-female-transit');
    expect(captionsFor('largeIntestine', ctx('male', {})).map((c) => c.ruleId)).not.toContain('colon-female-transit');
  });

  it('never renders NaN or undefined', () => {
    const extremes = [
      ctx('male', {}),
      ctx('female', { sugar: 50, starch: 80, protein: 40, fat: 30, fibre: 12, alcohol: 20, caffeine: 200, iron: 9 }),
    ];
    for (const c of extremes) for (const rule of RULES) if (rule.when(c)) expect(rule.text(c)).not.toMatch(/NaN|undefined/);
  });
});
