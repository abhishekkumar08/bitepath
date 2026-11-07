import { beatsFor } from '@/engine/beats';
import { captionsFor } from '@/engine/rules';
import { STAR_TRIGGERS } from '@/engine/stars';
import { MIN_STREAM_AMOUNT, NUTRIENTS, sumPortions } from '@/engine/totals';
import type { Catalogue, Journey, Nutrient, Nutrients, Portion, Sex, Station, StationId } from '@/engine/types';

export const STATION_ORDER: StationId[] = ['mouth', 'oesophagus', 'stomach', 'smallIntestine', 'liver', 'bloodstream', 'largeIntestine'];

const UPPER_GUT: StationId[] = ['mouth', 'oesophagus', 'stomach', 'smallIntestine'];

export const ROUTES: Record<Nutrient, StationId[]> = {
  sugar: [...UPPER_GUT, 'liver'],
  starch: [...UPPER_GUT, 'liver'],
  protein: [...UPPER_GUT, 'liver'],
  iron: [...UPPER_GUT, 'liver'],
  alcohol: [...UPPER_GUT, 'liver', 'bloodstream'],
  caffeine: [...UPPER_GUT, 'liver', 'bloodstream'],
  fat: [...UPPER_GUT, 'bloodstream'],
  fibre: [...UPPER_GUT, 'largeIntestine'],
};

const BASE_DWELL: Record<StationId, number> = {
  mouth: 4,
  oesophagus: 3,
  stomach: 5,
  smallIntestine: 7,
  liver: 5,
  bloodstream: 5,
  largeIntestine: 5,
};
const SECONDS_PER_EXTRA_CAPTION = 1;
const STAR_HOLD_SECONDS = 2;
const MAX_STAR_HOLD_SECONDS = 5;

function foodBonus(id: StationId, t: Nutrients): number {
  if (id === 'stomach') return Math.min(8, t.fat * 0.4 + t.protein * 0.1);
  if (id === 'smallIntestine') return Math.min(5, (t.sugar + t.starch + t.protein) / 15);
  if (id === 'largeIntestine') return Math.min(5, t.fibre * 0.8);
  return 0;
}

function dwell(id: StationId, captionCount: number, totals: Nutrients, beatSeconds: number, starOnly: boolean): number {
  if (starOnly) return Math.round(Math.min(STAR_HOLD_SECONDS + foodBonus(id, totals), MAX_STAR_HOLD_SECONDS) * 10) / 10;
  const floor = Math.max(BASE_DWELL[id] + SECONDS_PER_EXTRA_CAPTION * Math.max(0, captionCount - 1), beatSeconds);
  const seconds = floor + foodBonus(id, totals);
  return Math.round(seconds * 10) / 10;
}

export function buildJourney(catalogue: Catalogue, sex: Sex, portions: Portion[]): Journey {
  if (portions.length === 0) throw new Error('Nothing to digest: add at least one food');
  const totals = sumPortions(catalogue, portions);
  const stations: Station[] = [];
  for (const id of STATION_ORDER) {
    const captions = captionsFor(id, { sex, totals });
    if (captions.length === 0) continue;
    const stars = STAR_TRIGGERS.filter((t) => t.station === id && t.when(totals)).map((t) => t.star);
    const beats = beatsFor(captions.map((c) => c.ruleId), stars);
    const beatSeconds = beats.reduce((sum, b) => sum + (b.star === null ? b.seconds : 0), 0);
    stations.push({
      id,
      captions,
      streams: NUTRIENTS.filter((n) => totals[n] >= MIN_STREAM_AMOUNT && ROUTES[n].includes(id)).map((n) => ({ nutrient: n, amount: totals[n] })),
      stars,
      beats,
      dwellSeconds: dwell(id, captions.length, totals, beatSeconds, beatSeconds === 0 && stars.length > 0),
    });
  }
  return { sex, totals, stations };
}
