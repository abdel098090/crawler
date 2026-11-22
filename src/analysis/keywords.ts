// Keyword extraction with a frequency score.
//
// The idea: a word that appears often in THIS part of the book, but not on
// every single page of the book, is probably an important term here.
// That is the classic TF-IDF idea (term frequency times inverse document
// frequency), using pages as the "documents".

import type { Keyword, Lang } from '../core/types';
import { contentTokens, type Token } from '../text/tokenize';
import { isStopword } from '../text/stopwords';

export interface PageTokens {
  page: number;
  tokens: Token[];
  /** Language of each token, from its sentence. Same length as tokens. */
  langs: Lang[];
}

interface Acc {
  count: number;
  forms: Map<string, number>;
  pages: Set<number>;
  langs: Record<Lang, number>;
}

function add(map: Map<string, Acc>, key: string, form: string, page: number, lang: Lang, weight = 1) {
  let a = map.get(key);
  if (!a) {
    a = { count: 0, forms: new Map(), pages: new Set(), langs: { ar: 0, fr: 0, en: 0 } };
    map.set(key, a);
  }
  a.count += weight;
  a.forms.set(form, (a.forms.get(form) ?? 0) + 1);
  a.pages.add(page);
  a.langs[lang]++;
}

function displayForm(raw: string): string {
  // Keep acronyms like "DNS" in capitals, otherwise lower case for Latin.
  if (/^[A-Z0-9]{2,8}$/.test(raw)) return raw;
  return /[A-Za-zÀ-ÿ]/.test(raw) ? raw.toLowerCase() : raw;
}

/** Counts how many pages each stem appears on, for the whole document. */
export function documentFrequency(pages: PageTokens[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set<string>();
    for (const t of contentTokens(p.tokens)) seen.add(t.stem);
    for (const s of seen) df.set(s, (df.get(s) ?? 0) + 1);
  }
  return df;
}

export function extractKeywords(
  pages: PageTokens[],
  df: Map<string, number>,
  totalPages: number,
  limit = 25,
): Keyword[] {
  const map = new Map<string, Acc>();
  for (const p of pages) {
    const toks = p.tokens;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const content = !isStopword(t.norm) && t.norm.length >= 3 && !/^[0-9٠-٩]+$/.test(t.norm);
      if (!content) continue;
      add(map, t.stem, displayForm(t.raw), p.page, p.langs[i]);
      // Two-word terms like "cloud computing" or "أمن المعلومات".
      const n = toks[i + 1];
      // Only words separated by a single space count, so a phrase never crosses a sentence end.
      if (n && n.start - t.end === 1 && !isStopword(n.norm) && n.norm.length >= 3 && !/^[0-9٠-٩]+$/.test(n.norm)) {
        add(map, `${t.stem} ${n.stem}`, `${displayForm(t.raw)} ${displayForm(n.raw)}`, p.page, p.langs[i]);
      }
    }
  }

  const out: Keyword[] = [];
  for (const [key, a] of map) {
    const isPhrase = key.includes(' ');
    if (isPhrase && a.count < 3) continue;
    if (!isPhrase && a.count < 2 && pages.length > 1) continue;
    const parts = key.split(' ');
    const pageFreq = Math.max(...parts.map((p) => df.get(p) ?? 1));
    // idf goes down when a word is on almost every page of the book.
    const idf = totalPages >= 3 ? Math.log(1 + totalPages / pageFreq) / Math.log(1 + totalPages) : 1;
    let score = Math.pow(a.count, 0.8) * (0.35 + 0.65 * idf);
    if (isPhrase) score *= 1.6;
    let best = '';
    let bestN = -1;
    for (const [f, n] of a.forms) if (n > bestN) [best, bestN] = [f, n];
    const lang = (Object.keys(a.langs) as Lang[]).sort((x, y) => a.langs[y] - a.langs[x])[0];
    out.push({ key, display: best, count: a.count, score, lang, pages: [...a.pages].sort((x, y) => x - y) });
  }
  out.sort((a, b) => b.score - a.score);

  // Drop a single word if a phrase containing it already ranks higher with nearly the same count.
  const result: Keyword[] = [];
  for (const k of out) {
    if (result.length >= limit) break;
    if (!k.key.includes(' ')) {
      const covered = result.some((r) => r.key.includes(' ') && r.key.split(' ').includes(k.key) && r.count >= k.count * 0.8);
      if (covered) continue;
    }
    result.push(k);
  }
  return result;
}
