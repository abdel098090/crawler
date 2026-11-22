// "Explain this section simply" and "the spider explains at the end".
//
// The spider never invents facts. Its explanation is a short frame sentence
// ("These pages are mostly about X, Y and Z") filled ONLY with the section's
// own top keywords, plus real sentences from the pages: definitions found in
// the text and the simplest key sentences. Every piece links to its page.

import type { Keyword, KeyPoint, Lang } from '../core/types';
import { extractKeywords } from './keywords';
import type { PreparedDoc, PreparedSentence } from './analyze';

export interface Explanation {
  from: number;
  to: number;
  lang: Lang;
  notFound: boolean;
  keywords: Keyword[];
  /** Sentences from the text that define a term ("X is ..."). */
  definitions: KeyPoint[];
  /** Short, keyword-rich sentences that are easy to read. */
  simple: KeyPoint[];
  /** The spider's own words, built from the keywords. Marked kind: 'explanation'. */
  spider: KeyPoint | null;
}

const DEF_PATTERNS: Record<Lang, RegExp> = {
  en: /^(?:an?\s+|the\s+)?([\p{L}\p{N}][\p{L}\p{N}\s'’-]{1,40}?)\s+(?:is|are|means|refers\s+to|describes)\s+/iu,
  fr: /^(?:l['’]|le\s+|la\s+|les\s+|une?\s+)?([\p{L}\p{N}][\p{L}\p{N}\s'’-]{1,40}?)\s+(?:est|sont|désigne|signifie|correspond\s+à)\s+/iu,
  ar: /^([\p{L}\p{N}][\p{L}\p{N}\s]{1,40}?)\s+(?:هو|هي|يعني|تعني|يشير\s+إلى|تشير\s+إلى|عبارة\s+عن)\s+/u,
};

export function definitionSubject(sentence: string, lang: Lang): string | null {
  const m = DEF_PATTERNS[lang].exec(sentence.trim());
  if (!m) return null;
  const subject = m[1].trim();
  if (subject.split(/\s+/).length > 5) return null;
  return subject;
}

function toPoint(docId: string, page: number, s: PreparedSentence, chunkIndex: number, kind: 'quote' | 'explanation', text = s.text, keywords: string[] = []): KeyPoint {
  return {
    id: `${docId}:${page}:${s.index}:${kind}`,
    kind,
    text,
    source: { docId, page, index: s.index, start: s.start, end: s.end, text: s.text, lang: s.lang },
    score: 0,
    chunkIndex,
    keywords,
  };
}

function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join('');
  const and = lang === 'fr' ? ' et ' : lang === 'ar' ? ' و' : ' and ';
  const sep = lang === 'ar' ? '، ' : ', ';
  return items.slice(0, -1).join(sep) + and + items[items.length - 1];
}

/** The spider's frame sentence in the document's language. Only keywords are inserted. */
export function frameSentence(lang: Lang, from: number, to: number, keywords: string[]): string {
  const list = joinList(keywords.slice(0, 3), lang);
  const pages = from === to;
  if (lang === 'fr') return pages ? `En termes simples, la page ${from} parle surtout de ${list}.` : `En termes simples, les pages ${from} à ${to} parlent surtout de ${list}.`;
  if (lang === 'ar') return pages ? `ببساطة، تتحدث الصفحة ${from} أساسا عن ${list}.` : `ببساطة، تتحدث الصفحات من ${from} إلى ${to} أساسا عن ${list}.`;
  return pages ? `In simple words, page ${from} is mostly about ${list}.` : `In simple words, pages ${from} to ${to} are mostly about ${list}.`;
}

export function explainRange(prep: PreparedDoc, from: number, to: number, chunkIndex = 0): Explanation {
  const docId = prep.doc.id;
  const pages = prep.pages.filter((p) => p.page >= from && p.page <= to && !p.scanned);
  const sentences = pages.flatMap((p) => p.sentences.map((s) => ({ page: p.page, s })));
  const langCount: Record<Lang, number> = { ar: 0, fr: 0, en: 0 };
  sentences.forEach(({ s }) => langCount[s.lang]++);
  const lang = (Object.keys(langCount) as Lang[]).sort((a, b) => langCount[b] - langCount[a])[0];
  const empty: Explanation = { from, to, lang, notFound: true, keywords: [], definitions: [], simple: [], spider: null };
  if (!sentences.length) return empty;

  const keywords = extractKeywords(pages.map((p) => p.pageTokens), prep.df, prep.doc.pages.length, 8);
  if (!keywords.length) return empty;
  const kwParts = keywords.map((k) => k.key.split(' '));

  // Definitions whose subject contains a top keyword.
  const definitions: KeyPoint[] = [];
  for (const { page, s } of sentences) {
    if (definitions.length >= 3) break;
    const subject = definitionSubject(s.text, s.lang);
    if (!subject || s.text.length > 260) continue;
    const hit = kwParts.findIndex((parts) => parts.every((p) => s.stems.has(p)));
    if (hit < 0) continue;
    if (definitions.some((d) => d.text === s.text)) continue;
    definitions.push(toPoint(docId, page, s, chunkIndex, 'quote', s.text, [keywords[hit].display]));
  }

  // Simple sentences: many keywords, not too long.
  const scored = sentences
    .filter(({ s }) => s.text.length >= 30 && s.text.length <= 220 && s.stems.size >= 3)
    .map(({ page, s }) => {
      let hits = 0;
      kwParts.forEach((parts, i) => {
        if (parts.every((p) => s.stems.has(p))) hits += 1 / (1 + i * 0.3);
      });
      const words = s.text.split(/\s+/).length;
      const lengthPenalty = words > 25 ? 0.6 : words < 7 ? 0.7 : 1;
      return { page, s, score: hits * lengthPenalty };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const simple: KeyPoint[] = [];
  for (const x of scored) {
    if (simple.length >= 3) break;
    if (definitions.some((d) => d.text === x.s.text) || simple.some((d) => d.text === x.s.text)) continue;
    simple.push(toPoint(docId, x.page, x.s, chunkIndex, 'quote'));
  }

  const anchor = definitions[0] ?? simple[0];
  const spider = anchor
    ? {
        ...anchor,
        id: `${anchor.id}:spider`,
        kind: 'explanation' as const,
        text: frameSentence(lang, from, to, keywords.map((k) => k.display)),
        keywords: keywords.slice(0, 3).map((k) => k.display),
      }
    : null;
  return { from, to, lang, notFound: false, keywords, definitions, simple, spider };
}
