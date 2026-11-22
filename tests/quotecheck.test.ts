import { describe, expect, it } from 'vitest';
import type { DocPage, KeyPoint } from '../src/core/types';
import { checkQuote, lineOnPage } from '../src/analysis/quotecheck';
import { sharedIdeas } from '../src/analysis/overlap';
import { splitSentences } from '../src/text/tokenize';

const page = (number: number, text: string) => ({ number, text }) as DocPage;
const kpAt = (docId: string, p: DocPage, sentence: string, id = sentence.slice(0, 12)): KeyPoint => {
  const start = p.text.indexOf(sentence);
  const ref = { docId, page: p.number, index: 0, start, end: start + sentence.length, text: sentence, lang: 'en' as const };
  return { id, kind: 'quote', text: sentence, source: ref, score: 1, chunkIndex: 0, keywords: [] };
};

describe('check this quote', () => {
  const p = page(3, 'Chapter 2\n\nA firewall filters traffic between networks.\nIt blocks what is not allowed.\nA router forwards packets.');

  it('finds the quote word for word and says its line', () => {
    const r = checkQuote([p], kpAt('a', p, 'It blocks what is not allowed.'));
    expect(r).toMatchObject({ exact: true, page: 3, line: 3 });
  });

  it('first line is line 1', () => {
    expect(lineOnPage(p.text, 0)).toBe(1);
    expect(lineOnPage(p.text, p.text.indexOf('A router'))).toBe(4);
  });

  it('finds a quote that spans a line break', () => {
    const kp = kpAt('a', p, 'It blocks what is not allowed.');
    kp.text = 'networks. It blocks';
    kp.source = { ...kp.source, start: 0, end: 5 };
    const r = checkQuote([p], kp);
    expect(r.exact).toBe(true);
    expect(p.text.slice(r.start, r.end)).toBe('networks.\nIt blocks');
  });

  it('says so when the quote is not on the page', () => {
    const kp = kpAt('a', p, 'It blocks what is not allowed.');
    kp.text = 'A switch learns MAC addresses.';
    expect(checkQuote([p], kp).exact).toBe(false);
  });
});

describe('this idea is in both files', () => {
  const book = page(12, 'A firewall filters incoming and outgoing network traffic using security rules. Students like pizza.');
  const slides = page(2, 'Today we cover the firewall. The firewall filters network traffic with rules set by the security team. Questions at the end.');
  const other = page(1, 'Subnetting divides one network into smaller networks.');
  const docs = [
    { docId: 'book', fileName: 'book.pdf', pages: [book], keyPoints: [kpAt('book', book, 'A firewall filters incoming and outgoing network traffic using security rules.', 'k1')] },
    { docId: 'slides', fileName: 'slides.pdf', pages: [slides], keyPoints: [] },
    { docId: 'notes', fileName: 'notes.pdf', pages: [other], keyPoints: [kpAt('notes', other, 'Subnetting divides one network into smaller networks.', 'k2')] },
  ];

  it('links the same idea in another file, with exact offsets', () => {
    const m = sharedIdeas(docs);
    const s = m.get('k1')!;
    expect(s.fileName).toBe('slides.pdf');
    expect(s.page).toBe(2);
    expect(slides.text.slice(s.start, s.end)).toBe('The firewall filters network traffic with rules set by the security team.');
    expect(s.shared.length).toBeGreaterThanOrEqual(3);
  });

  it('does not link different ideas that share one word', () => {
    expect(sharedIdeas(docs).has('k2')).toBe(false);
  });

  it('never links a file to itself', () => {
    expect(sharedIdeas([docs[0]]).size).toBe(0);
  });

  it('sentence offsets used for links are exact', () => {
    for (const s of splitSentences(slides.text)) expect(slides.text.slice(s.start, s.end)).toBe(s.text);
  });
});
