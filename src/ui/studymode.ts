// Study mode (phase 6) and "the spider explains at the end".
//
// - Flashcards in the Study tab, made from the keywords and key sentences.
// - After the walk, the spider explains the topic in its own words, built
//   only from the key points. It is labelled as the spider's explanation.
// - "My notes" on the left, saved on this device.
// - The study document (Markdown or PDF), Anki cards and a Notion-ready
//   Markdown file. No export ever contains the book's full text.

import { explainDocument, type DocumentExplanation } from '../analysis/explain';
import { buildStudyHtml, buildStudyMarkdown, flashcardsToAnki, type StudyDocInput } from '../export/study';
import { makeFlashcards, type Flashcard } from '../study/flashcards';
import { dueCount, orderByDue, review, type CardState } from '../study/srs';
import type { App, DocState } from './app';
import { dirOf, download, h, toast } from './dom';
import { getUiLang, t } from './i18n';

export interface CardSession {
  queue: Flashcard[];
  flipped: boolean;
  known: number;
  seen: number;
}

export function installStudyMode(app: App): void {
  const explanations = new Map<string, DocumentExplanation>();
  let session: CardSession | null = null;
  let notes = '';

  const notesKey = () => `ankabut.notes.${app.docs.map((d) => d.doc.fileName).join('+')}`;
  const loadNotes = () => {
    try {
      notes = localStorage.getItem(notesKey()) ?? '';
    } catch {
      notes = '';
    }
  };
  const saveNotes = () => {
    try {
      localStorage.setItem(notesKey(), notes);
    } catch {
      /* storage blocked: notes still live in memory for this session */
    }
  };

  // ------------------------------------------------------- spider explains
  const explain = (s: DocState) => {
    if (!s.analysis) return;
    explanations.set(s.doc.id, explainDocument(s.analysis));
  };
  app.hooks.afterAnalysis.push(explain);
  app.hooks.afterWalk.push((s) => {
    explain(s);
    const e = explanations.get(s.doc.id);
    if (e?.overview) toast(`🕷 ${e.overview.text}`, 5000);
  });

  const prevSummary = app.renderSummaryBody.bind(app);
  app.renderSummaryBody = (el, a) => {
    const e = explanations.get(a.docId);
    if (e?.overview && app.finished) {
      const box = h('section', { class: 'kp', style: { borderColor: 'var(--accent)', marginBottom: '10px' } });
      box.append(h('h2', { style: { marginTop: '0' } }, `🕷 ${t('spiderExplains')}`));
      const list = h('ul', { class: 'kp-list' }, app.keyPointCard(e.overview));
      for (const p of e.parts.slice(0, 12)) list.append(app.keyPointCard(p.point));
      box.append(list);
      el.append(box);
    }
    el.append(exportButtons());
    prevSummary(el, a);
  };

  // ------------------------------------------------------------ exporting
  const studyInput = (): StudyDocInput | null => {
    const docs = app.docs.filter((d) => d.analysis);
    if (!docs.length) return null;
    const fileName = docs.length > 1 ? t('library') : docs[0].doc.meta.title ?? docs[0].doc.fileName;
    return {
      title: `${fileName} · ${t('summary')}`,
      docs: docs.map((d) => ({
        fileName: d.doc.fileName,
        meta: d.doc.meta,
        totalPages: d.doc.pages.length,
        chars: d.doc.pages.reduce((n, p) => n + p.text.length, 0),
        analysis: d.analysis!,
        explanation: explanations.get(d.doc.id),
      })),
      notes,
      searches: app.searchLog,
      hunts: app.lastHunt ?? [],
      label: (k) => exportLabel(k),
      sourceText: docs.map((d) => d.doc.pages.map((p) => p.text).join('\n')).join('\n'),
      date: new Date().toISOString().slice(0, 10),
    };
  };

  const baseName = () => (app.docs.length > 1 ? 'library' : app.state?.doc.fileName ?? 'ankabut').replace(/\.[^.]+$/, '');

  const safely = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      app.showError(err);
    }
  };

  const exportMarkdown = (suffix: string) =>
    safely(() => {
      const inp = studyInput();
      if (inp) download(`${baseName()}-${suffix}.md`, buildStudyMarkdown(inp), 'text/markdown;charset=utf-8');
    });

  const exportPdf = () =>
    safely(() => {
      const inp = studyInput();
      if (!inp) return;
      // The browser's print dialog turns this page into a PDF ("Save as PDF").
      const frame = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' }, title: 'print' });
      frame.srcdoc = buildStudyHtml(inp, getUiLang() === 'ar');
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => frame.remove(), 60000);
      };
      document.body.append(frame);
    });

  const exportAnki = () =>
    safely(() => {
      const cards = app.docs.flatMap((d) => (d.analysis ? makeFlashcards(d.analysis, 60) : []));
      const chars = app.docs.reduce((n, d) => n + d.doc.pages.reduce((m, p) => m + p.text.length, 0), 0);
      download(`${baseName()}-anki.txt`, flashcardsToAnki(cards, chars, baseName()));
    });

  const exportButtons = () =>
    h(
      'div',
      { class: 'chips', style: { margin: '0 0 10px' } },
      h('button', { class: 'btn small', onclick: () => exportMarkdown('study') }, `⬇ ${t('exportStudy')}`),
      h('button', { class: 'btn small', onclick: exportPdf }, `🖨 ${t('exportPdf')}`),
      h('button', { class: 'btn small', onclick: exportAnki }, `🗂 ${t('exportAnki')}`),
      h('button', { class: 'btn small', onclick: () => exportMarkdown('notion') }, `📓 ${t('exportNotion')}`),
    );

  // ------------------------------------------------------------ flashcards
  // Spaced repetition: each card's Leitner box is saved on this device, keyed by file name and card.
  const SRS_KEY = 'ankabut.srs';
  const loadSrs = (): Record<string, CardState> => {
    try {
      return JSON.parse(localStorage.getItem(SRS_KEY) ?? '{}');
    } catch {
      return {};
    }
  };
  const saveSrs = (states: Record<string, CardState>) => {
    try {
      localStorage.setItem(SRS_KEY, JSON.stringify(states));
    } catch {
      /* storage blocked: the schedule lasts for this session only */
    }
  };
  let srs = loadSrs();
  const allCards = (): Flashcard[] =>
    app.docs.flatMap((d) =>
      d.analysis ? makeFlashcards(d.analysis, 40).map((c) => ({ ...c, id: `${d.doc.fileName}|${c.id}` })) : [],
    );

  const startCards = () => {
    srs = loadSrs();
    const cards = orderByDue(allCards(), srs);
    session = { queue: cards, flipped: false, known: 0, seen: 0 };
    app.renderRight();
  };

  app.cardSession = () => session;
  app.setCardSession = (s) => {
    session = s;
    app.renderRight();
  };

  const grade = (knew: boolean) => {
    if (!session?.queue.length) return;
    const card = session.queue.shift()!;
    srs[card.id] = review(srs[card.id], knew);
    saveSrs(srs);
    session.seen++;
    if (knew) session.known++;
    // "Again" puts the card back a few places later, so it returns soon.
    else session.queue.splice(Math.min(3, session.queue.length), 0, card);
    session.flipped = false;
    app.events.emit('card', { knew, card });
    app.renderRight();
  };

  const renderCards = (el: HTMLElement) => {
    if (!session) {
      const due = dueCount(allCards().map((c) => c.id), loadSrs());
      el.append(h('p', { class: 'muted' }, '🗂 ', t('flashcards'), ` · ${t('due')}: ${due}`), h('button', { class: 'btn primary', onclick: startCards }, t('start')));
      return;
    }
    const card = session.queue[0];
    el.append(h('div', { class: 'muted' }, `${t('know')}: ${session.known} · ${session.queue.length} ${t('flashcards').toLowerCase()}`));
    if (!card) {
      el.append(h('p', {}, `🎉 ${t('greatJob')}`), h('button', { class: 'btn', onclick: startCards }, t('start')));
      return;
    }
    const face = session.flipped ? card.back : card.front;
    el.append(
      h(
        'button',
        {
          class: 'kp',
          dir: dirOf(face),
          'aria-live': 'polite',
          style: { width: '100%', minHeight: '140px', fontSize: card.kind === 'term' && !session.flipped ? '22px' : '15px', cursor: 'pointer', textAlign: 'center' },
          onclick: () => {
            session!.flipped = !session!.flipped;
            app.renderRight();
          },
        },
        face,
      ),
      h('div', { class: 'muted', style: { margin: '4px 0' } }, h('button', { class: 'link', onclick: () => app.jumpTo(card.source.docId, card.source.page, card.source.start, card.source.end) }, t('checkPage', { p: card.source.page }))),
      session.flipped
        ? h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn', onclick: () => grade(false) }, `↺ ${t('again')}`), h('button', { class: 'btn primary', onclick: () => grade(true) }, `✓ ${t('know')}`))
        : h('button', { class: 'btn primary', onclick: () => { session!.flipped = true; app.renderRight(); } }, t('flip')),
    );
  };

  app.studySections.unshift({ id: 'cards', label: () => `🗂 ${t('flashcards')}`, render: renderCards });

  // ----------------------------------------------------------------- notes
  app.leftSections.push({
    id: 'notes',
    render: (el) => {
      el.append(h('h2', {}, `📝 ${t('notes')}`));
      const area = h('textarea', { rows: 5, dir: 'auto', placeholder: t('notesPlaceholder'), 'aria-label': t('notes') }, notes);
      area.addEventListener('input', () => {
        notes = area.value;
        saveNotes();
      });
      el.append(area);
    },
  });

  app.hooks.beforeLoad.push(() => {
    session = null;
  });
  app.hooks.afterAnalysis.push(() => loadNotes());
}

