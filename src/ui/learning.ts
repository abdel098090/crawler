// The remaining learning science ideas, in the interface:
//  2. Illusion of knowing: after reading, a quick 3-question check is offered.
//  6. Use it: tasks that ask the learner to apply an idea.
// 11. Timed challenge: a 60-second speed round with instant feedback.
// 12. Emotion: the spider reacts with short friendly lines and small celebrations.
// 15. Protege effect: the spider "learns" the ideas the learner teaches it.
// (4, 8, 9, 10 and 13 were built earlier: instant feedback, mind map, focus mode,
//  interleaving and adaptive difficulty. 1, 3, 7 and 14 too.)
// 5. Games are not magic: every game here asks for recall or use, never just watching.

import type { Lang } from '../core/types';
import { applyTasks, spiderLevel, spiderLine, teachSpider, usesKeyword, type SpiderMind } from '../study/learning';
import { checkAnswer, generateQuiz, type Question } from '../study/quiz';
import type { App } from './app';
import { dirOf, h } from './dom';
import { getUiLang, t } from './i18n';

const L: Record<string, Record<Lang, string>> = {
  quickCheck: { en: 'Quick check: 3 questions', fr: 'Vérification rapide : 3 questions', ar: 'تحقق سريع: 3 أسئلة', es: 'Repaso rápido: 3 preguntas' },
  quickWhy: { en: 'Watching feels like learning, but recall is what sticks.', fr: 'Regarder donne l’impression d’apprendre, mais c’est le rappel qui fixe.', ar: 'المشاهدة تشعرك بالتعلم، لكن الاسترجاع هو ما يثبت.', es: 'Mirar parece aprender, pero recordar es lo que se queda.' },
  useIt: { en: 'Use it', fr: 'Appliquer', ar: 'طبق', es: 'Aplícalo' },
  speed: { en: 'Speed round', fr: 'Course contre la montre', ar: 'جولة سريعة', es: 'Ronda rápida' },
  yourSpider: { en: 'Your spider learned {n} of {total} key ideas from you', fr: 'Ton araignée a appris {n} idées clés sur {total} grâce à toi', ar: 'تعلم عنكبوتك منك {n} من {total} أفكار رئيسية', es: 'Tu araña aprendió de ti {n} de {total} ideas clave' },
  level: { en: 'Level', fr: 'Niveau', ar: 'المستوى', es: 'Nivel' },
  usedIdea: { en: 'You used the idea. Now compare with the book:', fr: 'Tu as utilisé l’idée. Compare avec le livre :', ar: 'استخدمت الفكرة. قارن الآن مع الكتاب:', es: 'Usaste la idea. Ahora compara con el libro:' },
  notUsed: { en: 'Try to use the word itself in your answer.', fr: 'Essaie d’utiliser le mot lui-même dans ta réponse.', ar: 'حاول أن تستخدم الكلمة نفسها في إجابتك.', es: 'Intenta usar la palabra misma en tu respuesta.' },
};
const tl = (k: string, vars: Record<string, string | number> = {}) =>
  (L[k][getUiLang()] ?? L[k].en).replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? ''));

