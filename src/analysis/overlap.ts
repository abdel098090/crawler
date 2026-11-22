// "This idea is in both files" (Library mode).
// For each key point of one file, finds the sentence in another file that
// says the same thing: they must share at least 3 important words (stems),
// and most of the shorter sentence's words. Only real sentences are linked,
// so the student can open both and compare.
//
// Limit: it compares words, so a French file and an English file about the
// same idea are not linked.

import type { DocPage, KeyPoint } from '../core/types';
import { contentTokens, splitSentences, tokenize } from '../text/tokenize';

export interface SharedIdea {
  /** The key point it belongs to. */
  kpId: string;
  docId: string;
  fileName: string;
  page: number;
  start: number;
  end: number;
  text: string;
  /** Important words both sentences have. */
  shared: string[];
  score: number;
}

export interface LibraryDoc {
  docId: string;
  fileName: string;
  pages: DocPage[];
  keyPoints: KeyPoint[];
}

const stemsOf = (text: string) => {
  const m = new Map<string, string>();
  for (const tk of contentTokens(tokenize(text))) if (tk.stem.length > 2 && !/^\d+$/.test(tk.stem) && !m.has(tk.stem)) m.set(tk.stem, tk.raw);
  return m;
};

export const MIN_SHARED = 3;

export function sharedIdeas(docs: LibraryDoc[]): Map<string, SharedIdea> {
  // One index per file: stem -> sentences that have it.
  const index = docs.map((d) => {
    const sentences: { page: number; start: number; end: number; text: string; stems: Map<string, string> }[] = [];
    const byStem = new Map<string, number[]>();
    for (const p of d.pages) {
      for (const s of splitSentences(p.text)) {
        const stems = stemsOf(s.text);
        if (stems.size < MIN_SHARED) continue;
        const id = sentences.push({ page: p.number, start: s.start, end: s.end, text: s.text, stems }) - 1;
        for (const st of stems.keys()) (byStem.get(st) ?? byStem.set(st, []).get(st)!).push(id);
      }
    }
    return { sentences, byStem };
  });
  const out = new Map<string, SharedIdea>();
  docs.forEach((d, di) => {
    for (const kp of d.keyPoints) {
      const mine = stemsOf(kp.source.text);
      if (mine.size < MIN_SHARED) continue;
      let best: SharedIdea | null = null;
      docs.forEach((o, oi) => {
        if (oi === di) return;
        const counts = new Map<number, number>();
        for (const st of mine.keys()) for (const id of index[oi].byStem.get(st) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
        for (const [id, n] of counts) {
          if (n < MIN_SHARED) continue;
          const s = index[oi].sentences[id];
          const small = Math.min(mine.size, s.stems.size);
          const big = Math.max(mine.size, s.stems.size);
          // Most of the shorter sentence, and a fair part of the longer one.
          if (n / small < 0.6 || n / big < 0.3) continue;
          const score = n / small + n / big;
          if (!best || score > best.score) {
            best = {
              kpId: kp.id, docId: o.docId, fileName: o.fileName, page: s.page, start: s.start, end: s.end, text: s.text,
              shared: [...mine.keys()].filter((k) => s.stems.has(k)).map((k) => mine.get(k)!), score,
            };
          }
        }
      });
      if (best) out.set(kp.id, best);
    }
  });
  return out;
}
