// Two Study sections for textbooks:
// - "Definitions": flip cards made from the book's own Definition / Theorem /
//   Rule boxes and "is called the …" sentences.
// - "Worked examples": the coach shows the book's example task, the student
//   thinks of the next step, then reveals the book's step, one at a time.
// When a card or step holds a formula, the real page picture is one tap away,
// because PDF text breaks formulas.

import { definitionCards, workedExamples, type DefinitionCard, type WorkedExample } from '../study/blocks';
import { suggestTopics } from '../study/practice';
import type { App } from './app';
import { dirOf, h } from './dom';
import { t } from './i18n';

export function installTextbook(app: App): void {
  // ---------------------------------------------------------------- definitions
  let deck: { docId: string; cards: DefinitionCard[] } | null = null;
  let index = 0;
  let flipped = false;
  let known = 0;

  const pagesInRange = () => {
    const s = app.state;
    if (!s) return [];
    return s.doc.pages.filter((p) => p.number >= s.range.from && p.number <= s.range.to);
  };

  const formulaNote = (page: number) => {
    const s = app.state;
    return h(
      'div',
      { class: 'formula-row' },
      h('span', { class: 'badge formula' }, `🧮 ${t('formulaBadge')}`),
      s && app.canShowPage(s.doc.id) ? h('button', { class: 'link', onclick: () => void app.showRealPage(s.doc.id, page) }, `📷 ${t('realPage')}`) : null,
    );
  };

  app.studySections.push({
    id: 'definitions',
    label: () => `📐 ${t('definitions')}`,
    render: (el) => {
      const s = app.state;
      if (!s) return;
      if (!deck || deck.docId !== s.doc.id) {
        deck = { docId: s.doc.id, cards: definitionCards(pagesInRange()) };
        index = 0;
        flipped = false;
        known = 0;
      }
      const cards = deck.cards;
      if (!cards.length) {
        el.append(h('p', { class: 'muted' }, t('noDefinitions')));
        return;
      }
      if (index >= cards.length) {
        el.append(
          h('p', {}, `✅ ${t('deckDone', { n: known, total: cards.length })}`),
          h('button', { class: 'btn primary', onclick: () => { index = 0; known = 0; flipped = false; app.renderRight(); } }, `🔁 ${t('again')}`),
        );
        return;
      }
      const c = cards[index];
      const kindLabel = t(c.kind === 'definition' ? 'kindDefinition' : c.kind === 'theorem' ? 'kindTheorem' : 'kindRule');
      el.append(h('p', { class: 'muted', style: { marginTop: '0' } }, `${index + 1} / ${cards.length}`));
      const card = h(
        'div',
        { class: 'kp def-card', role: 'button', tabindex: '0', 'aria-label': t('flip'), onclick: () => { flipped = !flipped; app.renderRight(); } },
        h('div', { class: 'muted' }, `${kindLabel} · ${t('page')} ${c.page}`),
        h('p', { class: 'def-term', dir: dirOf(c.term) }, c.term),
        flipped ? h('p', { dir: dirOf(c.text) }, c.text) : h('p', { class: 'muted' }, `👆 ${t('defRecall')}`),
      );
      card.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), card.click()));
      el.append(card);
      if (flipped && c.formula) el.append(formulaNote(c.page));
      const move = (knew: boolean) => {
        if (knew) known++;
        index++;
        flipped = false;
        app.renderRight();
      };
      el.append(
        h(
          'div',
          { class: 'actions', style: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
          flipped
            ? [h('button', { class: 'btn primary', onclick: () => move(true) }, `✅ ${t('know')}`), h('button', { class: 'btn', onclick: () => move(false) }, `🔁 ${t('again')}`)]
            : h('button', { class: 'btn primary', onclick: () => { flipped = true; app.renderRight(); } }, `🔄 ${t('flip')}`),
        ),
      );
    },
  });

  // ---------------------------------------------------------------- worked examples
  let examples: { docId: string; list: WorkedExample[] } | null = null;
  let open: string | null = null;
  let shown = 0;
  const notes = new Map<string, string>();

  app.studySections.push({
    id: 'examples',
    label: () => `📝 ${t('workedExamples')}`,
    render: (el) => {
      const s = app.state;
      if (!s) return;
      if (!examples || examples.docId !== s.doc.id) {
        examples = { docId: s.doc.id, list: workedExamples(pagesInRange()) };
        open = null;
        shown = 0;
      }
      const list = examples.list;
      if (!list.length) {
        el.append(h('p', { class: 'muted' }, t('noExamples')));
        return;
      }
      const ex = list.find((e) => e.id === open);
      if (!ex) {
        el.append(h('p', { class: 'muted', style: { marginTop: '0' } }, t('examplesIntro')));
        el.append(
          h(
            'ul',
            { class: 'kp-list' },
            ...list.map((e) =>
              h(
                'li',
                { class: 'kp' },
                h('div', { class: 'meta' }, h('strong', {}, e.label), h('span', { class: 'muted' }, ` · ${t('page')} ${e.page} · ${t('stepsCount', { n: e.steps.length })}`)),
                h('div', { class: 'text', dir: dirOf(e.problem) }, e.problem),
                h('button', { class: 'btn small primary', onclick: () => { open = e.id; shown = 0; app.renderRight(); } }, `▶ ${t('coachStart')}`),
              ),
            ),
          ),
        );
        return;
      }
      el.append(h('button', { class: 'link', onclick: () => { open = null; app.renderRight(); } }, `← ${t('allExamples')}`));
      el.append(h('h3', {}, `${ex.label} · ${t('page')} ${ex.page}`));
      el.append(h('p', { class: 'kp', dir: dirOf(ex.problem), style: { fontSize: '17px' } }, ex.problem));
      if (ex.formula) el.append(formulaNote(ex.page));
      const steps = h('ol', { class: 'steps' }, ...ex.steps.slice(0, shown).map((st) => h('li', { dir: dirOf(st) }, st)));
      el.append(steps);
      if (shown < ex.steps.length) {
        // Think first, then look: trying before seeing the answer is what makes it stick.
        const area = h('textarea', { rows: 2, dir: 'auto', placeholder: t(shown === 0 ? 'coachFirst' : 'coachNext'), 'aria-label': t(shown === 0 ? 'coachFirst' : 'coachNext') }, notes.get(`${ex.id}:${shown}`) ?? '') as HTMLTextAreaElement;
        area.addEventListener('input', () => notes.set(`${ex.id}:${shown}`, area.value));
        el.append(
          h('p', { style: { fontWeight: '600' } }, `🤔 ${t(shown === 0 ? 'coachFirst' : 'coachNext')}`),
          area,
          h('button', { class: 'btn primary small', style: { marginTop: '6px' }, onclick: () => { shown++; app.renderRight(); } }, `👀 ${t('showStep', { n: shown + 1, total: ex.steps.length })}`),
        );
      } else {
        el.append(h('p', { role: 'status' }, `✅ ${t('coachDone')}`));
        // The example alone may not say "quadratic", but the page around it does.
        const pageText = s.doc.pages.find((pg) => pg.number === ex.page)?.text ?? '';
        const topic = suggestTopics(`${ex.problem} ${ex.steps.join(' ')}`)[0] ?? suggestTopics(pageText)[0];
        const row = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
        if (topic && app.startPractice) row.append(h('button', { class: 'btn primary', onclick: () => app.startPractice?.(topic) }, `🧮 ${t('practiceLikeThis')}`));
        row.append(h('button', { class: 'btn', onclick: () => { shown = 0; app.renderRight(); } }, `🔁 ${t('again')}`));
        el.append(row);
      }
    },
  });
}
