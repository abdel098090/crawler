// Tests for the four top-priority fixes:
// missing middle, made-up content, silent cutoff, broken Arabic from PDFs.
import { describe, expect, it, vi } from 'vitest';
import { analyzeDoc } from '../src/analysis/analyze';
import { spreadReport, verifyAnalysis, verifyKeyPoints } from '../src/analysis/verify';
import { extractPdf, type PdfJsLike, type PdfPageLike, type PdfTextItem } from '../src/loaders/pdf';
import { makeBook } from './helpers';

describe('made-up content is impossible', () => {
  it('drops a key point whose text is not on its page', () => {
    const book = makeBook(30);
    const r = analyzeDoc(book);
    const fake = { ...r.keyPoints[0], id: 'fake', text: 'The firewall was invented on the moon in 1802.' };
    const moved = { ...r.keyPoints[1], id: 'moved', source: { ...r.keyPoints[1].source, page: r.keyPoints[1].source.page + 1 } };
    const v = verifyKeyPoints(book.pages, [r.keyPoints[0], fake, moved]);
    expect(v.kept.map((k) => k.id)).toEqual([r.keyPoints[0].id]);
    expect(v.dropped.length).toBe(2);
  });
  it('a real analysis passes verification untouched', () => {
    const book = makeBook(60);
    const r = analyzeDoc(book);
    const before = r.keyPoints.length;
    expect(verifyAnalysis(book.pages, r)).toBe(0);
    expect(r.keyPoints.length).toBe(before);
  });
});

describe('missing middle', () => {
  it('spreadReport shows key points from every chunk of a long book', () => {
    const r = analyzeDoc(makeBook(300));
    const s = spreadReport(r);
    expect(s.emptyChunks).toBe(0);
    expect(s.rows.length).toBe(10);
  });
  it('the middle third of the book gets roughly a third of the whole-book points', () => {
    const r = analyzeDoc(makeBook(300));
    const middle = r.keyPoints.filter((k) => k.source.page > 100 && k.source.page <= 200).length;
    expect(middle / r.keyPoints.length).toBeGreaterThan(0.25);
  });
});

describe('silent cutoff', () => {
  it('coverage always accounts for every page', () => {
    const book = makeBook(50);
    book.pages[9].scanned = true;
    book.pages[9].text = '';
    book.pages[19].text = '';
    const r = analyzeDoc(book, { fromPage: 1, toPage: 40 });
    const skippedPages = r.coverage.skipped.map((s) => s.page);
    expect(r.coverage.readPages + r.coverage.skipped.length).toBe(50);
    expect(skippedPages).toContain(10);
    expect(skippedPages).toContain(20);
    expect(skippedPages).toContain(45);
  });
});

describe('broken Arabic from PDFs switches to OCR', () => {
  const good =
    'الجدار الناري هو جهاز أمني يقوم بتصفية حركة الشبكة باستخدام مجموعة من القواعد وتتم مقارنة كل حزمة تصل إلى الجدار الناري مع القواعد';
  function fakePdf(lineText: string): PdfJsLike {
    const item: PdfTextItem = { str: lineText, transform: [12, 0, 0, 12, 50, 700], width: 400, height: 12 };
    const page: PdfPageLike = {
      getTextContent: async () => ({ items: [item] }),
      getOperatorList: async () => ({ fnArray: [] }),
    };
    return {
      OPS: {},
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => page,
          getPermissions: async () => null,
          getMetadata: async () => ({ info: {} }),
        }),
        destroy: async () => undefined,
      }),
    };
  }
  it('fixes reversed Arabic without OCR', async () => {
    const reversed = Array.from(good).reverse().join('');
    const ocr = vi.fn();
    const r = await extractPdf(new Uint8Array(), fakePdf(reversed), { ocrPage: ocr });
    expect(r.pages[0].text).toBe(good);
    expect(ocr).not.toHaveBeenCalled();
    expect(r.warnings.join(' ')).toMatch(/reversed/);
  });
  it('calls OCR automatically for scrambled Arabic', async () => {
    const scrambled = Array.from(good.replace(/\s/g, '')).join(' ');
    const ocr = vi.fn(async () => good);
    const r = await extractPdf(new Uint8Array(), fakePdf(scrambled), { ocrPage: ocr });
    expect(ocr).toHaveBeenCalledOnce();
    expect(r.pages[0].text).toBe(good);
    expect(r.pages[0].ocr).toBe(true);
  });
  it('says so clearly when OCR is not available', async () => {
    const scrambled = Array.from(good.replace(/\s/g, '')).join(' ');
    const r = await extractPdf(new Uint8Array(), fakePdf(scrambled));
    expect(r.needsOcr).toEqual([1]);
    expect(r.warnings.join(' ')).toMatch(/scrambled/);
  });
});
