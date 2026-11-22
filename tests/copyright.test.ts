import { describe, expect, it } from 'vitest';
import {
  assertDocxNotProtected,
  assertExportSafe,
  assertNoLongVerbatimRun,
  assertNotDrmFormat,
  assertPdfAllowsExtraction,
  ExportBlockedError,
  fitQuotesToLimit,
  isDeveloperSampleName,
  mayRead,
  PDF_PERMISSION_COPY,
  ProtectedFileError,
  shortenQuote,
} from '../src/core/copyright';

describe('rule 1: protected files', () => {
  it('refuses an OLE-wrapped (encrypted or DRM) docx', () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(() => assertDocxNotProtected(ole)).toThrow(ProtectedFileError);
  });
  it('accepts a normal zip docx', () => {
    expect(() => assertDocxNotProtected(new Uint8Array([0x50, 0x4b, 3, 4]))).not.toThrow();
  });
  it('refuses DRM ebook formats', () => {
    expect(() => assertNotDrmFormat('book.epub')).toThrow(ProtectedFileError);
    expect(() => assertNotDrmFormat('book.azw3')).toThrow(ProtectedFileError);
    expect(() => assertNotDrmFormat('notes.txt')).not.toThrow();
  });
});

describe('rule 2: PDF permission flags', () => {
  it('allows a PDF with no restrictions', () => {
    expect(() => assertPdfAllowsExtraction(null)).not.toThrow();
  });
  it('allows when COPY is granted', () => {
    expect(() => assertPdfAllowsExtraction([4, PDF_PERMISSION_COPY])).not.toThrow();
  });
  it('blocks when COPY is not granted', () => {
    expect(() => assertPdfAllowsExtraction([4])).toThrow(ProtectedFileError);
  });
});

describe('rule 3: export guard', () => {
  it('blocks quotes longer than two sentences', () => {
    expect(() =>
      assertExportSafe([{ text: 'One. Two. Three.', page: 1 }], 100000),
    ).toThrow(ExportBlockedError);
  });
  it('blocks quotes with no page', () => {
    expect(() => assertExportSafe([{ text: 'One.', page: 0 }], 100000)).toThrow(ExportBlockedError);
  });
  it('blocks when the quotes add up to too much of the document', () => {
    const quotes = Array.from({ length: 50 }, (_, i) => ({ text: 'A sentence of about forty characters here.', page: i + 1 }));
    expect(() => assertExportSafe(quotes, 5000)).toThrow(ExportBlockedError);
  });
  it('fitQuotesToLimit always produces a safe set', () => {
    const quotes = Array.from({ length: 500 }, (_, i) => ({
      text: 'First sentence is here. Second one too. Third should go. ' + 'x'.repeat(400),
      page: i + 1,
    }));
    const kept = fitQuotesToLimit(quotes, 20000);
    expect(kept.length).toBeGreaterThan(0);
    expect(() => assertExportSafe(kept, 20000)).not.toThrow();
  });
  it('shortenQuote keeps at most two sentences', () => {
    expect(shortenQuote('One. Two. Three.')).toBe('One. Two.');
  });
  it('detects a long verbatim run of the source', () => {
    const source = 'word '.repeat(50) + Array.from({ length: 200 }, (_, i) => `token${i}`).join(' ');
    expect(() => assertNoLongVerbatimRun('# Export\n' + source, source)).toThrow(ExportBlockedError);
    expect(() => assertNoLongVerbatimRun('# Export\nshort summary only', source)).not.toThrow();
  });
});

describe('rule 4: consent, and the developer relaxation', () => {
  it('needs consent in the user version', () => {
    expect(mayRead({ confirmed: false }, false, true)).toBe(false);
    expect(mayRead({ confirmed: true }, false, false)).toBe(true);
  });
  it('developer mode only relaxes consent for developer samples', () => {
    expect(mayRead({ confirmed: false }, true, true)).toBe(true);
    expect(mayRead({ confirmed: false }, true, false)).toBe(false);
    expect(isDeveloperSampleName('sample-arabic.pdf')).toBe(true);
    expect(isDeveloperSampleName('novel.pdf')).toBe(false);
  });
});
