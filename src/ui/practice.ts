// The "Practice" section of the Study tab: new problems with new numbers,
// answers calculated by code, worked steps after each answer. Topics that
// match the open book are suggested first.

import { isRight, makeProblem, PRACTICE_TOPICS, suggestTopics, type PracticeTopic, type Problem } from '../study/practice';
import type { App } from './app';
import { dirOf, h } from './dom';
import { getUiLang, t } from './i18n';

const TOPIC_KEY: Record<PracticeTopic, string> = {
  quadratic: 'topicQuadratic',
  linear: 'topicLinear',
  percent: 'topicPercent',
  binary: 'topicBinary',
  subnet: 'topicSubnet',
};

export function installPractice(app: App): void {
  let topic: PracticeTopic | null = null;
  let problem: Problem | null = null;
  let given = '';
  let result: boolean | null = null;
  let score = { right: 0, total: 0 };

  const next = () => {
    if (!topic) return;
    let p = makeProblem(topic, getUiLang(), Date.now() + Math.floor(Math.random() * 1e6));
    // Never the same problem twice in a row.
    for (let i = 0; i < 5 && problem && p.id === problem.id; i++) p = makeProblem(topic, getUiLang(), Date.now() + i * 7919);
    problem = p;
    given = '';
    result = null;
  };

  app.studySections.push({
    id: 'practice',
    label: () => `🧮 ${t('practice')}`,
    render: (el) => {
      const s = app.state;
      const text = s ? `${s.doc.fileName} ${s.analysis?.keywords.map((k) => k.display).join(' ') ?? ''} ${s.doc.pages.slice(0, 30).map((p) => p.text).join(' ')}` : '';
      const suggested = suggestTopics(text);
      const order = [...suggested, ...PRACTICE_TOPICS.filter((x) => !suggested.includes(x))];
      el.append(h('p', { class: 'muted', style: { marginTop: '0' } }, t('practiceIntro')));
      el.append(
        h(
          'div',
          { class: 'chips', role: 'group', 'aria-label': t('practice') },
          ...order.map((x) =>
            h('button', {
              class: `chip${topic === x ? ' active' : ''}`,
              'aria-pressed': String(topic === x),
              onclick: () => {
                topic = x;
                score = { right: 0, total: 0 };
                problem = null;
                next();
                app.renderRight();
              },
            }, `${suggested.includes(x) ? '⭐ ' : ''}${t(TOPIC_KEY[x])}`),
          ),
        ),
      );
      if (suggested.length) el.append(h('p', { class: 'muted', style: { fontSize: '12px' } }, `⭐ ${t('suggestedForFile')}`));
      if (!problem) return;
      const p = problem;
      if (score.total) el.append(h('p', {}, `${t('score')}: ${score.right}/${score.total}`));
      const input = h('input', { type: 'text', dir: 'ltr', value: given, 'aria-label': t('yourAnswer'), placeholder: t('yourAnswer'), style: { width: '100%' } }) as HTMLInputElement;
      input.addEventListener('input', () => (given = input.value));
      const check = () => {
        if (result !== null || !given.trim()) return;
        result = isRight(p, given);
        score = { right: score.right + (result ? 1 : 0), total: score.total + 1 };
        app.renderRight();
      };
      input.addEventListener('keydown', (e) => e.key === 'Enter' && (result === null ? check() : (next(), app.renderRight())));
      const card = h('div', { class: 'kp practice' }, h('p', { dir: dirOf(p.prompt), style: { marginTop: '0', fontSize: '17px' } }, p.prompt), input);
      if (result === null) {
        card.append(h('button', { class: 'btn primary small', style: { marginTop: '6px' }, onclick: check }, t('check')));
      } else {
        card.append(
          h('p', { role: 'status', style: { fontWeight: '600' } }, result ? `✅ ${t('correct')}` : `❌ ${t('wrong')} ${t('rightAnswer')}: ${p.answer}`),
          h('ol', { class: 'steps', dir: dirOf(p.steps.join(' ')) }, ...p.steps.map((st) => h('li', {}, st))),
          h('button', { class: 'btn primary small', onclick: () => { next(); app.renderRight(); } }, `➡ ${t('newProblem')}`),
        );
      }
      el.append(card, h('p', { class: 'muted', style: { fontSize: '12px' } }, `🔒 ${t('practiceNote')}`));
      // Keep typing without clicking again.
      if (result === null) queueMicrotask(() => input.focus({ preventScroll: true }));
    },
  });
}
