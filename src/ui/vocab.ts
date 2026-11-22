// Vocabulary colors. While the spider picks the key points, the most
// interesting words of the document are colored on every page, each word in
// its own color, with matching chips in the Keywords tab. Seeing "gateway" in
// green on every page makes it easy to spot how the word is used.

import { topicTerms } from '../analysis/topic';
import { call } from '../worker/client';
import type { App, DocState } from './app';
import { h } from './dom';
import { t } from './i18n';

/** Eight colors that stay apart from each other in light and dark themes. */
const PALETTE = ['#e8590c', '#2f9e44', '#1c7ed6', '#ae3ec9', '#f08c00', '#d6336c', '#0c8599', '#7048e8'];
const HOW_MANY = 8;
const STORE_KEY = 'ankabut.vocabColors';

export interface VocabColor {
  /** Solid color, for the chip border. */
  solid: string;
  /** See-through color, painted under the word on the page. */
  fill: string;
}

function fill(hex: string, a = 0.3): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function loadOn(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveOn(on: boolean): void {
  try {
    localStorage.setItem(STORE_KEY, on ? 'on' : 'off');
  } catch {
    // Private windows can block storage. The switch still works for this visit.
  }
}

/** The vocabulary words of a document and their colors, strongest first. */
export function vocabPlan(keywords: import('../core/types').Keyword[]): { term: string; color: VocabColor }[] {
  return topicTerms(keywords, HOW_MANY).map((term, i) => {
    const solid = PALETTE[i % PALETTE.length];
    return { term, color: { solid, fill: fill(solid) } };
  });
}

export function installVocab(app: App): void {
  let on = loadOn();

  const clear = () => {
    app.vocabColors.clear();
    app.view.highlights = app.view.highlights.filter((x) => x.kind !== 'vocab');
  };

  const apply = async (state: DocState) => {
    clear();
    if (!on || !state.analysis) return app.renderRight();
    const plan = vocabPlan(state.analysis.keywords);
    const terms = plan.map((v) => v.term);
    if (!terms.length) return;
    const report = await call('hunt', { docId: state.doc.id, terms, range: state.range });
    // The user may have opened another file while we searched.
    if (app.state !== state) return;
    const marks = report.results.flatMap((r, i) => {
      const color = plan[i]?.color ?? { solid: PALETTE[0], fill: fill(PALETTE[0]) };
      app.vocabColors.set(terms[i] ?? r.term, color);
      return r.matches.map((m) => ({ page: m.page, start: m.start, end: m.end, kind: 'vocab' as const, color: color.fill }));
    });
    // Vocabulary goes first, so key point and search highlights are painted on top of it.
    app.view.highlights = [...marks, ...app.view.highlights.filter((x) => x.kind !== 'vocab')];
    app.renderRight();
  };

  app.vocabEnabled = () => on;

  app.vocabToggle = () => {
    const box = h('input', { type: 'checkbox', checked: on });
    box.addEventListener('change', () => {
      on = box.checked;
      saveOn(on);
      if (app.state) void apply(app.state);
      else clear();
    });
    return h('label', { class: 'chip', style: { cursor: 'pointer', marginBottom: '8px' } }, box, ` 🖍 ${t('vocabColors')}`);
  };

  app.hooks.afterAnalysis.push((s) => void apply(s));
  app.hooks.beforeLoad.push(clear);
}
