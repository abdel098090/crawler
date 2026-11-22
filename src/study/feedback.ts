// Feedback on the learner's own writing.
//
// Generation effect: writing a key point in your own words first, THEN
// seeing the spider's version, makes it stick better. compareOwnWords shows
// which ideas of the real sentence the learner covered.
//
// Feynman technique (and the protege effect): the learner explains the topic
// to the spider in simple words. checkTeaching points out gaps using the
// document: important ideas not mentioned, words that never appear in the
// document, and numbers that are not in the document. It never grades
// "style", and it never guesses: everything it says points to a page.

import type { DocPage, KeyPoint, Keyword } from '../core/types';
import { isStopword } from '../text/stopwords';
import { tokenize } from '../text/tokenize';

export interface OwnWordsResult {
  covered: string[];
  missing: string[];
  /** 0..1, the share of the point's key ideas the learner mentioned. */
  score: number;
}

function stems(text: string): Set<string> {
  return new Set(tokenize(text).map((t) => t.stem));
}

export function compareOwnWords(userText: string, kp: KeyPoint): OwnWordsResult {
  const user = stems(userText);
  // The ideas of a point: its keywords, plus its other content words.
  const ideas = new Map<string, string>();
  for (const k of kp.keywords) ideas.set(tokenize(k).map((t) => t.stem).join(' '), k);
  for (const tok of tokenize(kp.text)) {
    if (isStopword(tok.norm) || tok.norm.length < 4 || /^[0-9٠-٩]+$/.test(tok.norm)) continue;
    if (![...ideas.keys()].some((k) => k.split(' ').includes(tok.stem))) ideas.set(tok.stem, tok.raw);
  }
  const covered: string[] = [];
  const missing: string[] = [];
  for (const [key, label] of ideas) {
    if (key.split(' ').every((s) => user.has(s))) covered.push(label);
    else missing.push(label);
  }
  return { covered, missing, score: ideas.size ? covered.length / ideas.size : 0 };
}

export interface TeachingGap {
  keyword: string;
  /** A real sentence from the document that explains this idea. */
  evidence: KeyPoint | null;
}

export interface TeachingResult {
  mentioned: string[];
  gaps: TeachingGap[];
  /** Words the learner used that do not appear anywhere in the document. */
  notInDocument: string[];
  /** Numbers the learner wrote that do not appear in the document. */
  numbersNotFound: string[];
  score: number;
}

export function checkTeaching(userText: string, keywords: Keyword[], keyPoints: KeyPoint[], pages: DocPage[]): TeachingResult {
  const userTokens = tokenize(userText);
  const user = new Set(userTokens.map((t) => t.stem));
  const docStems = new Set<string>();
  const docNorms = new Set<string>();
  for (const p of pages) {
    for (const t of tokenize(p.text)) {
      docStems.add(t.stem);
      docNorms.add(t.norm);
    }
  }
  const top = keywords.slice(0, 10);
  const mentioned: string[] = [];
  const gaps: TeachingGap[] = [];
  for (const k of top) {
    const parts = k.key.split(' ');
    if (parts.every((p) => user.has(p))) mentioned.push(k.display);
    else {
      const evidence = keyPoints.find((kp) => kp.keywords.includes(k.display)) ?? keyPoints.find((kp) => stems(kp.text).has(parts[0])) ?? null;
      gaps.push({ keyword: k.display, evidence });
    }
  }
  const notInDocument = [
    ...new Set(
      userTokens
        .filter((t) => !isStopword(t.norm) && t.norm.length >= 5 && !/^[0-9٠-٩.,]+$/.test(t.norm) && !docStems.has(t.stem) && !docNorms.has(t.norm))
        .map((t) => t.raw),
    ),
  ].slice(0, 8);
  const docText = pages.map((p) => p.text).join('\n');
  const numbersNotFound = [...new Set(userText.match(/\d+(?:[.,]\d+)?%?/g) ?? [])].filter((n) => !docText.includes(n.replace(/%$/, '')));
  return { mentioned, gaps, notInDocument, numbersNotFound, score: top.length ? mentioned.length / top.length : 0 };
}
