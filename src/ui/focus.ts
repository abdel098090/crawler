// Focus timer and daily goal in the interface.
//
// ⏱ button in the toolbar: shows the time left. Click it for a small panel:
// start, pause, stop, focus length (15, 25, 45 min) and break length (5, 10).
// When a focus block ends: a soft sound, a message to take a break, and the
// spider pauses. The time left is also shown in the browser tab title.
//
// 📖 chip: pages read today and the goal ("4 / 10"). The goal is chosen in
// the Progress tab. Each page counts once per day.

import {
  addFocusBlock, addPages, BREAK_CHOICES, clock, FOCUS_CHOICES, freshToday, GOAL_CHOICES, goalStatus, isPaused, newTimer, pause, resume, rollover, start, stop, tick, timeLeft,
  type Timer, type Today,
} from '../study/focus';
import type { App } from './app';
import { h, toast } from './dom';
import { t } from './i18n';

const KEY = 'ankabut.focus';

interface Saved {
  timer: Timer;
  today: Today;
  goal: number;
  sound: boolean;
}

function load(): Saved {
  const base: Saved = { timer: newTimer(), today: freshToday(), goal: 10, sound: true };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    return {
      timer: s.timer && typeof s.timer.phase === 'string' ? { ...newTimer(), ...s.timer } : base.timer,
      today: s.today && Array.isArray(s.today.pages) ? rollover(s.today) : base.today,
      goal: GOAL_CHOICES.includes(Number(s.goal)) ? Number(s.goal) : base.goal,
      sound: s.sound !== false,
    };
  } catch {
    return base;
  }
}

/** A short, soft two-note chime. Silent if the browser blocks sound. */
function chime(): void {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.32);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* no sound available */
  }
}

