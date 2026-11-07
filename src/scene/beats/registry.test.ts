import { describe, expect, it } from 'vitest';
import { RULES } from '@/engine/rules';
import type { EffectId } from '@/engine/types';
import { BEAT_FACTORIES } from '@/scene/beats/registry';

const EFFECT_IDS: Record<EffectId, true> = {
  chew: true, amylase: true, peristalsis: true, pepsin: true, drain: true, drain4h: true, seep: true,
  'chop-carbs': true, 'chop-protein': true, emulsify: true, villi: true, 'absorb-fast': true, 'absorb-partial': true,
  portal: true, lymph: true, circulate: true, ferment: true, 'idle-bacteria': true,
};
const ALL_EFFECTS = Object.keys(EFFECT_IDS) as EffectId[];

describe('BEAT_FACTORIES', () => {
  const used = [...new Set(RULES.flatMap((rule) => (rule.effect === null ? [] : [rule.effect])))];

  it('has a factory for every animated effect a rule uses', () => {
    const missing = used.filter((effect) => typeof BEAT_FACTORIES[effect] !== 'function');
    expect(missing).toEqual([]);
  });

  it('has a factory for every effect id, so a new one cannot be forgotten', () => {
    const missing = ALL_EFFECTS.filter((effect) => typeof BEAT_FACTORIES[effect] !== 'function');
    expect(missing).toEqual([]);
    expect(Object.keys(BEAT_FACTORIES).sort()).toEqual([...ALL_EFFECTS].sort());
  });

  it('covers the effects the rules actually use', () => {
    expect(used.length).toBeGreaterThan(0);
    for (const effect of used) expect(ALL_EFFECTS).toContain(effect);
  });
});
