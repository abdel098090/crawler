import { describe, expect, it } from 'vitest';
import { analyzeDoc } from '../src/analysis/analyze';
import { explainDocument } from '../src/analysis/explain';
import { assertExportSafe, MAX_QUOTE_CHARS } from '../src/core/copyright';
import { buildStudyHtml, buildStudyMarkdown, flashcardsToAnki, type StudyDocInput } from '../src/export/study';
import { hunt } from '../src/hunt/search';
import { makeFlashcards } from '../src/study/flashcards';
import { makeBook } from './helpers';

function input(pages = 120): { inp: StudyDocInput; source: string } {
  const book = makeBook(pages);
  const analysis = analyzeDoc(book);
  const source = book.pages.map((p) => p.text).join('\n');
  return {
    source,
    inp: {
      title: 'My study notes',
      docs: [{ fileName: 'book.pdf', meta: { author: 'A. Writer' }, totalPages: pages, chars: source.length, analysis, explanation: explainDocument(analysis) }],
      notes: 'Remember to review chapter 3.',
      searches: [{ query: 'firewall', count: 12, pages: [1, 2, 3] }],
      hunts: [hunt(book.pages, ['packet'])],
      sourceText: source,
    },
  };
}

describe('the spider explains at the end', () => {
  it('builds an overview and one line per part, labelled as explanation', () => {
    const a = analyzeDoc(makeBook(120));
    const e = explainDocument(a);
    expect(e.overview?.kind).toBe('explanation');
    expect(e.overview?.text).toMatch(/^In simple words, pages 1 to 120/);
    expect(e.parts.length).toBe(a.chunks.length);
    for (const p of e.parts) expect(p.point.source.text.length).toBeGreaterThan(0);
  });
});

describe('study document', () => {
  it('contains key points with pages, searches, hunt counts and notes', () => {
    const { inp } = input();
    const md = buildStudyMarkdown(inp);
    expect(md).toContain('# My study notes');
    expect(md).toContain('**Author:** A. Writer');
    expect(md).toMatch(/“.+” \(p\. \d+\)/);
    expect(md).toContain('| firewall | 12 | 1, 2, 3 |');
    expect(md).toContain('| packet |');
    expect(md).toContain('Remember to review chapter 3.');
    expect(md).toContain('The spider explains');
  });
  it('never contains the full text, even for a big book', () => {
    const { inp, source } = input(300);
    const md = buildStudyMarkdown(inp);
    expect(md.length).toBeLessThan(source.length * 0.15);
    const quotes = [...md.matchAll(/“(.+)” \(p\. (\d+)\)/g)].map((m) => ({ text: m[1], page: Number(m[2]) }));
    for (const q of quotes) expect(q.text.length).toBeLessThanOrEqual(MAX_QUOTE_CHARS + 1);
    expect(() => assertExportSafe(quotes, source.length)).not.toThrow();
  });
  it('makes printable HTML for PDF', () => {
    const { inp } = input(30);
    const html = buildStudyHtml(inp);
    expect(html).toContain('<h1 dir="auto">My study notes</h1>');
    expect(html).toContain('<table>');
  });
});

describe('flashcards and Anki', () => {
  it('makes term and cloze cards with pages', () => {
    const a = analyzeDoc(makeBook(60));
    const cards = makeFlashcards(a, 20);
    expect(cards.length).toBeGreaterThan(5);
    expect(cards.some((c) => c.kind === 'term')).toBe(true);
    expect(cards.some((c) => c.kind === 'cloze')).toBe(true);
    for (const c of cards) expect(c.source.page).toBeGreaterThan(0);
  });
  it('exports an Anki file within the copyright limits', () => {
    const book = makeBook(60);
    const a = analyzeDoc(book);
    const chars = book.pages.reduce((n, p) => n + p.text.length, 0);
    const anki = flashcardsToAnki(makeFlashcards(a, 20), chars, 'book.pdf');
    const rows = anki.trim().split('\n').filter((l) => !l.startsWith('#'));
    expect(rows.length).toBeGreaterThan(5);
    for (const r of rows) expect(r.split('\t').length).toBe(3);
  });
});
