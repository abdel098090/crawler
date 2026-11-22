// Smart chunking: split a long document into chapters, or into even
// blocks of about 15 to 20 pages when no chapters can be found.

import type { Chunk, DocPage } from '../core/types';

export const LONG_DOC_PAGES = 20;
export const TARGET_CHUNK_PAGES = 18;
export const MAX_CHAPTER_PAGES = 40;

const WORD_NUM = '(?:[0-9]+|[IVXLC]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|premier|première|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)';
const LATIN_HEADING = new RegExp(`^\\s*(?:chapter|chapitre|part|partie|unit|unité|module|lesson|leçon)\\s+${WORD_NUM}\\b.{0,70}$`, 'i');
const ARABIC_HEADING = /^\s*(?:الفصل|الباب|الجزء|الوحدة|الدرس|المحور)\s+\S+.{0,70}$/;

/** Returns the heading text if this line looks like a chapter title. */
export function chapterHeading(line: string): string | null {
  const l = line.trim();
  if (l.length < 3 || l.length > 90) return null;
  if (LATIN_HEADING.test(l) || ARABIC_HEADING.test(l)) return l;
  return null;
}

export interface ChapterMark {
  page: number;
  title: string;
}

/** Finds chapter headings. Only the first few lines of each page are checked. */
export function findChapters(pages: DocPage[]): ChapterMark[] {
  const marks: ChapterMark[] = [];
  for (const p of pages) {
    const lines = p.text.split('\n').slice(0, 6);
    for (const line of lines) {
      const h = chapterHeading(line);
      if (h) {
        if (!marks.length || marks[marks.length - 1].page !== p.number) marks.push({ page: p.number, title: h });
        break;
      }
    }
  }
  return marks;
}

function evenSplit(from: number, to: number, startIndex: number, titlePrefix: string): Chunk[] {
  const count = to - from + 1;
  const n = Math.max(1, Math.ceil(count / TARGET_CHUNK_PAGES));
  const size = Math.ceil(count / n);
  const chunks: Chunk[] = [];
  for (let i = 0; i < n; i++) {
    const a = from + i * size;
    const b = Math.min(to, a + size - 1);
    if (a > to) break;
    chunks.push({ index: startIndex + chunks.length, title: `${titlePrefix}${a}–${b}`, fromPage: a, toPage: b, byChapter: false });
  }
  return chunks;
}

/**
 * Plans the chunks for pages [fromPage, toPage]. Short documents are one chunk.
 * The page numbers in the result always cover every page in the range, with no gaps.
 */
export function planChunks(pages: DocPage[], fromPage = 1, toPage = pages.length): Chunk[] {
  const inRange = pages.filter((p) => p.number >= fromPage && p.number <= toPage);
  const count = toPage - fromPage + 1;
  if (count <= LONG_DOC_PAGES) {
    return [{ index: 0, title: `Pages ${fromPage}–${toPage}`, fromPage, toPage, byChapter: false }];
  }
  const marks = findChapters(inRange);
  if (marks.length >= 2) {
    const chunks: Chunk[] = [];
    // Pages before the first chapter (title page, contents) join the first chapter.
    const starts = marks.map((m, i) => ({ ...m, page: i === 0 ? fromPage : m.page }));
    starts.forEach((m, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].page - 1 : toPage;
      if (end < m.page) return;
      if (end - m.page + 1 > MAX_CHAPTER_PAGES) {
        for (const c of evenSplit(m.page, end, chunks.length, `${m.title} · `)) chunks.push({ ...c, byChapter: true });
      } else {
        chunks.push({ index: chunks.length, title: m.title, fromPage: m.page, toPage: end, byChapter: true });
      }
    });
    return chunks;
  }
  return evenSplit(fromPage, toPage, 0, 'Pages ');
}
