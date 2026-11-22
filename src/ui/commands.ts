// The command panel on the left. The user tells the spider what to do:
// "Take the key points" (whole document or a page range), "Explain this
// section simply", or "Find every 'cloud'". Results link back to their pages.

import type { Explanation } from '../analysis/explain';
import { parseCommand } from '../commands/parse';
import type { Match } from '../hunt/search';
import { snippet } from '../hunt/search';
import { call } from '../worker/client';
import type { App } from './app';
import { dirOf, h } from './dom';
import { t } from './i18n';

interface SearchState {
  query: string;
  matches: Match[];
  index: number;
}

export function installCommands(app: App): void {
  let search: SearchState | null = null;
  let explanation: Explanation | null = null;
  let message: string | null = null;
  let input: HTMLInputElement | null = null;
  let lastValue = '';

  const showMatch = (i: number) => {
    if (!search || !search.matches.length) return;
    search.index = (i + search.matches.length) % search.matches.length;
    const m = search.matches[search.index];
    app.view.highlights = app.view.highlights.filter((x) => x.kind !== 'current');
    app.view.highlights.push({ page: m.page, start: m.start, end: m.end, kind: 'current' });
    app.view.goTo(m.page, m.start, m.end, true);
    app.renderLeft();
  };

  const runFind = async (query: string) => {
    const s = app.state;
    if (!s) return;
    const matches = await call('find', { docId: s.doc.id, query });
    search = { query, matches, index: -1 };
    app.searchLog = app.searchLog.filter((x) => !(x.query === query && x.fileName === s.doc.fileName));
    app.searchLog.push({ query, count: matches.length, pages: [...new Set(matches.map((m) => m.page))], fileName: app.docs.length > 1 ? s.doc.fileName : undefined });
    explanation = null;
    message = matches.length ? null : t('notFound', { word: query });
    app.view.highlights = app.view.highlights.filter((x) => x.kind !== 'match' && x.kind !== 'current');
    for (const m of matches) app.view.highlights.push({ page: m.page, start: m.start, end: m.end, kind: 'match' });
    if (matches.length) showMatch(0);
    else app.renderLeft();
  };

  /** The section the user is looking at: the chunk that holds the page in view. */
  const currentSection = (): { from: number; to: number } => {
    const s = app.state!;
    const page = app.view.pageAt(app.view.scrollY + app.els.canvas.clientHeight * 0.42);
    const chunk = s.analysis?.chunks.find((c) => page >= c.chunk.fromPage && page <= c.chunk.toPage)?.chunk ?? s.chunks.find((c) => page >= c.fromPage && page <= c.toPage);
    return chunk ? { from: chunk.fromPage, to: chunk.toPage } : { from: page, to: page };
  };

  const run = async (text: string) => {
    const s = app.state;
    if (!s) return;
    lastValue = text;
    const cmd = parseCommand(text);
    const total = s.doc.pages.length;
    const clamp = (n: number | undefined, d: number) => Math.max(1, Math.min(total, n ?? d));
    message = null;
    if (cmd.type === 'empty') return;
    if (cmd.type === 'find') return runFind(cmd.query);
    if (cmd.type === 'keypoints') {
      search = null;
      explanation = null;
      const from = clamp(cmd.from, 1);
      const to = clamp(cmd.to, total);
      app.resetCollected();
      await app.analyzeAndWalk(s, { from, to });
      return;
    }
    if (cmd.type === 'explain') {
      const range = cmd.from ? { from: clamp(cmd.from, 1), to: clamp(cmd.to, cmd.from) } : currentSection();
      explanation = await call('explain', { docId: s.doc.id, ...range });
      search = null;
      if (explanation.notFound) message = t('notFound', { word: `${t('pages')} ${range.from}–${range.to}` });
      app.renderLeft();
    }
  };

  app.runCommand = run;
  app.onKeywordClick = (word: string) => {
    void runFind(word);
    if (app.els.workspace.dataset.mobile === 'right') app.mobile('left');
  };

  const section = {
    id: 'commands',
    render: (el: HTMLElement) => {
      el.append(h('h2', {}, `🕷 ${t('commands')}`));
      input = h('input', { type: 'text', value: lastValue, placeholder: t('commandPlaceholder'), 'aria-label': t('commands'), dir: 'auto' });
      const form = h(
        'form',
        {
          style: { display: 'flex', gap: '6px' },
          onsubmit: (e: Event) => {
            e.preventDefault();
            void run(input!.value);
          },
        },
        input,
        h('button', { class: 'btn primary', type: 'submit', disabled: !app.state }, t('run')),
      );
      el.append(form);
      el.append(
        h(
          'div',
          { class: 'chips', style: { margin: '6px 0' } },
          h('button', { class: 'chip', disabled: !app.state, onclick: () => void run(t('cmdKeyPoints')) }, t('cmdKeyPoints')),
          h('button', { class: 'chip', disabled: !app.state, onclick: () => void run(t('cmdExplain')) }, t('cmdExplain')),
          h('button', { class: 'chip', disabled: !app.state, onclick: () => input?.focus() }, t('cmdFind')),
        ),
      );
      if (message) el.append(h('div', { class: 'warn-box', role: 'status' }, message));
      if (search && search.matches.length) {
        const s = app.state!;
        el.append(
          h(
            'div',
            { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' } },
            h('strong', { dir: 'auto' }, t('matches', { word: search.query, n: search.matches.length })),
            h('button', { class: 'btn small', onclick: () => showMatch(search!.index - 1), 'aria-keyshortcuts': 'P' }, `◀ ${t('prev')}`),
            h('span', { class: 'muted' }, `${search.index + 1}/${search.matches.length}`),
            h('button', { class: 'btn small', onclick: () => showMatch(search!.index + 1), 'aria-keyshortcuts': 'N' }, `${t('next')} ▶`),
          ),
        );
        const list = h('ol', { class: 'kp-list', style: { maxHeight: '240px', overflow: 'auto' } });
        search.matches.slice(0, 300).forEach((m, i) => {
          const page = s.doc.pages[m.page - 1];
          list.append(
            h(
              'li',
              { class: 'kp', style: i === search!.index ? { borderColor: 'var(--accent)' } : {} },
              h('button', { class: 'link', onclick: () => showMatch(i) }, `${t('page')} ${m.page}`),
              h('div', { class: 'text', dir: dirOf(page.text) }, snippet(page, m)),
            ),
          );
        });
        el.append(list);
      }
      if (explanation && !explanation.notFound) {
        const e = explanation;
        const box = h('div', {});
        box.append(h('h3', {}, `${t('cmdExplain')} · ${t('page')} ${e.from}–${e.to}`));
        const list = h('ul', { class: 'kp-list' });
        if (e.spider) list.append(app.keyPointCard(e.spider));
        for (const kp of [...e.definitions, ...e.simple]) list.append(app.keyPointCard(kp, app.keyPointExtras(kp)));
        box.append(list);
        el.append(box);
      }
    },
  };
  app.leftSections.unshift(section);

  const prevKey = app.onKey;
  app.onKey = (e: KeyboardEvent) => {
    if ((e.key === 'n' || e.key === 'N') && search) showMatch(search.index + 1);
    else if ((e.key === 'p' || e.key === 'P') && search) showMatch(search.index - 1);
    else if (e.key === '/') {
      e.preventDefault();
      input?.focus();
    } else prevKey?.(e);
  };
  app.hooks.beforeLoad.push(() => {
    app.searchLog = [];
    search = null;
    explanation = null;
    message = null;
  });
}
