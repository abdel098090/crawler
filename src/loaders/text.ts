// Plain text, Markdown and pasted notes.
//
// Text files have no real pages, so we make "virtual pages" of about
// 2,800 characters (roughly one printed page), always cutting at a paragraph
// or sentence boundary. A form feed character (\f) is treated as a real page break.

import type { DocPage } from '../core/types';
import { fixArabicText, hasArabic } from '../text/arabic';

export const VIRTUAL_PAGE_CHARS = 2800;

/** Turns Markdown into readable plain text while keeping headings on their own line. */
export function markdownToText(md: string): string {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*/g, '').trim())
    .replace(/^#{1,6}\s+(.*)$/gm, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(\S.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*---+\s*$/gm, '');
}

function splitLong(text: string, max: number): string[] {
  const pages: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < max * 0.5) cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf('؟ ', max), rest.lastIndexOf('! ', max));
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    else cut += 1;
    pages.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pages.push(rest);
  return pages;
}

export function textToPages(raw: string): DocPage[] {
  let text = raw.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n');
  if (hasArabic(text)) text = fixArabicText(text).text;
  const hardPages = text.split('\f');
  const pages: string[] = [];
  for (const hp of hardPages) {
    if (hardPages.length > 1) pages.push(...(hp.length > VIRTUAL_PAGE_CHARS * 1.5 ? splitLong(hp, VIRTUAL_PAGE_CHARS) : [hp.trim()]));
    else pages.push(...splitLong(hp, VIRTUAL_PAGE_CHARS));
  }
  if (!pages.length) pages.push('');
  return pages.map((t, i) => ({ number: i + 1, text: t, scanned: false }));
}
