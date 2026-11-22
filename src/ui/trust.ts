// Two trust features on every key point card:
// - 🔍 Check: goes to the exact sentence, makes it blink, and says
//   "word for word on page 3, line 12" so the student can find it in the book.
// - 🔗 Also in (Library mode): the same idea in another file, one tap away.
//   The Library tab lists all of them: "Ideas in both files".

import { checkQuote } from '../analysis/quotecheck';
import { sharedIdeas, type SharedIdea } from '../analysis/overlap';
import type { KeyPoint } from '../core/types';
import type { App } from './app';
import { dirOf, h, toast } from './dom';
import { t } from './i18n';

const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function installTrust(app: App): void {
  const go = (docId: string, page: number, start: number, end: number) => {
    app.jumpTo(docId, page, start, end);
    app.view.flash(page, start, end);
  };

  // ---------------------------------------------------------------- check this quote
  app.cardButtons.push((kp: KeyPoint) =>
    h(
      'button',
      {
        class: 'link',
        title: t('checkTitle'),
        onclick: () => {
          const d = app.docs.find((x) => x.doc.id === kp.source.docId);
          if (!d) return;
          const r = checkQuote(d.doc.pages, kp);
          go(kp.source.docId, r.page, r.start, r.end);
          if (!r.exact) toast(`⚠️ ${t('checkMissing', { page: r.page })}`, 7000);
          else toast(`✅ ${t(kp.kind === 'quote' ? 'checkOk' : 'checkSource', { page: r.page, line: r.line })}`, 6000);
        },
      },
      `🔍 ${t('check')}`,
    ),
  );

  // ---------------------------------------------------------------- in both files
  let cache: { key: string; map: Map<string, SharedIdea> } | null = null;
  const ideas = (): Map<string, SharedIdea> => {
    const ready = app.docs.filter((d) => d.analysis);
    if (app.docs.length < 2 || ready.length < 2) return new Map();
    const key = ready.map((d) => `${d.doc.id}:${d.analysis!.chunks.reduce((n, c) => n + c.keyPoints.length, 0)}`).join('|');
    if (cache?.key !== key) {
      cache = {
        key,
        map: sharedIdeas(ready.map((d) => ({ docId: d.doc.id, fileName: d.doc.fileName, pages: d.doc.pages, keyPoints: d.analysis!.chunks.flatMap((c) => c.keyPoints) }))),
      };
    }
    return cache.map;
  };
  app.hooks.beforeLoad.push(() => (cache = null));

  const openIdea = (s: SharedIdea) => {
    go(s.docId, s.page, s.start, s.end);
    toast(`🔗 ${t('bothWords', { words: s.shared.slice(0, 6).join(', ') })}`, 6000);
  };

  app.cardButtons.push((kp: KeyPoint) => {
    const s = ideas().get(kp.id);
    if (!s) return null;
    return h('button', { class: 'link both-link', title: s.text, onclick: () => openIdea(s) }, `🔗 ${t('alsoIn', { file: s.fileName, page: s.page })}`);
  });

  const library = app.tabs.find((x) => x.id === 'library');
  if (library) {
    const inner = library.render;
    library.render = (el) => {
      inner(el);
      if (app.docs.length < 2) return;
      const map = ideas();
      const points = new Map<string, KeyPoint>();
      for (const d of app.docs) for (const c of d.analysis?.chunks ?? []) for (const kp of c.keyPoints) points.set(kp.id, kp);
      // A→B and B→A are the same pair: show it once.
      const seen = new Set<string>();
      const pairs = [...map.values()]
        .filter((s) => points.has(s.kpId))
        .sort((a, b) => b.score - a.score)
        .filter((s) => {
          const kp = points.get(s.kpId)!;
          const ends = [`${kp.source.docId}:${kp.source.page}:${kp.source.start}`, `${s.docId}:${s.page}:${s.start}`].sort().join('|');
          if (seen.has(ends)) return false;
          seen.add(ends);
          return true;
        });
      el.append(h('h3', {}, `🔗 ${t('bothTitle')} · ${pairs.length}`));
      if (!pairs.length) {
        el.append(h('p', { class: 'muted' }, app.docs.every((d) => d.analysis) ? t('bothNone') : `${t('analyzing')}…`));
        return;
      }
      el.append(h('p', { class: 'muted', style: { marginTop: '0' } }, t('bothIntro')));
      const list = h('ul', { class: 'kp-list' });
      for (const s of pairs.slice(0, 30)) {
        const kp = points.get(s.kpId)!;
        const from = app.fileLabel(kp.source.docId) ?? '';
        list.append(
          h(
            'li',
            { class: 'kp both-pair' },
            h('button', { class: 'link', onclick: () => go(kp.source.docId, kp.source.page, kp.source.start, kp.source.end) }, `📄 ${from} · ${t('page')} ${kp.source.page}`),
            h('div', { class: 'text', dir: dirOf(kp.source.text) }, short(kp.source.text)),
            h('button', { class: 'link', onclick: () => openIdea(s) }, `📄 ${s.fileName} · ${t('page')} ${s.page}`),
            h('div', { class: 'text', dir: dirOf(s.text) }, short(s.text)),
            h('div', { class: 'muted', style: { fontSize: '12px' } }, `${t('sharedWords')}: ${s.shared.slice(0, 8).join(', ')}`),
          ),
        );
      }
      el.append(list);
    };
  }
}
