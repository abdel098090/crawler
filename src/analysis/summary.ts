// Extractive summary with a TextRank-style score.
//
// How TextRank works, in plain words: every sentence "votes" for the sentences
// that share words with it. A sentence that many other sentences agree with
// gets a high score, like a web page with many links pointing to it.
// The summary is made of the best REAL sentences, never new text.
//
// The "missing middle" fix: we split each chunk into page bins and take the
// best sentence from every bin first, so the middle pages always get a voice.

import type { Lang } from '../core/types';
import { contentTokens, type Token } from '../text/tokenize';

export interface Candidate {
  page: number;
  index: number;
  start: number;
  end: number;
  text: string;
  lang: Lang;
  stems: Set<string>;
  /** Order of the sentence in the whole document, used for even spreading. */
  order: number;
}

export function makeCandidateStems(tokens: Token[]): Set<string> {
  return new Set(contentTokens(tokens).map((t) => t.stem));
}

/** Share of words two sentences have in common (0 = none, 1 = the same words). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size < 2 || b.size < 2) return 0;
  let shared = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const s of small) if (big.has(s)) shared++;
  if (!shared) return 0;
  return shared / (Math.log(a.size + 1) + Math.log(b.size + 1));
}

const MAX_GRAPH = 700;

/**
 * Scores sentences with TextRank plus a keyword bonus.
 * `keywordWeights` maps a stem to how important it is in this chunk.
 */
export function rankSentences(cands: Candidate[], keywordWeights: Map<string, number>): number[] {
  const kwScore = cands.map((c) => {
    let s = 0;
    for (const st of c.stems) s += keywordWeights.get(st) ?? 0;
    return s / Math.sqrt(c.stems.size + 1);
  });
  // For very big chunks, only the most keyword-rich sentences enter the graph,
  // which keeps the work small (the graph grows with the square of its size).
  let graphIdx = cands.map((_, i) => i);
  if (cands.length > MAX_GRAPH) {
    graphIdx = graphIdx.sort((a, b) => kwScore[b] - kwScore[a]).slice(0, MAX_GRAPH);
  }
  const n = graphIdx.length;
  const w: number[][] = Array.from({ length: n }, () => []);
  const nb: number[][] = Array.from({ length: n }, () => []);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = similarity(cands[graphIdx[i]].stems, cands[graphIdx[j]].stems);
      if (s > 0) {
        nb[i].push(j);
        w[i].push(s);
        nb[j].push(i);
        w[j].push(s);
        out[i] += s;
        out[j] += s;
      }
    }
  }
  let rank = new Float64Array(n).fill(1);
  const d = 0.85;
  for (let iter = 0; iter < 25; iter++) {
    const next = new Float64Array(n).fill(1 - d);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < nb[i].length; k++) {
        const j = nb[i][k];
        if (out[j] > 0) next[i] += (d * w[i][k] * rank[j]) / out[j];
      }
    }
    rank = next;
  }
  const maxKw = Math.max(1e-9, ...kwScore);
  const scores = cands.map((_, i) => 0.3 * (kwScore[i] / maxKw));
  graphIdx.forEach((ci, gi) => {
    scores[ci] += rank[gi];
  });
  // Very short or very long sentences make poor key points.
  cands.forEach((c, i) => {
    const len = c.text.length;
    if (len < 40) scores[i] *= 0.6;
    if (len > 300) scores[i] *= 0.7;
  });
  return scores;
}

/**
 * Picks `quota` sentences spread across the chunk:
 * 1. split the candidates into `quota` bins in reading order,
 * 2. take the best sentence of every bin,
 * 3. skip near-duplicates.
 */
export function pickSpread(cands: Candidate[], scores: number[], quota: number): number[] {
  if (!cands.length || quota <= 0) return [];
  const order = cands.map((_, i) => i).sort((a, b) => cands[a].order - cands[b].order);
  const bins = Math.min(quota, order.length);
  const chosen: number[] = [];
  const isDup = (i: number) => chosen.some((c) => jaccard(cands[c].stems, cands[i].stems) > 0.8 || cands[c].text === cands[i].text);
  for (let b = 0; b < bins; b++) {
    const from = Math.floor((b * order.length) / bins);
    const to = Math.floor(((b + 1) * order.length) / bins);
    const inBin = order.slice(from, to).sort((x, y) => scores[y] - scores[x]);
    const pick = inBin.find((i) => !isDup(i));
    if (pick !== undefined) chosen.push(pick);
  }
  // Fill up with the best remaining sentences if some bins were empty.
  if (chosen.length < quota) {
    const rest = cands
      .map((_, i) => i)
      .filter((i) => !chosen.includes(i))
      .sort((x, y) => scores[y] - scores[x]);
    for (const i of rest) {
      if (chosen.length >= quota) break;
      if (!isDup(i)) chosen.push(i);
    }
  }
  return chosen.sort((a, b) => cands[a].order - cands[b].order);
}
