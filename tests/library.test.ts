import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeDoc } from '../src/analysis/analyze';
import { mergeKeywords } from '../src/analysis/library';
import { extractPdf, type PdfJsLike } from '../src/loaders/pdf';
import { hunt } from '../src/hunt/search';
import { huntToCsv } from '../src/export/hunt';
import type { LoadedDoc } from '../src/core/types';

async function load(name: string): Promise<LoadedDoc> {
  const r = await extractPdf(new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url))), pdfjs as unknown as PdfJsLike);
  return { id: name, fileName: name, kind: 'pdf', pages: r.pages, meta: r.meta, warnings: [], log: [] };
}

describe('Library mode with several PDFs', () => {
  it('merges keywords and keeps file and page for each', async () => {
    const docs = await Promise.all(['sample-en.pdf', 'sample-fr.pdf', 'sample-mixed.pdf'].map(load));
    const items = docs.map((d) => ({ docId: d.id, fileName: d.fileName, analysis: analyzeDoc(d) }));
    const merged = mergeKeywords(items);
    const enc = merged.find((k) => k.display === 'encryption')!;
    expect(enc.files.map((f) => f.fileName).sort()).toEqual(['sample-en.pdf', 'sample-mixed.pdf']);
    for (const f of enc.files) expect(f.pages.length).toBeGreaterThan(0);
    // every key point knows its file
    for (const it of items) for (const kp of it.analysis.keyPoints) expect(kp.source.docId).toBe(it.docId);
  });
  it('builds one combined Word Hunt report across files', async () => {
    const docs = await Promise.all(['sample-en.pdf', 'sample-fr.pdf'].map(load));
    const reports = docs.map((d) => ({ ...hunt(d.pages, ['TLS', 'certificat']), docId: d.id, fileName: d.fileName }));
    const csv = huntToCsv(reports);
    expect(csv).toContain('file,word,count,pages');
    expect(csv).toMatch(/sample-en\.pdf,TLS,\d+/);
    expect(csv).toMatch(/sample-fr\.pdf,certificat,\d+/);
  });
});
