// The optional local AI, in the interface.
// Off by default: students who do not want AI never see an AI button.
// When on, each key point gets "Ask my AI", which sends only the nearby pages
// to Ollama on this same computer.

import { ask, DEFAULT_URL, listModels, pickExcerpts } from '../ai/local';
import type { KeyPoint } from '../core/types';
import type { App } from './app';
import { h, modal } from './dom';
import { getUiLang, t } from './i18n';

const STORE_KEY = 'ankabut.localAi';

interface AiSettings {
  enabled: boolean;
  model: string;
  url: string;
}

function load(): AiSettings {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<AiSettings>;
    return { enabled: s.enabled === true, model: typeof s.model === 'string' ? s.model : '', url: DEFAULT_URL };
  } catch {
    return { enabled: false, model: '', url: DEFAULT_URL };
  }
}

function save(s: AiSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ enabled: s.enabled, model: s.model }));
  } catch {
    /* the choice still works for this visit */
  }
}

export function installLocalAi(app: App): void {
  const cfg = load();

  // ---------------------------------------------------------- settings block
  app.settingsExtras.push(() => {
    const status = h('p', { class: 'muted', role: 'status', style: { fontSize: '13px' } });
    const modelSel = h('select', { 'aria-label': t('aiModel') }) as HTMLSelectElement;
    const modelRow = h('label', { style: { display: 'none', margin: '8px 0' } }, h('div', { class: 'muted' }, t('aiModel')), modelSel);
    modelSel.addEventListener('change', () => {
      cfg.model = modelSel.value;
      save(cfg);
      app.renderPanels();
    });
    const refresh = async () => {
      if (!cfg.enabled) {
        modelRow.style.display = 'none';
        status.textContent = '';
        return;
      }
      status.textContent = `${t('loading')}…`;
      try {
        const models = await listModels(cfg.url);
        if (!models.length) {
          status.textContent = `⚠ ${t('aiNoModels')}`;
          modelRow.style.display = 'none';
          return;
        }
        modelSel.replaceChildren(...models.map((m) => h('option', { value: m.name }, `${m.name} (${(m.size / 1e9).toFixed(1)} GB)`)));
        if (!models.some((m) => m.name === cfg.model)) {
          cfg.model = models[0].name;
          save(cfg);
        }
        modelSel.value = cfg.model;
        modelRow.style.display = 'block';
        status.textContent = `✅ ${t('aiConnected')}`;
      } catch {
        modelRow.style.display = 'none';
        status.textContent = `⚠ ${t('aiNotRunning')}`;
      }
      app.renderPanels();
    };
    const box = h('input', { type: 'checkbox', checked: cfg.enabled }) as HTMLInputElement;
    box.addEventListener('change', () => {
      cfg.enabled = box.checked;
      save(cfg);
      void refresh();
      app.renderPanels();
    });
    void refresh();
    return h(
      'div',
      {},
      h('h3', { style: { margin: '16px 0 4px' } }, `🤖 ${t('aiTitle')}`),
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' } }, box, t('aiEnable')),
      modelRow,
      status,
      h('p', { class: 'muted', style: { fontSize: '12px' } }, `🔒 ${t('aiNote')}`),
    );
  });

  // ---------------------------------------------------------- ask window
  const openAsk = (kp: KeyPoint) => {
    const s = app.state;
    if (!s || !cfg.enabled || !cfg.model) return;
    const pages = s.doc.pages.map((p) => ({ page: p.number, text: p.text }));
    const question = h('textarea', { rows: 2, dir: 'auto', 'aria-label': t('aiQuestion') }, t('aiDefaultQ')) as HTMLTextAreaElement;
    const answer = h('div', { class: 'ai-answer', dir: 'auto', 'aria-live': 'polite' });
    const label = h('p', { class: 'ai-label' }, `⚠ ${t('aiLabel', { p: kp.source.page })}`);
    let running: { abort: () => void } | null = null;
    const askBtn = h('button', { class: 'btn primary' }, `🤖 ${t('aiAsk')}`) as HTMLButtonElement;
    const run = () => {
      if (running) {
        running.abort();
        return;
      }
      answer.textContent = '';
      askBtn.textContent = `⏹ ${t('aiStop')}`;
      const r = ask({
        url: cfg.url,
        model: cfg.model,
        question: `${question.value.trim() || t('aiDefaultQ')}\n\nThe sentence the student is looking at (page ${kp.source.page}): "${kp.text}"`,
        excerpts: pickExcerpts(pages, kp.source.page),
        lang: getUiLang(),
        onToken: (piece) => (answer.textContent += piece),
      });
      running = r;
      r.done
        .catch((e: unknown) => {
          if ((e as Error)?.name !== 'AbortError') answer.textContent = `⚠ ${t('aiNotRunning')}`;
        })
        .finally(() => {
          running = null;
          askBtn.textContent = `🤖 ${t('aiAsk')}`;
        });
    };
    askBtn.addEventListener('click', run);
    const close = modal(
      h(
        'div',
        {},
        h('h2', {}, `🤖 ${t('aiTitle')}`),
        h('blockquote', { class: 'ai-quote', dir: 'auto' }, `“${kp.text}” · ${t('page')} ${kp.source.page}`),
        question,
        answer,
        label,
        h('div', { class: 'actions' }, askBtn, h('button', { class: 'btn', onclick: () => close() }, t('close'))),
      ),
      () => running?.abort(),
    );
    run();
  };

  app.cardButtons.push((kp) => (cfg.enabled && cfg.model ? h('button', { class: 'link', onclick: () => openAsk(kp) }, `🤖 ${t('aiAskShort')}`) : null));
}
