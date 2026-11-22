import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeDoc } from '../src/analysis/analyze';
import { findChapters, planChunks } from '../src/analysis/chunking';
import { extractPdf, type PdfJsLike } from '../src/loaders/pdf';
import type { LoadedDoc } from '../src/core/types';
import { splitSentences } from '../src/text/tokenize';
import { docFromText, makeBook } from './helpers';

const fx = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
async function pdfDoc(name: string): Promise<LoadedDoc> {
  const r = await extractPdf(fx(name), pdfjs as unknown as PdfJsLike);
  return { id: name, fileName: name, kind: 'pdf', pages: r.pages, meta: r.meta, warnings: r.warnings, log: r.log };
}

describe('sentences', () => {
  it('splits English, French and Arabic sentences and keeps offsets exact', () => {
    const text = 'A firewall filters traffic. Le chiffrement protège les données! التشفير يحمي البيانات؟ Version 2.5 is out.';
    const s = splitSentences(text);
    expect(s.map((x) => x.lang)).toEqual(['en', 'fr', 'ar', 'en']);
    for (const x of s) expect(text.slice(x.start, x.end)).toBe(x.text);
    expect(s[3].text).toBe('Version 2.5 is out.');
  });
});

describe('keywords and summary on real PDFs', () => {
  for (const [file, lang, word] of [
    ['sample-en.pdf', 'en', 'firewall'],
    ['sample-fr.pdf', 'fr', 'chiffrement'],
    ['sample-ar.pdf', 'ar', 'الجدار'],
  ] as const) {
    it(`finds keywords and real key points in ${file}`, async () => {
      const doc = await pdfDoc(file);
      const r = analyzeDoc(doc);
      expect(r.mainLang).toBe(lang);
      expect(r.keywords.map((k) => k.display).join(' ')).toContain(word);
      expect(r.keyPoints.length).toBeGreaterThan(2);
      // No made-up content: every key point is exactly the text at its offsets on its page.
      for (const kp of r.keyPoints) {
        const page = doc.pages.find((p) => p.number === kp.source.page)!;
        expect(page.text.slice(kp.source.start, kp.source.end)).toBe(kp.text);
        expect(kp.kind).toBe('quote');
      }
      expect(r.coverage.readPages).toBe(doc.pages.length);
    });
  }
  it('handles a mixed-language PDF', async () => {
    const r = analyzeDoc(await pdfDoc('sample-mixed.pdf'));
    expect(new Set(r.languages)).toEqual(new Set(['ar', 'en', 'fr']));
  });
  it('reports scanned pages in coverage instead of skipping silently', async () => {
    const r = analyzeDoc(await pdfDoc('sample-scanned.pdf'));
    expect(r.coverage.skipped[0].reason).toMatch(/scanned/);
    expect(r.coverage.readPages).toBe(0);
  });
});

describe('long books', () => {
  it('chunks a 300-page book by chapter and reads it fast', () => {
    const book = makeBook(300);
    expect(findChapters(book.pages).length).toBe(10);
    const t0 = performance.now();
    const r = analyzeDoc(book);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(15000);
    expect(r.chunks.length).toBe(10);
    expect(r.coverage).toMatchObject({ totalPages: 300, readPages: 300 });
  });
  it('has no missing middle: key points come from every chunk', () => {
    const r = analyzeDoc(makeBook(300));
    for (const c of r.chunks) expect(c.keyPoints.length).toBeGreaterThan(0);
    const chunkOfPoints = new Set(r.keyPoints.map((k) => k.chunkIndex));
    expect(chunkOfPoints.size).toBe(r.chunks.length);
    // inside a chunk, points are spread over its pages too
    const c = r.chunks[5];
    const pages = c.keyPoints.map((k) => k.source.page);
    expect(Math.max(...pages) - Math.min(...pages)).toBeGreaterThan((c.chunk.toPage - c.chunk.fromPage) / 2);
  });
  it('splits a long book with no chapters into 15 to 20 page chunks', () => {
    const book = makeBook(300);
    for (const p of book.pages) p.text = p.text.replace(/^Chapter.*\n/, '');
    const chunks = planChunks(book.pages);
    expect(chunks.length).toBeGreaterThanOrEqual(15);
    expect(chunks.length).toBeLessThanOrEqual(20);
    // every page is covered exactly once
    const covered = chunks.flatMap((c) => Array.from({ length: c.toPage - c.fromPage + 1 }, (_, i) => c.fromPage + i));
    expect(covered).toEqual(Array.from({ length: 300 }, (_, i) => i + 1));
  });
  it('respects a page range and says what is outside it', () => {
    const r = analyzeDoc(makeBook(60), { fromPage: 10, toPage: 20 });
    expect(r.coverage.readPages).toBe(11);
    expect(r.coverage.skipped.filter((s) => s.reason.includes('outside')).length).toBe(49);
    for (const kp of r.keyPoints) expect(kp.source.page).toBeGreaterThanOrEqual(10);
  });
  it('copies numbers exactly from the page', () => {
    const doc = docFromText(['In 2023, exactly 47.5% of the 1,204 audited servers had port 3389 open to the internet. Firewalls blocked most attacks on these servers. Servers need patches every month to stay secure.']);
    const r = analyzeDoc(doc);
    const withNumbers = r.keyPoints.find((k) => k.text.includes('47.5%'));
    expect(withNumbers?.text).toContain('1,204');
    expect(withNumbers?.text).toContain('3389');
  });
});
