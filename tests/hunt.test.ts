import { describe, expect, it } from 'vitest';
import { prepareDoc } from '../src/analysis/analyze';
import { definitionSubject, explainRange } from '../src/analysis/explain';
import { parseCommand } from '../src/commands/parse';
import { huntToCsv, huntToMarkdown } from '../src/export/hunt';
import { findAll, hunt, parseTerms } from '../src/hunt/search';
import { docFromText, makeBook } from './helpers';

describe('search matches normalized forms but keeps the original word', () => {
  const doc = docFromText([
    'المكتبة كبيرة. ذهبت إلى المَكتبة والمكتبة الثانية مغلقة.',
    'Le pare-feu protège l’élève. Un ÉLÈVE apprend. Firewalls and a firewall.',
  ]);
  it('Arabic: مكتبة finds المكتبة, المَكتبة and والمكتبة', () => {
    const m = findAll(doc.pages, 'مكتبة');
    expect(m.length).toBe(3);
    expect(m.map((x) => x.text)).toEqual(['المكتبة', 'المَكتبة', 'والمكتبة']);
    for (const x of m) expect(doc.pages[0].text.slice(x.start, x.end)).toBe(x.text);
  });
  it('French: eleve finds élève and ÉLÈVE, including after an elision', () => {
    const m = findAll(doc.pages, 'eleve');
    expect(m.map((x) => x.text)).toEqual(['élève', 'ÉLÈVE']);
  });
  it('English: firewall finds singular and plural', () => {
    expect(findAll(doc.pages, 'firewall').map((x) => x.text)).toEqual(['Firewalls', 'firewall']);
  });
  it('phrases match across words', () => {
    expect(findAll(doc.pages, 'pare-feu protège').length).toBe(1);
  });
  it('returns nothing (honestly) for missing words', () => {
    expect(findAll(doc.pages, 'blockchain')).toEqual([]);
  });
});

describe('Word Hunt', () => {
  it('counts every match with pages over a whole book', () => {
    const book = makeBook(100);
    const r = hunt(book.pages, ['firewall', 'encryption', 'unicorn']);
    expect(r.pagesSearched).toBe(100);
    const fw = r.results[0];
    expect(fw.count).toBeGreaterThan(100);
    expect(fw.pages[0]).toBe(1);
    expect(r.results[2].count).toBe(0);
  });
  it('parses the term list', () => {
    expect(parseTerms('cloud\nfirewall, "zero trust"\ncloud\nأمن، تشفير')).toEqual(['cloud', 'firewall', 'zero trust', 'أمن', 'تشفير']);
  });
  it('exports CSV and Markdown with counts and pages only', () => {
    const book = makeBook(20);
    const r = hunt(book.pages, ['firewall', 'unicorn']);
    const csv = huntToCsv([r]);
    expect(csv).toContain('word,count,pages');
    expect(csv).toContain('unicorn,0,');
    const md = huntToMarkdown([r]);
    expect(md).toContain('| firewall |');
    expect(md).toContain('(not found)');
    expect(md).not.toContain('On page');
  });
});

describe('command panel parser', () => {
  it.each([
    ["Find every 'cloud'", { type: 'find', query: 'cloud' }],
    ['find all "zero trust"', { type: 'find', query: 'zero trust' }],
    ['Trouve chaque « nuage »', { type: 'find', query: 'nuage' }],
    ['ابحث عن كل «سحابة»', { type: 'find', query: 'سحابة' }],
    ['Take the key points', { type: 'keypoints' }],
    ['Take the key points from 10 to 20', { type: 'keypoints', from: 10, to: 20 }],
    ['Les points clés de la page 10 à 20', { type: 'keypoints', from: 10, to: 20 }],
    ['النقاط الرئيسية من ١٠ إلى ٢٠', { type: 'keypoints', from: 10, to: 20 }],
    ['Explain this section simply', { type: 'explain' }],
    ['Explique cette section simplement', { type: 'explain' }],
    ['اشرح هذا القسم ببساطة', { type: 'explain' }],
    ['firewall', { type: 'find', query: 'firewall' }],
  ])('%s', (input, expected) => {
    expect(parseCommand(input)).toEqual(expected);
  });
});


describe('explain this section simply', () => {
  it('finds definitions in all three languages', () => {
    expect(definitionSubject('A firewall is a security device that filters traffic.', 'en')).toBe('firewall');
    expect(definitionSubject('Le chiffrement est une méthode de protection.', 'fr')).toBe('chiffrement');
    expect(definitionSubject('الجدار الناري هو جهاز أمني.', 'ar')).toBe('الجدار الناري');
  });
  it('builds an explanation only from the section itself', () => {
    const doc = docFromText([
      'A firewall is a security device that filters network traffic. Every firewall uses rules to decide which packet passes. Firewall rules must be reviewed often.',
      'Encryption turns data into ciphertext. A key is needed to read encrypted data. Strong encryption protects data on untrusted networks.',
    ]);
    const prep = prepareDoc(doc);
    const e = explainRange(prep, 1, 1);
    expect(e.notFound).toBe(false);
    expect(e.definitions[0].text).toBe('A firewall is a security device that filters network traffic.');
    expect(e.spider?.kind).toBe('explanation');
    expect(e.spider?.text).toContain('firewall');
    for (const kp of [...e.definitions, ...e.simple]) expect(kp.source.page).toBe(1);
    expect(e.spider?.text).not.toContain('encryption');
  });
  it('says not found for an empty range', () => {
    const doc = docFromText(['', 'Some words here about nothing much at all.']);
    expect(explainRange(prepareDoc(doc), 1, 1).notFound).toBe(true);
  });
});

import { allKeysPresent } from '../src/ui/i18n';
describe('interface text', () => {
  it('every English string exists in French and Arabic', () => {
    expect(allKeysPresent()).toEqual([]);
  });
});
