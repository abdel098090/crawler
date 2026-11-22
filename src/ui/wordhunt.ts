// Word Hunt mode: a small game. The user lists words before (or during) a
// read, the spider hunts every match across the whole book, and a live score
// shows words found, pages searched and time taken. At the end a results
// table can be exported as CSV or Markdown.

import { huntToCsv, huntToMarkdown } from '../export/hunt';
import { parseTerms, type HuntReport, type Match } from '../hunt/search';
import type { Stop } from '../render/route';
import { call } from '../worker/client';
import type { App } from './app';
import { download, h } from './dom';
import { t } from './i18n';

export interface HuntState {
  terms: string[];
  reports: HuntReport[];
  caught: number;
  totalMatches: number;
  pagesSeen: Set<string>;
  startedAt: number;
  endedAt: number | null;
  foundTerms: Set<string>;
}

export function installWordHunt(app: App): void {
  let draft = '';
  let state: HuntState | null = null;
  let timer = 0;

  const scoreLine = () => {
    if (!state) return null;
    const secs = (((state.endedAt ?? performance.now()) - state.startedAt) / 1000).toFixed(1);
    const totalPages = app.docs.reduce((n, d) => n + (d.range.to - d.range.from + 1), 0);
    return h(
      'div',
      { class: 'chips', role: 'status', 'aria-live': 'polite', style: { margin: '8px 0' } },
      h('span', { class: 'chip' }, `🎯 ${t('found')}: ${state.foundTerms.size}/${state.terms.length} · ${state.caught}/${state.totalMatches}`),
      h('span', { class: 'chip' }, `📄 ${t('searched')}: ${Math.min(state.pagesSeen.size, totalPages)}/${totalPages}`),
      h('span', { class: 'chip' }, `⏱ ${t('time')}: ${secs}s`),
    );
  };

  const resultsTable = (reports: HuntReport[]) => {
    const multi = reports.length > 1;
    const table = h('table', {}, h('tr', {}, multi ? h('th', {}, t('file')) : null, h('th', {}, t('word')), h('th', {}, t('count')), h('th', {}, t('pages'))));
    for (const r of reports) {
      for (const x of r.results) {
        table.append(
          h(
            'tr',
            {},
            multi ? h('td', {}, r.fileName ?? '') : null,
            h('td', { dir: 'auto' }, x.term),
            h('td', {}, String(x.count)),
            h(
              'td',
              {},
              x.count
                ? x.pages.slice(0, 40).map((p, i) =>
                    h('button', { class: 'link', onclick: () => jump(r, x.matches.find((m) => m.page === p)!) }, `${i ? ', ' : ''}${p}`),
                  )
                : h('span', { class: 'muted' }, '—'),
              x.pages.length > 40 ? ` … (+${x.pages.length - 40})` : '',
            ),
          ),
        );
      }
    }
    return table;
  };

  const jump = (r: HuntReport, m: Match) => app.jumpTo(r.docId ?? app.state!.doc.id, m.page, m.start, m.end);

  const render = (el: HTMLElement) => {
    el.append(h('h2', {}, `🎯 ${t('wordHunt')}`));
    const area = h('textarea', { rows: 4, placeholder: t('huntPlaceholder'), 'aria-label': t('huntPlaceholder'), dir: 'auto' }, draft);
    area.addEventListener('input', () => (draft = area.value));
    el.append(area, h('button', { class: 'btn primary', style: { marginTop: '6px' }, disabled: !app.state, onclick: () => void start(area.value) }, t('huntStart')));
    const score = scoreLine();
    if (score) el.append(score);
    if (state && state.endedAt !== null) {
      el.append(resultsTable(state.reports));
      const name = (app.docs.length > 1 ? 'library' : app.state?.doc.fileName ?? 'ankabut').replace(/\.[^.]+$/, '');
      el.append(
        h(
          'div',
          { class: 'chips', style: { marginTop: '8px' } },
          h('button', { class: 'btn small', onclick: () => download(`${name}-word-hunt.csv`, huntToCsv(state!.reports), 'text/csv;charset=utf-8') }, t('exportCsv')),
          h('button', { class: 'btn small', onclick: () => download(`${name}-word-hunt.md`, huntToMarkdown(state!.reports), 'text/markdown;charset=utf-8') }, t('exportMd')),
        ),
      );
    }
  };

  const start = async (input: string) => {
    const terms = parseTerms(input);
    if (!terms.length || !app.docs.length) return;
    draft = input;
    const reports: HuntReport[] = [];
    for (const d of app.docs) reports.push(await call('hunt', { docId: d.doc.id, terms, range: d.range }));
    state = {
      terms,
      reports,
      caught: 0,
      totalMatches: reports.reduce((n, r) => n + r.results.reduce((m, x) => m + x.count, 0), 0),
      pagesSeen: new Set(),
      startedAt: performance.now(),
      endedAt: null,
      foundTerms: new Set(),
    };
    app.activeTab = 'hunt';
    window.clearInterval(timer);
    timer = window.setInterval(() => app.activeTab === 'hunt' && app.renderRight(), 250);
    app.lastHunt = reports;
    await app.huntWalk(state);
    window.clearInterval(timer);
    app.renderRight();
  };

  /** Walks the spider over every match, one document after another (Library mode). */
  app.huntWalk = async (hs: HuntState) => {
    for (const report of hs.reports) {
      const docIndex = app.docs.findIndex((d) => d.doc.id === report.docId);
      if (docIndex >= 0 && docIndex !== app.active) app.switchDoc(docIndex);
      const all: { m: Match; term: string }[] = [];
      for (const r of report.results) for (const m of r.matches) all.push({ m, term: r.term });
      all.sort((a, b) => a.m.page - b.m.page || a.m.start - b.m.start);
      const stops: Stop[] = all.map((x, i) => ({ page: x.m.page, start: x.m.start, end: x.m.end, kind: 'match', ref: i }));
      app.view.highlights = app.view.highlights.filter((x) => x.kind !== 'match');
      const range = app.docs[docIndex]?.range;
      await new Promise<void>((resolve) => {
        app.view.walk(
          stops,
          {
            onArrive: (s) => {
              app.view.highlights.push({ page: s.page, start: s.start, end: s.end, kind: 'match' });
              // A glowing outline box around the match...
              app.view.huntBox(s.page, s.start, s.end);
            },
            onFinish: (s, screen) => {
              hs.caught++;
              hs.foundTerms.add(all[s.ref].term);
              // ...then the spider bites it with a small flash (skipped when effects are off).
              if (screen.x >= 0) app.view.bite(s.page, s.start, s.end);
            },
            onPage: (p) => {
              // Pages between matches were searched too.
              const from = range?.from ?? 1;
              for (let n = from; n <= p; n++) hs.pagesSeen.add(`${report.docId}:${n}`);
            },
            onDone: () => resolve(),
          },
          range,
        );
      });
      if (range) for (let n = range.from; n <= range.to; n++) hs.pagesSeen.add(`${report.docId}:${n}`);
    }
    hs.endedAt = performance.now();
    // Back to the first match, so the user can start reading from there.
    const firstReport = hs.reports.find((r) => r.results.some((x) => x.matches.length));
    if (firstReport) {
      const first = firstReport.results.flatMap((x) => x.matches).sort((a, b) => a.page - b.page || a.start - b.start)[0];
      jump(firstReport, first);
    }
    app.events.emit('hunt-done', { found: hs.caught });
    if (hs.caught) app.view.spider.celebrate();
  };

  app.tabs.splice(1, 0, { id: 'hunt', label: () => `🎯 ${t('wordHunt')}`, render });
  app.hooks.beforeLoad.push(() => {
    app.lastHunt = null;
    state = null;
  });
}
