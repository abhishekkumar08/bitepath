import { MIN_STREAM_AMOUNT } from '@/engine/totals';
import type { Nutrient, Nutrients, StationId } from '@/engine/types';
import type { AnchorId } from '@/models/types';
import { STATION_ANCHORS } from '@/scene/route';
import type { RouteArgs } from '@/scene/types';

const SWELL: Record<AnchorId, number> = {
  mouth: 0.6,
  oesophagusTop: 0.5,
  oesophagusBottom: 0.5,
  stomach: 1.8,
  duodenum: 1.2,
  smallIntestine: 1.5,
  liver: 1.0,
  heart: 1.0,
  colon: 1.0,
  brain: 1.0,
};

const GRAM_NUTRIENTS: Nutrient[] = ['sugar', 'starch', 'protein', 'fat', 'fibre', 'alcohol'];
const MG_NUTRIENTS: Nutrient[] = ['caffeine', 'iron'];
const MIN_MASS = 36;
const MAX_MASS = 150;
const MIN_PER_NUTRIENT = 3;
const FLECKS = 4;

const smooth = (u: number): number => u * u * (3 - 2 * u);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function stationSpan(a: RouteArgs, station: StationId): [number, number] | null {
  const own = STATION_ANCHORS[station];
  const first = a.routeAnchors.indexOf(own[0]);
  if (first < 0) return null;
  return [first, a.routeAnchors.indexOf(own[own.length - 1])];
}

function restIndex(a: RouteArgs): number {
  for (let i = a.index - 1; i >= 0; i -= 1) {
    const span = stationSpan(a, a.journeyStations[i]);
    if (span) return span[1];
  }
  return 0;
}

export function routeParam(a: RouteArgs, advanceOverride?: number | null): number {
  const steps = Math.max(1, a.routeAnchors.length - 1);
  const span = stationSpan(a, a.journeyStations[a.index]);
  const rest = restIndex(a);
  if (!span) return rest / steps;
  const u = a.phase === 'travel' ? lerp(rest, span[0], smooth(a.progress)) : lerp(span[0], span[1], smooth(advanceOverride ?? a.stationProgress));
  return clamp(u / steps, 0, 1);
}

export function swellAt(routeAnchors: AnchorId[], u: number): number {
  const at = clamp(u, 0, 1) * (routeAnchors.length - 1);
  const i = Math.min(Math.floor(at), routeAnchors.length - 2);
  if (i < 0) return SWELL[routeAnchors[0]];
  return lerp(SWELL[routeAnchors[i]], SWELL[routeAnchors[i + 1]], at - i);
}

export function massParticles(totals: Nutrients): Partial<Record<Nutrient, number>> {
  const present = (list: Nutrient[]): Nutrient[] => list.filter((n) => totals[n] >= MIN_STREAM_AMOUNT);
  const grams = present(GRAM_NUTRIENTS);
  const milligrams = present(MG_NUTRIENTS);
  const mass: Partial<Record<Nutrient, number>> = {};
  if (grams.length === 0) {
    for (const n of milligrams) mass[n] = MIN_MASS / milligrams.length;
    return mass;
  }
  const sum = grams.reduce((total, n) => total + totals[n], 0);
  const budget = clamp(Math.round(24 + 14 * Math.sqrt(sum)), MIN_MASS, MAX_MASS);
  for (const n of grams) mass[n] = Math.max(MIN_PER_NUTRIENT, Math.round((budget * totals[n]) / sum));
  for (const n of milligrams) mass[n] = FLECKS;
  return mass;
}
