// Everything the analysis worker can do. These are normal functions, so the
// tests can call them directly. worker.ts only forwards messages to them.

import { analyzePrepared, prepareDoc, type AnalyzeOptions, type PreparedDoc } from '../analysis/analyze';
import { planChunks } from '../analysis/chunking';
import { explainRange, type Explanation } from '../analysis/explain';
import { goDeeper, type Deeper } from '../analysis/deeper';
import { findAll, hunt, type HuntReport, type Match } from '../hunt/search';
import type { AnalysisResult, Chunk, KeyPoint, Keyword, LoadedDoc } from '../core/types';
import { checkTeaching, type TeachingResult } from '../study/feedback';

const prepared = new Map<string, PreparedDoc>();

export type Progress = (info: Record<string, unknown>) => void;

export function getPrepared(docId: string): PreparedDoc {
  const p = prepared.get(docId);
  if (!p) throw new Error(`Document ${docId} is not loaded in the worker.`);
  return p;
}

export const api = {
  prepare(args: { doc: LoadedDoc }, progress: Progress): { docId: string; pages: number; chunks: Chunk[] } {
    const t0 = performance.now();
    const prep = prepareDoc(args.doc, (done, total) => {
      if (done % 10 === 0 || done === total) progress({ stage: 'prepare', done, total });
    });
    prepared.set(args.doc.id, prep);
    prep.doc.log.push(`worker prepared ${args.doc.pages.length} pages in ${Math.round(performance.now() - t0)} ms`);
    return { docId: args.doc.id, pages: args.doc.pages.length, chunks: planChunks(args.doc.pages) };
  },

  plan(args: { docId: string; fromPage?: number; toPage?: number }): Chunk[] {
    const prep = getPrepared(args.docId);
    return planChunks(prep.doc.pages, args.fromPage, args.toPage);
  },

  analyze(args: { docId: string; opts: Omit<AnalyzeOptions, 'onProgress'> }, progress: Progress): AnalysisResult {
    const prep = getPrepared(args.docId);
    return analyzePrepared(prep, { ...args.opts, onProgress: (p) => progress({ stage: 'analyze', ...p }) });
  },

  find(args: { docId: string; query: string; range?: { from: number; to: number } }): Match[] {
    return findAll(getPrepared(args.docId).doc.pages, args.query, args.range);
  },

  hunt(args: { docId: string; terms: string[]; range?: { from: number; to: number } }, progress: Progress): HuntReport {
    const prep = getPrepared(args.docId);
    const r = hunt(prep.doc.pages, args.terms, (done, total) => progress({ stage: 'hunt', done, total }), args.range);
    return { ...r, docId: prep.doc.id, fileName: prep.doc.fileName };
  },

  explain(args: { docId: string; from: number; to: number }): Explanation {
    return explainRange(getPrepared(args.docId), args.from, args.to);
  },

  teach(args: { docId: string; text: string; keywords: Keyword[]; keyPoints: KeyPoint[] }): TeachingResult {
    return checkTeaching(args.text, args.keywords, args.keyPoints, getPrepared(args.docId).doc.pages);
  },

  deeper(args: { kp: KeyPoint }): Deeper {
    return goDeeper(getPrepared(args.kp.source.docId), args.kp);
  },

  forget(args: { docId: string }): boolean {
    return prepared.delete(args.docId);
  },
};

export type Api = typeof api;
export type ApiMethod = keyof Api;

/** Adds more methods to the API (later features register themselves here). */
export function extendApi(methods: Record<string, (args: never, progress: Progress) => unknown>): void {
  Object.assign(api, methods);
}
