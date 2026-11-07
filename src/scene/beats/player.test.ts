import { describe, expect, it, vi } from 'vitest';
import type { Beat, EffectId, Journey, Station } from '@/engine/types';
import { emptyNutrients } from '@/engine/totals';
import { BEAT_FACTORIES } from '@/scene/beats/registry';
import { MAX_RECORDED_FAILURES, createBeatPlayer, describeFailure } from '@/scene/beats/player';
import type { BeatContext, BeatEffect, BeatFactory } from '@/scene/beats/types';
import type { CameraGoal, Moment, Phase } from '@/scene/types';

const beat = (ruleId: string, effect: EffectId | null): Beat => ({ ruleId, effect, seconds: 5, star: null });
const station: Station = { id: 'mouth', captions: [], streams: [], stars: [], beats: [beat('a', 'chew'), beat('b', 'chew'), beat('c', 'amylase')], dwellSeconds: 10 };
const journey: Journey = { sex: 'female', totals: emptyNutrients(), stations: [station] };

const moment = (beatIndex: number | null, beatProgress = 0, phase: Phase = 'dwell'): Moment => ({
  index: 0,
  phase,
  progress: 0,
  stationProgress: 0,
  star: null,
  done: false,
  beatIndex,
  beatProgress,
  beatEffect: beatIndex === null ? null : station.beats[beatIndex].effect,
});

const goal: CameraGoal = { position: [1, 2, 3], target: [0, 0, 0] };

interface Spy {
  log: string[];
  effects: BeatEffect[];
  factory: BeatFactory;
}

function spyFactory(label: string, log: string[], withCamera = false): Spy {
  const effects: BeatEffect[] = [];
  const factory: BeatFactory = (ctx: BeatContext) => {
    const id = `${label}${ctx.beatIndex}`;
    const effect: BeatEffect = {
      enter: vi.fn(() => log.push(`enter ${id}`)),
      update: vi.fn((p: number, dt: number) => log.push(`update ${id} ${p} ${dt}`)),
      exit: vi.fn(() => log.push(`exit ${id}`)),
      dispose: vi.fn(() => log.push(`dispose ${id}`)),
      ...(withCamera ? { camera: (p: number) => (p > 0.5 ? goal : null) } : {}),
    };
    effects.push(effect);
    return effect;
  };
  return { log, effects, factory };
}

function setup(factories: Partial<Record<EffectId, BeatFactory>>) {
  for (const key of Object.keys(BEAT_FACTORIES) as EffectId[]) delete BEAT_FACTORIES[key];
  Object.assign(BEAT_FACTORIES, factories);
  return createBeatPlayer({ stage: {} as never, body: {} as never, journey, station, streams: {} as never, lens: null, looks: [] });
}

