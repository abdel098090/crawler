// PDF reading with pdf.js.
//
// This file does not import pdf.js itself. The caller passes it in, so the
// same code runs in the browser and in the Node tests.
//
// Copyright rules applied here, before any text is extracted:
//  - password protected PDFs are refused (we never try a password)
//  - if the permission flags say "no copying", we stop politely

import { assertPdfAllowsExtraction, isPdfPasswordError, ProtectedFileError } from '../core/copyright';
import type { DocMeta, DocPage } from '../core/types';
import { fixArabicText, hasArabic } from '../text/arabic';

/** The small part of the pdf.js API we use. */
export interface PdfJsLike {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; useSystemFonts?: boolean; disableFontFace?: boolean }): {
    promise: Promise<PdfDocLike>;
    destroy(): Promise<void>;
  };
  OPS: Record<string, number>;
}
export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
  getPermissions(): Promise<Iterable<number> | null>;
  getMetadata(): Promise<{ info?: Record<string, unknown> }>;
}
export interface PdfTextItem {
  str: string;
  dir?: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}
export interface PdfPageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[] }>;
  cleanup?(): void;
}

export interface PdfLoadResult {
  pages: DocPage[];
  meta: DocMeta;
  warnings: string[];
  log: string[];
  /** Page numbers whose Arabic text was scrambled and needs OCR. */
  needsOcr: number[];
}

interface Line {
  y: number;
  size: number;
  items: PdfTextItem[];
}

const ARABIC_CHAR = /[؀-ۿﭐ-﷿ﹰ-﻿]/g;

