import { MIN_STREAM_AMOUNT } from '@/engine/totals';
import type { Caption, Nutrients, Rule, RuleContext, StationId } from '@/engine/types';

const grams = (value: number): string => `${Math.round(value)} g`;
const hasWaterSoluble = (t: Nutrients): boolean =>
  t.sugar + t.starch + t.protein >= MIN_STREAM_AMOUNT ||
  t.alcohol >= MIN_STREAM_AMOUNT ||
  t.caffeine >= MIN_STREAM_AMOUNT ||
  t.iron >= MIN_STREAM_AMOUNT;

export const RULES: Rule[] = [
  {
    id: 'mouth-bolus',
    station: 'mouth',
    when: () => true,
    text: () => 'Your tongue and saliva shape what you take in into a soft mass called a bolus, ready to swallow.',
    sourceIds: ['openstax-23-3'],
    effect: 'chew',
  },
  {
    id: 'mouth-amylase',
    station: 'mouth',
    when: ({ totals }) => totals.starch >= 1,
    text: ({ totals }) => `Saliva contains amylase, an enzyme that starts breaking down the ${grams(totals.starch)} of starch while you chew.`,
    sourceIds: ['openstax-23-3'],
    effect: 'amylase',
  },
  {
    id: 'oesophagus-peristalsis',
    station: 'oesophagus',
    when: () => true,
    text: () => 'Rings of muscle squeeze in waves, called peristalsis, pushing the bolus down the oesophagus to the stomach.',
    sourceIds: ['openstax-23-3'],
    effect: 'peristalsis',
  },
  {
    id: 'stomach-pepsin',
    station: 'stomach',
    when: ({ totals }) => totals.protein >= 1,
    text: ({ totals }) => `Stomach acid switches on pepsin, an enzyme that starts cutting up the ${grams(totals.protein)} of protein.`,
    sourceIds: ['openstax-23-4'],
    effect: 'pepsin',
  },
  {
    id: 'stomach-emptying-order',
    station: 'stomach',
    when: ({ totals: t }) => t.fat >= 10 || t.protein >= 10 || t.sugar + t.starch >= 10,
    text: ({ totals }) => {
      if (totals.fat >= 10) return `With ${grams(totals.fat)} of fat, this food will sit in the stomach longer: fatty meals stay the longest.`;
      if (totals.protein >= 10) return 'Protein-rich food leaves the stomach more slowly than carbohydrate-heavy food.';
      return 'Carbohydrate-heavy food leaves the stomach fastest.';
    },
    sourceIds: ['openstax-23-4'],
    effect: 'drain',
  },
  {
    id: 'stomach-four-hours',
    station: 'stomach',
    when: () => true,
    text: () => 'In healthy adults, more than 90% of a meal has normally left the stomach by four hours.',
    sourceIds: ['abell2008'],
    effect: 'drain4h',
  },
  {
    id: 'stomach-female-emptying',
    station: 'stomach',
    when: ({ sex }) => sex === 'female',
    text: () => 'In a study of 215 healthy adults, women’s stomachs emptied about 17 minutes slower than men’s on average.',
    sourceIds: ['wang2015'],
    effect: null,
  },
  {
    id: 'stomach-alcohol-female',
    station: 'stomach',
    when: ({ sex, totals }) => sex === 'female' && totals.alcohol >= MIN_STREAM_AMOUNT,
    text: () =>
      'An enzyme in the stomach lining breaks down some alcohol before it reaches the blood, but in women this “first pass” was only about a quarter of men’s.',
    sourceIds: ['frezza1990'],
    effect: 'seep',
  },
  {
    id: 'stomach-alcohol-male',
    station: 'stomach',
    when: ({ sex, totals }) => sex === 'male' && totals.alcohol >= MIN_STREAM_AMOUNT,
    text: () => 'An enzyme in the stomach lining breaks down some of the alcohol before it ever reaches the blood.',
    sourceIds: ['frezza1990'],
    effect: 'seep',
  },
  {
    id: 'si-carbs',
    station: 'smallIntestine',
    when: ({ totals }) => totals.starch >= 1,
    text: () => 'Pancreatic amylase does the heavy lifting on starch here, and enzymes on the intestinal wall finish the job, freeing glucose.',
    sourceIds: ['openstax-23-7'],
    effect: 'chop-carbs',
  },
  {
    id: 'si-protein',
    station: 'smallIntestine',
    when: ({ totals }) => totals.protein >= 1,
    text: () => 'Enzymes from the pancreas keep cutting protein down into amino acids.',
    sourceIds: ['openstax-23-7'],
    effect: 'chop-protein',
  },
  {
    id: 'si-bile',
    station: 'smallIntestine',
    when: ({ totals }) => totals.fat >= 1,
    text: ({ totals }) => `Bile from the liver breaks the ${grams(totals.fat)} of fat into small droplets so enzymes can digest it, a step called emulsification.`,
    sourceIds: ['openstax-23-6'],
    effect: 'emulsify',
  },
  {
    id: 'si-villi',
    station: 'smallIntestine',
    when: () => true,
    text: () => 'Tiny finger-like villi line the wall and absorb the digested nutrients.',
    sourceIds: ['openstax-23-7'],
    effect: 'villi',
  },
  {
    id: 'si-caffeine',
    station: 'smallIntestine',
    when: ({ totals }) => totals.caffeine >= 1,
    text: ({ totals }) => `The ${Math.round(totals.caffeine)} mg of caffeine is absorbed quickly and almost completely.`,
    sourceIds: ['fredholm1999'],
    effect: 'absorb-fast',
  },
  {
    id: 'si-iron',
    station: 'smallIntestine',
    when: ({ totals }) => totals.iron >= 1,
    text: () => 'Only part of the iron in food is absorbed, and how much depends on the food and on how much iron your body already stores.',
    sourceIds: ['hurrell2010'],
    effect: 'absorb-partial',
  },
  {
    id: 'si-iron-female',
    station: 'smallIntestine',
    when: ({ sex, totals }) => sex === 'female' && totals.iron >= 1,
    text: () => 'Women of child-bearing age need more iron than men, mainly to replace iron lost in menstrual blood.',
    sourceIds: ['hurrell2010'],
    effect: null,
  },
  {
    id: 'liver-portal',
    station: 'liver',
    when: ({ totals }) => hasWaterSoluble(totals),
    text: () => 'Water-soluble nutrients, like sugars and amino acids, travel from the intestine to the liver first, through the hepatic portal vein.',
    sourceIds: ['openstax-23-7'],
    effect: 'portal',
  },
  {
    id: 'blood-fat-lymph',
    station: 'bloodstream',
    when: ({ totals }) => totals.fat >= 1,
    text: () =>
      'Fat takes a different road: it is packed into particles called chylomicrons, enters the lymph, and joins the blood near the heart through the thoracic duct.',
    sourceIds: ['openstax-23-7'],
    effect: 'lymph',
  },
  {
    id: 'blood-caffeine',
    station: 'bloodstream',
    when: ({ totals }) => totals.caffeine >= 1,
    text: () => 'Caffeine reaches the brain and blocks adenosine, a chemical signal that makes you feel sleepy.',
    sourceIds: ['fredholm1999'],
    effect: 'circulate',
  },
  {
    id: 'blood-alcohol',
    station: 'bloodstream',
    when: ({ totals }) => totals.alcohol >= MIN_STREAM_AMOUNT,
    text: () => 'Alcohol is absorbed into the blood and carried throughout the body.',
    sourceIds: ['frezza1990'],
    effect: 'circulate',
  },
  {
    id: 'blood-alcohol-female',
    station: 'bloodstream',
    when: ({ sex, totals }) => sex === 'female' && totals.alcohol >= MIN_STREAM_AMOUNT,
    text: () => 'After the same drink, women reach higher blood alcohol levels than men, even allowing for body size.',
    sourceIds: ['frezza1990'],
    effect: null,
  },
  {
    id: 'colon-fibre',
    station: 'largeIntestine',
    when: ({ totals }) => totals.fibre >= 1,
    text: ({ totals }) =>
      `Your own enzymes can’t digest the ${grams(totals.fibre)} of fibre. Gut bacteria ferment it into short-chain fatty acids your body can use.`,
    sourceIds: ['denbesten2013'],
    effect: 'ferment',
  },
  {
    id: 'colon-no-fibre',
    station: 'largeIntestine',
    when: ({ totals }) => totals.fibre < 1,
    text: () => 'There is almost no fibre here, so gut bacteria have little to ferment.',
    sourceIds: ['denbesten2013'],
    effect: 'idle-bacteria',
  },
  {
    id: 'colon-female-transit',
    station: 'largeIntestine',
    when: ({ sex }) => sex === 'female',
    text: () => 'In the same 215-person study, food took about 1¾ hours longer to pass through women’s colons than men’s.',
    sourceIds: ['wang2015'],
    effect: null,
  },
];

export function captionsFor(station: StationId, ctx: RuleContext): Caption[] {
  return RULES.filter((rule) => rule.station === station && rule.when(ctx)).map((rule) => ({
    ruleId: rule.id,
    text: rule.text(ctx),
    sourceIds: rule.sourceIds,
  }));
}
