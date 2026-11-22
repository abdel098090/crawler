// Feature roadmap items 1 to 10 (see PROGRESS.md for the plan of each).

import type { GlossaryEntry } from '../analysis/glossary';
import type { Lang } from '../core/types';
import { drawMindMap, layoutMindMap, nodeAt } from '../render/mindmap';
import { emptyProgress, record, streak, type Progress } from '../study/progress';
import { checkAnswer, generateQuiz, type Question } from '../study/quiz';
import { splitSentences } from '../text/tokenize';
import { lookup } from '../translate/dictionary';
import { callAny } from '../worker/client';
import type { App } from './app';
import { dirOf, download, h, modal, toast } from './dom';
import { t } from './i18n';

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function installRoadmap(app: App): void {
  installGlossary(app);
  installTranslate(app);
  installMindMap(app);
  installExam(app);
  installProgress(app);
  installCamera(app);
  installReadAloud(app);
  installVideo(app);
}

// ------------------------------------------------------- 1. Glossary hunter
function installGlossary(app: App): void {
  const cache = new Map<string, GlossaryEntry[]>();
  app.tabs.push({
    id: 'glossary',
    label: () => `📖 ${t('glossary')}`,
    render: (el) => {
      const s = app.state;
      if (!s?.analysis) {
        el.append(h('p', { class: 'muted' }, t('dropHint')));
        return;
      }
      const entries = cache.get(s.doc.id);
      if (!entries) {
        el.append(h('p', { class: 'muted' }, '🕷 …'));
        void callAny<GlossaryEntry[]>('glossary', { docId: s.doc.id, keywords: s.analysis.keywords }).then((g) => {
          cache.set(s.doc.id, g);
          if (app.activeTab === 'glossary') app.renderRight();
        });
        return;
      }
      el.append(h('h2', {}, `📖 ${t('glossary')} (${entries.length})`));
      const list = h('ul', { class: 'kp-list' });
      for (const e of entries) {
        const head = h(
          'div',
          { style: { display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap' } },
          h('button', { class: 'chip', dir: dirOf(e.term), onclick: () => app.onKeywordClick(e.term) }, e.term),
          e.expansion ? h('span', { class: 'muted', dir: 'auto' }, `= ${e.expansion}`) : null,
        );
        if (e.definition) list.append(h('li', {}, head, app.keyPointCard(e.definition)));
        else
          list.append(
            h('li', { class: 'kp' }, head, h('div', { class: 'muted' }, e.pages.length ? `${t('pages')}: ${e.pages.slice(0, 15).join(', ')}` : '')),
          );
      }
      el.append(list);
    },
  });
  app.hooks.beforeLoad.push(() => cache.clear());
}

// ------------------------------------------------------ 2. Translate on tap
type TranslatorLike = { translate(text: string): Promise<string> };
type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorLike>;
};

async function onDeviceTranslate(word: string, from: Lang, to: Lang): Promise<string | null> {
  // Chrome's built-in Translator runs on the device, so the word never leaves it.
  const api = (globalThis as unknown as { Translator?: TranslatorApi }).Translator;
  if (!api) return null;
  try {
    const avail = await api.availability({ sourceLanguage: from, targetLanguage: to });
    if (avail !== 'available') return null;
    const tr = await api.create({ sourceLanguage: from, targetLanguage: to });
    return await tr.translate(word);
  } catch {
    return null;
  }
}

function installTranslate(app: App): void {
  let pop: HTMLElement | null = null;
  const close = () => {
    pop?.remove();
    pop = null;
  };
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  app.view.onWordClick = async (_page, _offset, word, x, y) => {
    close();
    const from: Lang = /[؀-ۿ]/.test(word) ? 'ar' : app.state?.analysis?.languages.includes('fr') && !app.state.analysis.languages.includes('en') ? 'fr' : 'en';
    const rows = h('table', {});
    pop = h(
      'div',
      { class: 'popover', role: 'dialog', 'aria-label': t('translate'), style: { left: `${Math.min(x, innerWidth - 300)}px`, top: `${Math.min(y + 12, innerHeight - 200)}px` } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } }, h('strong', { dir: 'auto' }, word), h('button', { class: 'link', onclick: close, 'aria-label': t('close') }, '✕')),
      rows,
      h('button', { class: 'btn small', style: { marginTop: '6px' }, onclick: () => { close(); app.onKeywordClick(word); } }, `🔎 ${t('cmdFind')}`),
    );
    document.body.append(pop);
    const dict = lookup(word);
    const names: Record<Lang, string> = { en: 'English', fr: 'Français', ar: 'العربية' };
    for (const to of (['en', 'fr', 'ar'] as Lang[]).filter((l) => l !== from)) {
      // Show the offline dictionary answer at once, then upgrade it if the on-device translator answers.
      const cell = h('td', { dir: 'auto' }, dict?.[to] ?? h('span', { class: 'muted' }, t('noTranslation')));
      rows.append(h('tr', {}, h('th', {}, names[to]), cell));
      const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1500));
      void Promise.race([onDeviceTranslate(word, from, to), timeout]).then((v) => {
        if (v && v.toLowerCase() !== word.toLowerCase()) cell.textContent = v;
      });
    }
  };
  app.els.canvas.addEventListener('wheel', close, { passive: true });
}

