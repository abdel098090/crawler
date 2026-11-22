// Library mode (phase 7). Drop several files at once: the spider reads them
// one after another, builds one combined keyword list and one combined
// Word Hunt report, and every key point shows which file and page it is from.

import { mergeKeywords } from '../analysis/library';
import { verifyAnalysis } from '../analysis/verify';
import type { KeyPoint, LoadedDoc } from '../core/types';
import type { Stop } from '../render/route';
import { call } from '../worker/client';
import type { App, DocState } from './app';
import { dirOf, h } from './dom';
import { t } from './i18n';

export function installLibrary(app: App): void {
  const single = app.startDocs.bind(app);

  app.startDocs = async (docs: LoadedDoc[]) => {
    if (docs.length < 2 || !app.isFeatureOn('library')) {
      if (docs.length > 1) app.setStatus(t('premium'));
      return single(docs.slice(0, 1));
    }
    app.hideDrop();
    app.resetCollected();
    const states: DocState[] = [];
    for (const [i, doc] of docs.entries()) {
      app.setStatus(`${t('preparing')} ${i + 1}/${docs.length}: ${doc.fileName}`);
      const prepared = await call('prepare', { doc });
      states.push({ doc, chunks: prepared.chunks, range: { from: 1, to: doc.pages.length } });
    }
    app.docs = states;
    app.active = 0;
    app.view.setPages(states[0].doc.pages);
    app.activeTab = 'library';
    app.renderPanels();
    for (const [i, s] of states.entries()) {
      s.analysis = await call('analyze', { docId: s.doc.id, opts: { chunks: s.chunks } }, (p) => {
        app.setStatus(`${s.doc.fileName} (${i + 1}/${states.length}) · ${t('analyzing')} ${p.chunk}/${p.chunks}`);
      });
      verifyAnalysis(s.doc.pages, s.analysis);
      app.hooks.afterAnalysis.forEach((f) => f(s));
    }
    app.setStatus('');
    app.renderPanels();
    // Walk every file except the last here; the last uses the normal walk, which ends the read.
    for (let i = 0; i < states.length - 1; i++) {
      app.switchDoc(i);
      app.renderCoverage();
      await walkOne(states[i]);
      app.hooks.afterWalk.forEach((f) => f(states[i]));
    }
    app.switchDoc(states.length - 1);
    app.renderCoverage();
    app.walkKeyPoints(states[states.length - 1]);
  };

  const walkOne = (s: DocState) =>
    new Promise<void>((resolve) => {
      const points = s.analysis!.chunks.flatMap((c) => c.keyPoints);
      const stops: Stop[] = points.map((kp, i) => ({ page: kp.source.page, start: kp.source.start, end: kp.source.end, kind: 'key', ref: i }));
      app.walking = true;
      app.view.walk(
        stops,
        {
          onArrive: (st) => app.view.highlights.push({ page: st.page, start: st.start, end: st.end, kind: 'key' }),
          onFinish: (st, screen) => {
            const kp = points[st.ref];
            app.collectKeyPoint(kp);
            for (const w of kp.keywords.slice(0, 3)) app.view.fling(w, screen, () => app.collectKeyword(w, s.analysis!.keywords));
          },
          onPage: (p) => app.renderCoverage({ walkingPage: p }),
          onDone: () => resolve(),
        },
        s.range,
      );
    });

  // Switching files keeps each file's highlights.
  const highlights = new Map<string, typeof app.view.highlights>();
  app.switchDoc = (idx: number) => {
    const cur = app.state;
    if (cur) highlights.set(cur.doc.id, app.view.highlights);
    app.active = idx;
    const s = app.docs[idx];
    app.view.setPages(s.doc.pages);
    app.view.highlights = highlights.get(s.doc.id) ?? [];
    app.renderCoverage();
  };

  // Combined keyword list.
  const prevKeywords = app.renderKeywords.bind(app);
  app.renderKeywords = (el) => {
    const done = app.docs.filter((d) => d.analysis);
    if (done.length < 2 || !app.finished) return prevKeywords(el);
    const merged = mergeKeywords(done.map((d) => ({ docId: d.doc.id, fileName: d.doc.fileName, analysis: d.analysis! })));
    el.append(h('h2', {}, `${t('library')} · ${t('keywords')}`));
    el.append(
      h(
        'div',
        { class: 'chips' },
        ...merged.map((k) =>
          h(
            'button',
            { class: 'chip', dir: dirOf(k.display), title: k.files.map((f) => `${f.fileName}: ${f.count} (${t('page')} ${f.pages.slice(0, 8).join(', ')})`).join('\n'), onclick: () => app.onKeywordClick(k.display) },
            k.display,
            h('b', {}, `${k.count}${k.files.length > 1 ? ` · ${k.files.length}📄` : ''}`),
          ),
        ),
      ),
    );
  };

  // The Library tab: every file, its coverage, and a button to view it.
  app.tabs.push({
    id: 'library',
    label: () => `📚 ${t('library')}`,
    render: (el) => {
      if (app.docs.length < 2) {
        el.append(h('p', { class: 'muted' }, t('dropHint')));
        return;
      }
      const total = app.docs.reduce((n, d) => n + (d.analysis?.coverage.readPages ?? 0), 0);
      const pages = app.docs.reduce((n, d) => n + d.doc.pages.length, 0);
      el.append(h('h2', {}, `📚 ${t('library')} · ${app.docs.length}`), h('p', {}, t('coverage', { read: total, total: pages })));
      const list = h('ul', { class: 'kp-list' });
      app.docs.forEach((d, i) => {
        const points = d.analysis?.chunks.reduce((n, c) => n + c.keyPoints.length, 0) ?? 0;
        list.append(
          h(
            'li',
            { class: 'kp', style: i === app.active ? { borderColor: 'var(--accent)' } : {} },
            h('button', { class: 'link', onclick: () => { app.switchDoc(i); app.renderPanels(); } }, `${i === app.active ? '🕷 ' : ''}${d.doc.fileName}`),
            h('div', { class: 'muted' }, d.analysis ? `${t('coverage', { read: d.analysis.coverage.readPages, total: d.doc.pages.length })} · ${points} ${t('keyPoints').toLowerCase()}` : `${t('analyzing')}…`),
          ),
        );
      });
      el.append(list);
    },
  });

  // Every key point card shows its file in Library mode (Known problem 8).
  const prevCard = app.keyPointCard.bind(app);
  app.keyPointCard = (kp: KeyPoint, extra?: HTMLElement | null, fileName?: string) => prevCard(kp, extra, fileName ?? app.fileLabel(kp.source.docId));
}
