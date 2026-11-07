import { COPY } from '@/copy';
import { SOURCES } from '@/engine/sources';
import { el } from '@/ui/dom';

export const SOURCE_ORDER = Object.keys(SOURCES);
export const sourceNumber = (id: string): number => SOURCE_ORDER.indexOf(id) + 1;

let dialog: HTMLDialogElement | null = null;

export function openSource(id: string): void {
  dialog?.showModal();
  document.getElementById(`source-${id}`)?.scrollIntoView({ block: 'nearest' });
}

export function createCredits(root: HTMLElement): void {
  const created = el('dialog', { class: 'credits' }, [
    el('h2', {}, [COPY.CREDITS.MODELS_TITLE]),
    el('ul', {}, [el('li', {}, [COPY.CREDITS.HUBMAP]), el('li', {}, [COPY.CREDITS.BP3D]), el('li', {}, [COPY.CREDITS.FEMALE_NOTE])]),
    el('h2', {}, [COPY.CREDITS.DATA_TITLE]),
    el('ul', {}, [el('li', {}, [COPY.CREDITS.IFCT]), el('li', {}, [COPY.CREDITS.USDA])]),
    el('h2', {}, [COPY.CREDITS.SCIENCE_TITLE]),
    el(
      'ol',
      {},
      SOURCE_ORDER.map((id) =>
        el('li', { id: `source-${id}` }, [SOURCES[id].citation, ' ', el('a', { href: SOURCES[id].url, target: '_blank', rel: 'noreferrer' }, [SOURCES[id].url])]),
      ),
    ),
    el('p', { class: 'disclaimer' }, [COPY.DISCLAIMER]),
    el('button', { onclick: () => created.close() }, [COPY.CREDITS.CLOSE]),
  ]);
  root.replaceChildren(el('button', { class: 'link', onclick: () => created.showModal() }, [COPY.CREDITS.OPEN]), created);
  dialog = created;
}
