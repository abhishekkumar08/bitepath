import { alcoholBeads } from '@/scene/beats/beadCounts';
import { lensBeat } from '@/scene/beats/lensBeat';
import type { BeatFactory } from '@/scene/beats/types';
import { createLiningScene } from '@/scene/lens/lining';

export const seepBeat: BeatFactory = (ctx) => {
  const options = { beads: alcoholBeads(ctx.journey.totals.alcohol), female: ctx.journey.sex === 'female' };
  return lensBeat(ctx, { organ: 'stomach', build: () => createLiningScene(options), frame: ctx.beat.star !== null });
};
