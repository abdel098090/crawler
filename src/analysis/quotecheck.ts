// "Check this quote": proves a quote is really in the file, word for word.
// It compares the quote with the page text again, right now, and says which
// line of the page it starts on, so the student can find it in the real book.

import type { DocPage, KeyPoint } from '../core/types';

export interface QuoteCheck {
  /** True when the page holds the quote exactly, word for word. */
  exact: boolean;
  page: number;
  /** The line of the page where the quote starts (counting lines with text). */
  line: number;
  /** Where it really is, when it moved (same page). */
  start: number;
  end: number;
}

/** Line number (1 = first line with text) of a character offset on a page. */
export function lineOnPage(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').filter((l) => l.trim()).length + (/(^|\n)\s*$/.test(text.slice(0, offset)) ? 1 : 0);
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

export function checkQuote(pages: DocPage[], kp: KeyPoint): QuoteCheck {
  const { page, start, end } = kp.source;
  const text = pages.find((p) => p.number === page)?.text ?? '';
  const quote = kp.kind === 'quote' ? kp.text : kp.source.text;
  if (text.slice(start, end) === quote && quote.length > 0) return { exact: true, page, line: lineOnPage(text, start), start, end };
  // Not at its place: look for it on the same page, ignoring spaces and line breaks.
  const want = squash(quote);
  if (want) {
    const flat: number[] = [];
    let s = '';
    for (let i = 0; i < text.length; i++) {
      const c = /\s/.test(text[i]) ? ' ' : text[i];
      if (c === ' ' && (s.endsWith(' ') || !s)) continue;
      s += c;
      flat.push(i);
    }
    const at = s.indexOf(want);
    if (at >= 0) {
      const from = flat[at];
      const to = flat[at + want.length - 1] + 1;
      return { exact: true, page, line: lineOnPage(text, from), start: from, end: to };
    }
  }
  return { exact: false, page, line: lineOnPage(text, start), start, end };
}
