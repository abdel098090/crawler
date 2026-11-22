// "Go deeper" on a key point (Known problem 7: shallow summaries).
//
// It shows more of the document around the idea, never new text:
//  - context: the sentence just before and just after, on the same page
//  - related: other sentences in the document that share the most key words,
//    each with its own page

import type { KeyPoint } from '../core/types';
import type { PreparedDoc, PreparedSentence } from './analyze';
import { jaccard } from './summary';

export interface Deeper {
  before: KeyPoint | null;
  after: KeyPoint | null;
  related: KeyPoint[];
}

function asPoint(docId: string, page: number, s: PreparedSentence, chunkIndex: number): KeyPoint {
  return {
    id: `${docId}:${page}:${s.index}`,
    kind: 'quote',
    text: s.text,
    source: { docId, page, index: s.index, start: s.start, end: s.end, text: s.text, lang: s.lang },
    score: 0,
    chunkIndex,
    keywords: [],
  };
}

export function goDeeper(prep: PreparedDoc, kp: KeyPoint, limit = 3): Deeper {
  const docId = prep.doc.id;
  const page = prep.pages.find((p) => p.page === kp.source.page);
  if (!page) return { before: null, after: null, related: [] };
  const me = page.sentences.find((s) => s.index === kp.source.index);
  const prev = page.sentences.find((s) => s.index === kp.source.index - 1);
  const next = page.sentences.find((s) => s.index === kp.source.index + 1);
  const related: { score: number; p: KeyPoint }[] = [];
  if (me && me.stems.size >= 2) {
    for (const p of prep.pages) {
      for (const s of p.sentences) {
        if (p.page === page.page && Math.abs(s.index - me.index) <= 1) continue;
        if (s.text.length < 30 || s.text === me.text) continue;
        let shared = 0;
        for (const st of s.stems) if (me.stems.has(st)) shared++;
        if (shared < 2) continue;
        related.push({ score: jaccard(me.stems, s.stems) + shared * 0.01, p: asPoint(docId, p.page, s, kp.chunkIndex) });
      }
    }
  }
  related.sort((a, b) => b.score - a.score);
  const picked: KeyPoint[] = [];
  for (const r of related) {
    if (picked.length >= limit) break;
    if (picked.some((x) => x.text === r.p.text)) continue;
    picked.push(r.p);
  }
  return {
    before: prev ? asPoint(docId, page.page, prev, kp.chunkIndex) : null,
    after: next ? asPoint(docId, page.page, next, kp.chunkIndex) : null,
    related: picked,
  };
}
