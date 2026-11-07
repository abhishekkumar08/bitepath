import * as THREE from 'three';
import { defaultPortion, searchItems } from '@/catalogue/search';
import type { PreviewHandle, PreviewQuery } from '@/dev/types';
import type { Catalogue, Portion, Sex } from '@/engine/types';
import { showFoodGallery } from '@/scene/food/gallery';
import { FOOD_MODEL_IDS } from '@/scene/food/models';
import type { FoodModelId } from '@/scene/food/types';
import type { LensScene } from '@/scene/lens/types';

const DEFAULT_AT = 0.5;
const MAX_ANGLE = 2;
const DEFAULT_PLATE = ['samosa'];
const FULL_PLATE = ['samosa', 'black-coffee', 'palak', 'beer'];
const PLATES: Record<string, string[]> = {
  'si-carbs': FULL_PLATE,
  'si-protein': FULL_PLATE,
  'si-bile': FULL_PLATE,
  'si-villi': FULL_PLATE,
  'si-caffeine': FULL_PLATE,
  'si-iron': FULL_PLATE,
  'si-iron-female': FULL_PLATE,
  'stomach-alcohol-female': ['beer'],
  'stomach-alcohol-male': ['beer'],
  'blood-caffeine': ['black-coffee'],
  'blood-alcohol': ['beer'],
  'blood-alcohol-female': ['beer'],
  'colon-fibre': ['palak'],
  'colon-no-fibre': ['beer'],
};

export function parsePreviewQuery(search: string): PreviewQuery {
  const params = new URLSearchParams(search);
  const at = Number.parseFloat(params.get('at') ?? '');
  const angle = Number.parseInt(params.get('angle') ?? '', 10);
  const lens = params.get('lens');
  return {
    beat: params.get('beat') || null,
    sex: params.get('sex') === 'male' ? 'male' : 'female',
    plate: (params.get('plate') ?? '').split(',').map((entry) => entry.trim()).filter(Boolean),
    at: Number.isFinite(at) ? Math.min(Math.max(at, 0), 1) : DEFAULT_AT,
    lens: lens === 'cube' || lens === 'emulsify' ? lens : null,
    foods: params.get('foods') === 'gallery',
    model: params.get('model') || null,
    angle: Number.isFinite(angle) ? Math.min(Math.max(angle, 0), MAX_ANGLE) : 0,
  };
}

export const defaultPlate = (ruleId: string): string[] => PLATES[ruleId] ?? DEFAULT_PLATE;

export function resolvePlate(catalogue: Catalogue, entries: string[]): { portions: Portion[]; unknown: string[] } {
  const portions: Portion[] = [];
  const unknown: string[] = [];
  for (const entry of entries) {
    if (catalogue.dishes[entry]) {
      portions.push({ kind: 'dish', dishId: entry, servings: 1 });
      continue;
    }
    const hit = searchItems(catalogue, entry, 1)[0];
    if (hit) portions.push(defaultPortion(hit));
    else unknown.push(entry);
  }
  return { portions, unknown };
}

function cubeLensScene(): LensScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10151c);
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(2, 3, 4);
  scene.add(light, new THREE.AmbientLight(0xffffff, 0.6));
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = [0xe63946, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x457b9d, 0x9b5de5].map((color) => new THREE.MeshStandardMaterial({ color }));
  const cube = new THREE.Mesh(geometry, materials);
  cube.rotation.set(0.5, 0.7, 0);
  scene.add(cube);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
  camera.position.set(0, 0, 3.2);
  return {
    scene,
    camera,
    update: (dt) => {
      cube.rotation.x += dt * 0.6;
      cube.rotation.y += dt * 0.9;
    },
    dispose: () => {
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

function report(status: 'ready' | 'error', text: string | null): void {
  if (text !== null) {
    const note = document.createElement('div');
    note.id = 'beat-dev-message';
    note.setAttribute('style', 'position:fixed;top:8px;right:8px;z-index:99;max-width:min(420px,calc(100vw - 16px));padding:8px 12px;border-radius:8px;background:#7a1020;color:#fff;font:600 13px/1.4 system-ui,sans-serif');
    note.textContent = text;
    document.body.append(note);
  }
  document.body.dataset.beatPreview = status;
}

export async function runBeatPreview(handle: PreviewHandle, search: string): Promise<void> {
  const query = parsePreviewQuery(search);
  if (!query.beat) return report('error', 'Beat preview: missing beat id.');
  const entries = query.plate.length > 0 ? query.plate : defaultPlate(query.beat);
  const { portions, unknown } = resolvePlate(handle.catalogue, entries);
  if (unknown.length > 0) return report('error', `Beat preview: no dish or food matches ${unknown.map((u) => `"${u}"`).join(', ')}.`);
  const sex: Sex = query.sex;
  await handle.start(sex, portions, false);
  const director = handle.getDirector();
  if (!director) return report('error', 'Beat preview: the journey did not start.');
  const present = director.journey.stations.some((s) => s.beats.some((b) => b.ruleId === query.beat));
  if (!present) {
    return report('error', `Beat preview: "${query.beat}" does not appear for ${sex} with ${entries.join(', ')}. Showing the first station instead.`);
  }
  director.seekBeat(query.beat, query.at);
  const anchors = handle.getAnchors();
  if (query.lens === 'cube' && anchors) handle.getLens()?.show(cubeLensScene, anchors.duodenum);
  if (query.lens === 'emulsify' && anchors) {
    const { createEmulsifyScene } = await import('@/scene/lens/droplets');
    const fat = director.journey.totals.fat;
    const at = query.at;
    handle.getLens()?.show(() => {
      const scene = createEmulsifyScene({ fat });
      scene.setProgress(at);
      return scene;
    }, anchors.smallIntestine);
  }
  handle.getNarration()?.setPlaying(false);
  report('ready', null);
}

const isModel = (id: string): id is FoodModelId => (FOOD_MODEL_IDS as string[]).includes(id);

export function runFoodGallery(search: string): void {
  const query = parsePreviewQuery(search);
  if (!query.foods) return report('error', 'Food gallery: use ?foods=gallery.');
  if (query.model !== null && !isModel(query.model)) return report('error', `Food gallery: unknown model "${query.model}".`);
  showFoodGallery(document.body, query.model, query.angle);
  report('ready', null);
}
