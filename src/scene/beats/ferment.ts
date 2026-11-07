import { lensBeat } from '@/scene/beats/lensBeat';
import type { BeatFactory } from '@/scene/beats/types';
import { createBacteriaScene } from '@/scene/lens/bacteria';

export const fermentBeat: BeatFactory = (ctx) =>
  lensBeat(ctx, { organ: 'colon', build: () => createBacteriaScene({ fibre: true }), options: { sped: true }, frame: ctx.beat.star !== null });

export const idleBacteriaBeat: BeatFactory = (ctx) =>
  lensBeat(ctx, { organ: 'colon', build: () => createBacteriaScene({ fibre: false }), options: { sped: false } });
