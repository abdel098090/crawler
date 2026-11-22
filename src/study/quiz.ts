// Quizzes built only from the document.
//
// Testing effect (Roediger and Karpicke, 2006): pulling an answer out of your
// memory beats re-reading. So the spider asks questions instead of just
// showing things.
//
// Each question is a real key sentence with one keyword blanked out
// ("cloze" question). Wrong options are other keywords from the same book.
// Every question carries its page, so feedback can say "check page 12".

import type { AnalysisResult, KeyPoint, Keyword, Lang } from '../core/types';
import { findInPage } from '../hunt/search';
import { makeRng, shuffle } from './rng';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  /** The sentence with the answer replaced by "_____". */
  prompt: string;
  answer: string;
  /** Multiple choice options (empty for 'hard', where the user types). */
  options: string[];
  difficulty: Difficulty;
  source: KeyPoint['source'];
  chunkIndex: number;
  lang: Lang;
}

const BLANK = '_____';

/** Finds a keyword inside a sentence and returns the sentence with it blanked. */
export function blankOut(sentence: string, keyword: string): { prompt: string; answer: string } | null {
  const m = findInPage({ number: 1, text: sentence, scanned: false }, keyword)[0];
  if (!m) return null;
  return { prompt: sentence.slice(0, m.start) + BLANK + sentence.slice(m.end), answer: m.text };
}

function optionCount(d: Difficulty): number {
  return d === 'easy' ? 3 : d === 'medium' ? 4 : 0;
}

/**
 * Builds questions. Points are taken round-robin from the chunks, so topics
 * are mixed (interleaving) instead of all questions from chapter 1 first.
 */
export function generateQuiz(
  analysis: AnalysisResult,
  opts: { count?: number; difficulty?: Difficulty; seed?: number; keyPoints?: KeyPoint[]; keywords?: Keyword[] } = {},
): Question[] {
  const rng = makeRng(opts.seed);
  const difficulty = opts.difficulty ?? 'medium';
  const count = opts.count ?? 8;
  const allKeywords = opts.keywords ?? analysis.keywords;
  const groups = opts.keyPoints
    ? [opts.keyPoints]
    : analysis.chunks.map((c) => shuffle(c.keyPoints, rng));
  // Interleave: one from each chunk in turn.
  const order: KeyPoint[] = [];
  const maxLen = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < maxLen; i++) for (const g of shuffle(groups, rng)) if (g[i]) order.push(g[i]);

  const questions: Question[] = [];
  const used = new Set<string>();
  for (const kp of order) {
    if (questions.length >= count) break;
    if (kp.kind !== 'quote') continue;
    // Prefer the keywords listed for this point, then any keyword that appears in it.
    const candidates = [...kp.keywords, ...allKeywords.map((k) => k.display)].filter((k, i, a) => a.indexOf(k) === i);
    for (const kw of candidates) {
      const b = blankOut(kp.text, kw);
      if (!b || used.has(`${kp.id}`)) continue;
      const lang = kp.source.lang;
      const pool = allKeywords
        .filter((k) => k.lang === lang && !k.key.includes(' ') === !kw.includes(' '))
        .map((k) => k.display)
        .filter((d) => d.toLowerCase() !== b.answer.toLowerCase() && d.toLowerCase() !== kw.toLowerCase() && !blankOut(kp.text, d));
      const n = optionCount(difficulty);
      if (n && pool.length < n - 1) continue;
      const options = n ? shuffle([b.answer, ...shuffle(pool, rng).slice(0, n - 1)], rng) : [];
      questions.push({
        id: `${kp.id}:${kw}`,
        prompt: b.prompt,
        answer: b.answer,
        options,
        difficulty,
        source: kp.source,
        chunkIndex: kp.chunkIndex,
        lang,
      });
      used.add(kp.id);
      break;
    }
  }
  return questions;
}

/** Checks an answer. Typed answers are compared loosely (case, accents, tashkeel, Arabic prefixes). */
export function checkAnswer(q: Question, given: string): boolean {
  const g = given.trim();
  if (!g) return false;
  if (g === q.answer) return true;
  return findInPage({ number: 1, text: q.answer, scanned: false }, g).some((m) => m.start === 0 && m.end === q.answer.length);
}

/**
 * Flow: adapt the difficulty to the learner. Three right in a row goes up a
 * level, two wrong in a row goes down.
 */
export function nextDifficulty(current: Difficulty, recent: boolean[]): Difficulty {
  const levels: Difficulty[] = ['easy', 'medium', 'hard'];
  const i = levels.indexOf(current);
  const last3 = recent.slice(-3);
  const last2 = recent.slice(-2);
  if (last3.length === 3 && last3.every(Boolean)) return levels[Math.min(2, i + 1)];
  if (last2.length === 2 && last2.every((x) => !x)) return levels[Math.max(0, i - 1)];
  return current;
}
