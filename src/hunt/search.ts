// Searching the document, for the command panel and for Word Hunt.
//
// Matching uses NORMALIZED forms, so "Élève" finds "eleve", "مكتبة" finds
// "المكتبة" and "والمكتبة", and "firewalls" finds "firewall".
// But every match keeps the exact character positions of the ORIGINAL word,
// so the page highlights what is really written there.

import type { DocPage } from '../core/types';
import { tokenize, type Token } from '../text/tokenize';

export interface Match {
  page: number;
  start: number;
  end: number;
  /** The words exactly as written on the page. */
  text: string;
}

export interface HuntResult {
  term: string;
  count: number;
  pages: number[];
  matches: Match[];
}

export interface HuntReport {
  results: HuntResult[];
  pagesSearched: number;
  ms: number;
  docId?: string;
  fileName?: string;
}

function same(q: Token, t: Token): boolean {
  if (q.norm === t.norm) return true;
  if (q.arabic !== t.arabic) return false;
  return q.stem === t.stem;
}

/** Tokens per page are cached, because Word Hunt searches the same pages for many terms. */
const tokenCache = new WeakMap<DocPage, Token[]>();
function pageTokens(p: DocPage): Token[] {
  let toks = tokenCache.get(p);
  if (!toks) {
    toks = tokenize(p.text);
    tokenCache.set(p, toks);
  }
  return toks;
}

export function findInPage(page: DocPage, query: string): Match[] {
  const q = tokenize(query);
  if (!q.length) return [];
  const toks = pageTokens(page);
  const out: Match[] = [];
  for (let i = 0; i + q.length <= toks.length; i++) {
    let ok = true;
    for (let j = 0; j < q.length; j++) {
      if (!same(q[j], toks[i + j])) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const start = toks[i].start;
      const end = toks[i + q.length - 1].end;
      out.push({ page: page.number, start, end, text: page.text.slice(start, end) });
    }
  }
  return out;
}

export function findAll(pages: DocPage[], query: string, range?: { from: number; to: number }): Match[] {
  const out: Match[] = [];
  for (const p of pages) {
    if (range && (p.number < range.from || p.number > range.to)) continue;
    out.push(...findInPage(p, query));
  }
  return out;
}

/** Splits the user's hunt list: one term per line, or separated by commas. */
export function parseTerms(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\n,،;]+/)) {
    const term = raw.trim().replace(/^["'“«]+|["'”»]+$/g, '').trim();
    const key = term.toLowerCase();
    if (term && !seen.has(key)) {
      seen.add(key);
      out.push(term);
    }
  }
  return out;
}

export function hunt(
  pages: DocPage[],
  terms: string[],
  onProgress?: (done: number, total: number) => void,
  range?: { from: number; to: number },
): HuntReport {
  const t0 = performance.now();
  const inRange = pages.filter((p) => !range || (p.number >= range.from && p.number <= range.to));
  const results: HuntResult[] = terms.map((term) => ({ term, count: 0, pages: [], matches: [] }));
  inRange.forEach((p, i) => {
    results.forEach((r) => {
      const m = findInPage(p, r.term);
      if (m.length) {
        r.matches.push(...m);
        r.count += m.length;
        r.pages.push(p.number);
      }
    });
    if (onProgress && (i % 20 === 0 || i === inRange.length - 1)) onProgress(i + 1, inRange.length);
  });
  return { results, pagesSearched: inRange.length, ms: Math.round(performance.now() - t0) };
}

/** A short piece of text around a match, only for showing in the panel (never exported). */
export function snippet(page: DocPage, m: Match, radius = 40): string {
  const a = Math.max(0, m.start - radius);
  const b = Math.min(page.text.length, m.end + radius);
  return (a > 0 ? '…' : '') + page.text.slice(a, b).replace(/\s+/g, ' ') + (b < page.text.length ? '…' : '');
}
