import { COPY } from '@/copy';
import { el } from '@/ui/dom';

export const LAYER_STEPS = ['skin', 'muscle', 'skeleton', 'organs'] as const;

export const stepBy = (step: number, dir: 1 | -1): number => Math.min(LAYER_STEPS.length - 1, Math.max(0, step + dir));

export function nextLabel(step: number): string | undefined {
  const next = LAYER_STEPS[step + 1];
  return next ? `${COPY.PEEL_NEXT} ${COPY.LAYER_NAMES[next]}` : undefined;
}

export function peelAt(from: number, to: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return from + (to - from) * k * k * (3 - 2 * k);
}

export function createLayerStepper(root: HTMLElement, onStep: (step: number) => void): void {
  let step = 0;
  const name = el('span', { class: 'step-name', 'aria-live': 'polite' });
  const upNext = el('span', { class: 'step-next' });
  const pips = LAYER_STEPS.map(() => el('i'));
  const back = el('button', { 'aria-label': COPY.PEEL_BACK, onclick: () => go(-1) }, ['−']);
  const deeper = el('button', { 'aria-label': COPY.PEEL_DEEPER, onclick: () => go(1) }, ['+']);

  function draw(): void {
    name.textContent = COPY.LAYER_NAMES[LAYER_STEPS[step]];
    const label = nextLabel(step);
    upNext.textContent = label ?? '';
    upNext.hidden = label === undefined;
    back.hidden = step === 0;
    deeper.hidden = step === LAYER_STEPS.length - 1;
    pips.forEach((pip, i) => pip.toggleAttribute('data-on', i <= step));
  }

  function go(dir: 1 | -1): void {
    step = stepBy(step, dir);
    draw();
    onStep(step);
  }

  root.replaceChildren(
    el('span', { class: 'stepper-label' }, [COPY.LAYERS_LABEL]),
    el('div', { class: 'stepper' }, [el('span', { class: 'slot' }, [back]), el('span', { class: 'step-label' }, [name, upNext]), el('span', { class: 'slot' }, [deeper])]),
    el('span', { class: 'pips' }, pips),
  );
  draw();
}