/** Export labels follow the interface language. */
function exportLabel(key: string): string {
  const map: Record<string, string> = {
    studyDocument: 'exportStudy',
    author: 'author',
    publisher: 'publisher',
    date: 'date',
    spiderExplains: 'spiderExplains',
    keywords: 'keywords',
    wordHunt: 'wordHunt',
    notes: 'notes',
    page: 'page',
    motto: 'motto',
  };
  const fallback: Record<string, Record<string, string>> = {
    fr: {
      source: 'Source',
      coverage: 'Couverture',
      pagesRead: 'pages lues',
      skipped: 'Pages ignorées',
      explanationNote: 'Ces lignes sont l’explication de l’araignée, construite à partir des mots-clés. Vérifiez-les avec les citations et les pages.',
      keyPoints: 'Points clés (courtes citations avec numéros de page)',
      searches: 'Mes recherches',
      footer: 'Fait avec Ankabut. Citations courtes uniquement, pour l’étude personnelle. Le texte complet de la source n’est pas inclus.',
    },
    ar: {
      source: 'المصدر',
      coverage: 'التغطية',
      pagesRead: 'صفحة مقروءة',
      skipped: 'صفحات تم تخطيها',
      explanationNote: 'هذه الأسطر شرح العنكبوت، مبني على الكلمات المفتاحية. تحقق منها بالاقتباسات والصفحات.',
      keyPoints: 'النقاط الرئيسية (اقتباسات قصيرة مع أرقام الصفحات)',
      searches: 'عمليات البحث',
      footer: 'صنع بواسطة عنكبوت. اقتباسات قصيرة فقط للدراسة الشخصية. النص الكامل للمصدر غير مضمن.',
    },
  };
  if (map[key]) return t(map[key]);
  return fallback[getUiLang()]?.[key] ?? ({ source: 'Source', coverage: 'Coverage', pagesRead: 'pages read', skipped: 'Skipped pages', explanationNote: 'These lines are the spider’s own explanation, built from the keywords. Check them against the quotes and pages.', keyPoints: 'Key points (short quotes with page numbers)', searches: 'My searches', footer: 'Made with Ankabut. Short quotes only, for personal study. The full text of the source is not included.' } as Record<string, string>)[key] ?? key;
}
