// Library mode: several documents read together.
// mergeKeywords builds one combined keyword list, and remembers which file
// (and which pages in it) each keyword came from.

import type { AnalysisResult, Keyword } from '../core/types';

export interface LibraryKeyword extends Keyword {
  files: { docId: string; fileName: string; count: number; pages: number[] }[];
}

export function mergeKeywords(items: { docId: string; fileName: string; analysis: AnalysisResult }[], limit = 50): LibraryKeyword[] {
  const map = new Map<string, LibraryKeyword>();
  for (const { docId, fileName, analysis } of items) {
    for (const k of analysis.keywords) {
      let m = map.get(k.key);
      if (!m) {
        m = { ...k, count: 0, score: 0, pages: [], files: [] };
        map.set(k.key, m);
      }
      m.count += k.count;
      m.score += k.score;
      m.files.push({ docId, fileName, count: k.count, pages: k.pages });
    }
  }
  // A keyword shared by several files is a strong theme of the library.
  for (const m of map.values()) m.score *= 1 + 0.5 * (m.files.length - 1);
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
