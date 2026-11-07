import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import type { Beat, Journey, Station } from '@/engine/types';
import { createDirector } from '@/scene/director';
import type { Lens } from '@/scene/lens/types';
import { TEST_ANCHORS } from '@/scene/testAnchors';
import { BEAT_FACTORIES } from '@/scene/beats/registry';
import type { DirectorHandlers, FrameCallback, LoadedBody, Stage, StreamModifier, Streams } from '@/scene/types';

const made = vi.hoisted(() => ({ streams: null as Streams | null }));

vi.mock('@/scene/streams', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/scene/streams')>();
  return {
    createStreams: (...args: Parameters<typeof actual.createStreams>) => {
      made.streams = actual.createStreams(...args);
      return made.streams;
    },
  };
});

const mod = (): StreamModifier => (made.streams as Streams).mod;

const beat = (ruleId: string, effect: Beat['effect'], seconds: number): Beat => ({ ruleId, effect, seconds, star: null });
const station = (id: Station['id'], beats: Beat[], dwellSeconds: number): Station => ({ id, captions: [], streams: [], stars: [], beats, dwellSeconds });

function setup(handlers: Partial<DirectorHandlers> = {}, reducedMotion = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }));
  let frame: FrameCallback = () => {};
  let subscribed = true;
  const scene = new THREE.Scene();
  const stage = {
    scene,
    camera: new THREE.PerspectiveCamera(35, 1.6),
    controls: { target: new THREE.Vector3(), enabled: true },
    renderer: { domElement: { parentElement: null } },
    onFrame: (cb: FrameCallback) => {
      frame = cb;
      return () => {
        subscribed = false;
      };
    },
    setInsets: () => {},
  } as unknown as Stage;
  const body = {
    root: new THREE.Group(),
    layers: { skin: [], muscle: [], skeleton: [], organs: [] },
    vessels: [],
    organs: {},
    anchors: TEST_ANCHORS,
    front: [0, 0, 1],
  } as unknown as LoadedBody;
  const journey: Journey = {
    sex: 'female',
    totals: { ...emptyNutrients(), starch: 30 },
    stations: [
      station('mouth', [beat('mouth-bolus', 'chew', 8), beat('mouth-amylase', 'amylase', 6)], 14),
      station('oesophagus', [beat('oesophagus-peristalsis', 'peristalsis', 5)], 5),
    ],
  };
  const lens = { show: vi.fn(), hide: vi.fn(), setAnchor: vi.fn(), update: vi.fn(), endStation: vi.fn(), dispose: vi.fn() } satisfies Lens;
  const director = createDirector(
    stage,
    body,
    journey,
    { onStation: () => {}, onBeat: () => {}, onFinish: () => {}, ...handlers },
    () => ({ position: [0, 0, 1], target: [0, 0, 0] }),
    lens,
    { catalogue: { foods: {}, dishes: {} }, portions: [] },
  );
  const run = (seconds: number): void => {
    for (let s = 0; s < seconds; s += 0.05) if (subscribed) frame(0.05);
  };
  return { director, run, scene, lens, stage, isSubscribed: () => subscribed };
}

describe('director modifier policy', () => {
  it('keeps the chewed ball through the next beat of the station and eases it back on the next station', () => {
    const { director, run } = setup();
    director.play();
    run(10.3);
    const ball = mod().swell;
    expect(ball).toBeLessThan(0.5);
    run(3);
    expect(made.streams?.holdModifiers).toBe(true);
    expect(mod().swell).toBeCloseTo(ball, 6);
    run(4.5);
    expect(made.streams?.holdModifiers).toBe(false);
    expect(mod().swell).toBe(1);
  });

  it('restarting the current station drops the held ball through the travel instead of keeping it', () => {
    const { director, run } = setup();
    director.play();
    run(10.3);
    expect(made.streams?.holdModifiers).toBe(true);
    expect(mod().swell).toBeLessThan(0.5);
    director.jump(0);
    run(0.1);
    expect(made.streams?.holdModifiers).toBe(false);
    run(1);
    expect(mod().swell).toBe(1);
  });

  it('replays the earlier beats of the station on a seek, so a paused seek to the second beat shows the ball', () => {
    const { director } = setup();
    director.seekBeat('mouth-amylase', 0.5);
    expect(mod().swell).toBeLessThan(0.5);
    director.seekBeat('mouth-bolus', 0.1);
    expect(mod().visible).toBe(0);
    director.seekBeat('oesophagus-peristalsis', 0.2);
    expect(mod().swell).toBeLessThan(0.5);
    expect(mod().visible).toBe(1);
  });
});


describe('director journey end', () => {
  it('ends the station on finish: lens ended, beat effects exited, only the streams left in the scene', () => {
    const onFinish = vi.fn();
    const { director, run, scene, lens } = setup({ onFinish });
    director.play();
    run(19);
    expect(scene.children.length).toBeGreaterThan(1);
    const ended = lens.endStation.mock.calls.length;
    run(5);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(director.playing).toBe(false);
    expect(lens.endStation.mock.calls.length).toBe(ended + 1);
    expect(scene.children).toEqual([(made.streams as Streams).group]);
    run(2);
    expect(scene.children).toEqual([(made.streams as Streams).group]);
    expect(lens.show).toHaveBeenCalledTimes(1);
  });

  it('replays the whole journey on Play after the finish, lens beats included', () => {
    const onStation = vi.fn();
    const { director, run, lens } = setup({ onStation });
    director.play();
    run(24);
    expect(director.playing).toBe(false);
    onStation.mockClear();
    director.play();
    run(0.1);
    expect(onStation).toHaveBeenCalledWith(0, expect.objectContaining({ id: 'mouth' }));
    run(12);
    expect(lens.show).toHaveBeenCalledTimes(2);
  });
});

describe('director camera', () => {
  const blends = (reduced: boolean): number[] => {
    const { director, run, stage } = setup({}, reduced);
    const lerp = vi.spyOn(stage.camera.position, 'lerp');
    director.play();
    run(2);
    return lerp.mock.calls.map((call) => call[1] as number);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('eases toward its goal, but snaps to it when the user prefers reduced motion', () => {
    const eased = blends(false);
    expect(eased.length).toBeGreaterThan(0);
    expect(eased.every((k) => k < 1)).toBe(true);
    const snapped = blends(true);
    expect(snapped.length).toBeGreaterThan(0);
    expect(snapped.every((k) => k === 1)).toBe(true);
  });
});

describe('director dispose', () => {
  it('unsubscribes its frame callback and lets a second journey run on the same stage', () => {
    const first = setup();
    first.director.play();
    first.run(1);
    first.director.dispose();
    expect(first.isSubscribed()).toBe(false);
    const second = setup();
    second.director.play();
    second.run(1);
    expect(second.isSubscribed()).toBe(true);
    expect(second.lens.update).toHaveBeenCalled();
  });
});

describe('director beat failures', () => {
  it('reports a contained beat failure once, with its phase and beat index', () => {
    const original = BEAT_FACTORIES.amylase;
    BEAT_FACTORIES.amylase = () => {
      throw new Error('boom');
    };
    try {
      const onBeatError = vi.fn();
      const { director, run } = setup({ onBeatError });
      director.play();
      run(13);
      expect(onBeatError).toHaveBeenCalledTimes(1);
      expect(onBeatError.mock.calls[0][0]).toMatchObject({ beatIndex: 1, phase: 'create' });
      run(5);
      expect(onBeatError).toHaveBeenCalledTimes(1);
    } finally {
      BEAT_FACTORIES.amylase = original;
    }
  });
});