// --------------------------------------------------------- 5. Mind map
function installMindMap(app: App): void {
  const shownFor = new Set<string>();
  const show = () => {
    const a = app.state?.analysis;
    if (!a) return;
    const size = Math.min(innerWidth - 64, 820);
    const canvas = h('canvas', { width: size * 2, height: Math.round(size * 0.72) * 2, style: { width: '100%', borderRadius: '10px', cursor: 'pointer' }, 'aria-label': t('mindMap') });
    const ctx = canvas.getContext('2d')!;
    const nodes = layoutMindMap(a, canvas.width / 2, canvas.height / 2);
    const scaled = nodes.map((n) => ({ ...n, x: n.x * 2, y: n.y * 2 })); // canvas pixels, for clicks
    const colors = { bg: cssVar('--page-bg', '#fff'), text: cssVar('--page-text', '#1d2428'), silk: cssVar('--silk', '#99a'), accent: cssVar('--accent', '#1f7a7f'), amber: cssVar('--hl-key', '#fde2a6') };
    let p = 0;
    const animate = () => {
      p = app.settings.reducedMotion ? 1 : Math.min(1, p + 0.025);
      drawMindMapScaled(ctx, nodes, colors, p);
      if (p < 1 && canvas.isConnected) requestAnimationFrame(animate);
    };
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const n = nodeAt(scaled, ((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height);
      if (n) {
        closeModal();
        app.onKeywordClick(n.label);
      }
    });
    const closeModal = modal(
      h(
        'div',
        {},
        h('h2', {}, `🕸 ${t('mindMap')}`),
        canvas,
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', onclick: () => canvas.toBlob((b) => b && download(`${(app.state?.doc.fileName ?? 'ankabut').replace(/\.[^.]+$/, '')}-mind-map.png`, b)) }, '⬇ PNG'),
          h('button', { class: 'btn primary', onclick: () => closeModal() }, t('close')),
        ),
      ),
    );
    requestAnimationFrame(animate);
  };
  app.showMindMap = show;
  const prevSummary = app.renderSummaryBody.bind(app);
  app.renderSummaryBody = (el, a) => {
    el.append(h('button', { class: 'btn', style: { marginBottom: '8px' }, onclick: show }, `🕸 ${t('mindMap')}`));
    prevSummary(el, a);
  };
  // The mind map ending: once per document, after the spider finishes (not in fast mode).
  app.hooks.afterWalk.push((s) => {
    if (app.settings.fastMode || shownFor.has(s.doc.id) || s !== app.docs[app.docs.length - 1]) return;
    shownFor.add(s.doc.id);
    setTimeout(show, 900);
  });
}

