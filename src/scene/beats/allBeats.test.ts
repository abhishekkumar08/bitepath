import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dishList from '@/data/dishes.json';
import { resolvePlate } from '@/dev/preview';
import { buildJourney } from '@/engine/journey';
import { RULES } from '@/engine/rules';
import type { Catalogue, Dish, EffectId, Food, Journey, Sex } from '@/engine/types';
import type { AnchorId, OrganId } from '@/models/types';
import { createBeatPlayer, describeFailure } from '@/scene/beats/player';
import { looksFor } from '@/scene/food/look';
import type { Lens, LensScene } from '@/scene/lens/types';
import { createStreams } from '@/scene/streams';
import { TEST_ANCHORS } from '@/scene/testAnchors';
import type { LoadedBody, Moment, Stage } from '@/scene/types';

const foods = JSON.parse(readFileSync('public/data/foods.json', 'utf8')) as Food[];
const catalogue: Catalogue = {
  foods: Object.fromEntries(foods.map((f) => [f.id, f])),
  dishes: Object.fromEntries((dishList as Dish[]).map((d) => [d.id, d])),
};

const PLATES: Record<string, string[]> = {
  samosa: ['samosa'],
  beer: ['beer'],
  'black-coffee': ['black-coffee'],
  palak: ['palak'],
  meal: ['samosa', 'black-coffee', 'palak', 'beer'],
};
const PROGRESS = [0, 0.5, 1];

const ORGAN_ANCHORS: Record<OrganId, AnchorId> = {
  mouth: 'mouth',
  oesophagus: 'oesophagusTop',
  stomach: 'stomach',
  smallIntestine: 'smallIntestine',
  liver: 'liver',
  gallbladder: 'duodenum',
  pancreas: 'duodenum',
  colon: 'colon',
  heart: 'heart',
  vessels: 'heart',
  brain: 'brain',
};

function fakeBody(): LoadedBody {
  const root = new THREE.Group();
  const organs: Partial<Record<OrganId, THREE.Object3D>> = {};
  for (const [id, anchor] of Object.entries(ORGAN_ANCHORS) as [OrganId, AnchorId][]) {
    const [x, y, z] = TEST_ANCHORS[anchor];
    const group = new THREE.Group();
    group.userData.organ = id;
    const size = id === 'gallbladder' ? 0.02 : 0.06;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size).translate(x, y, z), new THREE.MeshPhysicalMaterial({ color: 0x884444 })));
    organs[id] = group;
    root.add(group);
  }
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3).translate(0, 0.8, -0.1));
  root.add(spine);
  root.updateMatrixWorld(true);
  return { root, organs, anchors: TEST_ANCHORS, front: [0, 0, 1], vessels: [], layers: { skeleton: [spine], skin: [], muscle: [], organs: [] } } as unknown as LoadedBody;
}

interface Harness {
  stage: Stage;
  lens: Lens;
  closeLens: () => void;
}

function harness(): Harness {
  const scene = new THREE.Scene();
  const tag = { remove: vi.fn(), className: '', textContent: '' };
  const host = { append: vi.fn(), ownerDocument: { createElement: () => tag } };
  const stage = {
    scene,
    camera: new THREE.PerspectiveCamera(35, 1.6),
    controls: { target: new THREE.Vector3(), enabled: true },
    renderer: { domElement: { parentElement: host, clientWidth: 1440, clientHeight: 900 } },
    onFrame: () => () => {},
    setInsets: () => {},
  } as unknown as Stage;
  let content: LensScene | null = null;
  const closeLens = (): void => {
    content?.dispose();
    content = null;
  };
  const lens: Lens = {
    show: (factory) => {
      closeLens();
      content = factory();
    },
    hide: closeLens,
    setAnchor: () => {},
    update: (dt) => content?.update(dt),
    endStation: closeLens,
    dispose: closeLens,
  };
  return { stage, lens, closeLens };
}

const moment = (index: number, beatIndex: number, beatProgress: number): Moment => ({
  index,
  phase: 'dwell',
  progress: beatProgress,
  stationProgress: beatProgress,
  star: null,
  done: false,
  beatIndex,
  beatProgress,
  beatEffect: null,
});

function sweep(journey: Journey, plate: string): string[] {
  const entries = resolvePlate(catalogue, PLATES[plate]);
  const looks = looksFor(catalogue, entries.portions);
  const problems: string[] = [];
  journey.stations.forEach((station, index) => {
    const { stage, lens, closeLens } = harness();
    const body = fakeBody();
    const streams = createStreams(body.anchors, journey, looks);
    const player = createBeatPlayer({ stage, body, journey, station, streams, lens, looks });
    station.beats.forEach((beat, beatIndex) => {
      for (const p of PROGRESS) {
        const m = { ...moment(index, beatIndex, p), beatEffect: beat.effect };
        player.update(m, 0.016);
        lens.update(0.016);
        streams.easeModifiers(0.016);
      }
    });
    player.update({ ...moment(index, 0, 0), phase: 'travel', beatIndex: null }, 0.016);
    player.dispose();
    closeLens();
    streams.dispose();
    for (const failure of player.failures) problems.push(`${plate}/${station.id}: ${describeFailure(failure)}`);
    if (player.failed.size > 0) problems.push(`${plate}/${station.id}: failed beats ${[...player.failed].join(',')}`);
  });
  return problems;
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('every real beat of the real journeys runs through the real player without a contained failure', () => {
  for (const plate of Object.keys(PLATES)) {
    for (const sex of ['female', 'male'] as Sex[]) {
      it(`${plate} / ${sex}`, () => {
        const { portions } = resolvePlate(catalogue, PLATES[plate]);
        const journey = buildJourney(catalogue, sex, portions);
        const animated = journey.stations.flatMap((s) => s.beats).filter((b) => b.effect !== null);
        expect(animated.length).toBeGreaterThan(0);
        expect(sweep(journey, plate)).toEqual([]);
      });
    }
  }
});

describe('the swept journeys exercise every effect the rules use', () => {
  it('the union of their animated effects equals the effects used by RULES', () => {
    const used = new Set(RULES.flatMap((rule) => (rule.effect === null ? [] : [rule.effect])));
    const exercised = new Set<EffectId>();
    for (const plate of Object.keys(PLATES)) {
      for (const sex of ['female', 'male'] as Sex[]) {
        const journey = buildJourney(catalogue, sex, resolvePlate(catalogue, PLATES[plate]).portions);
        for (const b of journey.stations.flatMap((s) => s.beats)) if (b.effect !== null) exercised.add(b.effect);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    expect([...exercised].sort()).toEqual([...used].sort());
  });
});
