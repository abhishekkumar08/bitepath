import { BEAT_FACTORIES } from '@/scene/beats/registry';
import type { BeatContextBase, BeatEffect, BeatFailure, BeatFailurePhase, BeatPlayer } from '@/scene/beats/types';
import type { CameraGoal, Moment } from '@/scene/types';

export const MAX_RECORDED_FAILURES = 20;

const SLOT_FAILING: ReadonlySet<BeatFailurePhase> = new Set<BeatFailurePhase>(['create', 'enter', 'update', 'camera']);

export const describeFailure = (failure: BeatFailure): string =>
  `beat ${failure.beatIndex} ${failure.phase}: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`;

interface Slot {
  index: number;
  effect: BeatEffect | null;
  entered: boolean;
  failed: boolean;
}

export function createBeatPlayer(base: BeatContextBase): BeatPlayer {
  const cache = new Map<number, Slot>();
  const failed = new Set<number>();
  const failures: BeatFailure[] = [];
  let firstError: BeatFailure | null = null;
  let lastError: BeatFailure | null = null;
  let activeIndex: number | null = null;
  let active: Slot | null = null;

  function record(slot: Slot, phase: BeatFailurePhase, error: unknown): void {
    const failure: BeatFailure = { beatIndex: slot.index, phase, error };
    firstError ??= failure;
    lastError = failure;
    if (failures.length < MAX_RECORDED_FAILURES) failures.push(failure);
    if (SLOT_FAILING.has(phase)) {
      slot.failed = true;
      failed.add(slot.index);
    }
  }

  function attempt<T>(slot: Slot, phase: BeatFailurePhase, run: () => T): T | undefined {
    try {
      return run();
    } catch (error) {
      record(slot, phase, error);
      return undefined;
    }
  }

  function instance(index: number): Slot {
    const cached = cache.get(index);
    if (cached !== undefined) return cached;
    const beat = base.station.beats[index];
    const factory = beat.effect === null ? undefined : BEAT_FACTORIES[beat.effect];
    const created: Slot = { index, effect: null, entered: false, failed: false };
    if (factory) created.effect = attempt(created, 'create', () => factory({ ...base, beat, beatIndex: index })) ?? null;
    cache.set(index, created);
    return created;
  }

  function exitSlot(slot: Slot): void {
    if (!slot.entered) return;
    slot.entered = false;
    const { effect } = slot;
    if (effect) attempt(slot, 'exit', () => effect.exit());
  }

  function leave(): void {
    if (active) exitSlot(active);
    active = null;
    activeIndex = null;
  }

  function drive(slot: Slot, progress: number, dt: number): CameraGoal | null {
    const { effect } = slot;
    if (!effect || slot.failed) return null;
    try {
      effect.update(progress, dt);
    } catch (error) {
      record(slot, 'update', error);
      exitSlot(slot);
      return null;
    }
    try {
      return effect.camera?.(progress) ?? null;
    } catch (error) {
      record(slot, 'camera', error);
      exitSlot(slot);
      return null;
    }
  }

  return {
    update(moment: Moment, dt: number): CameraGoal | null {
      const { beatIndex } = moment;
      if (beatIndex === null) {
        if (moment.phase !== 'dwell') leave();
        return active ? drive(active, 1, dt) : null;
      }
      if (beatIndex !== activeIndex) {
        leave();
        activeIndex = beatIndex;
        active = instance(beatIndex);
        const { effect } = active;
        if (effect && !active.failed) {
          active.entered = true;
          const slot = active;
          attempt(slot, 'enter', () => effect.enter());
        }
      }
      return active ? drive(active, moment.beatProgress, dt) : null;
    },
    dispose() {
      for (const slot of cache.values()) {
        exitSlot(slot);
        const { effect } = slot;
        if (effect) attempt(slot, 'dispose', () => effect.dispose());
      }
      cache.clear();
      active = null;
      activeIndex = null;
    },
    get firstError() {
      return firstError;
    },
    get lastError() {
      return lastError;
    },
    get failures() {
      return failures;
    },
    get failed() {
      return failed;
    },
  };
}