function drawMindMapScaled(ctx: CanvasRenderingContext2D, nodes: ReturnType<typeof layoutMindMap>, colors: Parameters<typeof drawMindMap>[2], p: number) {
  // The canvas has twice the pixels for sharp text, so draw with a 2x transform.
  ctx.save();
  ctx.scale(2, 2);
  drawMindMap(ctx, nodes, colors, p);
  ctx.restore();
}

// --------------------------------------------------------- 6. Exam mode
function installExam(app: App): void {
  const EXAM_QUESTIONS = 10;
  const EXAM_SECONDS = 360;
  let exam: { questions: Question[]; answers: string[]; i: number; endsAt: number; done: boolean } | null = null;
  let timer = 0;
  const finish = () => {
    if (!exam) return;
    exam.done = true;
    window.clearInterval(timer);
    const right = exam.questions.filter((q, i) => checkAnswer(q, exam!.answers[i] ?? '')).length;
    app.events.emit('exam', { right, total: exam.questions.length });
    app.renderRight();
  };
  const start = () => {
    const a = app.state?.analysis;
    if (!a) return;
    const seed = Date.now();
    const mixed = [...generateQuiz(a, { count: 6, difficulty: 'medium', seed }), ...generateQuiz(a, { count: 6, difficulty: 'hard', seed: seed + 1 })];
    const seen = new Set<string>();
    const questions = mixed.filter((q) => !seen.has(q.source.page + ':' + q.source.index) && seen.add(q.source.page + ':' + q.source.index)).slice(0, EXAM_QUESTIONS);
    exam = { questions, answers: [], i: 0, endsAt: Date.now() + EXAM_SECONDS * 1000, done: false };
    window.clearInterval(timer);
    timer = window.setInterval(() => {
      if (exam && !exam.done && Date.now() >= exam.endsAt) finish();
      else if (app.activeTab === 'study') {
        const clock = document.getElementById('exam-clock');
        if (clock && exam) clock.textContent = clockText(exam.endsAt);
      }
    }, 500);
    app.renderRight();
  };
  const clockText = (endsAt: number) => {
    const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    return `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const render = (el: HTMLElement) => {
    if (!app.isFeatureOn('exam')) {
      el.append(h('p', { class: 'muted' }, t('premium')));
      return;
    }
    if (!exam) {
      el.append(h('p', { class: 'muted' }, `⏱ ${EXAM_QUESTIONS} × ${t('quiz')} · ${EXAM_SECONDS / 60} min`), h('button', { class: 'btn primary', onclick: start }, t('start')));
      return;
    }
    if (exam.done) {
      const right = exam.questions.filter((q, i) => checkAnswer(q, exam!.answers[i] ?? '')).length;
      el.append(h('h2', {}, `${t('score')}: ${right}/${exam.questions.length}`));
      const list = h('ol', { class: 'kp-list' });
      exam.questions.forEach((q, i) => {
        const ok = checkAnswer(q, exam!.answers[i] ?? '');
        list.append(
          h(
            'li',
            { class: ok ? 'kp' : 'warn-box' },
            h('div', { dir: dirOf(q.prompt) }, q.prompt),
            h('div', {}, `${ok ? '✅' : '❌'} `, h('span', { dir: 'auto' }, exam!.answers[i] || '—'), ' → ', h('strong', { dir: 'auto' }, q.answer)),
            h('button', { class: 'link', onclick: () => app.jumpTo(q.source.docId, q.source.page, q.source.start, q.source.end) }, t('checkPage', { p: q.source.page })),
          ),
        );
      });
      el.append(list, h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: start }, t('start')));
      return;
    }
    const q = exam.questions[exam.i];
    el.append(h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('span', {}, `${exam.i + 1}/${exam.questions.length}`), h('strong', { id: 'exam-clock' }, clockText(exam.endsAt))));
    if (!q) return finish();
    el.append(h('p', { class: 'kp', dir: dirOf(q.prompt) }, q.prompt));
    const next = (value: string) => {
      exam!.answers[exam!.i] = value;
      exam!.i++;
      if (exam!.i >= exam!.questions.length) finish();
      else app.renderRight();
    };
    if (q.options.length) {
      el.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, ...q.options.map((o) => h('button', { class: 'btn', dir: 'auto', onclick: () => next(o) }, o))));
    } else {
      const input = h('input', { type: 'text', dir: 'auto', 'aria-label': t('exam') });
      el.append(h('form', { style: { display: 'flex', gap: '6px' }, onsubmit: (e: Event) => { e.preventDefault(); next(input.value); } }, input, h('button', { class: 'btn primary', type: 'submit' }, t('next'))));
      setTimeout(() => input.focus(), 0);
    }
    el.append(h('button', { class: 'link', style: { marginTop: '8px' }, onclick: finish }, t('finish')));
  };
  app.studySections.push({ id: 'exam', label: () => `⏱ ${t('exam')}`, render });
  app.hooks.beforeLoad.push(() => {
    exam = null;
    window.clearInterval(timer);
  });
}

// -------------------------------------------------- 7. Progress and streaks
function installProgress(app: App): void {
  const KEY = 'ankabut.progress';
  let p: Progress = emptyProgress();
  try {
    p = { ...emptyProgress(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    /* fresh start */
  }
  const save = (change: Parameters<typeof record>[1]) => {
    p = record(p, change);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };
  app.hooks.afterWalk.push((s) => save({ pagesRead: s.analysis?.coverage.readPages ?? 0 }));
  app.events.on('quiz-answer', (d) => save({ questions: 1, correct: d.correct ? 1 : 0 }));
  app.events.on('exam', (d) => save({ questions: Number(d.total), correct: Number(d.right) }));
  app.events.on('card', () => save({ cardsReviewed: 1 }));
  app.events.on('hunt-done', (d) => save({ wordsFound: Number(d.found) }));
  app.tabs.push({
    id: 'progress',
    label: () => `🔥 ${t('progress')}`,
    render: (el) => {
      const days = streak(p);
      el.append(h('h2', {}, `🔥 ${days} ${t('streak')}`));
      const rows: [string, number][] = [
        [t('pages'), p.pagesRead],
        [`🎯 ${t('found')}`, p.wordsFound],
        [`🧠 ${t('quiz')}`, p.questions],
        [`✅ ${t('correct')}`, p.correct],
        [`🗂 ${t('flashcards')}`, p.cardsReviewed],
      ];
      el.append(h('table', {}, ...rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, String(v))))));
      // Last 28 days as small squares.
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: '3px', marginTop: '10px' }, 'aria-hidden': 'true' });
      const set = new Set(p.days);
      for (let i = 27; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        grid.append(h('span', { title: key, style: { aspectRatio: '1', borderRadius: '3px', background: set.has(key) ? 'var(--accent)' : 'var(--border)' } }));
      }
      el.append(grid, h('p', { class: 'muted' }, t('privacy')));
    },
  });
}

// ------------------------------------------------------------ 8. Scan photos
function installCamera(app: App): void {
  const input = h('input', {
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    class: 'sr-only',
    onchange: (e: Event) => {
      const files = [...((e.target as HTMLInputElement).files ?? [])];
      if (files.length) void app.openFiles(files);
    },
  });
  const box = app.els.drop.querySelector('.box');
  box?.insertBefore(h('button', { class: 'btn', style: { marginInlineStart: '8px' }, onclick: () => input.click() }, '📷'), box.querySelector('.btn.primary')?.nextSibling ?? null);
  box?.append(input);
}

// ------------------------------------------------------------ 9. Read aloud
function installReadAloud(app: App): void {
  if (typeof speechSynthesis === 'undefined') return;
  let reading = false;
  const voiceLang: Record<Lang, string> = { ar: 'ar', fr: 'fr', en: 'en' };
  const btn = h('button', { class: 'btn', title: t('readAloud'), 'aria-label': t('readAloud') }, '🔊');
  const stop = () => {
    reading = false;
    speechSynthesis.cancel();
    btn.textContent = '🔊';
  };
  const start = async () => {
    const s = app.state;
    if (!s) return;
    if (!app.isFeatureOn('readAloud')) return toast(t('premium'));
    reading = true;
    btn.textContent = '⏹';
    app.view.playing = false;
    const voices = speechSynthesis.getVoices();
    let page = app.view.pageAt(app.view.scrollY + app.els.canvas.clientHeight * 0.3);
    const missing = new Set<string>();
    while (reading && page <= s.range.to) {
      const p = s.doc.pages[page - 1];
      for (const sent of splitSentences(p.text)) {
        if (!reading) return;
        app.view.highlights = app.view.highlights.filter((x) => x.kind !== 'current');
        app.view.highlights.push({ page, start: sent.start, end: sent.end, kind: 'current' });
        app.view.goTo(page, sent.start, sent.end, true);
        const u = new SpeechSynthesisUtterance(sent.text);
        const voice = voices.find((v) => v.lang.toLowerCase().startsWith(voiceLang[sent.lang]));
        if (voice) u.voice = voice;
        else if (voices.length && !missing.has(sent.lang)) {
          missing.add(sent.lang);
          toast(`🔇 ${sent.lang.toUpperCase()}: no voice on this device`);
        }
        u.lang = sent.lang === 'ar' ? 'ar-SA' : sent.lang === 'fr' ? 'fr-FR' : 'en-US';
        u.rate = Math.min(2, Math.max(0.6, app.view.speed));
        await new Promise<void>((resolve) => {
          u.onend = () => resolve();
          u.onerror = () => resolve();
          speechSynthesis.speak(u);
        });
      }
      page++;
    }
    stop();
  };
  btn.addEventListener('click', () => (reading ? stop() : void start()));
  app.els.controls.append(btn);
  app.hooks.beforeLoad.push(stop);
}

// ---------------------------------------------------------- 10. Video export
function installVideo(app: App): void {
  if (typeof MediaRecorder === 'undefined') return;
  const btn = h('button', { class: 'btn', title: t('recordVideo'), 'aria-label': t('recordVideo') }, '🎬');
  let recorder: MediaRecorder | null = null;
  const start = () => {
    const s = app.state;
    if (!s?.analysis) return;
    if (!app.isFeatureOn('videoExport')) return toast(t('premium'));
    const canvas = app.els.canvas;
    // Switch the canvas to a vertical 9:16 frame for TikTok, Reels and Shorts.
    const h0 = Math.min(canvas.parentElement!.clientHeight - 90, 900);
    canvas.style.flex = '0 0 auto';
    canvas.style.height = `${h0}px`;
    canvas.style.width = `${Math.round((h0 * 9) / 16)}px`;
    canvas.style.margin = '0 auto';
    app.view.resize();
    const title = s.doc.meta.title ?? s.doc.fileName;
    app.view.onAfterDraw = (ctx, w) => {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, w, 54);
      ctx.fillStyle = '#fff';
      ctx.font = '600 16px "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.direction = dirOf(title);
      ctx.fillText(`🕷 ${title}`.slice(0, 48), w / 2, 22);
      ctx.font = '12px "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif';
      ctx.fillText(t('motto'), w / 2, 42);
      ctx.restore();
    };
    const stream = canvas.captureStream(30);
    const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/webm' });
      download(`${title.replace(/[^\p{L}\p{N}]+/gu, '-')}-ankabut.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, blob);
      canvas.style.cssText = '';
      app.view.onAfterDraw = undefined;
      app.view.resize();
      btn.textContent = '🎬';
      recorder = null;
    };
    recorder.start(500);
    btn.textContent = '⏺';
    app.resetCollected();
    const done = () => recorder?.state === 'recording' && setTimeout(() => recorder?.stop(), 1200);
    app.hooks.afterWalk.push(function once(st) {
      app.hooks.afterWalk.splice(app.hooks.afterWalk.indexOf(once), 1);
      if (st === s) done();
    });
    app.walkKeyPoints(s);
  };
  btn.addEventListener('click', () => (recorder ? recorder.stop() : start()));
  app.els.controls.append(btn);
}

