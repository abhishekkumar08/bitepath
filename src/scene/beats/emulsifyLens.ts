import { lensBeat } from '@/scene/beats/lensBeat';
import type { BeatContext, BeatEffect } from '@/scene/beats/types';
import { createEmulsifyScene } from '@/scene/lens/droplets';
import type { LensOptions } from '@/scene/lens/types';

export const createEmulsifyLensBeat = (ctx: BeatContext, options?: LensOptions): BeatEffect => {
  const fat = ctx.journey.totals.fat;
  return lensBeat(ctx, { organ: 'smallIntestine', build: () => createEmulsifyScene({ fat }), options });
};
