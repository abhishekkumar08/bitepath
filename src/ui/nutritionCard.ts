import { COPY } from '@/copy';
import { DETAILS } from '@/engine/details';
import { plateNutrition, streamShares } from '@/engine/nutrition';
import { sumPortions } from '@/engine/totals';
import type { Catalogue, DetailGroup, Nutrient, PlateNutrition, Portion } from '@/engine/types';
import { NUTRIENT_COLOR } from '@/scene/path';
import { el } from '@/ui/dom';
import { formatEnergy, mixLabel, rowFor } from '@/ui/format';

export const nutrientCss = (nutrient: Nutrient): string => `#${NUTRIENT_COLOR[nutrient].toString(16).padStart(6, '0')}`;

export function createMixBar(catalogue: Catalogue, portions: Portion[]): HTMLElement {
  const shares = streamShares(sumPortions(catalogue, portions));
  const bar = el(
    'div',
    { class: 'mixbar', role: 'img', 'aria-label': mixLabel(shares) },
    shares.map(({ nutrient, share }) => el('span', { style: `flex-grow:${share};background:${nutrientCss(nutrient)}` })),
  );
  bar.hidden = shares.length === 0;
  return bar;
}

function rows(nutrition: PlateNutrition, groups: DetailGroup[]): HTMLElement {
  return el(
    'ul',
    { class: 'rows' },
    groups.flatMap((group) => DETAILS.filter((spec) => spec.group === group)).map((spec) => {
      const row = rowFor(nutrition.details[spec.id], spec.unit);
      const value = el('span', { class: row.missing ? 'amount missing' : 'amount' }, [row.text]);
      if (row.partial) value.title = COPY.NUTRITION.PARTIAL_HINT;
      return el('li', {}, [el('span', {}, [COPY.NUTRITION.NAMES[spec.id]]), value]);
    }),
  );
}

export function createNutritionCard(catalogue: Catalogue, portions: Portion[], opts: { collapsed: boolean }): HTMLElement {
  const nutrition = plateNutrition(catalogue, portions);
  const anyPartial = DETAILS.some((spec) => rowFor(nutrition.details[spec.id], spec.unit).partial);
  const body = [
    el('p', { class: 'energy' }, [el('span', {}, [COPY.NUTRITION.ENERGY]), el('strong', {}, [formatEnergy(nutrition.energyKcal)])]),
    createMixBar(catalogue, portions),
    el('h3', {}, [COPY.NUTRITION.MACROS_TITLE]),
    rows(nutrition, ['macro']),
    el('details', { class: 'micros' }, [el('summary', {}, [COPY.NUTRITION.MICROS_TITLE]), rows(nutrition, ['mineral', 'vitamin'])]),
    ...(anyPartial ? [el('p', { class: 'footnote' }, [`${COPY.NUTRITION.AT_LEAST} ${COPY.NUTRITION.PARTIAL_HINT}`])] : []),
  ];
  if (opts.collapsed) return el('details', { class: 'nutrition' }, [el('summary', {}, [COPY.NUTRITION.TITLE]), ...body]);
  return el('section', { class: 'nutrition' }, [el('h2', {}, [COPY.NUTRITION.TITLE]), ...body]);
}
