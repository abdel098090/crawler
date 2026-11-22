// Flashcards made from the document.
//
// Two kinds of cards:
//  - term cards: the front is a keyword, the back is a real sentence that uses it
//  - cloze cards: the front is a key sentence with a blank, the back is the missing word
// Both carry the page, so the learner can always check the source.

import type { AnalysisResult, KeyPoint } from '../core/types';
import { blankOut } from './quiz';

export interface Flashcard {
  id: string;
  kind: 'term' | 'cloze';
  front: string;
  back: string;
  source: KeyPoint['source'];
}

export function makeFlashcards(analysis: AnalysisResult, limit = 40): Flashcard[] {
  const points = analysis.chunks.flatMap((c) => c.keyPoints).filter((k) => k.kind === 'quote');
  const cards: Flashcard[] = [];
  const usedTerms = new Set<string>();
  const usedPoints = new Set<string>();
  // Term cards for the top keywords, each with the best key point that uses it.
  for (const k of analysis.keywords.slice(0, Math.ceil(limit / 2))) {
    const kp = points.find((p) => !usedPoints.has(p.id) && blankOut(p.text, k.display));
    if (!kp || usedTerms.has(k.key)) continue;
    usedTerms.add(k.key);
    usedPoints.add(kp.id);
    cards.push({ id: `term:${k.key}`, kind: 'term', front: k.display, back: kp.text, source: kp.source });
  }
  // Cloze cards for the remaining key points.
  for (const kp of points) {
    if (cards.length >= limit) break;
    if (usedPoints.has(kp.id)) continue;
    const kw = kp.keywords.find((w) => blankOut(kp.text, w));
    if (!kw) continue;
    const b = blankOut(kp.text, kw)!;
    usedPoints.add(kp.id);
    cards.push({ id: `cloze:${kp.id}`, kind: 'cloze', front: b.prompt, back: b.answer, source: kp.source });
  }
  return cards;
}
