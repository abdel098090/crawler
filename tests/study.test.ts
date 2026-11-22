import { describe, expect, it } from 'vitest';
import { analyzeDoc } from '../src/analysis/analyze';
import { checkTeaching, compareOwnWords } from '../src/study/feedback';
import { blankOut, checkAnswer, generateQuiz, nextDifficulty } from '../src/study/quiz';
import { docFromText, makeBook } from './helpers';

const doc = docFromText([
  'A firewall is a security device that filters network traffic using rules. Every packet is compared with the firewall rules. Stateful firewalls remember active connections.',
  'Encryption turns readable data into ciphertext. Symmetric encryption uses one shared key. A certificate proves that a public key belongs to a website.',
  'Phishing tricks people into giving away passwords. Multi-factor authentication stops many phishing attacks. Users should report suspicious messages.',
]);

describe('quiz (testing effect)', () => {
  it('blanks a keyword in its original form', () => {
    expect(blankOut('Stateful firewalls remember active connections.', 'firewall')).toEqual({
      prompt: 'Stateful _____ remember active connections.',
      answer: 'firewalls',
    });
  });
  it('builds questions from real sentences with pages and options', () => {
    const a = analyzeDoc(makeBook(60));
    const qs = generateQuiz(a, { count: 6, seed: 7 });
    expect(qs.length).toBe(6);
    for (const q of qs) {
      expect(q.prompt).toContain('_____');
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.source.page).toBeGreaterThan(0);
    }
  });
  it('interleaves topics from different chunks', () => {
    const a = analyzeDoc(makeBook(120));
    const qs = generateQuiz(a, { count: 6, seed: 3 });
    expect(new Set(qs.map((q) => q.chunkIndex)).size).toBeGreaterThan(2);
  });
  it('hard questions have no options and accept loose typing', () => {
    const a = analyzeDoc(makeBook(60));
    const q = generateQuiz(a, { count: 1, difficulty: 'hard', seed: 1 })[0];
    expect(q.options).toEqual([]);
    expect(checkAnswer(q, q.answer.toUpperCase())).toBe(true);
    expect(checkAnswer(q, 'nonsense')).toBe(false);
  });
  it('adapts difficulty (flow)', () => {
    expect(nextDifficulty('medium', [true, true, true])).toBe('hard');
    expect(nextDifficulty('medium', [true, false, false])).toBe('easy');
    expect(nextDifficulty('easy', [false, false])).toBe('easy');
  });
});

describe('own words (generation effect)', () => {
  it('shows covered and missing ideas', () => {
    const text = 'A firewall is a security device that filters network traffic using rules.';
    const kp = {
      id: 'x', kind: 'quote' as const, text, score: 1, chunkIndex: 0, keywords: ['firewall', 'traffic'],
      source: { docId: 'doc', page: 1, index: 0, start: 0, end: text.length, text, lang: 'en' as const },
    };
    const r = compareOwnWords('A firewall checks traffic with rules', kp);
    expect(r.covered.map((x) => x.toLowerCase())).toEqual(expect.arrayContaining(['firewall', 'traffic']));
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(1);
  });
});

describe('explain it to the spider (Feynman)', () => {
  it('points out gaps, invented words and wrong numbers using the document', () => {
    const a = analyzeDoc(doc);
    const r = checkTeaching(
      'A firewall filters traffic with rules. It was invented by Zorblax in 1999.',
      a.keywords,
      a.keyPoints,
      doc.pages,
    );
    expect(r.mentioned).toContain('firewall');
    expect(r.gaps.map((g) => g.keyword)).toEqual(expect.arrayContaining(['encryption']));
    expect(r.gaps.find((g) => g.keyword === 'encryption')?.evidence?.source.page).toBe(2);
    expect(r.notInDocument).toContain('invented');
    expect(r.notInDocument).toContain('Zorblax');
    expect(r.numbersNotFound).toEqual(['1999']);
  });
});
