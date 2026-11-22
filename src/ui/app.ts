// The app controller. It builds the page, reacts to the user, and connects
// the loaders, the analysis worker, the canvas view and the side panels.

import { joinList, topicInfo } from '../analysis/topic';
import { vocabPlan } from './vocab';
import { DEVELOPER_MODE } from '../core/config';
import { isEnabled, LARGE_BOOK_PAGES, tierOf } from '../core/flags';
import { isDeveloperSampleName, mayRead, ProtectedFileError } from '../core/copyright';
import type { AnalysisResult, Chunk, KeyPoint, Keyword, LoadedDoc } from '../core/types';
import { spreadReport, verifyAnalysis } from '../analysis/verify';
import { loadFile, loadNotes } from '../loaders/browser';
import { findInPage } from '../hunt/search';
import type { SpiderStyle } from '../render/view';
import { applyTheme, resolveTheme, type ThemeSetting } from './theme';
import type { Stop } from '../render/route';
import { DocView } from '../render/view';
import { call } from '../worker/client';
import { clear, dirOf, h, modal, toast } from './dom';
import { getUiLang, initialUiLang, onLangChange, setUiLang, t } from './i18n';

export interface DocState {
  doc: LoadedDoc;
  chunks: Chunk[];
  analysis?: AnalysisResult;
  /** Page range the user chose for this read. */
  range: { from: number; to: number };
}

export interface Tab {
  id: string;
  label: () => string;
  render: (el: HTMLElement) => void;
}

const STORAGE_KEY = 'ankabut.settings';

export class App {
  root: HTMLElement;
  view!: DocView;
  docs: DocState[] = [];
  active = -1;
  settings = {
    v: 2,
    fastMode: false,
    reducedMotion: false,
    focusMode: false,
    theme: 'lab-crawl' as ThemeSetting,
    spiderStyle: 'wire' as SpiderStyle,
  };
  /** Key points the spider has collected so far, in the order it found them. */
  collected: KeyPoint[] = [];
  collectedKeywords = new Map<string, { kw: Keyword | null; text: string; count: number }>();
  tabs: Tab[] = [];
  activeTab = 'keywords';
  leftSections: { id: string; render: (el: HTMLElement) => void }[] = [];
  els!: {
    canvas: HTMLCanvasElement;
    drop: HTMLElement;
    left: HTMLElement;
    right: HTMLElement;
    controls: HTMLElement;
    coverage: HTMLElement;
    status: HTMLElement;
    speed: HTMLElement;
    playBtn: HTMLButtonElement;
    workspace: HTMLElement;
    header: HTMLElement;
  };
  walking = false;
  finished = false;
  /** Hooks that later features use to react to app events. */
  hooks = {
    afterAnalysis: [] as ((s: DocState) => void)[],
    afterWalk: [] as ((s: DocState) => void)[],
    beforeLoad: [] as (() => void)[],
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.loadSettings();
    setUiLang(initialUiLang());
    this.build();
    onLangChange(() => this.rebuildText());
    this.registerCoreTabs();
    this.installKeyboard();
    this.renderPanels();
  }

  get state(): DocState | undefined {
    return this.docs[this.active];
  }

