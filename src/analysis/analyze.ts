// The main analysis pipeline. It runs inside a Web Worker in the browser
// (see worker.ts) so the spider animation never freezes, and it also runs
// directly in the tests.
//
// Steps:
// 1. prepare: split every page into sentences and words (once per document)
// 2. plan chunks (chapters or ~18 page blocks)
// 3. for each chunk: keywords, sentence ranking, spread-out key points
// 4. merge the chunk results into a whole-book summary
// 5. report coverage honestly: what was read and what was skipped

import type { AnalysisResult, Chunk, ChunkSummary, Keyword, KeyPoint, Lang, LoadedDoc } from '../core/types';
import { languagesOf } from '../text/lang';
import { splitSentences, tokenize, type Sentence, type Token } from '../text/tokenize';
import { planChunks } from './chunking';
import { documentFrequency, extractKeywords, type PageTokens } from './keywords';
import { makeCandidateStems, pickSpread, rankSentences, type Candidate } from './summary';

export interface PreparedSentence extends Sentence {
  index: number;
  tokens: Token[];
  stems: Set<string>;
}

export interface PreparedPage {
  page: number;
  text: string;
  scanned: boolean;
  sentences: PreparedSentence[];
  pageTokens: PageTokens;
}

export interface PreparedDoc {
  doc: LoadedDoc;
  pages: PreparedPage[];
  df: Map<string, number>;
}

export function prepareDoc(doc: LoadedDoc, onPage?: (done: number, total: number) => void): PreparedDoc {
  const pages: PreparedPage[] = doc.pages.map((p, i) => {
    const sentences: PreparedSentence[] = splitSentences(p.text).map((s, index) => {
      const tokens = tokenize(s.text, s.start);
      return { ...s, index, tokens, stems: makeCandidateStems(tokens) };
    });
    const tokens: Token[] = [];
    const langs: Lang[] = [];
    for (const s of sentences) {
      for (const t of s.tokens) {
        tokens.push(t);
        langs.push(s.lang);
      }
    }
    onPage?.(i + 1, doc.pages.length);
    return { page: p.number, text: p.text, scanned: p.scanned, sentences, pageTokens: { page: p.number, tokens, langs } };
  });
  return { doc, pages, df: documentFrequency(pages.map((p) => p.pageTokens)) };
}

export interface AnalyzeOptions {
  fromPage?: number;
  toPage?: number;
  /** Only analyse these chunk indexes (the user picked chapters). */
  onlyChunks?: number[];
  /** Pre-planned chunks, if the UI already showed a plan to the user. */
  chunks?: Chunk[];
  onProgress?: (info: { chunk: number; chunks: number; title: string }) => void;
}