export function installFocus(app: App): void {
  const s = load();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* works for this visit */
    }
  };
  const baseTitle = document.title;

  // ---------------------------------------------------------------- toolbar
  const timerBtn = h('button', { class: 'btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: t('focusTimer') }, '⏱') as HTMLButtonElement;
  const goalChip = h('button', { class: 'btn goal-chip', title: t('dailyGoal'), onclick: () => { app.activeTab = 'progress'; app.renderRight(); } }) as HTMLButtonElement;
  let panel: HTMLElement | null = null;

  const renderGoalChip = () => {
    const g = goalStatus(s.today, s.goal);
    goalChip.style.display = s.goal ? '' : 'none';
    goalChip.textContent = `${g.reached ? '🎉' : '📖'} ${g.read}/${g.goal}`;
    goalChip.style.setProperty('--goal', `${Math.round(g.share * 100)}%`);
    goalChip.setAttribute('aria-label', t('goalAria', { n: g.read, goal: g.goal }));
  };

  const renderPanel = () => {
    if (!panel) return;
    const tm = s.timer;
    const left = timeLeft(tm);
    const phaseText = tm.phase === 'idle' ? t('focusReady') : tm.phase === 'focus' ? `📖 ${t('focusPhase')}` : `☕ ${t('breakPhase')}`;
    const select = (label: string, value: number, choices: number[], set: (v: number) => void) => {
      const sel = h('select', { 'aria-label': label, disabled: tm.phase !== 'idle', onchange: (e: Event) => { set(Number((e.target as HTMLSelectElement).value)); save(); renderPanel(); } }, ...choices.map((c) => h('option', { value: String(c) }, `${c} min`))) as HTMLSelectElement;
      sel.value = String(value);
      return h('label', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', margin: '4px 0' } }, label, sel);
    };
    const buttons = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' } });
    if (tm.phase === 'idle') buttons.append(h('button', { class: 'btn primary', onclick: () => act(start(s.timer)) }, `▶ ${t('start')}`));
    else {
      buttons.append(
        isPaused(tm)
          ? h('button', { class: 'btn primary', onclick: () => act(resume(s.timer)) }, `▶ ${t('play')}`)
          : h('button', { class: 'btn', onclick: () => act(pause(s.timer)) }, `⏸ ${t('pause')}`),
        h('button', { class: 'btn', onclick: () => act(stop(s.timer)) }, `⏹ ${t('focusStop')}`),
      );
    }
    const sound = h('input', { type: 'checkbox', checked: s.sound, onchange: (e: Event) => { s.sound = (e.target as HTMLInputElement).checked; save(); } });
    panel.replaceChildren(
      h('strong', {}, `⏱ ${t('focusTimer')}`),
      h('div', { class: 'focus-clock', role: 'timer', 'aria-live': 'off' }, tm.phase === 'idle' ? clock(tm.focusMin * 60_000) : clock(left)),
      h('div', { class: 'muted' }, phaseText + (isPaused(tm) ? ` · ${t('pause')}` : '')),
      buttons,
      select(t('focusLength'), tm.focusMin, FOCUS_CHOICES, (v) => (s.timer = { ...s.timer, focusMin: v })),
      select(t('breakLength'), tm.breakMin, BREAK_CHOICES, (v) => (s.timer = { ...s.timer, breakMin: v })),
      h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', margin: '4px 0' } }, sound, `🔔 ${t('focusSound')}`),
      h('p', { class: 'muted', style: { fontSize: '12px', margin: '6px 0 0' } }, t('focusTip', { n: rollover(s.today).focusBlocks })),
    );
  };

  const renderButton = () => {
    const tm = s.timer;
    if (tm.phase === 'idle') {
      timerBtn.textContent = '⏱';
      document.title = baseTitle;
    } else {
      const c = clock(timeLeft(tm));
      timerBtn.textContent = `${tm.phase === 'focus' ? '📖' : '☕'} ${c}${isPaused(tm) ? ' ⏸' : ''}`;
      document.title = `${tm.phase === 'focus' ? '📖' : '☕'} ${c} · ${baseTitle}`;
    }
  };

  const act = (next: Timer) => {
    s.timer = next;
    save();
    renderButton();
    renderPanel();
  };

  const closePanel = () => {
    panel?.remove();
    panel = null;
    timerBtn.setAttribute('aria-expanded', 'false');
  };
  timerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel) return closePanel();
    panel = h('div', { class: 'popover focus-panel', role: 'dialog', 'aria-label': t('focusTimer') });
    panel.addEventListener('click', (ev) => ev.stopPropagation());
    const r = timerBtn.getBoundingClientRect();
    Object.assign(panel.style, { top: `${r.bottom + 6}px`, left: `${Math.max(8, Math.min(r.left, innerWidth - 270))}px`, width: '250px', maxWidth: 'calc(100vw - 16px)' });
    document.body.append(panel);
    timerBtn.setAttribute('aria-expanded', 'true');
    renderPanel();
  });
  document.addEventListener('click', () => panel && closePanel());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && panel && closePanel());
  app.els.controls.append(timerBtn, goalChip);

  // ---------------------------------------------------------------- every second
  setInterval(() => {
    const { timer, event } = tick(s.timer);
    if (event) {
      s.timer = timer;
      if (event === 'focus-done') {
        s.today = addFocusBlock(s.today);
        // Breaks matter: pause the spider so the student really stops.
        app.view.playing = false;
        toast(`☕ ${t('breakNow', { n: s.timer.breakMin })}`, 9000);
      } else {
        toast(`📖 ${t('breakOver')}`, 7000);
      }
      if (s.sound) chime();
      save();
      renderPanel();
    }
    if (s.timer.phase !== 'idle') {
      renderButton();
      if (panel) {
        const c = panel.querySelector('.focus-clock');
        if (c) c.textContent = clock(timeLeft(s.timer));
      }
    }
    // A new day started while the app was open.
    const r = rollover(s.today);
    if (r !== s.today) {
      s.today = r;
      save();
      renderGoalChip();
    }
  }, 1000);

  // ---------------------------------------------------------------- daily goal
  app.hooks.afterWalk.push((st) => {
    const skipped = new Set(st.analysis?.coverage.skipped.map((x) => x.page) ?? []);
    const pages: number[] = [];
    for (let n = st.range.from; n <= st.range.to; n++) if (!skipped.has(n)) pages.push(n);
    const before = goalStatus(s.today, s.goal);
    s.today = addPages(s.today, st.doc.fileName, pages);
    const after = goalStatus(s.today, s.goal);
    if (after.reached && !before.reached && !s.today.celebrated) {
      s.today = { ...s.today, celebrated: true };
      toast(`🎉 ${t('goalReached', { n: after.goal })}`, 7000);
      if (s.sound) chime();
    }
    save();
    renderGoalChip();
  });

  // The goal picker and today's numbers sit at the top of the Progress tab.
  const progress = app.tabs.find((x) => x.id === 'progress');
  if (progress) {
    const inner = progress.render;
    progress.render = (el) => {
      const g = goalStatus(s.today, s.goal);
      const sel = h('select', { 'aria-label': t('dailyGoal'), onchange: (e: Event) => { s.goal = Number((e.target as HTMLSelectElement).value); save(); renderGoalChip(); app.renderRight(); } },
        ...GOAL_CHOICES.map((c) => h('option', { value: String(c) }, c ? t('goalPages', { n: c }) : t('goalOff')))) as HTMLSelectElement;
      sel.value = String(s.goal);
      el.append(
        h(
          'div',
          { class: 'card today-card' },
          h('h3', { style: { margin: '0 0 6px' } }, `📅 ${t('today')}`),
          h('label', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } }, `🎯 ${t('dailyGoal')}`, sel),
          s.goal
            ? h('div', { class: 'goal-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(g.goal), 'aria-valuenow': String(g.read) }, h('span', { style: { width: `${Math.round(g.share * 100)}%` } }))
            : null,
          h('p', { style: { margin: '6px 0 0' } }, `📖 ${t('pagesToday', { n: g.read })}${s.goal ? ` / ${g.goal}` : ''} · ⏱ ${t('blocksToday', { n: rollover(s.today).focusBlocks })}`),
        ),
      );
      inner(el);
    };
  }

  renderGoalChip();
  renderButton();
}