export function installLearning(app: App): void {
  let n = 0;
  const docLang = (): Lang => app.state?.analysis?.mainLang ?? getUiLang();

  // 12. Personality: reactions to answers and to good progress while reading.
  app.events.on('quiz-answer', (d) => {
    app.view.say(spiderLine(docLang(), Boolean(d.correct), n++));
  });
  const prevCollect = app.collectKeyPoint.bind(app);
  app.collectKeyPoint = (kp) => {
    prevCollect(kp);
    if (app.collected.length % 6 === 0 && !app.settings.fastMode) app.view.say(spiderLine(docLang(), true, n++));
  };

  // 2. Illusion of knowing: pair the reading with a quick check.
  const prevSummary = app.renderSummaryBody.bind(app);
  app.renderSummaryBody = (el, a) => {
    if (app.finished) {
      el.append(
        h(
          'div',
          { class: 'warn-box', style: { borderColor: 'var(--accent)' } },
          h('button', { class: 'btn primary', onclick: () => app.startQuiz?.(3) }, `✅ ${tl('quickCheck')}`),
          h('div', { class: 'muted', style: { marginTop: '4px' } }, tl('quickWhy')),
        ),
      );
    }
    prevSummary(el, a);
  };

  // 6. Use it.
  const answers = new Map<string, { text: string; checked: boolean }>();
  app.studySections.push({
    id: 'apply',
    label: () => `🛠 ${tl('useIt')}`,
    render: (el) => {
      const a = app.state?.analysis;
      if (!a) return;
      for (const task of applyTasks(a.keywords, a.chunks.flatMap((c) => c.keyPoints))) {
        const st = answers.get(task.keyword) ?? { text: '', checked: false };
        answers.set(task.keyword, st);
        const area = h('textarea', { rows: 3, dir: 'auto', 'aria-label': task.prompt }, st.text);
        area.addEventListener('input', () => (st.text = area.value));
        const box = h('div', { class: 'kp', style: { marginBottom: '8px' } }, h('p', { dir: dirOf(task.prompt), style: { marginTop: '0' } }, task.prompt), area);
        box.append(h('button', { class: 'btn small', style: { marginTop: '4px' }, onclick: () => { st.checked = true; app.renderRight(); } }, t('check')));
        if (st.checked) {
          const used = usesKeyword(st.text, task.keyword);
          box.append(h('p', {}, used ? `✓ ${tl('usedIdea')}` : tl('notUsed')));
          if (used && task.evidence) box.append(h('ul', { class: 'kp-list' }, app.keyPointCard(task.evidence)));
        }
        el.append(box);
      }
    },
  });

  // 11. Speed round: 60 seconds, instant feedback after every answer.
  let round: { qs: Question[]; i: number; right: number; endsAt: number; flash: string | null } | null = null;
  let timer = 0;
  app.studySections.push({
    id: 'speed',
    label: () => `⚡ ${tl('speed')}`,
    render: (el) => {
      const a = app.state?.analysis;
      if (!a) return;
      if (!round || Date.now() >= round.endsAt || round.i >= round.qs.length) {
        if (round) {
          el.append(h('h2', {}, `⚡ ${t('score')}: ${round.right}/${round.i}`));
          window.clearInterval(timer);
        }
        el.append(
          h('p', { class: 'muted' }, '⚡ 60 s'),
          h('button', {
            class: 'btn primary',
            onclick: () => {
              round = { qs: generateQuiz(a, { count: 30, difficulty: 'easy', seed: Date.now() }), i: 0, right: 0, endsAt: Date.now() + 60000, flash: null };
              window.clearInterval(timer);
              timer = window.setInterval(() => app.activeTab === 'study' && app.renderRight(), 1000);
              app.renderRight();
            },
          }, t('start')),
        );
        return;
      }
      const r = round;
      const q = r.qs[r.i];
      el.append(h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('strong', {}, `⚡ ${r.right}`), h('span', {}, `${Math.ceil((r.endsAt - Date.now()) / 1000)} s`)));
      if (r.flash) el.append(h('div', { role: 'status', class: 'muted' }, r.flash));
      el.append(h('p', { class: 'kp', dir: dirOf(q.prompt) }, q.prompt));
      el.append(
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          ...q.options.map((o) =>
            h('button', {
              class: 'btn',
              dir: 'auto',
              onclick: () => {
                const ok = checkAnswer(q, o);
                if (ok) r.right++;
                r.flash = ok ? `✅ ${t('correct')}` : `❌ ${q.answer} · ${t('page')} ${q.source.page}`;
                r.i++;
                app.events.emit('quiz-answer', { correct: ok, question: q });
                app.renderRight();
              },
            }, o),
          ),
        ),
      );
    },
  });

  // 15. Protege effect: what the learner teaches, the spider learns.
  const mindKey = () => `ankabut.spider.${app.state?.doc.fileName ?? ''}`;
  const loadMind = (): SpiderMind => {
    try {
      return JSON.parse(localStorage.getItem(mindKey()) ?? '{"learned":[]}');
    } catch {
      return { learned: [] };
    }
  };
  let total = 10;
  app.events.on('teach', (d) => {
    total = Number(d.total) || 10;
    const r = teachSpider(loadMind(), (d.mentioned as string[]) ?? []);
    try {
      localStorage.setItem(mindKey(), JSON.stringify(r.mind));
    } catch {
      /* ignore */
    }
    if (r.newlyLearned.length) {
      app.view.say(`🧠 +${r.newlyLearned.length}`);
      app.view.spider.celebrate();
    }
  });
  const teach = app.studySections.find((s) => s.id === 'teach');
  if (teach) {
    const prev = teach.render;
    teach.render = (el) => {
      const mind = loadMind();
      const lv = spiderLevel(mind.learned.length, total);
      el.append(
        h(
          'div',
          { class: 'kp', style: { marginBottom: '8px' } },
          h('strong', {}, `🕷 ${tl('level')} ${lv.level}`),
          ' · ',
          tl('yourSpider', { n: Math.min(mind.learned.length, total), total }),
          h('div', { class: 'bar' }, h('span', { style: { width: `${Math.round(lv.share * 100)}%` } })),
        ),
      );
      prev(el);
    };
  }
}