describe('createBeatPlayer', () => {
  it('exits the previous beat before entering the next and updates with progress and dt', () => {
    const log: string[] = [];
    const player = setup({ chew: spyFactory('chew', log).factory, amylase: spyFactory('amy', log).factory });
    player.update(moment(0, 0.25), 0.1);
    player.update(moment(0, 0.5), 0.1);
    player.update(moment(2, 0), 0.1);
    expect(log).toEqual(['enter chew0', 'update chew0 0.25 0.1', 'update chew0 0.5 0.1', 'exit chew0', 'enter amy2', 'update amy2 0 0.1']);
  });

  it('caches per beat index, so two beats with one effect get two instances', () => {
    const chew = spyFactory('chew', []);
    const player = setup({ chew: chew.factory });
    player.update(moment(0), 0);
    player.update(moment(1), 0);
    player.update(moment(0), 0);
    expect(chew.effects).toHaveLength(2);
    expect(chew.effects[0].enter).toHaveBeenCalledTimes(2);
  });

  it('survives a missing factory', () => {
    const player = setup({});
    expect(player.update(moment(0, 0.4), 0.1)).toBeNull();
    expect(player.update(moment(null, 0, 'travel'), 0.1)).toBeNull();
    expect(() => player.dispose()).not.toThrow();
  });

  it('passes the active effect camera goal through, null when it has none', () => {
    const player = setup({ chew: spyFactory('chew', [], true).factory, amylase: spyFactory('amy', []).factory });
    expect(player.update(moment(0, 0.2), 0)).toBeNull();
    expect(player.update(moment(0, 0.8), 0)).toBe(goal);
    expect(player.update(moment(2, 0.8), 0)).toBeNull();
  });

  it('holds the last effect at progress 1 during a dwell with no beat', () => {
    const log: string[] = [];
    const player = setup({ chew: spyFactory('chew', log, true).factory });
    player.update(moment(0, 0.3), 0.1);
    log.length = 0;
    expect(player.update(moment(null, 0, 'dwell'), 0.2)).toBe(goal);
    expect(log).toEqual(['update chew0 1 0.2']);
  });

  it('exits the previous effect when a travel moment has no beat, and does not re-exit', () => {
    const log: string[] = [];
    const player = setup({ chew: spyFactory('chew', log).factory });
    player.update(moment(0, 0.3), 0.1);
    log.length = 0;
    player.update(moment(null, 0, 'travel'), 0.1);
    player.update(moment(null, 0, 'travel'), 0.1);
    expect(log).toEqual(['exit chew0']);
  });

  it('exits then disposes every cached instance on dispose', () => {
    const log: string[] = [];
    const player = setup({ chew: spyFactory('chew', log).factory });
    player.update(moment(0), 0);
    player.update(moment(1), 0);
    log.length = 0;
    player.dispose();
    expect(log).toEqual(['dispose chew0', 'exit chew1', 'dispose chew1']);
  });

  it('calls exit once per enter, even across leave then dispose and repeated dispose', () => {
    const log: string[] = [];
    const player = setup({ chew: spyFactory('chew', log).factory });
    player.update(moment(0), 0);
    player.update(moment(null, 0, 'travel'), 0);
    player.dispose();
    player.dispose();
    expect(log.filter((l) => l.startsWith('exit'))).toEqual(['exit chew0']);
  });

  it('builds the context from the base plus beat and index', () => {
    const seen: BeatContext[] = [];
    const player = setup({ chew: (ctx) => (seen.push(ctx), { enter() {}, update() {}, exit() {}, dispose() {} }) });
    player.update(moment(1), 0);
    expect(seen[0]).toMatchObject({ station, beat: station.beats[1], beatIndex: 1, lens: null });
  });

  describe('when an effect throws', () => {
    const boom = new Error('boom');
    const quiet = (over: Partial<BeatEffect>): BeatEffect => ({ enter() {}, update() {}, exit() {}, dispose() {}, ...over });

    it('contains a throwing factory, records it, and does not retry it every frame', () => {
      const chew = vi.fn((): BeatEffect => {
        throw boom;
      });
      const log: string[] = [];
      const player = setup({ chew, amylase: spyFactory('amy', log).factory });
      expect(player.update(moment(0, 0.2), 0.1)).toBeNull();
      expect(player.update(moment(0, 0.4), 0.1)).toBeNull();
      expect(chew).toHaveBeenCalledTimes(1);
      expect(player.lastError).toEqual({ beatIndex: 0, phase: 'create', error: boom });
      expect(player.failed.has(0)).toBe(true);
      player.update(moment(2, 0.1), 0.1);
      expect(log).toEqual(['enter amy2', 'update amy2 0.1 0.1']);
      expect(player.failed.has(2)).toBe(false);
    });

    it('contains a throwing enter, skips its updates, and still calls exit once to release what it built', () => {
      const exit = vi.fn();
      const update = vi.fn();
      const player = setup({
        chew: () =>
          quiet({
            enter() {
              throw boom;
            },
            update,
            exit,
          }),
        amylase: spyFactory('amy', []).factory,
      });
      expect(() => player.update(moment(0, 0.3), 0.1)).not.toThrow();
      player.update(moment(0, 0.4), 0.1);
      expect(update).not.toHaveBeenCalled();
      expect(player.lastError).toMatchObject({ beatIndex: 0, phase: 'enter', error: boom });
      player.update(moment(2, 0), 0.1);
      expect(exit).toHaveBeenCalledTimes(1);
      player.update(moment(0, 0.3), 0.1);
      expect(update).not.toHaveBeenCalled();
      expect(exit).toHaveBeenCalledTimes(1);
    });

    it('contains a throwing update, stops updating that beat and keeps the rest of the frame running', () => {
      let calls = 0;
      const exit = vi.fn();
      const log: string[] = [];
      const player = setup({
        chew: () =>
          quiet({
            update() {
              calls++;
              throw boom;
            },
            camera: () => goal,
            exit,
          }),
        amylase: spyFactory('amy', log, true).factory,
      });
      expect(player.update(moment(0, 0.3), 0.1)).toBeNull();
      expect(exit).toHaveBeenCalledTimes(1);
      expect(player.update(moment(0, 0.6), 0.1)).toBeNull();
      expect(calls).toBe(1);
      expect(player.lastError).toMatchObject({ beatIndex: 0, phase: 'update', error: boom });
      expect(player.update(moment(2, 0.8), 0.1)).toBe(goal);
      expect(exit).toHaveBeenCalledTimes(1);
      expect(log).toContain('update amy2 0.8 0.1');
    });

    it('contains a throwing camera and leaves the beat straight away', () => {
      const exit = vi.fn();
      const player = setup({
        chew: () =>
          quiet({
            camera() {
              throw boom;
            },
            exit,
          }),
      });
      expect(player.update(moment(0, 0.5), 0)).toBeNull();
      expect(player.lastError).toMatchObject({ phase: 'camera', error: boom });
      expect(exit).toHaveBeenCalledTimes(1);
      player.update(moment(null, 0, 'travel'), 0);
      expect(exit).toHaveBeenCalledTimes(1);
    });

    it('contains a throwing held update during a dwell with no beat', () => {
      let held = 0;
      const exit = vi.fn();
      const player = setup({
        chew: () =>
          quiet({
            update(p) {
              if (p === 1) {
                held++;
                throw boom;
              }
            },
            camera: () => goal,
            exit,
          }),
      });
      expect(player.update(moment(0, 0.4), 0)).toBe(goal);
      expect(player.update(moment(null, 0, 'dwell'), 0.1)).toBeNull();
      expect(player.update(moment(null, 0, 'dwell'), 0.1)).toBeNull();
      expect(held).toBe(1);
      expect(player.lastError).toMatchObject({ beatIndex: 0, phase: 'update', error: boom });
      expect(exit).toHaveBeenCalledTimes(1);
    });

    it('contains throwing exit and dispose, and reports the most recent failure', () => {
      const other = new Error('other');
      const player = setup({
        chew: () =>
          quiet({
            exit() {
              throw boom;
            },
            dispose() {
              throw other;
            },
          }),
      });
      player.update(moment(0, 0.3), 0);
      expect(() => player.update(moment(null, 0, 'travel'), 0)).not.toThrow();
      expect(player.lastError).toMatchObject({ phase: 'exit', error: boom });
      expect(() => player.dispose()).not.toThrow();
      expect(player.lastError).toMatchObject({ phase: 'dispose', error: other });
    });

    it('does not blank a beat for good because its exit threw', () => {
      const enter = vi.fn();
      const player = setup({
        chew: () =>
          quiet({
            enter,
            exit() {
              throw boom;
            },
          }),
      });
      player.update(moment(0, 0.3), 0);
      player.update(moment(1, 0.3), 0);
      expect(player.lastError).toMatchObject({ beatIndex: 0, phase: 'exit' });
      expect(player.failed.has(0)).toBe(false);
      player.update(moment(0, 0.3), 0);
      expect(enter).toHaveBeenCalledTimes(3);
    });

    it('keeps the first and the last error and a capped list of failures', () => {
      const second = new Error('second');
      let n = 0;
      const player = setup({
        chew: () =>
          quiet({
            update() {
              throw n++ === 0 ? boom : second;
            },
          }),
      });
      player.update(moment(0, 0.3), 0);
      player.update(moment(1, 0.3), 0);
      expect(player.firstError).toEqual({ beatIndex: 0, phase: 'update', error: boom });
      expect(player.lastError).toEqual({ beatIndex: 1, phase: 'update', error: second });
      expect(player.failures.map((f) => f.beatIndex)).toEqual([0, 1]);
    });

    it('records at most MAX_RECORDED_FAILURES failures but keeps counting the last', () => {
      const player = setup({
        chew: () =>
          quiet({
            exit() {
              throw boom;
            },
          }),
      });
      for (let i = 0; i < MAX_RECORDED_FAILURES + 5; i++) {
        player.update(moment(0, 0.3), 0);
        player.update(moment(null, 0, 'travel'), 0);
      }
      expect(player.failures).toHaveLength(MAX_RECORDED_FAILURES);
      expect(player.firstError).toBe(player.failures[0]);
      expect(player.lastError).toMatchObject({ beatIndex: 0, phase: 'exit', error: boom });
      expect(player.lastError).not.toBe(player.failures[MAX_RECORDED_FAILURES - 1]);
    });

    it('describes a failure in one line', () => {
      expect(describeFailure({ beatIndex: 3, phase: 'enter', error: boom })).toBe('beat 3 enter: boom');
      expect(describeFailure({ beatIndex: 1, phase: 'update', error: 'text' })).toBe('beat 1 update: text');
    });

    it('has no failure until something throws', () => {
      const player = setup({ chew: spyFactory('chew', []).factory });
      player.update(moment(0, 0.3), 0);
      expect(player.lastError).toBeNull();
      expect(player.firstError).toBeNull();
      expect(player.failures).toEqual([]);
      expect(player.failed.size).toBe(0);
    });
  });
});
