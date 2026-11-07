import { absorbFastBeat, absorbPartialBeat, villiBeat } from '@/scene/beats/absorb';
import { emulsifyBeat } from '@/scene/beats/bile';
import { chewBeat } from '@/scene/beats/chew';
import { circulateBeat } from '@/scene/beats/circulate';
import { amylaseBeat, chopCarbsBeat, chopProteinBeat, pepsinBeat } from '@/scene/beats/chop';
import { fourHourDrainBeat, stomachDrainBeat } from '@/scene/beats/drain';
import { fermentBeat, idleBacteriaBeat } from '@/scene/beats/ferment';
import { lymphBeat } from '@/scene/beats/lymph';
import { peristalsisBeat } from '@/scene/beats/peristalsis';
import { portalBeat } from '@/scene/beats/portal';
import { seepBeat } from '@/scene/beats/seep';
import type { BeatFactories } from '@/scene/beats/types';

export const BEAT_FACTORIES: BeatFactories = {
  chew: chewBeat,
  peristalsis: peristalsisBeat,
  drain: stomachDrainBeat,
  drain4h: fourHourDrainBeat,
  emulsify: emulsifyBeat,
  villi: villiBeat,
  'absorb-fast': absorbFastBeat,
  'absorb-partial': absorbPartialBeat,
  seep: seepBeat,
  amylase: amylaseBeat,
  pepsin: pepsinBeat,
  'chop-carbs': chopCarbsBeat,
  'chop-protein': chopProteinBeat,
  ferment: fermentBeat,
  'idle-bacteria': idleBacteriaBeat,
  portal: portalBeat,
  lymph: lymphBeat,
  circulate: circulateBeat,
};
