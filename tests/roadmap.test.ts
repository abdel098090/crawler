import { describe, expect, it } from 'vitest';
import { analyzeDoc, prepareDoc } from '../src/analysis/analyze';
import { buildGlossary, findAcronyms } from '../src/analysis/glossary';
import { layoutMindMap } from '../src/render/mindmap';
import { emptyProgress, record, streak } from '../src/study/progress';
import { dueCount, orderByDue, review } from '../src/study/srs';
import { lookup } from '../src/translate/dictionary';
import { docFromText, makeBook } from './helpers';

describe('glossary hunter', () => {
  const doc = docFromText([
    'Transport Layer Security (TLS) protects web traffic. A firewall is a device that filters traffic using rules. Firewalls are common.',
    'Le chiffrement est une méthode qui protège les données. TLS uses certificates.',
  ]);
  it('finds acronyms with their expansion', () => {
    expect(findAcronyms(doc.pages[0].text).get('TLS')).toBe('Transport Layer Security');
  });
  it('explains terms only with the document’s own sentences', () => {
    const prep = prepareDoc(doc);
    const g = buildGlossary(prep, analyzeDoc(doc).keywords);
    const fw = g.find((e) => e.term === 'firewall')!;
    expect(fw.definition?.text).toBe('A firewall is a device that filters traffic using rules.');
    expect(fw.definition?.source.page).toBe(1);
    expect(g.find((e) => e.term === 'chiffrement')?.definition?.source.page).toBe(2);
    const tls = g.find((e) => e.term === 'TLS')!;
    expect(tls.expansion).toBe('Transport Layer Security');
    expect(tls.pages).toEqual([1, 2]);
  });
});

describe('translate on tap (offline dictionary)', () => {
  it('finds words in any of the four languages and their forms', () => {
    expect(lookup('Firewalls')).toEqual({ en: 'firewall', fr: 'pare-feu', ar: 'جدار ناري', es: 'cortafuegos' });
    expect(lookup('chiffrement')?.ar).toBe('تشفير');
    expect(lookup('التشفير')?.en).toBe('encryption');
    expect(lookup('blorp')).toBeNull();
  });
});

describe('spaced repetition', () => {
  const day = 86400000;
  it('moves cards up the boxes and back to the start on a miss', () => {
    let s = review(undefined, true, 0);
    expect(s.due).toBe(1 * day);
    s = review(s, true, s.due);
    expect(s.box).toBe(1);
    expect(s.due).toBe(3 * day);
    s = review(s, false, s.due);
    expect(s).toMatchObject({ box: 0, reviews: 3 });
  });
  it('shows overdue cards first, then new, then later ones', () => {
    const cards = [{ id: 'later' }, { id: 'new' }, { id: 'over' }];
    const states = { later: { box: 3, due: 10 * day, reviews: 2 }, over: { box: 1, due: day, reviews: 1 } };
    expect(orderByDue(cards, states, 2 * day).map((c) => c.id)).toEqual(['over', 'new', 'later']);
    expect(dueCount(['later', 'new', 'over'], states, 2 * day)).toBe(2);
  });
});

describe('progress and streaks', () => {
  it('counts a daily streak', () => {
    let p = emptyProgress();
    p = record(p, { pagesRead: 10 }, new Date(2026, 0, 1));
    p = record(p, { wordsFound: 3 }, new Date(2026, 0, 2));
    p = record(p, { questions: 1, correct: 1 }, new Date(2026, 0, 3));
    expect(p.pagesRead).toBe(10);
    expect(streak(p, new Date(2026, 0, 3))).toBe(3);
    expect(streak(p, new Date(2026, 0, 4))).toBe(3); // still alive before you study today
    expect(streak(p, new Date(2026, 0, 6))).toBe(0);
  });
});

describe('mind map', () => {
  it('puts the main topic in the middle and one branch per chapter', () => {
    const a = analyzeDoc(makeBook(120));
    const nodes = layoutMindMap(a, 800, 600);
    expect(nodes[0]).toMatchObject({ level: 0, x: 400, y: 300 });
    expect(nodes.filter((n) => n.level === 1).length).toBe(Math.min(8, a.chunks.length));
    expect(new Set(nodes.map((n) => n.label.toLowerCase())).size).toBe(nodes.length);
  });
});

import { applyTasks, spiderLevel, teachSpider, usesKeyword } from '../src/study/learning';

describe('remaining learning science', () => {
  it('apply tasks use real keywords and point to evidence', () => {
    const a = analyzeDoc(makeBook(60));
    const tasks = applyTasks(a.keywords, a.chunks.flatMap((c) => c.keyPoints));
    expect(tasks.length).toBe(3);
    expect(tasks[0].prompt).toContain(a.keywords[0].display);
    expect(usesKeyword('My router has a firewall that blocks things', 'firewalls')).toBe(true);
    expect(usesKeyword('nothing relevant', 'firewall')).toBe(false);
  });
  it('the spider learns from teaching (protege effect)', () => {
    let r = teachSpider({ learned: [] }, ['firewall', 'packet']);
    r = teachSpider(r.mind, ['Firewall', 'rule']);
    expect(r.newlyLearned).toEqual(['rule']);
    expect(r.mind.learned.length).toBe(3);
    expect(spiderLevel(3, 10)).toEqual({ level: 2, share: 0.3 });
  });
});
