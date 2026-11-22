// Trust checks. These are the top-priority protections:
//
// 1. Missing middle: spreadReport shows how key points are spread over the
//    book, so the user can SEE that the middle was covered.
// 2. Made-up content: verifyKeyPoints drops any key point whose text is not
//    exactly on its page. Nothing reaches the screen without a real source.

import type { AnalysisResult, DocPage, KeyPoint } from '../core/types';

export interface VerifyResult {
  kept: KeyPoint[];
  dropped: KeyPoint[];
}

/**
 * A quote is kept only if page.text at [start, end) is exactly the quote.
 * Explanations (the spider's own words) must still point at a real sentence.
 */
export function verifyKeyPoints(pages: DocPage[], points: KeyPoint[]): VerifyResult {
  const kept: KeyPoint[] = [];
  const dropped: KeyPoint[] = [];
  for (const kp of points) {
    const page = pages.find((p) => p.number === kp.source.page);
    const real = page ? page.text.slice(kp.source.start, kp.source.end) : null;
    const sourceOk = real !== null && real === kp.source.text && real.length > 0;
    const textOk = kp.kind === 'quote' ? kp.text === real : true;
    if (sourceOk && textOk) kept.push(kp);
    else dropped.push(kp);
  }
  return { kept, dropped };
}

/** Applies verifyKeyPoints to a whole analysis result, in place. Returns how many were dropped. */
export function verifyAnalysis(pages: DocPage[], result: AnalysisResult): number {
  let dropped = 0;
  for (const c of result.chunks) {
    const v = verifyKeyPoints(pages, c.keyPoints);
    dropped += v.dropped.length;
    c.keyPoints = v.kept;
  }
  const v = verifyKeyPoints(pages, result.keyPoints);
  dropped += v.dropped.length;
  result.keyPoints = v.kept;
  return dropped;
}

export interface SpreadRow {
  title: string;
  fromPage: number;
  toPage: number;
  points: number;
}

/** One row per chunk: how many key points came from it. Empty rows are a warning sign. */
export function spreadReport(result: AnalysisResult): { rows: SpreadRow[]; emptyChunks: number } {
  const rows = result.chunks.map((c) => ({
    title: c.chunk.title,
    fromPage: c.chunk.fromPage,
    toPage: c.chunk.toPage,
    points: c.keyPoints.length,
  }));
  return { rows, emptyChunks: rows.filter((r) => r.points === 0).length };
}
