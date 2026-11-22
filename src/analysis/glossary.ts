// Glossary hunter: technical terms, each explained with the document's own
// defining sentence. No outside knowledge, so nothing can be invented.

import type { KeyPoint, Keyword } from '../core/types';
import type { PreparedDoc } from './analyze';
import { definitionSubject } from './explain';

export interface GlossaryEntry {
  term: string;
  /** The document's own definition, if it has one. */
  definition: KeyPoint | null;
  /** Expansion of an acronym, if the document gives one: TLS -> Transport Layer Security. */
  expansion?: string;
  pages: number[];
}

/** Finds "Long Name (ACRONYM)" in text. */
export function findAcronyms(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of text.matchAll(/((?:[\p{Lu}][\p{L}-]+\s+){1,6}?)\(([A-Z][A-Z0-9]{1,7})\)/gu)) {
    const words = m[1].trim().split(/\s+/);
    const acro = m[2];
    // Keep only as many words as the acronym has letters, if the initials match.
    const take = words.slice(-acro.length);
    const initials = take.map((w) => w[0].toUpperCase()).join('');
    if (initials === acro.replace(/[0-9]/g, '').slice(0, take.length)) out.set(acro, take.join(' '));
  }
  return out;
}

export function buildGlossary(prep: PreparedDoc, keywords: Keyword[], limit = 40): GlossaryEntry[] {
  const docId = prep.doc.id;
  const entries = new Map<string, GlossaryEntry>();
  const key = (s: string) => s.toLowerCase();
  const acronyms = new Map<string, string>();
  for (const p of prep.pages) for (const [a, e] of findAcronyms(p.text)) if (!acronyms.has(a)) acronyms.set(a, e);

  for (const p of prep.pages) {
    for (const s of p.sentences) {
      const subject = definitionSubject(s.text, s.lang);
      if (!subject || s.text.length > 300 || entries.has(key(subject))) continue;
      entries.set(key(subject), {
        term: subject,
        definition: {
          id: `${docId}:${p.page}:${s.index}:def`,
          kind: 'quote',
          text: s.text,
          source: { docId, page: p.page, index: s.index, start: s.start, end: s.end, text: s.text, lang: s.lang },
          score: 0,
          chunkIndex: 0,
          keywords: [subject],
        },
        pages: [p.page],
      });
    }
  }
  for (const [a, e] of acronyms) {
    const existing = entries.get(key(a)) ?? entries.get(key(e));
    if (existing) existing.expansion = existing.term === a ? e : a;
    else entries.set(key(a), { term: a, definition: null, expansion: e, pages: [] });
  }
  // Pages where each term is used, from the keyword list when possible.
  for (const entry of entries.values()) {
    const k = keywords.find((x) => key(x.display) === key(entry.term));
    if (k) entry.pages = k.pages;
    else {
      const re = new RegExp(`(^|[^\\p{L}])${entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
      entry.pages = prep.pages.filter((p) => re.test(p.text)).map((p) => p.page);
    }
  }
  // Top keywords that the document never defines still appear, with their pages.
  for (const k of keywords.slice(0, 15)) {
    if (!entries.has(key(k.display))) entries.set(key(k.display), { term: k.display, definition: null, pages: k.pages });
  }
  return [...entries.values()]
    .sort((a, b) => Number(!!b.definition) - Number(!!a.definition) || b.pages.length - a.pages.length)
    .slice(0, limit);
}
