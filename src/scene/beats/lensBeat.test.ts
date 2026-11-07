import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { emptyNutrients } from '@/engine/totals';
import { lensBeat } from '@/scene/beats/lensBeat';
import type { BeatContext } from '@/scene/beats/types';
import type { Lens, LensOptions } from '@/scene/lens/types';

const ANCHOR: [number, number, number] = [1, 2, 3];

const harness = (organ: THREE.Object3D | undefined, withLens = true, options?: LensOptions) => {
  const lens = { show: vi.fn(), hide: vi.fn(), setAnchor: vi.fn(), update: vi.fn(), endStation: vi.fn(), dispose: vi.fn() } satisfies Lens;
  const stage = { scene: new THREE.Scene() };
  const body = { organs: { colon: organ }, anchors: { colon: ANCHOR } };
  const ctx = {
    stage,
    journey: { sex: 'female', totals: emptyNutrients(), stations: [] },
    body,
    lens: withLens ? lens : null,
  } as unknown as BeatContext;
  const setProgress = vi.fn();
  const scene = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), update: vi.fn(), dispose: vi.fn(), setProgress };
  const build = vi.fn(() => scene);
  const effect = lensBeat(ctx, { organ: 'colon', build, options });
  return { effect, lens, stage, body, build, setProgress };
};

const placedOrgan = (): THREE.Mesh => {
  const organ = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6));
  organ.position.set(10, 20, 30);
  organ.updateMatrixWorld();
  return organ;
};

describe('lensBeat', () => {
  it('shows the lens once at the organ centre and passes the options through', () => {
    const { effect, lens, stage } = harness(placedOrgan(), true, { sped: true });
    effect.enter();
    expect(lens.show).toHaveBeenCalledTimes(1);
    const [, anchor, opts] = lens.show.mock.calls[0];
    expect(anchor).toEqual([10, 20, 30]);
    expect(opts).toEqual({ sped: true });
    expect(stage.scene.children).toHaveLength(0);
  });

  it('falls back to the organ anchor when the organ is missing or empty', () => {
    for (const organ of [undefined, new THREE.Group()]) {
      const { effect, lens } = harness(organ);
      effect.enter();
      expect(lens.show.mock.calls[0][1]).toEqual(ANCHOR);
    }
  });

  it('forwards beat progress to the scene the lens built', () => {
    const { effect, lens, build, setProgress } = harness(placedOrgan());
    effect.enter();
    effect.update(0.3, 0);
    expect(setProgress).not.toHaveBeenCalled();
    lens.show.mock.calls[0][0]();
    expect(build).toHaveBeenCalledTimes(1);
    effect.update(0.4, 0);
    expect(setProgress).toHaveBeenLastCalledWith(0.4);
  });

  it('hides once for two exits and never without an enter', () => {
    const shown = harness(placedOrgan());
    shown.effect.enter();
    shown.effect.exit();
    shown.effect.exit();
    expect(shown.lens.hide).toHaveBeenCalledTimes(1);
    const never = harness(placedOrgan());
    never.effect.exit();
    expect(never.lens.hide).not.toHaveBeenCalled();
  });

  it('computes the anchor once across re-entries', () => {
    const { effect, lens, body } = harness(placedOrgan());
    effect.enter();
    effect.exit();
    body.organs.colon = undefined;
    effect.enter();
    expect(lens.show).toHaveBeenCalledTimes(2);
    expect(lens.show.mock.calls[1][1]).toEqual([10, 20, 30]);
  });

  it('is safe without a lens and never reads the beat', () => {
    const { effect } = harness(placedOrgan(), false);
    expect(() => {
      effect.enter();
      effect.update(0.5, 0);
      effect.exit();
      effect.dispose();
    }).not.toThrow();
  });
});

describe('lensBeat framing', () => {
  const framedHarness = (frame: boolean | undefined, organ: THREE.Object3D | undefined) => {
    const lens = { show: vi.fn(), hide: vi.fn(), setAnchor: vi.fn(), update: vi.fn(), endStation: vi.fn(), dispose: vi.fn() } satisfies Lens;
    const camera = new THREE.PerspectiveCamera(35, 1.6);
    const ctx = {
      stage: { scene: new THREE.Scene(), camera },
      journey: { sex: 'female', totals: emptyNutrients(), stations: [] },
      body: { organs: { colon: organ }, anchors: { colon: ANCHOR }, front: [0, 0, 1] },
      lens,
    } as unknown as BeatContext;
    const scene = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), update: vi.fn(), dispose: vi.fn(), setProgress: vi.fn() };
    return lensBeat(ctx, { organ: 'colon', build: () => scene, frame });
  };

  it('frames the whole organ from the front when asked, the same goal at every progress', () => {
    const effect = framedHarness(true, placedOrgan());
    const goal = effect.camera?.(0.2);
    expect(goal?.target).toEqual([10, 20, 30]);
    const [x, y, z] = goal?.position ?? [0, 0, 0];
    expect([x, y]).toEqual([10, 20]);
    const radius = Math.hypot(1, 2, 3);
    expect(z - 30).toBeGreaterThan(radius / Math.sin((35 * Math.PI) / 360));
    expect(effect.camera?.(0.9)).toEqual(goal);
  });

  it('leaves the camera to the director when not asked or when the organ is missing', () => {
    expect(framedHarness(undefined, placedOrgan()).camera).toBeUndefined();
    expect(framedHarness(false, placedOrgan()).camera).toBeUndefined();
    expect(framedHarness(true, undefined).camera).toBeUndefined();
    expect(framedHarness(true, new THREE.Group()).camera).toBeUndefined();
  });
});
