import { COPY } from '@/copy';
import { plateNutrition } from '@/engine/nutrition';
import type { Catalogue, Portion, Station } from '@/engine/types';
import { captionBeatIndexes, revealedCaptions } from '@/ui/captions';
import { el } from '@/ui/dom';
import { legendAmount } from '@/ui/format';
import { createMixBar, createNutritionCard, nutrientCss } from '@/ui/nutritionCard';
import type { CaptionSlot } from '@/ui/types';

const SCROLL_GAP = 8;

export interface NarrationHandlers {
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
}

export interface Narration {
  show: (index: number, total: number, station: Station) => void;
  setBeat: (index: number | null, done: boolean) => void;
  setPlaying: (playing: boolean) => void;
  finish: () => void;
}

export function createNarration(
  root: HTMLElement,
  catalogue: Catalogue,
  portions: Portion[],
  sourceNumber: (id: string) => number,
  openSource: (id: string) => void,
  h: NarrationHandlers,
  bodyLabel: string,
): Narration {
  const { details } = plateNutrition(catalogue, portions);
  const title = el('h2');
  const step = el('p', { class: 'step' });
  const captions = el('ul', { class: 'captions' });
  const legend = el('ul', { class: 'legend' });
  const toggle = el('button', { class: 'primary', onclick: h.onToggle }, [COPY.PAUSE]);
  const prev = el('button', { onclick: h.onPrev }, [COPY.PREV]);
  const next = el('button', { onclick: h.onNext }, [COPY.NEXT]);
  const controls = el('div', { class: 'controls' }, [
    prev,
    toggle,
    next,
    el('button', { class: 'link', onclick: h.onBack }, [COPY.BACK]),
  ]);
  root.replaceChildren(
    step,
    title,
    captions,
    createMixBar(catalogue, portions),
    legend,
    controls,
    createNutritionCard(catalogue, portions, { collapsed: true }),
    el('p', { class: 'disclaimer' }, [COPY.DISCLAIMER]),
  );
  root.scrollTop = 0;
  const syncScrollPadding = (): void => {
    if (!controls.isConnected) {
      padding.disconnect();
      return;
    }
    root.style.scrollPaddingBottom =
      getComputedStyle(controls).position === 'sticky' ? `${controls.offsetHeight + SCROLL_GAP}px` : '';
  };
  const padding = new ResizeObserver(syncScrollPadding);
  padding.observe(controls);
  padding.observe(root);
  syncScrollPadding();
  let slots: CaptionSlot[] = [];
  let items: HTMLElement[] = [];
  let heading: HTMLElement | null = null;
  let headingAt = -1;
  let shown: boolean[] = [];

  const setBeat = (index: number | null, done: boolean): void => {
    if (index === null && !done && shown.some(Boolean)) return;
    const flags = revealedCaptions(index, done, slots);
    let target: HTMLElement | null = null;
    for (let i = 0; i < flags.length; i++) {
      const item = items[i];
      const visible = flags[i];
      const active = visible && !done && index !== null && slots[i].beatIndex === index;
      item.classList.toggle('shown', visible);
      item.classList.toggle('active', active);
      item.classList.toggle('past', visible && !done && !active && slots[i].beatIndex !== null);
      if (visible && !shown[i] && (target === null || active)) target = item;
      shown[i] = visible;
    }
    heading?.classList.toggle('shown', flags[headingAt] ?? false);
    if (index !== null) target?.scrollIntoView({ block: 'nearest' });
  };

  return {
    show(index, total, station) {
      step.textContent = `${bodyLabel} · ${index + 1} / ${total}`;
      prev.hidden = index === 0;
      next.hidden = index === total - 1;
      title.textContent = COPY.STATIONS[station.id];
      const indexes = captionBeatIndexes(station.captions, station.beats);
      const ordered = station.captions
        .map((caption, i) => ({ caption, beatIndex: indexes[i] }))
        .sort((a, b) => (a.beatIndex ?? Infinity) - (b.beatIndex ?? Infinity));
      slots = ordered.map(({ beatIndex }) => ({ beatIndex }));
      shown = ordered.map(() => false);
      headingAt = slots.findIndex((slot) => slot.beatIndex === null);
      heading = headingAt > 0 ? el('li', { class: 'captions-heading' }, [COPY.GOOD_TO_KNOW]) : null;
      items = ordered.map(({ caption }) =>
        el('li', {}, [
          caption.text,
          ...caption.sourceIds.map((id) => el(
              'a',
              {
                href: `#source-${id}`,
                class: 'cite',
                onclick: (event) => {
                  event.preventDefault();
                  openSource(id);
                },
              },
              [`[${sourceNumber(id)}]`],
            )),
        ]),
      );
      const children: HTMLElement[] = [...items];
      if (heading) children.splice(headingAt, 0, heading);
      captions.replaceChildren(...children);
      root.scrollTop = 0;
      setBeat(null, false);
      legend.replaceChildren(
        ...station.streams.map((s) =>
          el('li', {}, [
            el('span', { class: 'swatch', style: `background:${nutrientCss(s.nutrient)}` }),
            COPY.NUTRIENTS[s.nutrient],
            el('strong', {}, [legendAmount(s.nutrient, s.amount, details)]),
          ]),
        ),
      );
    },
    setBeat,
    setPlaying(playing) {
      toggle.textContent = playing ? COPY.PAUSE : COPY.PLAY;
    },
    finish() {
      step.textContent = COPY.FINISHED;
      setBeat(null, true);
      toggle.textContent = COPY.PLAY;
    },
  };
}