function isGoodCandidate(s: PreparedSentence): boolean {
  const t = s.text;
  if (t.length < 20 || t.length > 600) return false;
  if (s.stems.size < 3) return false;
  // Headings and list fragments without a final punctuation mark.
  if (t.length < 60 && !/[.!?؟:;…»”"]$/.test(t)) return false;
  const digits = t.replace(/[^0-9٠-٩]/g, '').length;
  if (digits / t.length > 0.3) return false;
  return true;
}

export function chunkQuota(pagesInChunk: number): number {
  return Math.max(3, Math.min(14, Math.round(2 + pagesInChunk * 0.6)));
}

export function analyzePrepared(prep: PreparedDoc, opts: AnalyzeOptions = {}): AnalysisResult {
  const t0 = performance.now();
  const { doc } = prep;
  const total = doc.pages.length;
  const fromPage = Math.max(1, opts.fromPage ?? 1);
  const toPage = Math.min(total, opts.toPage ?? total);
  const allChunks = opts.chunks ?? planChunks(doc.pages, fromPage, toPage);
  const chunks = opts.onlyChunks ? allChunks.filter((c) => opts.onlyChunks!.includes(c.index)) : allChunks;

  // Order counter across the whole doc, for even spreading.
  const orderOf = new Map<string, number>();
  let order = 0;
  for (const p of prep.pages) for (const s of p.sentences) orderOf.set(`${p.page}:${s.index}`, order++);

  const summaries: ChunkSummary[] = [];
  const allLangs: Lang[] = [];
  chunks.forEach((chunk, ci) => {
    opts.onProgress?.({ chunk: ci + 1, chunks: chunks.length, title: chunk.title });
    const pages = prep.pages.filter((p) => p.page >= chunk.fromPage && p.page <= chunk.toPage && !p.scanned);
    const keywords = extractKeywords(
      pages.map((p) => p.pageTokens),
      prep.df,
      total,
      20,
    );
    const weights = new Map<string, number>();
    const maxScore = keywords[0]?.score ?? 1;
    for (const k of keywords) {
      for (const part of k.key.split(' ')) weights.set(part, Math.max(weights.get(part) ?? 0, k.score / maxScore));
    }
    const cands: Candidate[] = [];
    for (const p of pages) {
      for (const s of p.sentences) {
        allLangs.push(s.lang);
        if (!isGoodCandidate(s)) continue;
        cands.push({
          page: p.page,
          index: s.index,
          start: s.start,
          end: s.end,
          text: s.text,
          lang: s.lang,
          stems: s.stems,
          order: orderOf.get(`${p.page}:${s.index}`) ?? 0,
        });
      }
    }
    const scores = rankSentences(cands, weights);
    const picked = pickSpread(cands, scores, chunkQuota(chunk.toPage - chunk.fromPage + 1));
    const keyPoints: KeyPoint[] = picked.map((i) => {
      const c = cands[i];
      const kws = keywords.filter((k) => k.key.split(' ').every((part) => c.stems.has(part))).slice(0, 4);
      return {
        id: `${doc.id}:${c.page}:${c.index}`,
        kind: 'quote',
        text: c.text,
        source: { docId: doc.id, page: c.page, index: c.index, start: c.start, end: c.end, text: c.text, lang: c.lang },
        score: scores[i],
        chunkIndex: chunk.index,
        keywords: kws.map((k) => k.display),
      };
    });
    summaries.push({ chunk, keyPoints, keywords });
  });

  // Whole-book summary: every chunk sends its best points, so no part is left out.
  const maxTotal = Math.max(8, Math.min(50, 8 + summaries.length * 2));
  const perChunk = Math.max(1, Math.floor(maxTotal / Math.max(1, summaries.length)));
  const merged: KeyPoint[] = [];
  for (const s of summaries) {
    const best = [...s.keyPoints].sort((a, b) => b.score - a.score).slice(0, perChunk);
    merged.push(...best);
  }
  merged.sort((a, b) => a.source.page - b.source.page || a.source.index - b.source.index);

  const rangePages = prep.pages.filter((p) => chunks.some((c) => p.page >= c.fromPage && p.page <= c.toPage));
  const keywords: Keyword[] = extractKeywords(
    rangePages.filter((p) => !p.scanned).map((p) => p.pageTokens),
    prep.df,
    total,
    40,
  );

  const skipped: { page: number; reason: string }[] = [];
  for (const p of rangePages) {
    if (p.scanned) skipped.push({ page: p.page, reason: 'scanned image with no text layer' });
    else if (p.text.trim().length === 0) skipped.push({ page: p.page, reason: 'empty page' });
  }
  for (let n = 1; n <= total; n++) {
    if (!rangePages.some((p) => p.page === n)) skipped.push({ page: n, reason: 'outside the chosen page range' });
  }
  skipped.sort((a, b) => a.page - b.page);

  const languages = languagesOf(allLangs);
  return {
    docId: doc.id,
    languages: languages.length ? languages : ['en'],
    mainLang: languages[0] ?? 'en',
    chunks: summaries,
    keyPoints: merged,
    keywords,
    coverage: {
      totalPages: total,
      readPages: rangePages.length - skipped.filter((s) => s.reason !== 'outside the chosen page range').length,
      skipped,
    },
    timingsMs: { analyze: Math.round(performance.now() - t0) },
  };
}

export function analyzeDoc(doc: LoadedDoc, opts: AnalyzeOptions = {}): AnalysisResult {
  const t0 = performance.now();
  const prep = prepareDoc(doc);
  const t1 = performance.now();
  const res = analyzePrepared(prep, opts);
  res.timingsMs.prepare = Math.round(t1 - t0);
  return res;
}
