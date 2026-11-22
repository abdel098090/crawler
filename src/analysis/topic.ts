// Topic, main point and name ideas for a document.
//
// Like the rest of Ankabut this is NOT AI writing. It is built from what the
// analysis already found:
// - the topic  = the strongest keywords of the whole document,
// - the main point = the best real sentence (a direct quote, with its page),
// - the name ideas = those keywords placed into a few simple title patterns,
//   in the document's own language.

import type { AnalysisResult, DocMeta, Keyword, KeyPoint, Lang } from '../core/types';

export interface TopicInfo {
  /** The 1 to 3 words the document is mostly about, strongest first. */
  terms: string[];
  /** The single most central sentence (a real quote), or null for empty documents. */
  mainPoint: KeyPoint | null;
  /** Title ideas, best first. The PDF's own title comes first when it has one. */
  names: string[];
  /** The first name idea turned into a safe file name, without extension. */
  fileName: string;
  lang: Lang;
}

const LATIN = /[A-Za-zÀ-ÿ]/;

/** "cloud computing" -> "Cloud Computing", but keeps acronyms like "DNS" and leaves Arabic alone. */
export function titleCase(s: string, lang: Lang): string {
  if (!LATIN.test(s)) return s;
  const small = lang === 'fr' ? new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'en', 'un', 'une']) : new Set(['and', 'of', 'the', 'to', 'in', 'a', 'an', 'for', 'on']);
  return s
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : /^[A-Z0-9]{2,8}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Picks distinct topic terms: a phrase "cloud computing" hides its own words "cloud" and "computing". */
export function topicTerms(keywords: Keyword[], n = 3): string[] {
  const out: Keyword[] = [];
  for (const k of keywords) {
    if (out.length >= n) break;
    const words = k.key.split(' ');
    const overlaps = out.some((o) => {
      const ow = o.key.split(' ');
      return words.some((w) => ow.includes(w));
    });
    if (!overlaps) out.push(k);
  }
  return out.map((k) => k.display);
}

/** The key point with the highest score in the whole document. */
export function mainPoint(points: KeyPoint[]): KeyPoint | null {
  let best: KeyPoint | null = null;
  for (const p of points) if (p.kind === 'quote' && (!best || p.score > best.score)) best = p;
  return best ?? points[0] ?? null;
}

/** Joins words the way each language does: "A, B and C", "A, B et C", "A وB وC". */
export function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items[0] ?? '';
  if (lang === 'ar') return items.slice(1).reduce((acc, x) => `${acc} و${x}`, items[0]);
  const and = lang === 'fr' ? 'et' : 'and';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

/** Builds 3 to 5 title ideas from the topic terms. */
export function nameIdeas(terms: string[], lang: Lang, metaTitle?: string): string[] {
  const T = terms.map((x) => titleCase(x, lang));
  const [a, b, c] = T;
  const ideas: string[] = [];
  const clean = metaTitle?.trim();
  // A real title from the file itself is the best idea, unless it is junk like "Microsoft Word - doc1".
  if (clean && clean.length >= 4 && !/^(microsoft word|untitled|document\d*|doc\d*)/i.test(clean)) ideas.push(clean);
  if (!a) return ideas;
  if (lang === 'ar') {
    if (b) ideas.push(`${a} و${b}`);
    ideas.push(`مدخل إلى ${a}`);
    if (b) ideas.push(`فهم ${a}: ${joinList([b, c].filter(Boolean) as string[], lang)}`);
    ideas.push(`دليل ${a}`);
  } else if (lang === 'fr') {
    if (b) ideas.push(`${a} et ${b}`);
    ideas.push(`Introduction à ${a}`);
    if (b) ideas.push(`Comprendre ${a} : ${joinList([b, c].filter(Boolean) as string[], lang)}`);
    ideas.push(`Guide : ${a}`);
  } else {
    if (b) ideas.push(`${a} and ${b}`);
    ideas.push(`An Introduction to ${a}`);
    if (b) ideas.push(`Understanding ${a}: ${joinList([b, c].filter(Boolean) as string[], lang)}`);
    ideas.push(`${a} Explained`);
  }
  // Never the same idea twice, at most 5.
  return [...new Set(ideas)].slice(0, 5);
}

/** "Understanding ARP: Gateway and MAC" -> "understanding-arp-gateway-and-mac". Arabic letters are kept. */
export function toFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
    .normalize('NFC'); // put Arabic letters like "أ" back together after NFKD split them
  return slug || 'document';
}

export function topicInfo(a: AnalysisResult, meta: DocMeta = {}): TopicInfo {
  const lang = a.mainLang;
  const terms = topicTerms(a.keywords);
  const allPoints = a.keyPoints.length ? a.keyPoints : a.chunks.flatMap((c) => c.keyPoints);
  const names = nameIdeas(terms, lang, meta.title);
  return { terms, mainPoint: mainPoint(allPoints), names, fileName: toFileName(names[0] ?? terms.join(' ')), lang };
}
