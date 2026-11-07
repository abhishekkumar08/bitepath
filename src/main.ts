import '@/styles.css';
import { COPY } from '@/copy';
import { loadCatalogue } from '@/catalogue/load';
import { buildJourney } from '@/engine/journey';
import type { Catalogue, Portion, Sex } from '@/engine/types';
import { along } from '@/models/vec';
import { applyLayers, loadBody } from '@/scene/body';
import { createDirector } from '@/scene/director';
import { createLens } from '@/scene/lens/lens';
import { LENS_PHONE_TOP_INSET, PHONE_MAX_WIDTH } from '@/scene/lens/placement';
import type { Lens } from '@/scene/lens/types';
import { createStage } from '@/scene/stage';
import { starGoal } from '@/scene/stars';
import type { Director, LoadedBody, Stage } from '@/scene/types';
import { createCredits, openSource, sourceNumber } from '@/ui/credits';
import { el } from '@/ui/dom';
import { createLayerStepper, peelAt } from '@/ui/layers';
import { createNarration } from '@/ui/narration';
import type { Narration } from '@/ui/narration';
import { renderPicker } from '@/ui/picker';

const PREVIEW_DISTANCE = 2.2;
const PEEL_MS = 380;

const byId = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
};

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const panel = byId('panel');
const loader = byId('loader');
const stage = ((): Stage => {
  try {
    return createStage(byId('viewport'));
  } catch (error: unknown) {
    panel.replaceChildren(el('p', { class: 'status' }, [`${COPY.ERROR_WEBGL} ${message(error)}`]));
    throw error;
  }
})();
const bodies = new Map<Sex, Promise<LoadedBody>>();
let shown: LoadedBody | null = null;
let director: Director | null = null;
let activeLens: Lens | null = null;
let lensActive = false;
let activeNarration: Narration | null = null;
let journeyStarted = false;
let peel = 0;
let peelFrame = 0;
let chosenSex: Sex = 'female';
let catalogue: Catalogue | null = null;

function syncInsets(): void {
  const rect = panel.getBoundingClientRect();
  const phone = window.innerWidth <= PHONE_MAX_WIDTH;
  stage.setInsets(
    phone
      ? { left: 0, bottom: Math.max(0, window.innerHeight - rect.top), top: lensActive ? LENS_PHONE_TOP_INSET : 0 }
      : { left: Math.max(0, rect.right), bottom: 0, top: 0 },
  );
}
new ResizeObserver(syncInsets).observe(panel);
window.addEventListener('resize', syncInsets);
syncInsets();

createCredits(byId('credits'));
function animatePeel(to: number): void {
  cancelAnimationFrame(peelFrame);
  const from = peel;
  const start = performance.now();
  const tick = (now: number): void => {
    const t = (now - start) / PEEL_MS;
    peel = peelAt(from, to, t);
    if (shown && !director) applyLayers(shown, peel, false);
    if (t < 1) peelFrame = requestAnimationFrame(tick);
  };
  peelFrame = requestAnimationFrame(tick);
}
createLayerStepper(byId('layers'), animatePeel);

function panelStatus(text: string, retry?: () => void): void {
  panel.replaceChildren(el('p', { class: 'status' }, [text]), ...(retry ? [el('button', { onclick: retry }, [COPY.RETRY])] : []));
}

function loaderStatus(text: string | null): void {
  loader.hidden = text === null;
  loader.textContent = text ?? '';
}

function bodyFor(sex: Sex): Promise<LoadedBody> {
  const cached = bodies.get(sex);
  if (cached) return cached;
  const loading = loadBody(sex, (f) => loaderStatus(`${COPY.LOADING_BODY} ${Math.round(f * 100)}%`)).finally(() => loaderStatus(null));
  bodies.set(sex, loading);
  loading.catch(() => bodies.delete(sex));
  return loading;
}

function show(body: LoadedBody): void {
  if (shown) stage.scene.remove(shown.root);
  stage.scene.add(body.root);
  shown = body;
}

