// Tiny helpers for building HTML elements from code, without a framework.
//
// h('button', { class: 'btn', onclick: go }, 'Go') makes <button class="btn">Go</button>.

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k in el && typeof v !== 'string') {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Saves text or a Blob as a file on the user's device. */
export function download(name: string, content: string | Blob, type = 'text/plain;charset=utf-8'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toast(message: string, ms = 2600): void {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const el = h('div', { class: 'toast', role: 'status', dir: 'auto' }, message);
  box.append(el);
  setTimeout(() => el.remove(), ms);
}

/** Shows a modal dialog. Returns a function that closes it. */
export function modal(content: HTMLElement, onClose?: () => void): () => void {
  const back = h('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true' });
  const box = h('div', { class: 'modal' }, content);
  back.append(box);
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => {
    if (e.target === back) close();
  });
  document.body.append(back);
  const focusable = box.querySelector<HTMLElement>('button, input, textarea, select');
  focusable?.focus();
  return close;
}

export function dirOf(text: string): 'rtl' | 'ltr' {
  const ar = text.match(/[؀-ۿ]/g)?.length ?? 0;
  const lat = text.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0;
  return ar > lat ? 'rtl' : 'ltr';
}
