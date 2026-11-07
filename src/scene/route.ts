import { ROUTES } from '@/engine/journey';
import type { Nutrient, StationId } from '@/engine/types';
import type { AnchorId } from '@/models/types';

export const STATION_ANCHORS: Record<StationId, AnchorId[]> = {
  mouth: ['mouth'],
  oesophagus: ['oesophagusTop', 'oesophagusBottom'],
  stomach: ['stomach'],
  smallIntestine: ['duodenum', 'smallIntestine'],
  liver: ['liver'],
  bloodstream: ['heart'],
  largeIntestine: ['colon'],
};

export const gutAnchors: AnchorId[] = ['mouth', 'oesophagusTop', 'oesophagusBottom', 'stomach', 'duodenum', 'smallIntestine', 'colon'];

export const sharedGut: AnchorId[] = gutAnchors.slice(0, gutAnchors.indexOf('smallIntestine') + 1);

export const routeAnchors = (nutrient: Nutrient): AnchorId[] => ROUTES[nutrient].flatMap((s) => STATION_ANCHORS[s]);
