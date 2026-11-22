// Loads a File from the user's computer in the browser and turns it into a
// LoadedDoc. It picks the right reader for the file type automatically.
// Nothing is uploaded: everything here runs on the user's device.

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { FileKind, LoadedDoc } from '../core/types';
import { decodeText, detectKind } from './detect';
import { extractDocx, type MammothLike } from './docx';
import { extractPdf, type PdfJsLike } from './pdf';
import { markdownToText, textToPages } from './text';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface LoadOptions {
  onProgress?: (done: number, total: number, label: string) => void;
  /** Run OCR on pages that are only images. */
  ocrScanned?: boolean;
}

let docCounter = 0;
function newId(name: string): string {
  docCounter += 1;
  return `${Date.now().toString(36)}-${docCounter}-${name.replace(/[^\w]+/g, '').slice(0, 20)}`;
}

export async function loadFile(file: File, opts: LoadOptions = {}): Promise<LoadedDoc> {
  const t0 = performance.now();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind: FileKind = detectKind(file.name, bytes.slice(0, 64));
  const id = newId(file.name);
  // The original file stays on this device, only to draw the real page picture (formulas, diagrams).
  const source = kind === 'pdf' || kind === 'image' ? file : undefined;
  const base = { id, fileName: file.name, kind, meta: {}, warnings: [] as string[], log: [] as string[], source };

  if (kind === 'pdf') {
    const { ocrPdfPage } = await import('./ocr');
    const r = await extractPdf(bytes, pdfjsLib as unknown as PdfJsLike, {
      onProgress: (d, t) => opts.onProgress?.(d, t, 'pages'),
      ocrPage: (page) => ocrPdfPage(page),
      ocrScanned: opts.ocrScanned,
    });
    return { ...base, pages: r.pages, meta: r.meta, warnings: r.warnings, log: [...r.log, `total ${Math.round(performance.now() - t0)} ms`] };
  }
  if (kind === 'docx') {
    const mammoth = (await import('mammoth/mammoth.browser.js')) as unknown as { default?: MammothLike } & MammothLike;
    const r = await extractDocx(bytes, mammoth.default ?? mammoth);
    return { ...base, pages: r.pages, meta: r.meta, log: [`docx read in ${Math.round(performance.now() - t0)} ms`] };
  }
  if (kind === 'image') {
    // Feature: scan photos of pages or handwritten notes.
    opts.onProgress?.(0, 1, 'ocr');
    const { ocrImage } = await import('./ocr');
    const { cleanOcrText } = await import('./ocrclean');
    const { text, labels } = cleanOcrText(await ocrImage(file));
    opts.onProgress?.(1, 1, 'ocr');
    const pages = textToPages(text).map((p) => ({ ...p, ocr: true }));
    const warnings = ['This text was recognised from a photo (OCR). Small mistakes are possible, so check important details on the original.'];
    if (labels.length) warnings.push(`Short labels that look like a diagram or picture were left out of the reading: ${labels.join(' · ')}`);
    return {
      ...base,
      pages,
      warnings,
      log: [`ocr in ${Math.round(performance.now() - t0)} ms`],
    };
  }
  const raw = decodeText(bytes);
  const text = kind === 'md' ? markdownToText(raw) : raw;
  return { ...base, pages: textToPages(text), log: [`text read in ${Math.round(performance.now() - t0)} ms`] };
}

/** Quick notes typed or pasted straight into the app. */
export function loadNotes(text: string, title = 'Quick notes'): LoadedDoc {
  return {
    id: newId('notes'),
    fileName: title,
    kind: 'notes',
    pages: textToPages(text),
    meta: {},
    warnings: [],
    log: [],
  };
}

// ------------------------------------------------------------ real page picture
const pdfCache = new Map<Blob, Promise<{ getPage(n: number): Promise<unknown> }>>();

/**
 * Draws the real page of the original file, so formulas, tables and diagrams
 * look exactly like in the book. PDF pages are drawn by pdf.js; a photo is the photo.
 */
export async function renderPagePicture(source: Blob, kind: FileKind, page: number, width: number): Promise<HTMLCanvasElement | HTMLImageElement> {
  if (kind === 'image') {
    const img = new Image();
    img.src = URL.createObjectURL(source);
    img.alt = '';
    await img.decode();
    return img;
  }
  let doc = pdfCache.get(source);
  if (!doc) {
    doc = source.arrayBuffer().then((b) => pdfjsLib.getDocument({ data: new Uint8Array(b) }).promise as unknown as Promise<{ getPage(n: number): Promise<unknown> }>);
    pdfCache.set(source, doc);
    doc.catch(() => pdfCache.delete(source));
  }
  type Viewport = { width: number; height: number };
  const p = (await (await doc).getPage(page)) as {
    getViewport(o: { scale: number }): Viewport;
    render(o: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: Viewport }): { promise: Promise<void> };
  };
  const base = p.getViewport({ scale: 1 });
  // Sharp on high-density screens, but never a giant canvas.
  const scale = Math.min(4, (width / base.width) * Math.max(1, devicePixelRatio || 1));
  const viewport = p.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = '100%';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  await p.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}
