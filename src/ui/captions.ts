import type { CaptionSlot } from '@/ui/types';

export function captionBeatIndexes(
  captions: { ruleId: string }[],
  beats: { ruleId: string; effect: string | null }[],
): (number | null)[] {
  return captions.map((c) => {
    const index = beats.findIndex((b) => b.ruleId === c.ruleId);
    return index >= 0 && beats[index].effect !== null ? index : null;
  });
}

export function revealedCaptions(beatIndex: number | null, done: boolean, captions: CaptionSlot[]): boolean[] {
  const animated = captions.flatMap((c) => (c.beatIndex === null ? [] : [c.beatIndex]));
  if (done || animated.length === 0) return captions.map(() => true);
  if (beatIndex === null) return captions.map(() => false);
  const last = Math.max(...animated);
  return captions.map((c) => (c.beatIndex === null ? beatIndex >= last : c.beatIndex <= beatIndex));
}
