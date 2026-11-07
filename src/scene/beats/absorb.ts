import { plateBeads } from '@/scene/beats/beadCounts';
import { lensBeat } from '@/scene/beats/lensBeat';
import type { BeatContext, BeatEffect, BeatFactory } from '@/scene/beats/types';
import type { BeadGroup, VilliOptions } from '@/scene/lens/types';
import { createVilliScene } from '@/scene/lens/villi';
import { NUTRIENT_COLOR } from '@/scene/path';

const SINGLE_KIND_BEADS = 24;
const IRON_FRACTION = 0.25;
const CAFFEINE_FRACTION = 0.9;

const villiLens = (ctx: BeatContext, options: VilliOptions, frame = false): BeatEffect =>
  lensBeat(ctx, { organ: 'smallIntestine', build: () => createVilliScene(options), frame });

export const villiBeat: BeatFactory = (ctx) => villiLens(ctx, { beads: plateBeads(ctx.journey.totals), flagship: true });

export const CAFFEINE_BEADS: BeadGroup = { kind: 'caffeine', color: NUTRIENT_COLOR.caffeine, count: SINGLE_KIND_BEADS, fraction: CAFFEINE_FRACTION };
export const IRON_BEADS: BeadGroup = { kind: 'iron', color: NUTRIENT_COLOR.iron, count: SINGLE_KIND_BEADS, fraction: IRON_FRACTION };

export const absorbFastBeat: BeatFactory = (ctx) => villiLens(ctx, { beads: [CAFFEINE_BEADS], flagship: false });

export const absorbPartialBeat: BeatFactory = (ctx) => villiLens(ctx, { beads: [IRON_BEADS], flagship: false }, ctx.beat.star !== null);
