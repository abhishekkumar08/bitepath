import { lensBeat } from '@/scene/beats/lensBeat';
import type { BeatFactory } from '@/scene/beats/types';
import { createChainScene } from '@/scene/lens/chains';
import type { ChainOptions } from '@/scene/lens/types';

const chainBeat = (organ: 'mouth' | 'stomach' | 'smallIntestine', options: ChainOptions): BeatFactory => (ctx) =>
  lensBeat(ctx, { organ, build: () => createChainScene(options) });

export const amylaseBeat = chainBeat('mouth', { kind: 'starch', enzyme: 'amylase', fluid: 'saliva', endBeads: 'pieces' });

export const pepsinBeat = chainBeat('stomach', { kind: 'protein', enzyme: 'pepsin', fluid: 'acid', endBeads: 'pieces' });

export const chopCarbsBeat = chainBeat('smallIntestine', { kind: 'starch', enzyme: 'pancreatic', fluid: 'plain', endBeads: 'glucose' });

export const chopProteinBeat = chainBeat('smallIntestine', { kind: 'protein', enzyme: 'pancreatic', fluid: 'plain', endBeads: 'amino' });