function showPicker(): void {
  if (catalogue) {
    renderPicker(
      panel,
      catalogue,
      (sex, portions) => void start(sex, portions),
      chosenSex,
      (sex) => {
        chosenSex = sex;
        void preview(sex);
      },
    );
    panel.scrollTop = 0;
  }
}

async function start(sex: Sex, portions: Portion[], autoplay = true): Promise<void> {
  if (!catalogue) return;
  chosenSex = sex;
  journeyStarted = true;
  panelStatus(COPY.LOADING_BODY);
  let createdLens: Lens | null = null;
  try {
    const body = await bodyFor(sex);
    show(body);
    const journey = buildJourney(catalogue, sex, portions);
    director?.dispose();
    const lens = createLens(stage, byId('lens'), {
      obstacles: [panel, byId('credits'), loader],
      keepOut: [byId('credits')],
      onActiveChange: (active) => {
        lensActive = active;
        syncInsets();
      },
    });
    createdLens = lens;
    activeLens = lens;
    let current = 0;
    const narration = createNarration(panel, catalogue, portions, sourceNumber, openSource, {
      onToggle: () => {
        if (!director) return;
        if (director.playing) director.pause();
        else director.play();
        narration.setPlaying(director.playing);
      },
      onPrev: () => {
        director?.jump(current - 1);
        narration.setPlaying(true);
      },
      onNext: () => {
        director?.jump(current + 1);
        narration.setPlaying(true);
      },
      onBack: () => {
        director?.dispose();
        director = null;
        activeLens = null;
        journeyStarted = false;
        applyLayers(body, peel, false);
        byId('layers').hidden = false;
        showPicker();
        void preview(chosenSex);
      },
    }, sex === 'male' ? COPY.SEX.MALE : COPY.SEX.FEMALE);
    activeNarration = narration;
    director = createDirector(
      stage,
      body,
      journey,
      {
        onStation: (index, station) => {
          current = index;
          narration.show(index, journey.stations.length, station);
        },
        onBeat: (index) => narration.setBeat(index, false),
        onFinish: () => narration.finish(),
        onBeatError: import.meta.env.DEV
          ? (failure) => void import('@/dev/beatErrors').then(({ showBeatError }) => showBeatError(failure))
          : undefined,
      },
      starGoal,
      lens,
      { catalogue, portions },
    );
    byId('layers').hidden = true;
    if (autoplay) {
      director.play();
      narration.setPlaying(true);
    }
  } catch (error: unknown) {
    createdLens?.dispose();
    if (activeLens === createdLens) activeLens = null;
    panelStatus(`${COPY.ERROR_BODY} ${message(error)}`, () => void start(sex, portions));
  }
}

async function preview(sex: Sex): Promise<void> {
  try {
    const body = await bodyFor(sex);
    if (journeyStarted || sex !== chosenSex) return;
    show(body);
    applyLayers(body, peel, false);
    const target = body.anchors.heart;
    stage.camera.position.set(...along(target, body.front, PREVIEW_DISTANCE));
    stage.controls.target.set(...target);
  } catch (error: unknown) {
    loaderStatus(`${COPY.ERROR_BODY} ${message(error)}`);
  }
}

async function boot(): Promise<void> {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('foods')) {
    const { runFoodGallery } = await import('@/dev/preview');
    runFoodGallery(location.search);
    return;
  }
  panelStatus(COPY.LOADING_FOODS);
  try {
    catalogue = await loadCatalogue();
  } catch (error: unknown) {
    panelStatus(`${COPY.ERROR_FOODS} ${message(error)}`, () => void boot());
    return;
  }
  showPicker();
  await preview(chosenSex);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('beat')) {
    const { runBeatPreview } = await import('@/dev/preview');
    await runBeatPreview({ catalogue, start, getDirector: () => director, getNarration: () => activeNarration, getLens: () => activeLens, getAnchors: () => shown?.anchors ?? null }, location.search);
  }
}

void boot();