/** Groups text pieces into lines (same height on the page), then orders each line. */
export function itemsToText(items: PdfTextItem[]): string {
  const lines: Line[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = it.transform[5];
    const size = Math.max(1, Math.abs(it.transform[3]) || it.height || 10);
    const line = lines.find((l) => Math.abs(l.y - y) < Math.min(l.size, size) * 0.5);
    if (line) line.items.push(it);
    else lines.push({ y, size, items: [it] });
  }
  // PDF y grows upwards, so the top line has the largest y.
  lines.sort((a, b) => b.y - a.y);
  const out: string[] = [];
  let prev: Line | null = null;
  for (const line of lines) {
    const all = line.items.map((i) => i.str).join('');
    const arabic = (all.match(ARABIC_CHAR)?.length ?? 0) > all.replace(/\s/g, '').length / 2;
    // Right-to-left lines are read from the right edge to the left edge.
    const sorted = [...line.items].sort((a, b) =>
      arabic ? b.transform[4] + b.width - (a.transform[4] + a.width) : a.transform[4] - b.transform[4],
    );
    let text = '';
    let last: PdfTextItem | null = null;
    for (const it of sorted) {
      if (last) {
        const gap = arabic
          ? last.transform[4] - (it.transform[4] + it.width)
          : it.transform[4] - (last.transform[4] + last.width);
        const needSpace = gap > line.size * 0.15 && !text.endsWith(' ') && !it.str.startsWith(' ');
        if (needSpace) text += ' ';
      }
      text += it.str;
      last = it;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (prev) {
      const gap = prev.y - line.y;
      const prevText = out[out.length - 1] ?? '';
      if (gap > line.size * 1.9) out.push('\n\n');
      else if (/[a-zà-ÿ]-$/.test(prevText) && /^[a-zà-ÿ]/.test(text)) {
        // Join words split by a hyphen at the end of a line: "infor-\nmation".
        out[out.length - 1] = prevText.slice(0, -1);
        out.push('');
      } else out.push('\n');
    }
    out.push(text);
    prev = line;
  }
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Turns a PDF date like "D:20240115103000Z" into "2024-01-15". */
export function pdfDate(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const m = /D?:?(\d{4})(\d{2})?(\d{2})?/.exec(s);
  if (!m) return s;
  return [m[1], m[2], m[3]].filter(Boolean).join('-');
}

export interface PdfExtractOptions {
  onProgress?: (done: number, total: number) => void;
  /**
   * Optional OCR hook (browser only). It is called automatically for pages whose
   * Arabic text is scrambled, and for scanned pages when `ocrScanned` is true.
   * It returns the recognised text, or null if OCR is not possible.
   */
  ocrPage?: (page: PdfPageLike, pageNumber: number) => Promise<string | null>;
  ocrScanned?: boolean;
}

export async function extractPdf(data: Uint8Array, pdfjs: PdfJsLike, opts: PdfExtractOptions = {}): Promise<PdfLoadResult> {
  const { onProgress, ocrPage, ocrScanned } = opts;
  const t0 = performance.now();
  let pdf: PdfDocLike;
  // pdf.js takes ownership of the bytes, so we give it a copy.
  const task = pdfjs.getDocument({ data: data.slice(), isEvalSupported: false, useSystemFonts: false, disableFontFace: true });
  try {
    pdf = await task.promise;
  } catch (err) {
    await task.destroy().catch(() => undefined);
    if (isPdfPasswordError(err)) {
      throw new ProtectedFileError('password', 'This PDF is password protected. Ankabut does not open protected files.');
    }
    throw err;
  }
  try {
    // Rule 2 check happens BEFORE any page text is read.
    assertPdfAllowsExtraction(await pdf.getPermissions());

    const warnings: string[] = [];
    const log: string[] = [`pdf opened in ${Math.round(performance.now() - t0)} ms, ${pdf.numPages} pages`];
    const metaRaw = await pdf.getMetadata().catch(() => ({ info: {} as Record<string, unknown> }));
    const info = metaRaw.info ?? {};
    const meta: DocMeta = {
      title: str(info.Title),
      author: str(info.Author),
      publisher: str(info.Publisher) ?? str((info.Custom as Record<string, unknown> | undefined)?.Publisher),
      date: pdfDate(info.CreationDate) ?? pdfDate(info.ModDate),
    };
    const imageOps = new Set(
      ['paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject', 'paintImageXObjectRepeat', 'paintJpegXObject']
        .map((k) => pdfjs.OPS[k])
        .filter((v) => v !== undefined),
    );

    const pages: DocPage[] = [];
    const needsOcr: number[] = [];
    let reversedPages = 0;
    let ocrPages = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = itemsToText(content.items.filter((i): i is PdfTextItem => typeof (i as PdfTextItem).str === 'string'));
      let scanned = false;
      if (text.replace(/\s/g, '').length < 15) {
        const ops = await page.getOperatorList();
        scanned = ops.fnArray.some((f) => imageOps.has(f));
      }
      let ocr = false;
      if (hasArabic(text)) {
        const fixed = fixArabicText(text);
        text = fixed.text;
        if (fixed.quality === 'reversed' && fixed.fixed) reversedPages++;
        if (fixed.quality === 'scrambled') {
          // Known problem 4: broken Arabic. Switch to OCR automatically when we can.
          const recognised = ocrPage ? await ocrPage(page, n).catch(() => null) : null;
          if (recognised && recognised.trim()) {
            text = recognised.trim();
            ocr = true;
            ocrPages++;
            log.push(`page ${n}: scrambled Arabic, replaced with OCR text`);
          } else {
            needsOcr.push(n);
          }
        }
      }
      if (scanned && ocrScanned && ocrPage) {
        const recognised = await ocrPage(page, n).catch(() => null);
        if (recognised && recognised.trim()) {
          text = recognised.trim();
          scanned = false;
          ocr = true;
          ocrPages++;
        }
      }
      pages.push({ number: n, text, scanned, ...(ocr ? { ocr } : {}) });
      page.cleanup?.();
      onProgress?.(n, pdf.numPages);
      // Give the browser a moment to breathe between pages, so nothing freezes.
      if (n % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const scannedCount = pages.filter((p) => p.scanned).length;
    if (scannedCount) {
      warnings.push(`${scannedCount} page(s) are scanned images with no text layer: ${pages.filter((p) => p.scanned).map((p) => p.number).join(', ')}.`);
    }
    if (reversedPages) warnings.push(`Arabic text on ${reversedPages} page(s) came out reversed from the PDF and was fixed.`);
    if (ocrPages) warnings.push(`${ocrPages} page(s) were read with OCR (text recognition), so small errors are possible there.`);
    if (needsOcr.length) {
      warnings.push(`Arabic text on page(s) ${needsOcr.join(', ')} is scrambled in the PDF and OCR was not available, so those pages may read badly.`);
    }
    log.push(`text extracted in ${Math.round(performance.now() - t0)} ms`);
    return { pages, meta, warnings, log, needsOcr };
  } finally {
    await task.destroy();
  }
}
