// Citations for a quote, in APA (7th edition) and MLA (9th edition).
//
// Built only from what the file itself says (author, title, publisher, date)
// plus the page of the quote. When something is missing we follow the style's
// own rule ("n.d." for no date in APA, title first when there is no author).
// Italics cannot be copied as plain text, so titles are left plain.

import type { DocMeta } from '../core/types';

export type CiteStyle = 'apa' | 'mla';

export interface Citation {
  /** The full entry for the reference list or works cited page. */
  reference: string;
  /** The short form after a quote in the text, with the page. */
  inText: string;
}

interface Person {
  first: string;
  last: string;
}

/** "Jane A. Smith; John Doe" or "Smith, Jane and Doe, John" -> people. */
export function parseAuthors(raw: string | undefined): Person[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/\s*(?:;|&|\band\b|\bet\b|\by\b|،| و)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  // "Smith, Jane" (one author, last name first) is not a list of two people.
  const commaSplit = parts.length === 1 && !/^[^,]+,\s*[^,\s]+(?:\s+[^,\s]\.?)?$/.test(parts[0]) ? parts[0].split(/\s*,\s*/) : parts;
  return commaSplit.map((p) => {
    if (p.includes(',')) {
      const [last, first] = p.split(/\s*,\s*/);
      return { last, first: first ?? '' };
    }
    const words = p.split(/\s+/);
    return words.length === 1 ? { last: words[0], first: '' } : { last: words[words.length - 1], first: words.slice(0, -1).join(' ') };
  });
}

const initials = (first: string) =>
  first
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(' ');

export function yearOf(date: string | undefined): string | null {
  if (!date) return null;
  // Raw PDF dates look like "D:20210304...", others like "2021-03-04" or "March 2021".
  return date.match(/^D:(\d{4})/)?.[1] ?? date.match(/(?<!\d)(1[5-9]\d\d|20\d\d)(?!\d)/)?.[1] ?? null;
}

/** "chapter-3_networks.pdf" -> "chapter 3 networks" when the file has no real title. */
export function titleOf(meta: DocMeta, fileName: string): string {
  const t = meta.title?.trim();
  if (t && t.length >= 3 && !/^(microsoft word|untitled|document\d*|doc\d*)/i.test(t)) return t;
  return fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
}

const shortTitle = (title: string) => title.split(/\s+/).slice(0, 4).join(' ');
const end = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);

function apa(meta: DocMeta, fileName: string, page: number): Citation {
  const people = parseAuthors(meta.author);
  const year = yearOf(meta.date) ?? 'n.d.';
  const title = titleOf(meta, fileName);
  const publisher = meta.publisher?.trim();
  const names = people.map((p) => (p.first ? `${p.last}, ${initials(p.first)}` : p.last));
  const authorList = names.length <= 1 ? (names[0] ?? '') : names.length === 2 ? `${names[0]}, & ${names[1]}` : `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  const reference = authorList
    ? `${end(authorList)} (${year}). ${end(title)}${publisher ? ` ${end(publisher)}` : ''}`
    : `${end(title)} (${year}).${publisher ? ` ${end(publisher)}` : ''}`;
  const who = people.length === 0 ? shortTitle(title) : people.length === 1 ? people[0].last : people.length === 2 ? `${people[0].last} & ${people[1].last}` : `${people[0].last} et al.`;
  return { reference, inText: `(${who}, ${year}, p. ${page})` };
}

function mla(meta: DocMeta, fileName: string, page: number): Citation {
  const people = parseAuthors(meta.author);
  const year = yearOf(meta.date);
  const title = titleOf(meta, fileName);
  const publisher = meta.publisher?.trim();
  const first = people[0];
  const lead = first ? (first.first ? `${first.last}, ${first.first}` : first.last) : '';
  const authorPart = !first ? '' : people.length === 1 ? lead : people.length === 2 ? `${lead}, and ${[people[1].first, people[1].last].filter(Boolean).join(' ')}` : `${lead}, et al`;
  const tail = [publisher, year].filter(Boolean).join(', ');
  const reference = [authorPart && end(authorPart), end(title), tail && end(tail)].filter(Boolean).join(' ');
  const who = !first ? `"${shortTitle(title)}"` : people.length === 2 ? `${first.last} and ${people[1].last}` : people.length > 2 ? `${first.last} et al.` : first.last;
  return { reference, inText: `(${who} ${page})` };
}

export function cite(style: CiteStyle, meta: DocMeta, fileName: string, page: number): Citation {
  return style === 'apa' ? apa(meta, fileName, page) : mla(meta, fileName, page);
}

/** What gets copied: the quote with its in-text citation, then the full reference. */
export function citedQuote(style: CiteStyle, quote: string, meta: DocMeta, fileName: string, page: number): string {
  const c = cite(style, meta, fileName, page);
  return `"${quote.trim()}" ${c.inText}\n\n${c.reference}`;
}
