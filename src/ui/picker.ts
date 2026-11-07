import { COPY } from '@/copy';
import { searchItems } from '@/catalogue/search';
import type { Catalogue, Portion, Sex } from '@/engine/types';
import { el } from '@/ui/dom';
import { createNutritionCard } from '@/ui/nutritionCard';
import { addToMeal, setAmount } from '@/ui/meal';
import type { MealItem, Mode } from '@/ui/types';

export function renderPicker(
  root: HTMLElement,
  catalogue: Catalogue,
  onStart: (sex: Sex, portions: Portion[]) => void,
  initialSex: Sex,
  onSexChange: (sex: Sex) => void,
): void {
  let sex: Sex = initialSex;
  let mode: Mode = 'single';
  let items: MealItem[] = [];

  const results = el('ul', { class: 'results' });
  const plate = el('ul', { class: 'plate' });
  const summary = el('div', { class: 'summary' });
  const start = el('button', { class: 'primary', onclick: () => onStart(sex, items.map((i) => i.portion)) }, [COPY.START]);
  const search = el('input', { type: 'search', placeholder: COPY.SEARCH_PLACEHOLDER, oninput: () => renderResults() });

  const toggle = <T extends string>(options: [T, string][], current: () => T, set: (v: T) => void): HTMLElement => {
    const group = el('div', { class: 'toggle' });
    const draw = (): void => {
      group.replaceChildren(
        ...options.map(([value, label]) =>
          el('button', { 'aria-pressed': String(current() === value), onclick: () => { set(value); draw(); renderPlate(); } }, [label]),
        ),
      );
    };
    draw();
    return group;
  };

  function renderResults(): void {
    const hits = searchItems(catalogue, search.value);
    results.replaceChildren(
      ...(hits.length === 0
        ? [el('li', { class: 'empty' }, [COPY.NO_RESULTS])]
        : hits.map((hit) => el('li', {}, [el('button', { onclick: () => { items = addToMeal(items, hit, mode); renderPlate(); } }, [hit.name])]))),
    );
  }

  function renderPlate(): void {
    if (mode === 'single' && items.length > 1) items = items.slice(-1);
    plate.replaceChildren(
      ...items.map((item, index) => {
        const isDish = item.portion.kind === 'dish';
        const value = item.portion.kind === 'dish' ? item.portion.servings : item.portion.grams;
        const note = item.hit.kind === 'dish' ? catalogue.dishes[item.hit.id]?.note : undefined;
        return el('li', {}, [
          el('span', {}, [item.hit.name, ...(note ? [el('small', { class: 'note' }, [note])] : [])]),
          el('input', {
            type: 'number',
            min: '0',
            step: isDish ? '0.5' : '10',
            value: String(value),
            onchange: (e) => { items = setAmount(items, index, Number((e.target as HTMLInputElement).value)); renderPlate(); },
          }),
          el('span', {}, [isDish ? COPY.UNIT_SERVINGS : COPY.UNIT_GRAMS]),
          el('button', { class: 'link', onclick: () => { items = items.filter((_, i) => i !== index); renderPlate(); } }, [COPY.REMOVE]),
        ]);
      }),
    );
    const portions = items.map((i) => i.portion);
    const microsOpen = summary.querySelector<HTMLDetailsElement>('details.micros')?.open ?? false;
    const card = items.length === 0 ? null : createNutritionCard(catalogue, portions, { collapsed: false });
    const micros = card?.querySelector<HTMLDetailsElement>('details.micros');
    if (micros) micros.open = microsOpen;
    summary.replaceChildren(card ?? el('p', { class: 'hint' }, [COPY.EMPTY_PLATE]));
    start.hidden = items.length === 0;
  }

  root.replaceChildren(
    el('h1', {}, [COPY.APP_TITLE]),
    el('p', { class: 'tagline' }, [COPY.TAGLINE]),
    el('ol', { class: 'howto' }, COPY.HOW_TO.map((text) => el('li', {}, [text]))),
    el('h2', {}, [COPY.SEX.PROMPT]),
    toggle<Sex>([['female', COPY.SEX.FEMALE], ['male', COPY.SEX.MALE]], () => sex, (v) => { sex = v; onSexChange(v); }),
    toggle<Mode>([['single', COPY.MODE.SINGLE], ['meal', COPY.MODE.MEAL]], () => mode, (v) => { mode = v; }),
    search,
    results,
    plate,
    summary,
    start,
    el('p', { class: 'disclaimer' }, [COPY.DISCLAIMER]),
  );
  renderResults();
  renderPlate();
}
