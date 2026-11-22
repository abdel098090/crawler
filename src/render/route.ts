// Plans the spider's walk through the document.
//
// The spider skims fast over pages with nothing important, and slows down to
// "read" key sentences line by line (right to left on Arabic lines).
// A time budget keeps a 300-page book to a few minutes.

import type { DocPage } from '../core/types';
import { linesForRange, spanInLine, type LayoutMetrics, type PageLayout } from './layout';

export interface Stop {
  page: number;
  start: number;
  end: number;
  kind: 'key' | 'match';
  /** Index into the caller's list (key point or match), passed back in events. */
  ref: number;
}

export interface Waypoint {
  x: number;
  y: number;
  mode: 'skim' | 'read';
  page: number;
  event?: { type: 'arrive' | 'finish'; stop: Stop };
}

export interface Route {
  points: Waypoint[];
  skimSpeed: number;
  readSpeed: number;
  /** Estimated duration at 1x speed, in seconds. */
  seconds: number;
}

type Measure = (text: string, heading: boolean) => number;

export function planRoute(
  pages: DocPage[],
  layouts: PageLayout[],
  stops: Stop[],
  m: LayoutMetrics,
  pageLeft: number,
  measure: Measure,
  range?: { from: number; to: number },
): Route {
  const points: Waypoint[] = [];
  const contentWidth = m.pageWidth - m.padding * 2;
  const byPage = new Map<number, Stop[]>();
  for (const s of stops) {
    if (!byPage.has(s.page)) byPage.set(s.page, []);
    byPage.get(s.page)!.push(s);
  }
  const from = range?.from ?? 1;
  const to = range?.to ?? pages.length;
  const centerX = pageLeft + m.pageWidth / 2;
  let pagesWalked = 0;
  for (const layout of layouts) {
    if (layout.number < from || layout.number > to) continue;
    pagesWalked++;
    const page = pages[layout.number - 1];
    const pageStops = (byPage.get(layout.number) ?? []).sort((a, b) => a.start - b.start);
    if (!points.length) points.push({ x: centerX, y: layout.top + m.padding, mode: 'skim', page: layout.number });
    for (const stop of pageStops) {
      const lines = linesForRange(layout, stop.start, stop.end);
      lines.forEach((line, i) => {
        const [x0, x1] = spanInLine(page.text, line, stop.start, stop.end, contentWidth, measure);
        const left = pageLeft + m.padding + x0;
        const right = pageLeft + m.padding + x1;
        const y = layout.top + line.y - m.fontSize * 0.35;
        const [first, last] = line.rtl ? [right, left] : [left, right];
        points.push({
          x: first,
          y,
          mode: i === 0 ? 'skim' : 'read',
          page: layout.number,
          ...(i === 0 ? { event: { type: 'arrive' as const, stop } } : {}),
        });
        points.push({
          x: last,
          y,
          mode: 'read',
          page: layout.number,
          ...(i === lines.length - 1 ? { event: { type: 'finish' as const, stop } } : {}),
        });
      });
    }
    points.push({ x: centerX, y: layout.top + layout.height - m.padding / 2, mode: 'skim', page: layout.number });
  }

  let skimDist = 0;
  let readDist = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (points[i].mode === 'read') readDist += d;
    else skimDist += d;
  }
  const skimBudget = Math.min(110, Math.max(4, pagesWalked * 0.35));
  const readBudget = Math.min(150, Math.max(3, stops.length * 2.5));
  const skimSpeed = Math.max(500, skimDist / skimBudget);
  const readSpeed = Math.max(120, readDist / readBudget);
  return { points, skimSpeed, readSpeed, seconds: skimDist / skimSpeed + readDist / readSpeed };
}
