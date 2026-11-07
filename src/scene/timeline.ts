import type { Journey, StarId, Station } from '@/engine/types';
import type { Moment, Segment } from '@/scene/types';

export const TRAVEL_SECONDS = 2;
export const STAR_SECONDS = 5;

function beatStartsFor(station: Station, travelEnd: number, starsEnd: number): number[] {
  const dwellTotal = station.beats.reduce((sum, b) => sum + (b.star === null ? b.seconds : 0), 0);
  const scale = dwellTotal > 0 ? station.dwellSeconds / dwellTotal : 0;
  let cursor = starsEnd;
  const starts = station.beats.map((b) => {
    if (b.effect === null) return starsEnd;
    if (b.star !== null) return travelEnd + STAR_SECONDS * station.stars.indexOf(b.star);
    const at = cursor;
    cursor += b.seconds * scale;
    return at;
  });
  const lastAnimated = Math.max(starsEnd, ...station.beats.flatMap((b, i) => (b.effect === null ? [] : [starts[i]])));
  return starts.map((at, i) => (station.beats[i].effect === null ? lastAnimated : at));
}

export function buildTimeline(journey: Journey): Segment[] {
  let t = 0;
  return journey.stations.map((station) => {
    const start = t;
    const travelEnd = start + TRAVEL_SECONDS;
    const starsEnd = travelEnd + STAR_SECONDS * station.stars.length;
    const end = starsEnd + station.dwellSeconds;
    t = end;
    return { station, start, travelEnd, starsEnd, end, beatStarts: beatStartsFor(station, travelEnd, starsEnd) };
  });
}

export const totalDuration = (timeline: Segment[]): number => timeline.at(-1)?.end ?? 0;

export const playFrom = (timeline: Segment[], t: number): number => (t >= totalDuration(timeline) ? 0 : t);

type BeatFields = Pick<Moment, 'beatIndex' | 'beatProgress' | 'beatEffect'>;

const NO_BEAT: BeatFields = { beatIndex: null, beatProgress: 0, beatEffect: null };

function beatAt(s: Segment, index: number, progress: number): BeatFields {
  return index < 0 ? NO_BEAT : { beatIndex: index, beatProgress: progress, beatEffect: s.station.beats[index].effect };
}

function lastBeat(s: Segment): number {
  const { beats } = s.station;
  let best = -1;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].effect !== null && (best < 0 || s.beatStarts[i] >= s.beatStarts[best])) best = i;
  }
  return best;
}

function starBeatIndex(s: Segment, star: StarId | undefined): number {
  const { beats } = s.station;
  for (let i = 0; i < beats.length; i++) if (beats[i].star === star) return i;
  return -1;
}

function dwellBeatAt(s: Segment, t: number): BeatFields {
  const { beats } = s.station;
  let active = -1;
  let end = s.end;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].star !== null || beats[i].seconds === 0) continue;
    if (s.beatStarts[i] > t) {
      end = s.beatStarts[i];
      break;
    }
    active = i;
  }
  if (active < 0) return NO_BEAT;
  const from = s.beatStarts[active];
  return beatAt(s, active, end > from ? Math.min(Math.max((t - from) / (end - from), 0), 1) : 1);
}

const SEEK_EDGE = 1e-4;

export function beatTime(s: Segment, ruleId: string, progress: number): number | null {
  const { beats } = s.station;
  let b = -1;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].ruleId === ruleId) b = i;
  }
  if (b < 0) return null;
  const p = Math.min(Math.max(progress, 0), 1);
  const from = s.beatStarts[b];
  let end = beats[b].star === null ? s.end : from + STAR_SECONDS;
  for (let i = 0; beats[b].star === null && i < beats.length; i++) {
    if (beats[i].star === null && beats[i].seconds > 0 && s.beatStarts[i] > from) end = Math.min(end, s.beatStarts[i]);
  }
  return Math.min(from + (end - from) * p, end - SEEK_EDGE);
}

export function momentAt(timeline: Segment[], t: number): Moment {
  const last = timeline.length - 1;
  if (t >= totalDuration(timeline)) {
    const tail = last < 0 ? NO_BEAT : beatAt(timeline[last], lastBeat(timeline[last]), 1);
    return { index: Math.max(last, 0), phase: 'dwell', progress: 1, stationProgress: 1, star: null, done: true, ...tail };
  }
  let index = 0;
  while (index < last && t >= timeline[index].end) index++;
  const s = timeline[index];
  if (t < s.travelEnd) return { index, phase: 'travel', progress: (t - s.start) / TRAVEL_SECONDS, stationProgress: 0, star: null, done: false, ...NO_BEAT };
  const stationProgress = Math.min(Math.max((t - s.travelEnd) / (s.end - s.travelEnd), 0), 1);
  if (t < s.starsEnd) {
    const starTime = t - s.travelEnd;
    const which = Math.floor(starTime / STAR_SECONDS);
    const star = s.station.stars[which];
    const progress = (starTime % STAR_SECONDS) / STAR_SECONDS;
    return { index, phase: 'star', progress, stationProgress, star, done: false, ...beatAt(s, starBeatIndex(s, star), progress) };
  }
  return { index, phase: 'dwell', progress: (t - s.starsEnd) / s.station.dwellSeconds, stationProgress, star: null, done: false, ...dwellBeatAt(s, t) };
}
