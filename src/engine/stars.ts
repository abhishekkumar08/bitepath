import { MIN_STREAM_AMOUNT } from '@/engine/totals';
import type { StarTrigger } from '@/engine/types';

export const STAR_TRIGGERS: StarTrigger[] = [
  { star: 'alcohol', station: 'stomach', when: (t) => t.alcohol >= MIN_STREAM_AMOUNT },
  { star: 'iron', station: 'smallIntestine', when: (t) => t.iron >= 3 },
  { star: 'sugar', station: 'liver', when: (t) => t.sugar >= 20 && t.fibre < 2 },
  { star: 'fat', station: 'bloodstream', when: (t) => t.fat >= 15 },
  { star: 'caffeine', station: 'bloodstream', when: (t) => t.caffeine >= 30 },
  { star: 'fibre', station: 'largeIntestine', when: (t) => t.fibre >= 6 },
];
