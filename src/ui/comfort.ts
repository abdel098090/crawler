// Reading comfort, from what students asked for:
// - an easy-to-read font (Lexend or Atkinson Hyperlegible, both made for
//   readers with dyslexia or low vision), bundled with the app, nothing downloaded,
// - more space between lines,
// - a voice picker for Read aloud, because the default voice often sounds robotic.
// All three live in the Settings dialog and are remembered on this device.

import '@fontsource/lexend/400.css';
import '@fontsource/lexend/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import type { Lang } from '../core/types';
import type { App } from './app';
import { h } from './dom';
import { t } from './i18n';

export type ReadingFont = 'default' | 'lexend' | 'atkinson';
export type Spacing = 'normal' | 'wide' | 'extra';

export interface Comfort {
  font: ReadingFont;
  spacing: Spacing;
  /** Chosen voice name per language. Missing = automatic. */
  voices: Partial<Record<Lang, string>>;
}

const STORE_KEY = 'ankabut.comfort';
const FAMILY: Record<ReadingFont, string | undefined> = {
  default: undefined,
  lexend: '"Lexend"',
  atkinson: '"Atkinson Hyperlegible"',
};
export const LINE_FACTOR: Record<Spacing, number> = { normal: 1.7, wide: 2.1, extra: 2.5 };
const SAMPLE: Record<Lang, string> = {
  en: 'Hello, I will read with you.',
  fr: 'Bonjour, je vais lire avec toi.',
  es: 'Hola, voy a leer contigo.',
  ar: 'مرحبا، سأقرأ معك.',
};
const LANGS: [Lang, string][] = [['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['ar', 'العربية']];

function load(): Comfort {
  const base: Comfort = { font: 'default', spacing: 'normal', voices: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Comfort>;
    return {
      font: saved.font && saved.font in FAMILY ? saved.font : base.font,
      spacing: saved.spacing && saved.spacing in LINE_FACTOR ? saved.spacing : base.spacing,
      voices: typeof saved.voices === 'object' && saved.voices ? saved.voices : {},
    };
  } catch {
    return base;
  }
}

function save(c: Comfort): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {
    // Private windows can block storage. The choice still works for this visit.
  }
}

/** The voice for a language: the one the user picked if it still exists, else none (automatic). */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang, chosen: Partial<Record<Lang, string>>): SpeechSynthesisVoice | undefined {
  const name = chosen[lang];
  const own = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  // Automatic prefers a voice that runs on the device: online voices send the text to a server.
  return (name && own.find((v) => v.name === name)) || own.find((v) => v.localService && v.default) || own.find((v) => v.localService) || own[0];
}

export function installComfort(app: App): void {
  const c = load();

  const apply = async () => {
    const family = FAMILY[c.font];
    const m = app.view.metrics;
    app.view.metrics = { ...m, fontFamily: family, lineFactor: LINE_FACTOR[c.spacing], lineHeight: Math.round(m.fontSize * LINE_FACTOR[c.spacing]) };
    document.documentElement.style.setProperty('--reading-font', family ?? 'inherit');
    document.documentElement.classList.toggle('comfort-font', !!family);
    // The page is drawn on a canvas, so wait until the font file is ready before measuring.
    if (family && document.fonts) {
      try {
        await document.fonts.load(`16px ${family}`);
      } catch {
        /* the default font is used instead */
      }
    }
    app.view.relayout();
  };

  app.voiceFor = (lang) => pickVoice(typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices(), lang, c.voices);

  const select = (label: string, value: string, options: [string, string][], onChange: (v: string) => void) => {
    const sel = h('select', { 'aria-label': label, onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) }, ...options.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = value;
    return h('label', { style: { display: 'block', margin: '10px 0' } }, h('div', { class: 'muted' }, label), sel);
  };

  app.settingsExtras.push(() => {
    const box = h(
      'div',
      {},
      h('h3', { style: { margin: '16px 0 4px' } }, `📖 ${t('comfortTitle')}`),
      select(t('readingFont'), c.font, [
        ['default', t('fontDefault')],
        ['lexend', 'Lexend'],
        ['atkinson', 'Atkinson Hyperlegible'],
      ], (v) => {
        c.font = v as ReadingFont;
        save(c);
        void apply();
      }),
      select(t('lineSpacing'), c.spacing, [
        ['normal', t('spacingNormal')],
        ['wide', t('spacingWide')],
        ['extra', t('spacingExtra')],
      ], (v) => {
        c.spacing = v as Spacing;
        save(c);
        void apply();
      }),
    );
    if (typeof speechSynthesis !== 'undefined') {
      const all = speechSynthesis.getVoices();
      let any = false;
      for (const [lang, name] of LANGS) {
        const own = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
        if (!own.length) continue;
        any = true;
        box.append(
          select(`🔊 ${t('voice')}: ${name}`, c.voices[lang] ?? '', [['', t('voiceAuto')], ...own.map((v): [string, string] => [v.name, `${v.name}${v.localService ? '' : ' ☁'}`])], (v) => {
            if (v) c.voices[lang] = v;
            else delete c.voices[lang];
            save(c);
            // Let the student hear the new voice at once.
            const sample = new SpeechSynthesisUtterance(SAMPLE[lang]);
            const voice = app.voiceFor?.(lang);
            if (voice) sample.voice = voice;
            sample.lang = voice?.lang ?? lang;
            speechSynthesis.cancel();
            speechSynthesis.speak(sample);
          }),
        );
      }
      if (any) box.append(h('p', { class: 'muted', style: { fontSize: '12px' } }, t('voiceNote')));
    }
    return box;
  });

  void apply();
}