  // ---------------------------------------------------------------- settings
  loadSettings(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        // Settings from before the redesign: move to the new defaults (Dark lab while crawling, wireframe spider).
        if (!saved.v) {
          delete saved.theme;
          saved.v = 2;
        }
        Object.assign(this.settings, saved);
      }
    } catch {
      /* storage blocked: defaults are fine */
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.settings.reducedMotion = true;
  }

  saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
    this.applySettings();
  }

  applySettings(): void {
    if (!this.view) return;
    this.view.options.fastMode = this.settings.fastMode;
    this.view.options.reducedMotion = this.settings.reducedMotion;
    this.view.options.focusMode = this.settings.focusMode;
    this.view.options.showRoute = DEVELOPER_MODE;
    if (this.view.options.spiderStyle !== this.settings.spiderStyle) this.view.setSpiderStyle(this.settings.spiderStyle);
    applyTheme(resolveTheme(this.settings.theme, this.view.crawling));
  }

  /** Settings dialog: theme and spider style (the toggles stay in the header). */
  openSettings(): void {
    const select = (label: string, value: string, options: [string, string][], onChange: (v: string) => void) => {
      const sel = h('select', { 'aria-label': label, onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) }, ...options.map(([v, l]) => h('option', { value: v }, l)));
      sel.value = value;
      return h('label', { style: { display: 'block', margin: '10px 0' } }, h('div', { class: 'muted' }, label), sel);
    };
    const close = modal(
      h(
        'div',
        {},
        h('h2', {}, `⚙ ${t('settings')}`),
        select(t('theme'), this.settings.theme, [
          ['lab-crawl', t('themeLabCrawl')],
          ['lab', t('themeLab')],
          ['auto', t('themeAuto')],
          ['light', t('themeLight')],
          ['dark', t('themeDark')],
        ], (v) => {
          this.settings.theme = v as ThemeSetting;
          this.saveSettings();
        }),
        select(t('spiderStyle'), this.settings.spiderStyle, [
          ['wire', t('spiderWire')],
          ['cartoon', t('spiderCartoon')],
        ], (v) => {
          this.settings.spiderStyle = v as SpiderStyle;
          this.saveSettings();
        }),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => close() }, t('close'))),
      ),
    );
  }

  /** Where flying keywords land: the Keywords tab, or its chips when it is open. */
  keywordsTarget(): { x: number; y: number } | null {
    const visible = (el: Element | null) => el instanceof HTMLElement && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
    const candidates = [
      this.activeTab === 'keywords' ? this.els.right.querySelector('[role=tabpanel] .chips:last-of-type, [role=tabpanel]') : null,
      this.els.right.querySelector('[data-tab="keywords"]'),
      document.querySelector('.mobile-tabs [data-t="keywords"]'),
    ];
    for (const el of candidates) {
      if (!visible(el)) continue;
      const r = (el as HTMLElement).getBoundingClientRect();
      return { x: r.left + Math.min(r.width / 2, 120), y: r.top + Math.min(r.height / 2, 24) };
    }
    return null;
  }

  /**
   * The grab effect for a key point's keywords: each keyword is found at its exact
   * spot inside the sentence on the page, glows, glitches, tears off and flies into
   * the Keywords panel. With effects off (fast mode, reduced motion) it is added at once.
   */
  grabKeywords(kp: KeyPoint, screen: { x: number; y: number }, all: Keyword[], delayMs = 0): void {
    kp.keywords.slice(0, 3).forEach((word, i) => {
      const add = () => this.collectKeyword(word, all);
      if (screen.x < 0) return add();
      const m = findInPage({ number: kp.source.page, text: kp.text, scanned: false }, word)[0];
      if (!m) return add();
      // A vocabulary word keeps its own color while it flies.
      const color = this.vocabColors.get(word)?.solid;
      this.view.grabWord(kp.source.page, kp.source.start + m.start, kp.source.start + m.end, add, delayMs + i * 140, color ? { color } : {});
    });
  }

  // ------------------------------------------------------------------- build
  build(): void {
    clear(this.root);
    const langSelect = h(
      'select',
      { 'aria-label': 'Language / Langue / اللغة', onchange: (e: Event) => setUiLang((e.target as HTMLSelectElement).value as 'en') },
      h('option', { value: 'en' }, 'English'),
      h('option', { value: 'fr' }, 'Français'),
      h('option', { value: 'ar' }, 'العربية'),
      h('option', { value: 'es' }, 'Español'),
    );
    langSelect.value = getUiLang();
    const toggle = (key: 'fastMode' | 'reducedMotion' | 'focusMode', label: string) =>
      h(
        'label',
        {},
        h('input', {
          type: 'checkbox',
          checked: this.settings[key],
          onchange: (e: Event) => {
            this.settings[key] = (e.target as HTMLInputElement).checked;
            this.saveSettings();
          },
        }),
        h('span', { 'data-t': label }, t(label)),
      );
    const header = h(
      'header',
      { class: 'top' },
      h('div', { class: 'brand' }, h('h1', { 'data-t': 'appName' }, t('appName')), h('span', { class: 'motto', 'data-t': 'motto' }, t('motto'))),
      h('span', { class: 'privacy', 'data-t': 'privacy' }, '🔒 ', t('privacy')),
      h('span', { class: 'spacer' }),
      h('div', { class: 'toggles' }, toggle('fastMode', 'fastMode'), toggle('reducedMotion', 'reduceMotion'), toggle('focusMode', 'focusMode')),
      h('div', { style: { width: '130px' } }, langSelect),
      h('button', { class: 'btn', 'aria-label': t('settings'), title: t('settings'), onclick: () => this.openSettings() }, '⚙'),
      DEVELOPER_MODE ? h('span', { class: 'badge' }, '🛠 ', t('dev')) : null,
    );

    const canvas = h('canvas', { 'aria-label': 'Document pages with the reading spider', tabindex: '0' });
    const playBtn = h('button', { class: 'btn', onclick: () => this.togglePlay(), 'aria-keyshortcuts': 'Space' }, '⏸');
    const speed = h('span', { class: 'speed', 'aria-live': 'polite' }, '1×');
    const status = h('span', { class: 'muted', 'aria-live': 'polite' });
    const controls = h(
      'div',
      { class: 'controls' },
      playBtn,
      h('button', { class: 'btn', title: t('slower'), 'aria-label': t('slower'), onclick: () => this.changeSpeed(0.5), 'aria-keyshortcuts': '-' }, '🐢'),
      speed,
      h('button', { class: 'btn', title: t('faster'), 'aria-label': t('faster'), onclick: () => this.changeSpeed(2), 'aria-keyshortcuts': '+' }, '🐇'),
      h('button', { class: 'btn', onclick: () => this.skip(), 'aria-keyshortcuts': 'S', 'data-t': 'skip' }, t('skip')),
      h('button', { class: 'btn', onclick: () => this.showDrop(), 'data-t': 'newFile' }, t('newFile')),
      status,
    );
    const coverage = h('div', { class: 'coverage', role: 'status', 'aria-live': 'polite' });
    const drop = this.buildDrop();
    const center = h('section', { class: 'center' }, controls, coverage, canvas, drop);
    const left = h('aside', { class: 'panel left', 'aria-label': t('commands') });
    const right = h('aside', { class: 'panel right', 'aria-label': t('keywords') });
    const workspace = h('main', { class: 'workspace', 'data-mobile': 'none' }, left, center, right);
    const mobileTabs = h(
      'nav',
      { class: 'mobile-tabs' },
      h('button', { class: 'btn', onclick: () => this.mobile('left'), 'data-t': 'commands' }, t('commands')),
      h('button', { class: 'btn', onclick: () => this.mobile('none') }, '📄'),
      h('button', { class: 'btn', onclick: () => this.mobile('right'), 'data-t': 'keywords' }, t('keywords')),
    );
    this.root.append(header, workspace, mobileTabs);
    this.els = { canvas, drop, left, right, controls, coverage, status, speed, playBtn, workspace, header };
    this.view = new DocView(canvas);
    this.view.grabTarget = () => this.keywordsTarget();
    // "Dark lab while crawling": switch the theme when a walk starts and ends.
    this.view.onCrawlChange = (crawling) => applyTheme(resolveTheme(this.settings.theme, crawling));
    this.applySettings();
    this.renderCoverage();
  }

  mobile(which: 'left' | 'right' | 'none'): void {
    const cur = this.els.workspace.dataset.mobile;
    this.els.workspace.dataset.mobile = cur === which ? 'none' : which;
    this.view.resize();
  }

  /** Updates every element that shows interface text after a language change. */
  rebuildText(): void {
    this.root.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => {
      el.textContent = (el.dataset.t === 'privacy' ? '🔒 ' : '') + t(el.dataset.t!);
    });
    this.renderPanels();
    this.renderCoverage();
  }

  buildDrop(): HTMLElement {
    const input = h('input', {
      type: 'file',
      multiple: true,
      class: 'sr-only',
      accept: '.pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp,text/plain,application/pdf',
      onchange: (e: Event) => {
        const files = [...((e.target as HTMLInputElement).files ?? [])];
        if (files.length) void this.openFiles(files);
        (e.target as HTMLInputElement).value = '';
      },
    });
    const notes = h('textarea', { 'aria-label': t('pasteNotes'), placeholder: t('pasteNotes') });
    const drop = h(
      'div',
      { class: 'drop' },
      h(
        'div',
        { class: 'box' },
        h('h2', { 'data-t': 'dropTitle' }, t('dropTitle')),
        h('p', { class: 'muted', 'data-t': 'dropHint' }, t('dropHint')),
        h('button', { class: 'btn primary', onclick: () => input.click(), 'data-t': 'chooseFile' }, t('chooseFile')),
        input,
        h('p', { class: 'muted', 'data-t': 'privacy' }, '🔒 ', t('privacy')),
        notes,
        h(
          'button',
          {
            class: 'btn',
            style: { marginTop: '8px' },
            onclick: () => {
              if (notes.value.trim()) void this.openNotes(notes.value);
            },
            'data-t': 'readNotes',
          },
          t('readNotes'),
        ),
        h('p', { class: 'muted', style: { marginTop: '16px' }, 'data-t': 'motto' }, t('motto')),
      ),
    );
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) void this.openFiles(files);
    });
    // Dropping anywhere on the canvas also works.
    this.root.addEventListener('dragover', (e) => e.preventDefault());
    this.root.addEventListener('drop', (e) => {
      if ((e.target as HTMLElement).closest('.drop')) return;
      e.preventDefault();
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) void this.openFiles(files);
    });
    return drop;
  }

  showDrop(): void {
    this.view.playing = false;
    this.els.drop.style.display = '';
  }

  hideDrop(): void {
    this.els.drop.style.display = 'none';
  }

  // ------------------------------------------------------------- consent etc
  /** Rule 4: ask the user to confirm they have the right to use the files. */
  askConsent(fileNames: string[]): Promise<boolean> {
    const allSamples = fileNames.every(isDeveloperSampleName);
    if (mayRead({ confirmed: false }, DEVELOPER_MODE, allSamples)) return Promise.resolve(true);
    return new Promise((resolve) => {
      let answered = false;
      const box = h('input', { type: 'checkbox', id: 'consent-box' });
      const ok = h('button', { class: 'btn primary', disabled: true }, t('consentOk'));
      box.addEventListener('change', () => (ok.disabled = !box.checked));
      const content = h(
        'div',
        {},
        h('h2', {}, t('consentTitle')),
        h('ul', {}, ...fileNames.map((f) => h('li', {}, f))),
        h('label', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start' } }, box, h('span', {}, t('consentText'))),
        h('p', { class: 'muted' }, '🔒 ', t('privacy')),
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => close() }, t('cancel')), ok),
      );
      const close = modal(content, () => {
        if (!answered) resolve(false);
      });
      ok.addEventListener('click', () => {
        answered = mayRead({ confirmed: box.checked }, DEVELOPER_MODE, allSamples);
        close();
        resolve(answered);
      });
    });
  }

  showError(err: unknown, fileName?: string): void {
    const e = err as Error;
    const isProtected = err instanceof ProtectedFileError;
    const content = h(
      'div',
      {},
      h('h2', {}, isProtected ? `🔒 ${t('protected')}` : '⚠️'),
      fileName ? h('p', { class: 'muted' }, fileName) : null,
      h('p', {}, e?.message ?? String(err)),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => close() }, t('close'))),
    );
    const close = modal(content);
  }

  setStatus(text: string): void {
    this.els.status.textContent = text;
  }

  // ----------------------------------------------------------------- loading
  async openFiles(files: File[]): Promise<void> {
    if (!(await this.askConsent(files.map((f) => f.name)))) return;
    this.hooks.beforeLoad.forEach((f) => f());
    const loaded: LoadedDoc[] = [];
    for (const file of files) {
      try {
        this.setStatus(`${t('loading')} ${file.name}…`);
        const doc = await loadFile(file, {
          onProgress: (d, total, label) => {
            this.setStatus(`${t('loading')} ${file.name}: ${label === 'ocr' ? 'OCR' : t('pageLong')} ${d}/${total}`);
            this.renderCoverage({ loading: d / Math.max(1, total) });
          },
        });
        loaded.push(doc);
        this.files.set(doc.id, file);
      } catch (err) {
        this.showError(err, file.name);
      }
    }
    this.setStatus('');
    if (loaded.length) await this.startDocs(loaded);
  }

  async openNotes(text: string): Promise<void> {
    // Notes the user typed are their own, so no consent question is needed.
    await this.startDocs([loadNotes(text, t('notes'))]);
  }

  /** Overridden by Library mode for several files. */
  async startDocs(docs: LoadedDoc[]): Promise<void> {
    await this.startDoc(docs[0]);
  }

  async startDoc(doc: LoadedDoc): Promise<void> {
    this.hideDrop();
    // Very large books may become premium later. If the flag is off, read the first part and say so.
    if (doc.pages.length > LARGE_BOOK_PAGES && !this.isFeatureOn('largeBooks')) {
      doc.warnings.push(`This book has ${doc.pages.length} pages. The free plan reads the first ${LARGE_BOOK_PAGES}; the rest are listed as skipped.`);
    }
    const prepared = await call('prepare', { doc }, (p) => {
      this.setStatus(`${t('preparing')} ${p.done}/${p.total}`);
    });
    const state: DocState = { doc, chunks: prepared.chunks, range: { from: 1, to: doc.pages.length } };
    this.docs = [state];
    this.active = 0;
    this.view.setPages(doc.pages);
    this.resetCollected();
    this.renderPanels();
    const plan = await this.choosePlan(state);
    if (!plan) return;
    if (!this.isFeatureOn('largeBooks')) plan.to = Math.min(plan.to, LARGE_BOOK_PAGES);
    await this.analyzeAndWalk(state, plan);
  }

  /**
   * Smart chunking notice. The page count is known the moment the file loads,
   * so the user never types it. Long documents get a reading plan they can accept,
   * narrow to a page range, or narrow to chosen chapters.
   */
  async choosePlan(state: DocState): Promise<{ from: number; to: number; onlyChunks?: number[] } | null> {
    const total = state.doc.pages.length;
    if (state.chunks.length <= 1) return { from: 1, to: total };
    return new Promise((resolve) => {
      let answered = false;
      const from = h('input', { type: 'number', min: 1, max: total, value: 1, 'aria-label': t('planRange') });
      const to = h('input', { type: 'number', min: 1, max: total, value: total, 'aria-label': t('planTo') });
      const checks = state.chunks.map((c) => h('input', { type: 'checkbox', value: String(c.index) }));
      const finish = (plan: { from: number; to: number; onlyChunks?: number[] } | null) => {
        answered = true;
        close();
        resolve(plan);
      };
      const content = h(
        'div',
        {},
        h('h2', {}, t('planTitle')),
        h('p', {}, t('planText', { pages: total, chunks: state.chunks.length })),
        h('div', { class: 'actions', style: { justifyContent: 'flex-start' } }, h('button', { class: 'btn primary', onclick: () => finish({ from: 1, to: total }) }, t('planAccept'))),
        h('h3', {}, t('planRange')),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          from,
          t('planTo'),
          to,
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                const a = Math.max(1, Math.min(total, Number(from.value) || 1));
                const b = Math.max(a, Math.min(total, Number(to.value) || total));
                finish({ from: a, to: b });
              },
            },
            t('planRange'),
          ),
        ),
        h('h3', {}, t('planChapters')),
        h(
          'div',
          { style: { maxHeight: '220px', overflow: 'auto' } },
          ...state.chunks.map((c, i) =>
            h('label', { style: { display: 'flex', gap: '6px', padding: '2px 0' } }, checks[i], h('span', { dir: 'auto' }, `${this.chunkTitle(c)} (${t('page')} ${c.fromPage}–${c.toPage})`)),
          ),
        ),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', onclick: () => finish(null) }, t('cancel')),
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                const picked = checks.filter((c) => c.checked).map((c) => Number(c.value));
                if (picked.length) finish({ from: 1, to: total, onlyChunks: picked });
              },
            },
            t('planChapters'),
          ),
        ),
      );
      const close = modal(content, () => {
        if (!answered) resolve(null);
      });
    });
  }

  /** Chunk titles: chapter headings as written, or "Pages 1–18" in the interface language. */
  chunkTitle(c: Chunk): string {
    return c.byChapter ? c.title : `${t('pages')} ${c.fromPage}–${c.toPage}`;
  }

  async analyzeAndWalk(state: DocState, plan: { from: number; to: number; onlyChunks?: number[] }): Promise<void> {
    state.range = { from: plan.from, to: plan.to };
    const chunks = plan.from === 1 && plan.to === state.doc.pages.length ? state.chunks : await call('plan', { docId: state.doc.id, fromPage: plan.from, toPage: plan.to });
    const t0 = performance.now();
    state.analysis = await call('analyze', { docId: state.doc.id, opts: { fromPage: plan.from, toPage: plan.to, chunks, onlyChunks: plan.onlyChunks } }, (p) => {
      const title = String(p.title).startsWith('Pages ') ? t('pages') + String(p.title).slice(5) : String(p.title);
      this.setStatus(`${t('analyzing')} ${p.chunk}/${p.chunks}: ${title}`);
      this.renderCoverage({ analyzing: Number(p.chunk) / Number(p.chunks) });
    });
    state.analysis.timingsMs.roundTrip = Math.round(performance.now() - t0);
    // Known problem 2: nothing is shown unless it is really on its page.
    const dropped = verifyAnalysis(state.doc.pages, state.analysis);
    if (dropped) state.doc.log.push(`verification dropped ${dropped} key point(s) that did not match their page`);
    this.setStatus('');
    this.renderCoverage();
    this.hooks.afterAnalysis.forEach((f) => f(state));
    this.renderPanels();
    this.walkKeyPoints(state);
  }

  resetCollected(): void {
    this.collected = [];
    this.collectedKeywords.clear();
    this.finished = false;
  }

  /**
   * Where each vocabulary word appears first in the range read. The spider stops
   * there too and kicks the word, in its own color, into the Keywords panel.
   */
  vocabSpots(state: DocState): { term: string; color: import('./vocab').VocabColor; page: number; start: number; end: number }[] {
    const a = state.analysis;
    if (!a || !this.vocabEnabled?.()) return [];
    const spots = [];
    for (const { term, color } of vocabPlan(a.keywords)) {
      this.vocabColors.set(term, color);
      for (let n = state.range.from; n <= state.range.to; n++) {
        const page = state.doc.pages[n - 1];
        const m = page ? findInPage(page, term)[0] : undefined;
        if (m) {
          spots.push({ term, color, page: m.page, start: m.start, end: m.end });
          break;
        }
      }
    }
    return spots;
  }

  /** Where flying key point sentences land: the Key points list on the side. */
  keyPointsTarget(): { x: number; y: number } | null {
    const section = this.els.left.querySelector('[data-section="keypoints"]');
    const el = section?.querySelector('.kp:last-child') ?? section?.querySelector('h2');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return null;
    return { x: r.left + r.width / 2, y: Math.min(innerHeight - 30, r.bottom + 14) };
  }

  /** Every key point of every chunk becomes a stop for the spider, plus one stop per vocabulary word. */
  walkKeyPoints(state: DocState): void {
    const a = state.analysis!;
    const points = a.chunks.flatMap((c) => c.keyPoints);
    const vocab = this.vocabSpots(state);
    const stops: Stop[] = [
      ...points.map((kp, i): Stop => ({ page: kp.source.page, start: kp.source.start, end: kp.source.end, kind: 'key', ref: i })),
      ...vocab.map((v, i): Stop => ({ page: v.page, start: v.start, end: v.end, kind: 'match', ref: i })),
    ];
    this.view.highlights = this.view.highlights.filter((x) => x.kind !== 'key');
    this.walking = true;
    this.finished = false;
    this.els.playBtn.textContent = '⏸';
    this.view.walk(
      stops,
      {
        onArrive: (stop) => {
          if (stop.kind === 'key') this.view.highlights.push({ page: stop.page, start: stop.start, end: stop.end, kind: 'key' });
        },
        onFinish: (stop, screen) => {
          if (stop.kind === 'match') {
            // A vocabulary word: kick it, in its own color, into the Keywords panel.
            const v = vocab[stop.ref];
            const add = () => this.collectKeyword(v.term, a.keywords);
            if (screen.x < 0) return add();
            this.view.grabWord(v.page, v.start, v.end, add, 0, { color: v.color.solid });
            return;
          }
          const kp = points[stop.ref];
          // The highlighted sentence flies to the Key points list; its card appears when it lands.
          if (screen.x < 0) this.collectKeyPoint(kp);
          else {
            const short = kp.text.length > 48 ? `${kp.text.slice(0, 46).trimEnd()}…` : kp.text;
            this.view.grabWord(kp.source.page, kp.source.start, kp.source.end, () => this.collectKeyPoint(kp), 0, {
              target: () => this.keyPointsTarget(),
              label: short,
            });
          }
          this.grabKeywords(kp, screen, a.keywords, 260);
        },
        onPage: (page) => this.renderCoverage({ walkingPage: page }),
        onDone: () => this.onWalkDone(state),
      },
      state.range,
    );
  }

  onWalkDone(state: DocState): void {
    this.walking = false;
    this.finished = true;
    this.els.playBtn.textContent = '▶';
    // Make sure every keyword is listed, even ones the animation did not fling.
    for (const k of state.analysis?.keywords ?? []) {
      if (!this.collectedKeywords.has(k.display)) this.collectedKeywords.set(k.display, { kw: k, text: k.display, count: k.count });
    }
    this.renderCoverage();
    this.hooks.afterWalk.forEach((f) => f(state));
    this.activeTab = 'summary';
    this.renderPanels();
    toast(t('done'));
  }

  /** Set by the roadmap (mind map ending). */
  showMindMap?: () => void;

  /** Feature flags: see src/core/flags.ts. Everything is free during the launch. */
  isFeatureOn(feature: string): boolean {
    return isEnabled(feature);
  }

  /** A small "premium later" marker for premium features, so the plan is visible from day one. */
  premiumMark(feature: string): string {
    return tierOf(feature) === 'premium' ? ' ✦' : '';
  }

  /** The original File of each document, kept in memory only (for OCR re-reads). */
  files = new Map<string, File>();

  /** Ids of items that just arrived, so only they get the "pop" animation. */
  fresh = new Set<string>();

  collectKeyPoint(kp: KeyPoint): void {
    if (this.collected.some((c) => c.id === kp.id)) return;
    this.collected.push(kp);
    this.fresh.add(kp.id);
    this.renderLeft();
  }

  collectKeyword(word: string, all: Keyword[]): void {
    const kw = all.find((k) => k.display === word) ?? null;
    const cur = this.collectedKeywords.get(word);
    if (!cur) {
      this.collectedKeywords.set(word, { kw, text: word, count: kw?.count ?? 1 });
      this.fresh.add(`kw:${word}`);
    }
    if (this.activeTab === 'keywords') this.renderRight();
  }

  // ---------------------------------------------------------------- controls
  togglePlay(): void {
    if (!this.view.route) return;
    this.view.playing = !this.view.playing;
    this.els.playBtn.textContent = this.view.playing ? '⏸' : '▶';
    this.els.playBtn.setAttribute('aria-label', this.view.playing ? t('pause') : t('play'));
  }

  changeSpeed(factor: number): void {
    this.view.speed = Math.max(0.25, Math.min(16, this.view.speed * factor));
    this.els.speed.textContent = `${this.view.speed}×`;
  }

  skip(): void {
    this.view.finishNow();
  }

  installKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('.modal-back')) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlay();
          break;
        case '+':
        case '=':
          this.changeSpeed(2);
          break;
        case '-':
          this.changeSpeed(0.5);
          break;
        case 's':
        case 'S':
          this.skip();
          break;
        case 'ArrowDown':
          this.view.scrollBy(80);
          break;
        case 'ArrowUp':
          this.view.scrollBy(-80);
          break;
        case 'PageDown':
          this.view.scrollBy(this.els.canvas.clientHeight * 0.9);
          break;
        case 'PageUp':
          this.view.scrollBy(-this.els.canvas.clientHeight * 0.9);
          break;
        default:
          this.onKey?.(e);
      }
    });
  }

  onKey?: (e: KeyboardEvent) => void;
  /** Set by the command panel (step 5). */
  runCommand?: (text: string) => Promise<void>;
  /** Set by the Study tab (step 6). */
  studySections: import('./study').StudySection[] = [];
  openStudy?: (id: string) => void;
  startQuiz?: (limit: number) => void;
  /** A tiny event bus: features tell each other what happened (progress, streaks, celebrations). */
  events = {
    listeners: new Map<string, ((data: Record<string, unknown>) => void)[]>(),
    on(name: string, fn: (data: Record<string, unknown>) => void) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name)!.push(fn);
    },
    emit(name: string, data: Record<string, unknown> = {}) {
      this.listeners.get(name)?.forEach((fn) => fn(data));
    },
  };
  /** Searches the user ran, for the study document. */
  searchLog: { query: string; count: number; pages: number[]; fileName?: string }[] = [];
  /** The last Word Hunt reports, for the study document. */
  lastHunt: import('../hunt/search').HuntReport[] | null = null;
  /** Vocabulary words and their colors (see vocab.ts). */
  vocabColors = new Map<string, import('./vocab').VocabColor>();
  /** The on/off switch for vocabulary colors (set by vocab.ts). */
  vocabToggle?: () => HTMLElement;
  /** True when vocabulary colors are switched on (set by vocab.ts). */
  vocabEnabled?: () => boolean;
  /** Set by study mode (step 7). */
  cardSession?: () => import('./studymode').CardSession | null;
  setCardSession?: (s: import('./studymode').CardSession | null) => void;
  /** Set by Word Hunt (step 5). */
  huntWalk!: (state: import('./wordhunt').HuntState) => Promise<void>;

  // ---------------------------------------------------------------- coverage
  /** Known problem 3: never quietly stop. The coverage bar always says what was read. */
  renderCoverage(live: { loading?: number; analyzing?: number; walkingPage?: number } = {}): void {
    const el = this.els?.coverage;
    if (!el) return;
    clear(el);
    el.classList.remove('warn');
    const s = this.state;
    if (live.loading !== undefined) {
      el.append(h('div', {}, t('loading')), h('div', { class: 'bar' }, h('span', { style: { width: `${Math.round(live.loading * 100)}%` } })));
      return;
    }
    if (live.analyzing !== undefined) {
      el.append(h('div', {}, t('analyzing')), h('div', { class: 'bar' }, h('span', { style: { width: `${Math.round(live.analyzing * 100)}%` } })));
      return;
    }
    if (!s?.analysis) {
      el.append(h('span', { class: 'muted' }, t('motto')));
      return;
    }
    const c = s.analysis.coverage;
    const realSkips = c.skipped.filter((x) => !x.reason.includes('outside'));
    const outside = c.skipped.filter((x) => x.reason.includes('outside'));
    const walked = live.walkingPage ? ` · 🕷 ${t('pageLong')} ${live.walkingPage}` : '';
    el.append(h('strong', {}, t('coverage', { read: c.readPages, total: c.totalPages })), walked);
    const ocrPages = s.doc.pages.filter((p) => p.ocr).length;
    if (ocrPages) el.append(h('span', { class: 'muted' }, ` · OCR: ${ocrPages}`));
    if (c.skipped.length) {
      el.classList.add('warn');
      const parts: string[] = [];
      if (realSkips.length) parts.push(`${realSkips.map((x) => x.page).join(', ')} (${realSkips[0].reason})`);
      if (outside.length) parts.push(`${outside.length} ${outside[0].reason}`);
      el.append(h('div', { class: 'muted' }, t('coverageSkipped', { n: c.skipped.length, list: parts.join('; ') })));
    } else {
      el.append(' · ', h('span', { class: 'muted' }, t('coverageAll')));
    }
    el.append(h('div', { class: 'bar' }, h('span', { style: { width: `${Math.round((c.readPages / Math.max(1, c.totalPages)) * 100)}%` } })));
  }

  // ------------------------------------------------------------------ panels
  registerCoreTabs(): void {
    this.tabs.push(
      { id: 'keywords', label: () => t('keywords'), render: (el) => this.renderKeywords(el) },
      { id: 'summary', label: () => t('summary'), render: (el) => this.renderSummary(el) },
      { id: 'about', label: () => t('metadata'), render: (el) => this.renderAbout(el) },
    );
    this.leftSections.push({ id: 'keypoints', render: (el) => this.renderKeyPointList(el) });
  }

  renderPanels(): void {
    this.renderLeft();
    this.renderRight();
  }

  renderLeft(): void {
    const el = this.els.left;
    const scroll = el.scrollTop;
    clear(el);
    for (const s of this.leftSections) {
      const box = h('section', { 'data-section': s.id });
      s.render(box);
      el.append(box);
    }
    el.scrollTop = scroll;
  }

  renderRight(): void {
    const el = this.els.right;
    clear(el);
    const tabs = h(
      'div',
      { class: 'tabs', role: 'tablist' },
      ...this.tabs.map((tab) =>
        h(
          'button',
          {
            role: 'tab',
            'data-tab': tab.id,
            'aria-selected': String(tab.id === this.activeTab),
            onclick: () => {
              this.activeTab = tab.id;
              this.renderRight();
            },
          },
          tab.label(),
        ),
      ),
    );
    const body = h('div', { role: 'tabpanel' });
    (this.tabs.find((x) => x.id === this.activeTab) ?? this.tabs[0]).render(body);
    el.append(tabs, body);
  }

  /** A key point card: the text, its page, and whether it is a quote or the spider's words. */
  keyPointCard(kp: KeyPoint, extra?: HTMLElement | null, fileName?: string): HTMLElement {
    const dir = dirOf(kp.text);
    const isNew = this.fresh.delete(kp.id);
    return h(
      'li',
      { class: isNew ? 'kp pop' : 'kp', dir },
      h(
        'div',
        { class: 'meta' },
        h(
          'button',
          { class: 'link', onclick: () => this.jumpTo(kp.source.docId, kp.source.page, kp.source.start, kp.source.end) },
          fileName ? `${fileName} · ` : '',
          `${t('page')} ${kp.source.page}`,
        ),
        h('span', { class: `badge ${kp.kind === 'quote' ? 'quote' : 'explain'}` }, kp.kind === 'quote' ? `❝ ${t('quote')}` : `🕷 ${t('explanation')}`),
      ),
      h('div', { class: 'text' }, kp.text),
      extra ?? null,
    );
  }

  /** Extra buttons under a key point. Later steps add "go deeper" here. */
  keyPointExtras(_kp: KeyPoint): HTMLElement | null {
    return null;
  }

  renderKeyPointList(el: HTMLElement): void {
    el.append(h('h2', {}, `${t('keyPoints')} (${this.collected.length})`));
    const list = h('ul', { class: 'kp-list' });
    for (const kp of this.collected) list.append(this.keyPointCard(kp, this.keyPointExtras(kp), this.fileLabel(kp.source.docId)));
    el.append(list);
  }

  fileLabel(docId: string): string | undefined {
    if (this.docs.length < 2) return undefined;
    return this.docs.find((d) => d.doc.id === docId)?.doc.fileName;
  }

  jumpTo(docId: string, page: number, start: number, end: number): void {
    const idx = this.docs.findIndex((d) => d.doc.id === docId);
    if (idx >= 0 && idx !== this.active) this.switchDoc(idx);
    this.view.highlights = this.view.highlights.filter((x) => x.kind !== 'current');
    this.view.highlights.push({ page, start, end, kind: 'current' });
    this.view.goTo(page, start, end, true);
    if (this.els.workspace.dataset.mobile !== 'none') this.mobile('none');
  }

  /** Library mode overrides this to show another file's pages. */
  switchDoc(idx: number): void {
    this.active = idx;
    this.view.setPages(this.docs[idx].doc.pages);
  }

  renderKeywords(el: HTMLElement): void {
    if (this.vocabToggle && this.state) el.append(this.vocabToggle());
    const list = [...this.collectedKeywords.values()];
    if (!list.length) {
      el.append(h('p', { class: 'muted' }, this.state ? '🕷 …' : t('dropHint')));
      return;
    }
    el.append(
      h(
        'div',
        { class: 'chips' },
        ...list.map((k) =>
          h(
            'button',
            {
              class: this.fresh.delete(`kw:${k.text}`) ? 'chip pop' : 'chip',
              dir: dirOf(k.text),
              title: k.kw ? `${t('pages')}: ${k.kw.pages.slice(0, 12).join(', ')}` : '',
              style: this.vocabColors.has(k.text) ? { borderColor: this.vocabColors.get(k.text)!.solid, background: this.vocabColors.get(k.text)!.fill, borderWidth: '2px' } : {},
              onclick: () => this.onKeywordClick(k.text),
            },
            k.text,
            h('b', {}, String(k.count)),
          ),
        ),
      ),
    );
  }

  /** Step 5 turns this into a search. */
  onKeywordClick(_word: string): void {}

  renderSummary(el: HTMLElement): void {
    const a = this.state?.analysis;
    if (!a) {
      el.append(h('p', { class: 'muted' }, '🕷 …'));
      return;
    }
    if (!this.finished) el.append(h('p', { class: 'muted' }, '🕷 … ', t('skip'), ' (S)'));
    this.renderSummaryBody(el, a);
  }

  renderSummaryBody(el: HTMLElement, a: AnalysisResult): void {
    if (this.state) el.append(this.topicCard(a, this.state.doc.meta));
    el.append(h('h2', {}, t('wholeBook')));
    // Known problem 1: show that every part of the book was used, not just the start and end.
    const spread = spreadReport(a);
    if (spread.rows.length > 1) {
      const max = Math.max(1, ...spread.rows.map((r) => r.points));
      el.append(
        h(
          'div',
          { class: 'spread', 'aria-label': 'Key points per part of the document', style: { display: 'flex', gap: '2px', alignItems: 'flex-end', height: '34px', margin: '4px 0 10px' } },
          ...spread.rows.map((r) =>
            h('span', {
              title: `${r.title.startsWith('Pages ') ? t('pages') + r.title.slice(5) : r.title}: ${r.points} (${t('page')} ${r.fromPage}–${r.toPage})`,
              style: { flex: '1', background: r.points ? 'var(--accent)' : 'var(--danger)', height: `${Math.max(12, (r.points / max) * 100)}%`, borderRadius: '2px' },
            }),
          ),
        ),
      );
    }
    const list = h('ul', { class: 'kp-list' });
    for (const kp of a.keyPoints) list.append(this.keyPointCard(kp, this.keyPointExtras(kp), this.fileLabel(kp.source.docId)));
    el.append(list);
    if (a.chunks.length > 1) {
      for (const c of a.chunks) {
        const det = h('details', {}, h('summary', { dir: 'auto' }, `${this.chunkTitle(c.chunk)} (${t('page')} ${c.chunk.fromPage}–${c.chunk.toPage})`));
        const l = h('ul', { class: 'kp-list' });
        for (const kp of c.keyPoints) l.append(this.keyPointCard(kp, this.keyPointExtras(kp)));
        det.append(h('div', { class: 'chips', style: { margin: '6px 0' } }, ...c.keywords.slice(0, 8).map((k) => h('span', { class: 'chip' }, k.display))), l);
        el.append(det);
      }
    }
  }

  /** Topic, main point and name ideas for the file (see analysis/topic.ts). */
  topicCard(a: AnalysisResult, meta: import('../core/types').DocMeta): HTMLElement {
    const info = topicInfo(a, meta);
    const copy = (text: string) => {
      navigator.clipboard?.writeText(text).then(
        () => toast(`${t('copied')}: ${text}`),
        () => toast(text),
      );
    };
    const box = h('div', { class: 'topic-card', style: { border: '2px solid var(--accent)', borderRadius: '10px', padding: '10px 12px', margin: '0 0 12px' } });
    box.append(h('h2', { style: { marginTop: '0' } }, `🏷 ${t('topicTitle')}`));
    if (info.terms.length) {
      box.append(h('p', {}, h('strong', {}, `${t('topicIs')} `), h('span', { dir: 'auto' }, joinList(info.terms, info.lang))));
    }
    if (info.mainPoint) {
      const mp = info.mainPoint;
      box.append(
        h('p', { style: { marginBottom: '2px' } }, h('strong', {}, `💡 ${t('mainPoint')}`)),
        h(
          'blockquote',
          { dir: dirOf(mp.text), style: { margin: '0 0 8px', paddingInlineStart: '10px', borderInlineStart: '3px solid var(--accent)' } },
          `“${mp.text}” `,
          h('button', { class: 'link', onclick: () => this.jumpTo(mp.source.docId, mp.source.page, mp.source.start, mp.source.end) }, `${t('page')} ${mp.source.page}`),
        ),
      );
    }
    if (info.names.length) {
      box.append(
        h('p', { style: { marginBottom: '4px' } }, h('strong', {}, `✏️ ${t('nameIdeas')}`), h('span', { class: 'muted' }, ` (${t('tapToCopy')})`)),
        h('div', { class: 'chips' }, ...info.names.map((n) => h('button', { class: 'chip', dir: 'auto', onclick: () => copy(n) }, n))),
        h(
          'p',
          { class: 'muted', style: { marginTop: '6px' } },
          `📁 ${t('fileNameIdea')}: `,
          h('button', { class: 'link', dir: 'auto', onclick: () => copy(info.fileName) }, info.fileName),
        ),
      );
    }
    return box;
  }

  /** "No AI-writing detector": we show the document's own metadata instead. */
  renderAbout(el: HTMLElement): void {
    const s = this.state;
    if (!s) {
      el.append(h('p', { class: 'muted' }, t('privacy')));
      return;
    }
    const m = s.doc.meta;
    el.append(h('h2', {}, s.doc.fileName));
    const rows: [string, string | undefined][] = [
      ['title', m.title],
      ['author', m.author],
      ['publisher', m.publisher],
      ['date', m.date],
    ];
    const known = rows.filter(([, v]) => v);
    if (known.length) el.append(h('table', {}, ...known.map(([k, v]) => h('tr', {}, h('th', {}, t(k)), h('td', { dir: 'auto' }, v!)))));
    else el.append(h('p', { class: 'muted' }, t('noMeta')));
    el.append(h('p', { class: 'muted' }, `${s.doc.pages.length} ${t('pages').toLowerCase()} · ${s.doc.kind.toUpperCase()}`));
    if (s.analysis) el.append(h('p', { class: 'muted' }, `${t('language')}: ${s.analysis.languages.join(', ')}`));
    if (s.doc.warnings.length) el.append(h('div', { class: 'warn-box' }, h('strong', {}, t('warnings')), h('ul', {}, ...s.doc.warnings.map((w) => h('li', {}, w)))));
    el.append(h('p', { class: 'muted' }, `✦ = ${t('premium')}`));
    if (DEVELOPER_MODE) {
      const timings = s.analysis ? Object.entries(s.analysis.timingsMs).map(([k, v]) => `${k}: ${v} ms`).join('\n') : '';
      const route = this.view.route ? `route: ${this.view.route.points.length} points, ~${Math.round(this.view.route.seconds)} s at 1x` : '';
      el.append(h('h3', {}, t('dev')), h('div', { class: 'dev' }, [...s.doc.log, timings, route].filter(Boolean).join('\n')));
    }
  }
}
