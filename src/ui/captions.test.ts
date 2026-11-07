import { describe, expect, it } from 'vitest';
import { captionBeatIndexes, revealedCaptions } from '@/ui/captions';

const slots = (...indexes: (number | null)[]) => indexes.map((beatIndex) => ({ beatIndex }));

describe('captionBeatIndexes', () => {
  it('maps a caption to the position of its rule in the beat list, text-only beats to null', () => {
    const beats = [
      { ruleId: 'a', effect: 'chew' },
      { ruleId: 'b', effect: 'drain' },
      { ruleId: 'c', effect: null },
    ];
    expect(captionBeatIndexes([{ ruleId: 'a' }, { ruleId: 'b' }, { ruleId: 'c' }], beats)).toEqual([0, 1, null]);
  });

  it('gives null to a caption that has no beat at all', () => {
    expect(captionBeatIndexes([{ ruleId: 'x' }], [])).toEqual([null]);
  });
});

describe('revealedCaptions', () => {
  const station = slots(0, 1, 2, null, null);

  it('reveals nothing before the first beat of a station that has animated beats', () => {
    expect(revealedCaptions(null, false, station)).toEqual([false, false, false, false, false]);
  });

  it('reveals every caption up to the active beat', () => {
    expect(revealedCaptions(0, false, station)).toEqual([true, false, false, false, false]);
    expect(revealedCaptions(1, false, station)).toEqual([true, true, false, false, false]);
  });

  it('follows a seek that jumps forward', () => {
    expect(revealedCaptions(2, false, station)).toEqual([true, true, true, true, true]);
  });

  it('reveals the text-only captions together with the last animated beat', () => {
    expect(revealedCaptions(1, false, slots(0, 1, null))).toEqual([true, true, true]);
    expect(revealedCaptions(0, false, slots(0, 1, null))).toEqual([true, false, false]);
  });

  it('reveals everything once the station is done', () => {
    expect(revealedCaptions(null, true, station)).toEqual([true, true, true, true, true]);
    expect(revealedCaptions(0, true, station)).toEqual([true, true, true, true, true]);
  });

  it('handles a station with a single star-window beat', () => {
    expect(revealedCaptions(null, false, slots(0, null))).toEqual([false, false]);
    expect(revealedCaptions(0, false, slots(0, null))).toEqual([true, true]);
  });

  it('shows everything at once when no caption has an animated beat', () => {
    expect(revealedCaptions(null, false, slots(null, null))).toEqual([true, true]);
  });

  it('reveals in beat order when a star-window beat comes first', () => {
    const withStar = slots(0, 1, 2, null);
    expect(revealedCaptions(0, false, withStar)).toEqual([true, false, false, false]);
    expect(revealedCaptions(1, false, withStar)).toEqual([true, true, false, false]);
    expect(revealedCaptions(2, false, withStar)).toEqual([true, true, true, true]);
  });

  it('returns an empty list for no captions', () => {
    expect(revealedCaptions(0, false, [])).toEqual([]);
  });

  it('is stateless: a lower index hides again, so the caller must ignore null during travel', () => {
    expect(revealedCaptions(2, false, station)[2]).toBe(true);
    expect(revealedCaptions(0, false, station)[2]).toBe(false);
  });
});
