import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import { ProtectedFileError } from '../src/core/copyright';
import { extractPdf, type PdfJsLike } from '../src/loaders/pdf';
import { extractDocx } from '../src/loaders/docx';
import { detectKind } from '../src/loaders/detect';
import { markdownToText, textToPages } from '../src/loaders/text';
import { detectLang } from '../src/text/lang';
import { assessArabic } from '../src/text/arabic';

const fx = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const lib = pdfjs as unknown as PdfJsLike;

describe('PDF loading', () => {
  it('reads an English PDF with metadata and page numbers', async () => {
    const r = await extractPdf(fx('sample-en.pdf'), lib);
    expect(r.pages.length).toBeGreaterThanOrEqual(3);
    expect(r.pages[0].text).toContain('firewall');
    expect(detectLang(r.pages[0].text)).toBe('en');
    expect(r.meta.title).toBe('Network Security Basics');
  });
  it('reads a French PDF', async () => {
    const r = await extractPdf(fx('sample-fr.pdf'), lib);
    expect(detectLang(r.pages[0].text)).toBe('fr');
    expect(r.pages[0].text).toContain('pare-feu');
  });
  it('reads an Arabic PDF in the correct order', async () => {
    const r = await extractPdf(fx('sample-ar.pdf'), lib);
    const text = r.pages.map((p) => p.text).join('\n');
    expect(detectLang(text)).toBe('ar');
    expect(assessArabic(text)).toBe('ok');
    expect(text).toContain('الجدار الناري');
  });
  it('reads a mixed PDF and finds all three languages', async () => {
    const r = await extractPdf(fx('sample-mixed.pdf'), lib);
    const langs = new Set(r.pages.map((p) => detectLang(p.text)));
    expect(langs).toEqual(new Set(['ar', 'en', 'fr']));
  });
  it('flags image-only pages as scanned', async () => {
    const r = await extractPdf(fx('sample-scanned.pdf'), lib);
    expect(r.pages[0].scanned).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/scanned/);
  });
  it('refuses a password-protected PDF (rule 1)', async () => {
    await expect(extractPdf(fx('sample-password.pdf'), lib)).rejects.toMatchObject({ code: 'password' });
  });
  it('refuses a PDF whose author disabled copying (rule 2)', async () => {
    await expect(extractPdf(fx('sample-nocopy.pdf'), lib)).rejects.toBeInstanceOf(ProtectedFileError);
    await expect(extractPdf(fx('sample-nocopy.pdf'), lib)).rejects.toMatchObject({ code: 'no-copy' });
  });
});

describe('Word, text and Markdown loading', () => {
  it('reads a .docx with Arabic and English and its metadata', async () => {
    const r = await extractDocx(fx('sample-mixed.docx'), mammoth);
    const text = r.pages.map((p) => p.text).join('\n');
    expect(text).toContain('الجدار الناري');
    expect(text).toContain('firewall');
    expect(r.meta.author).toBe('Ankabut Sample Author');
  });
  it('detects file kinds from bytes', () => {
    expect(detectKind('x.pdf', fx('sample-en.pdf').slice(0, 16))).toBe('pdf');
    expect(detectKind('x.docx', fx('sample-mixed.docx').slice(0, 16))).toBe('docx');
    expect(detectKind('notes.md', new TextEncoder().encode('# Hi'))).toBe('md');
    expect(() => detectKind('book.epub', new Uint8Array([0x50, 0x4b]))).toThrow(ProtectedFileError);
  });
  it('makes virtual pages for long text without losing any text', () => {
    const para = 'This is a sentence about networks and security. '.repeat(40);
    const text = Array.from({ length: 10 }, () => para).join('\n\n');
    const pages = textToPages(text);
    expect(pages.length).toBeGreaterThan(5);
    const joined = pages.map((p) => p.text).join(' ').replace(/\s+/g, ' ');
    expect(joined.length).toBeGreaterThanOrEqual(text.replace(/\s+/g, ' ').trim().length - 1);
  });
  it('turns Markdown into clean text', () => {
    expect(markdownToText('# Title\n\nSome **bold** and [link](http://x).')).toBe('Title\n\nSome bold and link.');
  });
});
