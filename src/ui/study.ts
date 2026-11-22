// The Study tab. Learning comes from active work, so this is where the
// learner does things: answers quizzes, writes key points in their own
// words, and explains the topic to the spider.

import type { KeyPoint } from '../core/types';
import type { TeachingResult } from '../study/feedback';
import { compareOwnWords } from '../study/feedback';
import { checkAnswer, generateQuiz, nextDifficulty, type Difficulty, type Question } from '../study/quiz';
import { callAny } from '../worker/client';
import type { App } from './app';
import { dirOf, h } from './dom';
import { t } from './i18n';

export interface StudySection {
  id: string;
  label: () => string;
  render: (el: HTMLElement) => void;
}

interface QuizState {
  pools: Record<Difficulty, Question[]>;
  used: Set<string>;
  difficulty: Difficulty;
  history: boolean[];
  current: Question | null;
  answered: { given: string; correct: boolean } | null;
  right: number;
  asked: number;
}

export function installStudy(app: App): void {
  const sections: StudySection[] = [];
  let active = 'quiz';
  let quiz: QuizState | null = null;
  let own: { kp: KeyPoint; text: string; revealed: boolean } | null = null;
  let ownIndex = 0;
  let teachText = '';
  let teachResult: TeachingResult | null = null;

  const rerender = () => app.renderRight();
  const studyPoints = (): KeyPoint[] => {
    const a = app.state?.analysis;
    if (!a) return [];
    return app.docs.flatMap((d) => d.analysis?.chunks.flatMap((c) => c.keyPoints) ?? []);
  };

  // ------------------------------------------------------------------ quiz
  const startQuiz = () => {
    const a = app.state?.analysis;
    if (!a) return;
    const seed = Math.floor(Math.random() * 1e9);
    const keyPoints = studyPoints();
    const keywords = app.docs.flatMap((d) => d.analysis?.keywords ?? []);
    const make = (difficulty: Difficulty) => generateQuiz(a, { count: 40, difficulty, seed, keyPoints: app.docs.length > 1 ? keyPoints : undefined, keywords });
    quiz = { pools: { easy: make('easy'), medium: make('medium'), hard: make('hard') }, used: new Set(), difficulty: 'medium', history: [], current: null, answered: null, right: 0, asked: 0 };
    nextQuestion();
  };

  const nextQuestion = () => {
    if (!quiz) return;
    const pick = (d: Difficulty) => quiz!.pools[d].find((q) => !quiz!.used.has(q.source.docId + q.source.page + q.source.index));
    const q = pick(quiz.difficulty) ?? pick('medium') ?? pick('easy') ?? pick('hard') ?? null;
    quiz.current = q;
    quiz.answered = null;
    if (q) quiz.used.add(q.source.docId + q.source.page + q.source.index);
    rerender();
  };

  const answer = (given: string) => {
    if (!quiz?.current || quiz.answered) return;
    const correct = checkAnswer(quiz.current, given);
    quiz.answered = { given, correct };
    quiz.asked++;
    if (correct) {
      quiz.right++;
      app.view.spider.celebrate();
    }
    quiz.history.push(correct);
    quiz.difficulty = nextDifficulty(quiz.difficulty, quiz.history);
    app.events.emit('quiz-answer', { correct, question: quiz.current });
    rerender();
  };

  const renderQuiz = (el: HTMLElement) => {
    if (!quiz) {
      el.append(h('p', { class: 'muted' }, '🧠 ', t('quiz')), h('button', { class: 'btn primary', onclick: startQuiz }, t('start')));
      return;
    }
    el.append(h('div', { class: 'muted' }, `${t('score')}: ${quiz.right}/${quiz.asked} · ${quiz.difficulty}`));
    const q = quiz.current;
    if (!q) {
      el.append(h('p', {}, '🎉 ', `${t('score')}: ${quiz.right}/${quiz.asked}`), h('button', { class: 'btn', onclick: startQuiz }, t('start')));
      return;
    }
    el.append(h('p', { class: 'kp', dir: dirOf(q.prompt), style: { fontSize: '15px' } }, q.prompt));
    if (q.options.length) {
      el.append(
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          ...q.options.map((o) =>
            h(
              'button',
              {
                class: 'btn',
                dir: 'auto',
                disabled: !!quiz!.answered,
                style: quiz!.answered && o === q.answer ? { borderColor: 'var(--ok)', borderWidth: '2px' } : quiz!.answered?.given === o ? { borderColor: 'var(--danger)' } : {},
                onclick: () => answer(o),
              },
              o,
            ),
          ),
        ),
      );
    } else {
      const input = h('input', { type: 'text', dir: 'auto', 'aria-label': t('quiz'), disabled: !!quiz.answered });
      el.append(
        h(
          'form',
          {
            style: { display: 'flex', gap: '6px' },
            onsubmit: (e: Event) => {
              e.preventDefault();
              answer(input.value);
            },
          },
          input,
          h('button', { class: 'btn primary', type: 'submit', disabled: !!quiz.answered }, t('check')),
        ),
      );
      setTimeout(() => input.focus(), 0);
    }
    if (quiz.answered) {
      // Instant feedback, always with the page so the learner can verify.
      el.append(
        h(
          'div',
          { class: quiz.answered.correct ? 'kp' : 'warn-box', role: 'status', style: { marginTop: '8px' } },
          h('strong', {}, quiz.answered.correct ? `✅ ${t('correct')}` : `❌ ${t('wrong')}`),
          ' ',
          h('span', { dir: 'auto' }, `→ ${q.answer}`),
          ' · ',
          h('button', { class: 'link', onclick: () => app.jumpTo(q.source.docId, q.source.page, q.source.start, q.source.end) }, t('checkPage', { p: q.source.page })),
        ),
        h('button', { class: 'btn primary', style: { marginTop: '8px' }, onclick: nextQuestion }, t('nextQuestion')),
      );
    }
  };

  // ------------------------------------------------------------- own words
  const pickOwn = () => {
    const pts = studyPoints().filter((k) => k.keywords.length);
    if (!pts.length) return;
    own = { kp: pts[ownIndex % pts.length], text: '', revealed: false };
    ownIndex++;
    rerender();
  };

  const renderOwn = (el: HTMLElement) => {
    if (!own) {
      el.append(h('p', { class: 'muted' }, '✍️ ', t('ownWords')), h('button', { class: 'btn primary', onclick: pickOwn, disabled: !studyPoints().length }, t('start')));
      return;
    }
    const o = own;
    // The learner sees only the topic and page, not the sentence, and writes first.
    el.append(
      h('p', {}, `${t('pageLong')} ${o.kp.source.page} · `, h('strong', { dir: 'auto' }, o.kp.keywords.join(', '))),
    );
    const area = h('textarea', { rows: 4, dir: 'auto', 'aria-label': t('ownWords'), placeholder: t('ownWords') }, o.text);
    area.addEventListener('input', () => (o.text = area.value));
    el.append(area);
    if (!o.revealed) {
      el.append(
        h(
          'button',
          {
            class: 'btn primary',
            style: { marginTop: '6px' },
            onclick: () => {
              if (!o.text.trim()) return area.focus();
              o.revealed = true;
              app.events.emit('own-words', {});
              rerender();
            },
          },
          t('showSpider'),
        ),
      );
      return;
    }
    const r = compareOwnWords(o.text, o.kp);
    el.append(
      h('ul', { class: 'kp-list', style: { marginTop: '8px' } }, app.keyPointCard(o.kp)),
      h('div', { class: 'chips', style: { margin: '6px 0' } }, ...r.covered.map((c) => h('span', { class: 'chip', style: { borderColor: 'var(--ok)' } }, `✓ ${c}`))),
      r.missing.length ? h('p', { class: 'muted' }, t('missing')) : h('p', {}, `🎉 ${t('greatJob')}`),
      h('div', { class: 'chips' }, ...r.missing.map((c) => h('span', { class: 'chip', style: { borderColor: 'var(--amber)' } }, c))),
      h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: pickOwn }, t('nextQuestion')),
    );
  };

  // ----------------------------------------------------------------- teach
  const checkTeach = async () => {
    const s = app.state;
    if (!s?.analysis || !teachText.trim()) return;
    teachResult = await callAny<TeachingResult>('teach', {
      docId: s.doc.id,
      text: teachText,
      keywords: s.analysis.keywords,
      keyPoints: s.analysis.chunks.flatMap((c) => c.keyPoints),
    });
    app.events.emit('teach', { score: teachResult.score });
    rerender();
  };

  const renderTeach = (el: HTMLElement) => {
    el.append(h('p', { class: 'muted' }, '🕷💬 ', t('teach')));
    const area = h('textarea', { rows: 6, dir: 'auto', 'aria-label': t('teach'), placeholder: t('teach') }, teachText);
    area.addEventListener('input', () => (teachText = area.value));
    el.append(area, h('button', { class: 'btn primary', style: { marginTop: '6px' }, onclick: () => void checkTeach(), disabled: !app.state?.analysis }, t('check')));
    const r = teachResult;
    if (!r) return;
    el.append(h('div', { class: 'bar', title: `${Math.round(r.score * 100)}%` }, h('span', { style: { width: `${Math.round(r.score * 100)}%` } })));
    if (r.mentioned.length) el.append(h('div', { class: 'chips', style: { margin: '6px 0' } }, ...r.mentioned.map((m) => h('span', { class: 'chip', style: { borderColor: 'var(--ok)' } }, `✓ ${m}`))));
    if (!r.gaps.length && !r.notInDocument.length && !r.numbersNotFound.length) el.append(h('p', {}, `🎉 ${t('greatJob')}`));
    if (r.gaps.length) {
      el.append(h('p', {}, t('missing')));
      const list = h('ul', { class: 'kp-list' });
      // One card per evidence sentence, with every missing idea it explains.
      const groups = new Map<string, { evidence: KeyPoint | null; words: string[] }>();
      for (const g of r.gaps.slice(0, 6)) {
        const key = g.evidence?.id ?? `none:${g.keyword}`;
        if (!groups.has(key)) groups.set(key, { evidence: g.evidence, words: [] });
        groups.get(key)!.words.push(g.keyword);
      }
      for (const g of groups.values()) {
        const chips = h('div', { class: 'chips', style: { marginTop: '4px' } }, ...g.words.map((w) => h('span', { class: 'chip' }, w)));
        list.append(g.evidence ? app.keyPointCard(g.evidence, chips) : h('li', { class: 'kp' }, chips));
      }
      el.append(list);
    }
    if (r.notInDocument.length) el.append(h('div', { class: 'warn-box' }, t('notInDoc'), ' ', h('strong', { dir: 'auto' }, r.notInDocument.join(', '))));
    if (r.numbersNotFound.length) el.append(h('div', { class: 'warn-box' }, t('numbersNotFound'), ' ', h('strong', {}, r.numbersNotFound.join(', '))));
  };

  sections.push(
    { id: 'quiz', label: () => `🧠 ${t('quiz')}`, render: renderQuiz },
    { id: 'own', label: () => `✍️ ${t('ownWords')}`, render: renderOwn },
    { id: 'teach', label: () => `🕷💬 ${t('teach')}`, render: renderTeach },
  );
  app.studySections = sections;

  app.tabs.splice(2, 0, {
    id: 'study',
    label: () => `🎓 ${t('study')}`,
    render: (el) => {
      if (!app.state?.analysis) {
        el.append(h('p', { class: 'muted' }, t('dropHint')));
        return;
      }
      el.append(
        h(
          'div',
          { class: 'tabs' },
          ...sections.map((s) =>
            h(
              'button',
              {
                'aria-selected': String(s.id === active),
                onclick: () => {
                  active = s.id;
                  rerender();
                },
              },
              s.label(),
            ),
          ),
        ),
      );
      const body = h('div', {});
      (sections.find((s) => s.id === active) ?? sections[0]).render(body);
      el.append(body);
    },
  });
  app.openStudy = (id: string) => {
    active = id;
    app.activeTab = 'study';
    app.renderRight();
  };
  app.hooks.beforeLoad.push(() => {
    quiz = null;
    own = null;
    teachResult = null;
    teachText = '';
  });
}
