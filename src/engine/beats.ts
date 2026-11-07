import { RULES } from '@/engine/rules';
import type { Beat, EffectId, StarId } from '@/engine/types';

export const BEAT_SECONDS = 5;
export const CHEW_SECONDS = 8;
export const LENS_BEAT_SECONDS = 7;
export const FLAGSHIP_SECONDS = 9;

export const LENS_EFFECTS: ReadonlySet<EffectId> = new Set<EffectId>([
  'amylase', 'pepsin', 'seep', 'chop-carbs', 'chop-protein', 'emulsify', 'villi',
  'absorb-fast', 'absorb-partial', 'ferment', 'idle-bacteria',
]);

export const STAR_BEATS: Record<StarId, string[]> = {
  alcohol: ['stomach-alcohol-female', 'stomach-alcohol-male'],
  iron: ['si-iron'],
  sugar: ['liver-portal'],
  fat: ['blood-fat-lymph'],
  caffeine: ['blood-caffeine'],
  fibre: ['colon-fibre'],
};

const EFFECTS = new Map(RULES.map((r) => [r.id, r.effect]));

function secondsFor(effect: EffectId | null): number {
  if (effect === null) return 0;
  if (effect === 'villi') return FLAGSHIP_SECONDS;
  if (effect === 'chew') return CHEW_SECONDS;
  if (effect === 'idle-bacteria') return BEAT_SECONDS;
  return LENS_EFFECTS.has(effect) ? LENS_BEAT_SECONDS : BEAT_SECONDS;
}

export function beatsFor(ruleIds: string[], stars: StarId[]): Beat[] {
  const beats = ruleIds.map((ruleId): Beat => {
    const effect = EFFECTS.get(ruleId);
    if (effect === undefined) throw new Error(`Unknown rule: ${ruleId}`);
    return { ruleId, effect, seconds: secondsFor(effect), star: stars.find((s) => STAR_BEATS[s].includes(ruleId)) ?? null };
  });
  const animated = beats.filter((b) => b.effect !== null);
  const starred = animated
    .filter((b) => b.star !== null)
    .sort((a, b) => stars.indexOf(a.star as StarId) - stars.indexOf(b.star as StarId));
  return [...starred, ...animated.filter((b) => b.star === null), ...beats.filter((b) => b.effect === null)];
}
