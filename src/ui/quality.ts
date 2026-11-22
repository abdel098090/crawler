// The remaining Known problems (5 to 15) that need interface work:
//  7. "Go deeper" on every key point
// 11. Scanned pages: tell the user, and offer OCR
// 15. Accessibility: text size, a keyboard shortcut list, and screen reader
//     announcements for what the spider finds (the canvas itself is silent)

import type { Deeper } from '../analysis/deeper';
import type { KeyPoint } from '../core/types';
import { loadFile } from '../loaders/browser';
import { callAny } from '../worker/client';
import type { App } from './app';
import { h, modal } from './dom';
import { t } from './i18n';

export function installQuality(app: App): void {
  // ------------------------------------------------------------ go deeper
  const deeper = new Map<string, Deeper | 'loading'>();
  const open = new Set<string>();
  const prevExtras = app.keyPointExtras.bind(app);
  app.keyPointExtras = (kp: KeyPoint) => {
    if (kp.kind !== 'quote') return prevExtras(kp);
    const box = h('div', {});
    const isOpen = open.has(kp.id);
    box.append(
      h(
        'button',
        {
          class: 'link',
          'aria-expanded': String(isOpen),
          onclick: async () => {
            if (open.has(kp.id)) open.delete(kp.id);
            else {
              open.add(kp.id);
              if (!deeper.has(kp.id)) {
                deeper.set(kp.id, 'loading');
                deeper.set(kp.id, await callAny<Deeper>('deeper', { kp }));
              }
            }
            app.renderPanels();
          },
        },
        `${isOpen ? '▾' : '▸'} ${t('goDeeper')}`,
      ),
    );
    const d = deeper.get(kp.id);
    if (isOpen && d && d !== 'loading') {
      const list = h('ul', { class: 'kp-list', style: { marginTop: '6px' } });
      for (const x of [d.before, d.after, ...d.related]) if (x) list.append(app.keyPointCard(x));
      if (!list.childElementCount) list.append(h('li', { class: 'muted' }, t('notFound', { word: t('goDeeper') })));
      box.append(list);
    }
    const extra = prevExtras(kp);
    if (extra) box.append(extra);
    return box;
  };

  // ------------------------------------------------------- scanned pages
  const prevAbout = app.renderAbout.bind(app);
  app.renderAbout = (el) => {
    prevAbout(el);
    const s = app.state;
    if (!s) return;
    const scanned = s.doc.pages.filter((p) => p.scanned).length;
    const file = app.files.get(s.doc.id);
    if (scanned && file) {
      el.append(
        h(
          'div',
          { class: 'warn-box' },
          `🖼 ${scanned} ${t('pages').toLowerCase()}: ${t('scannedPages')}`,
          h('br'),
          h(
            'button',
            {
              class: 'btn small',
              style: { marginTop: '6px' },
              onclick: async () => {
                app.setStatus('OCR…');
                try {
                  const doc = await loadFile(file, {
                    ocrScanned: true,
                    onProgress: (d, total) => app.setStatus(`OCR ${t('pageLong')} ${d}/${total}`),
                  });
                  app.files.set(doc.id, file);
                  await app.startDocs([doc]);
                } catch (err) {
                  app.showError(err, file.name);
                }
              },
            },
            t('ocrScanned'),
          ),
          h('div', { class: 'muted' }, t('ocrNote')),
        ),
      );
    }
  };

  // ------------------------------------------------------- accessibility
  const announcer = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'log' });
  document.body.append(announcer);
  const say = (text: string) => {
    announcer.textContent = text;
  };
  const prevCollect = app.collectKeyPoint.bind(app);
  app.collectKeyPoint = (kp) => {
    prevCollect(kp);
    say(`${t('keyFound')} ${t('pageLong')} ${kp.source.page}: ${kp.text}`);
  };

  const sizes = [15, 17, 19, 22, 26];
  const setSize = (delta: number) => {
    const i = Math.max(0, Math.min(sizes.length - 1, sizes.indexOf(app.view.metrics.fontSize) + delta));
    const fontSize = sizes[i] ?? 17;
    app.view.metrics = { ...app.view.metrics, fontSize, lineHeight: Math.round(fontSize * (app.view.metrics.lineFactor ?? 1.7)) };
    app.view.relayout();
    try {
      localStorage.setItem('ankabut.fontSize', String(fontSize));
    } catch {
      /* ignore */
    }
  };
  try {
    const saved = Number(localStorage.getItem('ankabut.fontSize'));
    if (sizes.includes(saved)) app.view.metrics = { ...app.view.metrics, fontSize: saved, lineHeight: Math.round(saved * (app.view.metrics.lineFactor ?? 1.7)) };
  } catch {
    /* ignore */
  }

  const showHelp = () => {
    const rows: [string, string][] = [
      ['Space', `${t('pause')} / ${t('play')}`],
      ['+ / -', `${t('faster')} / ${t('slower')}`],
      ['S', t('skip')],
      ['↑ ↓ PgUp PgDn', 'Scroll'],
      ['/', t('commands')],
      ['N / P', `${t('next')} / ${t('prev')}`],
      ['[ / ]', t('textSize')],
      ['?', t('shortcuts')],
    ];
    const close = modal(
      h(
        'div',
        {},
        h('h2', {}, `⌨ ${t('shortcuts')}`),
        h('table', {}, ...rows.map(([k, v]) => h('tr', {}, h('th', {}, h('kbd', {}, k)), h('td', {}, v)))),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => close() }, t('close'))),
      ),
    );
  };

  app.els.controls.append(
    h('button', { class: 'btn', 'aria-label': `${t('textSize')} −`, title: `${t('textSize')} −`, onclick: () => setSize(-1) }, 'A−'),
    h('button', { class: 'btn', 'aria-label': `${t('textSize')} +`, title: `${t('textSize')} +`, onclick: () => setSize(1) }, 'A+'),
    h('button', { class: 'btn', 'aria-label': t('shortcuts'), title: t('shortcuts'), onclick: showHelp }, '⌨'),
  );
  const prevKey = app.onKey;
  app.onKey = (e) => {
    if (e.key === '[') setSize(-1);
    else if (e.key === ']') setSize(1);
    else if (e.key === '?') showHelp();
    else prevKey?.(e);
  };
}
