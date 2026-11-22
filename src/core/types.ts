// Shared data shapes used everywhere in the app.
// Think of this file as the "vocabulary" the other files speak.

export type Lang = 'ar' | 'fr' | 'en' | 'es';

export type FileKind = 'pdf' | 'docx' | 'txt' | 'md' | 'notes' | 'image';

/** One page of a loaded document. Text files get "virtual" pages. */
export interface DocPage {
  /** 1-based page number, the same number the user sees. */
  number: number;
  /** The page text, cleaned up (Arabic fixed, lines joined). */
  text: string;
  /** True when the page looks like a picture with no real text layer. */
  scanned: boolean;
  /** True when the text came from OCR instead of the file's text layer. */
  ocr?: boolean;
}

/** Facts about the document itself (shown instead of any "AI detector"). */
export interface DocMeta {
  title?: string;
  author?: string;
  publisher?: string;
  date?: string;
}

export interface LoadedDoc {
  id: string;
  fileName: string;
  kind: FileKind;
  pages: DocPage[];
  meta: DocMeta;
  /** Plain-language notes about the load: skipped pages, OCR used, and so on. */
  warnings: string[];
  /** Developer-mode log lines (timings, extraction details). */
  log: string[];
}

/** A sentence that really exists on a real page. */
export interface SentenceRef {
  docId: string;
  page: number;
  /** Index of the sentence on its page. */
  index: number;
  /** Character offsets of the sentence inside page.text. */
  start: number;
  end: number;
  text: string;
  lang: Lang;
}

/**
 * A key point. "quote" means the exact sentence from the page.
 * "explanation" means the spider's own words built from quotes.
 */
export interface KeyPoint {
  id: string;
  kind: 'quote' | 'explanation';
  text: string;
  source: SentenceRef;
  score: number;
  chunkIndex: number;
  keywords: string[];
}

export interface Keyword {
  /** The stemmed, normalized form used for matching. */
  key: string;
  /** The most common form as written in the document. */
  display: string;
  count: number;
  score: number;
  lang: Lang;
  pages: number[];
}

export interface Chunk {
  index: number;
  title: string;
  fromPage: number;
  toPage: number;
  byChapter: boolean;
}

export interface Coverage {
  totalPages: number;
  readPages: number;
  skipped: { page: number; reason: string }[];
}

export interface ChunkSummary {
  chunk: Chunk;
  keyPoints: KeyPoint[];
  keywords: Keyword[];
}

export interface AnalysisResult {
  docId: string;
  languages: Lang[];
  mainLang: Lang;
  chunks: ChunkSummary[];
  /** Whole-book key points, merged from the chunk summaries. */
  keyPoints: KeyPoint[];
  keywords: Keyword[];
  coverage: Coverage;
  timingsMs: Record<string, number>;
}
