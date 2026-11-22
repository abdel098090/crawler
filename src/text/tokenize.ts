// Splitting text into sentences and words, while remembering where each
// piece sits in the original text (so we can highlight it on the page later).

import type { Lang } from '../core/types';
import { hasArabic, normalizeArabic, stemArabic } from './arabic';
import { detectLang } from './lang';
import { isStopword, latinNorm } from './stopwords';

export interface Sentence {
  text: string;
  start: number;
  end: number;
  lang: Lang;
}

export interface Token {
  /** The word exactly as written. */
  raw: string;
  /** Lowercased, accents or tashkeel removed. */
  norm: string;
  /** Normalized and lightly stemmed, used to group word forms together. */
  stem: string;
  start: number;
  end: number;
  arabic: boolean;
}

// A sentence ends at . ! ? ؟ … or a blank line. We avoid splitting on
// common abbreviations and decimal numbers like 3.14.
const ABBREV = /\b(?:e\.g|i\.e|etc|mr|mrs|ms|dr|prof|fig|vs|p|pp|no|vol|ch|art|cf|ex|env|av|j\.-c)\.$/i;

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  const push = (end: number) => {
    // Trim spaces on both sides but keep exact offsets.
    let s = start;
    let e = end;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e - s >= 2) {
      const t = text.slice(s, e);
      out.push({ text: t, start: s, end: e, lang: detectLang(t) });
    }
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' && text[i + 1] === '\n') {
      push(i);
      continue;
    }
    if ('.!?؟…'.includes(ch)) {
      // Keep groups like "?!" or "..." together.
      let j = i;
      while (j + 1 < text.length && '.!?؟…"»”)'.includes(text[j + 1])) j++;
      const next = text[j + 1];
      if (next !== undefined && !/\s/.test(next)) {
        i = j;
        continue;
      }
      if (ch === '.') {
        const before = text.slice(Math.max(0, i - 8), i + 1);
        if (ABBREV.test(before)) continue;
        if (/\d$/.test(text.slice(0, i)) && /^\s*\d/.test(text.slice(j + 1, j + 3))) continue;
      }
      push(j + 1);
      i = j;
    }
  }
  push(text.length);
  return out;
}

const WORD = /[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’\-]*/gu;

export function normalizeWord(raw: string): string {
  if (hasArabic(raw)) return normalizeArabic(raw).replace(/[^ء-ي0-9٠-٩]/g, '');
  return latinNorm(raw).replace(/[’]/g, "'").replace(/^'+|'+$/g, '');
}

/** English and French light stemming: just enough to join plurals. */
export function stemLatin(norm: string): string {
  if (norm.length <= 4) return norm;
  if (norm.endsWith('ies') && norm.length > 5) return norm.slice(0, -3) + 'y';
  if (norm.endsWith('aux') && norm.length > 5) return norm.slice(0, -3) + 'al';
  if (norm.endsWith('sses')) return norm.slice(0, -2);
  if (norm.endsWith('s') && !norm.endsWith('ss') && !norm.endsWith('us') && !norm.endsWith('is')) return norm.slice(0, -1);
  if (norm.endsWith('x') && /[eo]ux$/.test(norm)) return norm.slice(0, -1);
  return norm;
}

export function stemWord(norm: string, arabic: boolean): string {
  return arabic ? stemArabic(norm) : stemLatin(norm);
}

export function tokenize(text: string, offset = 0): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD)) {
    const raw = m[0].replace(/[\-'’]+$/, '');
    const arabic = hasArabic(raw);
    // French elision: "l'ordinateur" -> "ordinateur", "d'une" -> "une".
    let rawCore = raw;
    let shift = 0;
    const elision = !arabic ? /^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)['’]/i.exec(raw) : null;
    if (elision) {
      shift = elision[0].length;
      rawCore = raw.slice(shift);
    }
    const norm = normalizeWord(rawCore);
    if (!norm) continue;
    const start = offset + (m.index ?? 0) + shift;
    out.push({ raw: rawCore, norm, stem: stemWord(norm, arabic), start, end: start + rawCore.length, arabic });
  }
  return out;
}

/** Tokens worth considering as keywords. */
export function contentTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => {
    if (isStopword(t.norm)) return false;
    if (/^[0-9٠-٩]+$/.test(t.norm)) return false;
    return t.arabic ? t.norm.length >= 3 : t.norm.length >= 3;
  });
}
