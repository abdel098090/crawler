import { describe, expect, it } from 'vitest';
import type { Keyword, KeyPoint } from '../src/core/types';
import { joinList, mainPoint, nameIdeas, titleCase, toFileName, topicTerms } from '../src/analysis/topic';
import { parseCommand } from '../src/commands/parse';

const kw = (key: string, display = key): Keyword => ({ key, display, count: 3, score: 1, lang: 'en', pages: [1] });
const kp = (text: string, score: number, kind: KeyPoint['kind'] = 'quote'): KeyPoint => ({
  id: text,
  kind,
  text,
  score,
  chunkIndex: 0,
  keywords: [],
  source: { docId: 'd', page: 1, index: 0, start: 0, end: text.length, text, lang: 'en' },
});

describe('topic terms', () => {
  it('takes the strongest distinct keywords', () => {
    expect(topicTerms([kw('cloud comput', 'cloud computing'), kw('cloud'), kw('secur', 'security'), kw('data'), kw('extra')])).toEqual(['cloud computing', 'security', 'data']);
  });
});

describe('main point', () => {
  it('is the best quote, not an explanation', () => {
    expect(mainPoint([kp('a', 1), kp('b', 5, 'explanation'), kp('c', 3)])?.text).toBe('c');
  });
  it('is null for an empty document', () => {
    expect(mainPoint([])).toBeNull();
  });
});

describe('name ideas', () => {
  it('makes English titles with capitals and keeps acronyms', () => {
    const names = nameIdeas(['default gateway', 'ARP', 'subnet'], 'en');
    expect(names[0]).toBe('Default Gateway and ARP');
    expect(names).toContain('An Introduction to Default Gateway');
    expect(names).toContain('Understanding Default Gateway: ARP and Subnet');
    expect(names.length).toBeGreaterThanOrEqual(3);
  });
  it('makes French and Arabic titles in their own language', () => {
    expect(nameIdeas(['réseau', 'sécurité'], 'fr')[0]).toBe('Réseau et Sécurité');
    expect(nameIdeas(['الشبكة', 'الأمن'], 'ar')[0]).toBe('الشبكة والأمن');
    expect(nameIdeas(['الشبكة'], 'ar')).toContain('مدخل إلى الشبكة');
  });
  it('puts a real file title first but skips junk titles', () => {
    expect(nameIdeas(['arp'], 'en', 'Networking Basics')[0]).toBe('Networking Basics');
    expect(nameIdeas(['arp'], 'en', 'Microsoft Word - doc1')[0]).not.toContain('Microsoft');
  });
  it('joins lists per language', () => {
    expect(joinList(['A', 'B', 'C'], 'en')).toBe('A, B and C');
    expect(joinList(['A', 'B'], 'fr')).toBe('A et B');
    expect(joinList(['أ', 'ب'], 'ar')).toBe('أ وب');
  });
  it('title case leaves small words and Arabic alone', () => {
    expect(titleCase('guide to the network', 'en')).toBe('Guide to the Network');
    expect(titleCase('الشبكة', 'ar')).toBe('الشبكة');
  });
});

describe('file names', () => {
  it('are safe and readable', () => {
    expect(toFileName('Understanding ARP: Gateway & MAC!')).toBe('understanding-arp-gateway-mac');
    expect(toFileName('Réseau et Sécurité')).toBe('reseau-et-securite');
    expect(toFileName('الشبكة والأمن')).toBe('الشبكة-والأمن');
    expect(toFileName('***')).toBe('document');
  });
});


describe('the "name this topic" command', () => {
  it.each([
    'Suggest a name for this topic',
    'What is the main point?',
    'what is this file about',
    'Propose un titre',
    'Quelle est l’idée principale ?',
    'اقترح اسماً لهذا الموضوع',
    'ما هي الفكرة الرئيسية',
  ])('"%s" asks for the topic card', (input) => {
    expect(parseCommand(input)).toEqual({ type: 'topic' });
  });
  it.each([
    ['Find every name', { type: 'find', query: 'name' }],
    ['name', { type: 'find', query: 'name' }],
    ['Take the main points from 2 to 4', { type: 'keypoints', from: 2, to: 4 }],
    ['تقاسم', { type: 'find', query: 'تقاسم' }],
  ])('"%s" is not the topic command', (input, expected) => {
    expect(parseCommand(input)).toEqual(expected);
  });
});
