// Page layout: turns page text into lines that fit the canvas width.
//
// Every line remembers which characters of page.text it shows (start, end),
// so highlights and the spider's path can be placed exactly on the right words.
// Arabic paragraphs are laid out right-to-left: the line starts at the right edge.

import type { DocPage } from '../core/types';
import { arabicRatio } from '../text/arabic';
import { chapterHeading } from '../analysis/chunking';

export interface LayoutLine {
  start: number;
  end: number;
  rtl: boolean;
  heading: boolean;
  /** y of the text baseline, relative to the top of the page. */
  y: number;
}

export interface PageLayout {
  number: number;
  /** Top of the page card in document coordinates. */
  top: number;
  height: number;
  lines: LayoutLine[];
  scanned: boolean;
}

export interface LayoutMetrics {
  pageWidth: number;
  padding: number;
  fontSize: number;
  lineHeight: number;
  gap: number;
  /** Reading font chosen by the user (Lexend, Atkinson Hyperlegible). The default stack otherwise. */
  fontFamily?: string;
  /** Line height as a multiple of the font size (1.7 normal, more for wide spacing). */
  lineFactor?: number;
}

export const FONT_STACK = '"Segoe UI", "Noto Sans Arabic", "Noto Naskh Arabic", "Noto Sans", Tahoma, "DejaVu Sans", Arial, sans-serif';

export function font(m: LayoutMetrics, heading = false): string {
  return `${heading ? '600 ' : ''}${heading ? Math.round(m.fontSize * 1.25) : m.fontSize}px ${m.fontFamily ? `${m.fontFamily}, ` : ''}${FONT_STACK}`;
}

type Measure = (text: string, heading: boolean) => number;

/** Splits text into blocks (paragraphs and heading lines) with their offsets. */
function blocks(text: string): { start: number; end: number; heading: boolean }[] {
  const out: { start: number; end: number; heading: boolean }[] = [];
  const re = /\n\s*\n/g;
  let last = 0;
  const pushPara = (s: number, e: number) => {
    // A first line that looks like a chapter title becomes its own heading block.
    const firstNl = text.indexOf('\n', s);
    if (firstNl > s && firstNl < e && chapterHeading(text.slice(s, firstNl))) {
      out.push({ start: s, end: firstNl, heading: true });
      s = firstNl + 1;
    }
    if (e > s) out.push({ start: s, end: e, heading: !!chapterHeading(text.slice(s, e)) });
  };
  for (const m of text.matchAll(re)) {
    pushPara(last, m.index ?? 0);
    last = (m.index ?? 0) + m[0].length;
  }
  pushPara(last, text.length);
  return out;
}

export function layoutPage(page: DocPage, top: number, m: LayoutMetrics, measure: Measure): PageLayout {
  const text = page.text;
  const width = m.pageWidth - m.padding * 2;
  const lines: LayoutLine[] = [];
  let y = m.padding + m.fontSize;
  for (const b of blocks(text)) {
    const blockText = text.slice(b.start, b.end);
    const rtl = arabicRatio(blockText) > 0.4;
    const lh = b.heading ? m.lineHeight * 1.3 : m.lineHeight;
    // Greedy word wrap. Single newlines inside a paragraph behave like spaces.
    const words = [...blockText.matchAll(/\S+/g)];
    let lineStart = -1;
    let lineEnd = -1;
    let lineWidth = 0;
    const space = measure(' ', b.heading);
    for (const w of words) {
      const ws = b.start + (w.index ?? 0);
      const we = ws + w[0].length;
      const wWidth = measure(w[0], b.heading);
      if (lineStart < 0) {
        lineStart = ws;
        lineEnd = we;
        lineWidth = wWidth;
        continue;
      }
      if (lineWidth + space + wWidth > width) {
        lines.push({ start: lineStart, end: lineEnd, rtl, heading: b.heading, y });
        y += lh;
        lineStart = ws;
        lineEnd = we;
        lineWidth = wWidth;
      } else {
        lineEnd = we;
        lineWidth += space + wWidth;
      }
    }
    if (lineStart >= 0) {
      lines.push({ start: lineStart, end: lineEnd, rtl, heading: b.heading, y });
      y += lh;
    }
    y += m.lineHeight * 0.5;
  }
  const minHeight = page.scanned || !text.trim() ? m.lineHeight * 6 : 0;
  const height = Math.max(minHeight, y + m.padding - m.lineHeight * 0.5);
  return { number: page.number, top, height, lines, scanned: page.scanned };
}

/** Lays out all pages, stacked from top to bottom. */
export function layoutDocument(pages: DocPage[], m: LayoutMetrics, measure: Measure, startTop = 0): PageLayout[] {
  const out: PageLayout[] = [];
  let top = startTop;
  for (const p of pages) {
    const l = layoutPage(p, top, m, measure);
    out.push(l);
    top += l.height + m.gap;
  }
  return out;
}

/** Finds the lines that show characters [start, end) of a page. */
export function linesForRange(layout: PageLayout, start: number, end: number): LayoutLine[] {
  return layout.lines.filter((l) => l.end > start && l.start < end);
}

/**
 * Horizontal span (left x, right x) of characters [start, end) inside a line,
 * relative to the page's content box. Works for left-to-right and right-to-left lines.
 */
export function spanInLine(
  pageText: string,
  line: LayoutLine,
  start: number,
  end: number,
  contentWidth: number,
  measure: Measure,
): [number, number] {
  const s = Math.max(start, line.start);
  const e = Math.min(end, line.end);
  const before = measure(pageText.slice(line.start, s).replace(/\n/g, ' '), line.heading);
  const upto = measure(pageText.slice(line.start, e).replace(/\n/g, ' '), line.heading);
  if (line.rtl) return [contentWidth - upto, contentWidth - before];
  return [before, upto];
}
