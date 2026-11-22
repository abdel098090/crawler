import { describe, expect, it } from 'vitest';
import { cite, citedQuote, parseAuthors, titleOf, yearOf } from '../src/analysis/cite';

const book = { title: 'Networking Basics', author: 'Jane A. Smith', publisher: 'Cisco Press', date: 'D:20210304' };

describe('citations', () => {
  it('reads authors in common forms', () => {
    expect(parseAuthors('Jane A. Smith; John Doe')).toEqual([{ first: 'Jane A.', last: 'Smith' }, { first: 'John', last: 'Doe' }]);
    expect(parseAuthors('Smith, Jane')).toEqual([{ last: 'Smith', first: 'Jane' }]);
    expect(parseAuthors('Ann Lee and Bo Kim')).toHaveLength(2);
    expect(parseAuthors('')).toEqual([]);
  });
  it('finds the year and a clean title', () => {
    expect(yearOf('D:20210304')).toBe('2021');
    expect(yearOf(undefined)).toBeNull();
    expect(titleOf({ title: 'Microsoft Word - doc1' }, 'chapter-3_networks.pdf')).toBe('chapter 3 networks');
  });
  it('APA 7 with one author', () => {
    const c = cite('apa', book, 'x.pdf', 12);
    expect(c.reference).toBe('Smith, J. A. (2021). Networking Basics. Cisco Press.');
    expect(c.inText).toBe('(Smith, 2021, p. 12)');
  });
  it('APA 7 with no author and no date', () => {
    const c = cite('apa', { title: 'Apology Guide' }, 'x.pdf', 3);
    expect(c.reference).toBe('Apology Guide. (n.d.).');
    expect(c.inText).toBe('(Apology Guide, n.d., p. 3)');
  });
  it('APA 7 with three authors', () => {
    expect(cite('apa', { ...book, author: 'Ann Lee; Bo Kim; Cy Fox' }, 'x.pdf', 1).inText).toBe('(Lee et al., 2021, p. 1)');
    expect(cite('apa', { ...book, author: 'Ann Lee; Bo Kim' }, 'x.pdf', 1).reference).toBe('Lee, A., & Kim, B. (2021). Networking Basics. Cisco Press.');
  });
  it('MLA 9', () => {
    const c = cite('mla', book, 'x.pdf', 12);
    expect(c.reference).toBe('Smith, Jane A. Networking Basics. Cisco Press, 2021.');
    expect(c.inText).toBe('(Smith 12)');
    expect(cite('mla', { title: 'Apology Guide' }, 'x.pdf', 3).inText).toBe('("Apology Guide" 3)');
  });
  it('copies the quote with its citation', () => {
    expect(citedQuote('apa', ' A real apology repairs trust. ', book, 'x.pdf', 1)).toBe('"A real apology repairs trust." (Smith, 2021, p. 1)\n\nSmith, J. A. (2021). Networking Basics. Cisco Press.');
  });
});
