// DocView: one canvas that draws the pages, the highlights, the spider,
// and the flying keywords. It also runs the walk along a planned route.

import type { DocPage } from '../core/types';
import { font, layoutDocument, linesForRange, spanInLine, type LayoutMetrics, type PageLayout } from './layout';
import { planRoute, type Route, type Stop, type Waypoint } from './route';
import { Spider } from './spider';

export interface Highlight {
  page: number;
  start: number;
  end: number;
  kind: 'key' | 'match' | 'current' | 'focus';
}

interface Particle {
  text: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  onArrive?: () => void;
}

export interface ViewOptions {
  fastMode: boolean;
  reducedMotion: boolean;
  focusMode: boolean;
  showRoute: boolean;
}

export interface WalkHandlers {
  onArrive?: (stop: Stop) => void;
  onFinish?: (stop: Stop, screenPos: { x: number; y: number }) => void;
  onPage?: (page: number) => void;
  onDone?: () => void;
}

function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class DocView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pages: DocPage[] = [];
  layouts: PageLayout[] = [];
  metrics: LayoutMetrics = { pageWidth: 680, padding: 44, fontSize: 17, lineHeight: 29, gap: 28 };
  scrollY = 0;
  spider = new Spider(0, 0);
  highlights: Highlight[] = [];
  particles: Particle[] = [];
  options: ViewOptions = { fastMode: false, reducedMotion: false, focusMode: false, showRoute: false };
  speed = 1;
  playing = false;
  route: Route | null = null;
  private routeIndex = 0;
  private handlers: WalkHandlers = {};
  private width = 0;
  private height = 0;
  private dpr = 1;
  private measureCache = new Map<string, number>();
  private lastTime = 0;
  private followPausedUntil = 0;
  private raf = 0;
  private lastPage = 0;
  private focusLine: { page: number; y: number } | null = null;
  /** Called whenever someone clicks a word on a page. */
  onWordClick?: (page: number, offset: number, word: string, clientX: number, clientY: number) => void;
  /** Lets the video recorder draw extra things (like a title) on each frame. */
  onAfterDraw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    this.ctx = ctx;
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scrollBy(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('click', (e) => this.handleClick(e));
    let touchY = 0;
    canvas.addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      const y = e.touches[0].clientY;
      this.scrollBy(touchY - y);
      touchY = y;
    }, { passive: true });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  measure = (text: string, heading: boolean): number => {
    const key = (heading ? 'h|' : '') + text;
    let w = this.measureCache.get(key);
    if (w === undefined) {
      this.ctx.font = font(this.metrics, heading);
      w = this.ctx.measureText(text).width;
      if (this.measureCache.size > 200000) this.measureCache.clear();
      this.measureCache.set(key, w);
    }
    return w;
  };

  get pageLeft(): number {
    return Math.max(12, (this.width - this.metrics.pageWidth) / 2);
  }

  get docHeight(): number {
    const last = this.layouts[this.layouts.length - 1];
    return last ? last.top + last.height + this.metrics.gap : 0;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.width = Math.max(200, rect.width);
    this.height = Math.max(200, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const pageWidth = Math.min(680, this.width - 24);
    if (Math.abs(pageWidth - this.metrics.pageWidth) > 1 && this.pages.length) {
      this.metrics = { ...this.metrics, pageWidth, padding: pageWidth < 420 ? 20 : 44 };
      this.relayout();
    } else {
      this.metrics.pageWidth = pageWidth;
      this.metrics.padding = pageWidth < 420 ? 20 : 44;
    }
  }

  setPages(pages: DocPage[]): void {
    this.pages = pages;
    this.highlights = [];
    this.route = null;
    this.playing = false;
    this.relayout();
    this.scrollY = 0;
    this.spider.teleport({ x: this.pageLeft + this.metrics.pageWidth / 2, y: this.metrics.padding }, Math.PI / 2);
  }

  relayout(): void {
    this.measureCache.clear();
    this.layouts = layoutDocument(this.pages, this.metrics, this.measure, this.metrics.gap);
  }

  scrollBy(dy: number): void {
    this.scrollY = Math.max(0, Math.min(this.docHeight - this.height * 0.5, this.scrollY + dy));
    this.followPausedUntil = performance.now() + 2500;
  }

  /** Scrolls so a character range is in view, and optionally walks the spider there. */
  goTo(page: number, start: number, end: number, walk = true): void {
    const pos = this.positionOf(page, start, end);
    if (!pos) return;
    this.followPausedUntil = 0;
    if (walk && !this.options.reducedMotion) {
      this.route = {
        points: [{ x: pos.x, y: pos.y, mode: 'skim', page }],
        skimSpeed: Math.max(900, Math.abs(pos.y - this.spider.pos.y) * 1.5),
        readSpeed: 150,
        seconds: 1,
      };
      this.routeIndex = 0;
      this.handlers = {};
      this.playing = true;
    } else {
      this.spider.teleport(pos);
      this.scrollY = Math.max(0, pos.y - this.height * 0.4);
    }
  }

  /** Which page is at document height y. */
  pageAt(y: number): number {
    for (const l of this.layouts) if (y <= l.top + l.height + this.metrics.gap) return l.number;
    return this.layouts.length || 1;
  }

  positionOf(page: number, start: number, end: number): { x: number; y: number } | null {
    const layout = this.layouts[page - 1];
    if (!layout) return null;
    const lines = linesForRange(layout, start, end);
    const line = lines[0];
    if (!line) return { x: this.pageLeft + this.metrics.pageWidth / 2, y: layout.top + this.metrics.padding };
    const [x0, x1] = spanInLine(this.pages[page - 1].text, line, start, end, this.contentWidth, this.measure);
    return {
      x: this.pageLeft + this.metrics.padding + (line.rtl ? x1 : x0),
      y: layout.top + line.y - this.metrics.fontSize * 0.35,
    };
  }

  get contentWidth(): number {
    return this.metrics.pageWidth - this.metrics.padding * 2;
  }

  /** Starts a walk over the stops. In fast mode everything happens at once. */
  walk(stops: Stop[], handlers: WalkHandlers, range?: { from: number; to: number }): Route {
    const route = planRoute(this.pages, this.layouts, stops, this.metrics, this.pageLeft, this.measure, range);
    this.route = route;
    this.routeIndex = 0;
    this.handlers = handlers;
    this.lastPage = 0;
    if (this.options.fastMode) {
      this.finishNow();
      return route;
    }
    if (route.points[0]) this.spider.teleport(route.points[0], Math.PI / 2);
    this.playing = true;
    return route;
  }

  /** Skips to the end: fires every remaining event right away. */
  finishNow(): void {
    if (!this.route) return;
    const pts = this.route.points;
    for (let i = this.routeIndex; i < pts.length; i++) this.fire(pts[i], true);
    this.routeIndex = pts.length;
    const last = pts[pts.length - 1];
    if (last) this.spider.teleport(last);
    this.playing = false;
    const done = this.handlers.onDone;
    this.handlers = {};
    this.route = null;
    done?.();
  }

  private fire(p: Waypoint, instant: boolean): void {
    if (p.page !== this.lastPage) {
      this.lastPage = p.page;
      this.handlers.onPage?.(p.page);
    }
    if (!p.event) return;
    if (p.event.type === 'arrive') {
      this.handlers.onArrive?.(p.event.stop);
      if (this.options.focusMode) this.focusLine = { page: p.page, y: p.y };
    } else {
      const screen = { x: p.x, y: p.y - this.scrollY };
      this.handlers.onFinish?.(p.event.stop, instant ? { x: -1, y: -1 } : screen);
      if (!instant && !this.options.reducedMotion) this.spider.celebrate();
    }
  }

  fling(text: string, from: { x: number; y: number }, onArrive?: () => void): void {
    if (this.options.reducedMotion || this.options.focusMode || from.x < 0) {
      onArrive?.();
      return;
    }
    const rtlUi = document.documentElement.dir === 'rtl';
    this.particles.push({
      text,
      x: from.x,
      y: from.y,
      tx: rtlUi ? -40 : this.width + 40,
      ty: 40 + Math.random() * 60,
      t: 0,
      onArrive,
    });
  }

  private step(dt: number): void {
    if (this.playing && this.route) {
      const pts = this.route.points;
      let budget = dt;
      // Several waypoints may be passed in one frame at high speed.
      while (budget > 0 && this.routeIndex < pts.length) {
        const target = pts[this.routeIndex];
        const speed = (target.mode === 'read' ? this.route.readSpeed : this.route.skimSpeed) * this.speed;
        if (this.options.reducedMotion) {
          this.spider.teleport(target);
          this.fire(target, false);
          this.routeIndex++;
          if (target.event) break;
          continue;
        }
        const before = { ...this.spider.pos };
        const arrived = this.spider.moveToward(target, speed, budget);
        const used = Math.hypot(this.spider.pos.x - before.x, this.spider.pos.y - before.y) / speed;
        budget -= Math.max(used, 1e-4);
        if (!arrived) break;
        this.fire(target, false);
        this.routeIndex++;
      }
      if (this.routeIndex >= pts.length) {
        this.playing = false;
        const done = this.handlers.onDone;
        this.handlers = {};
        this.route = null;
        done?.();
      }
      this.spider.update(dt, this.route ? this.route.skimSpeed * this.speed : 100);
    } else {
      this.spider.update(dt, 100);
    }
    // Camera follows the spider unless the user is scrolling by hand.
    if (performance.now() > this.followPausedUntil) {
      const target = Math.max(0, this.spider.pos.y - this.height * 0.42);
      const k = this.options.reducedMotion ? 1 : Math.min(1, dt * 4);
      this.scrollY += (target - this.scrollY) * k;
    }
    for (const p of this.particles) p.t += dt / 0.9;
    const arrived = this.particles.filter((p) => p.t >= 1);
    this.particles = this.particles.filter((p) => p.t < 1);
    arrived.forEach((p) => p.onArrive?.());
  }

  private loop(time: number): void {
    const dt = Math.min(0.05, (time - (this.lastTime || time)) / 1000);
    this.lastTime = time;
    this.step(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  draw(): void {
    const { ctx, metrics: m } = this;
    const colors = {
      bg: cssVar('--canvas-bg', '#e9eef0'),
      page: cssVar('--page-bg', '#ffffff'),
      text: cssVar('--page-text', '#1d2428'),
      muted: cssVar('--muted', '#6b777d'),
      key: cssVar('--hl-key', 'rgba(255, 190, 60, 0.45)'),
      match: cssVar('--hl-match', 'rgba(40, 170, 160, 0.35)'),
      current: cssVar('--hl-current', 'rgba(230, 90, 60, 0.55)'),
      body: cssVar('--spider-body', '#1f5f63'),
      mark: cssVar('--spider-mark', '#f0a531'),
      leg: cssVar('--spider-leg', '#17474a'),
      silk: cssVar('--silk', 'rgba(120, 140, 150, 0.55)'),
      eye: cssVar('--spider-eye', '#ffffff'),
      glass: cssVar('--spider-glass', '#f0a531'),
      accent: cssVar('--accent', '#1f7a7f'),
    };
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(0, -this.scrollY);
    const left = this.pageLeft;
    const viewTop = this.scrollY - 50;
    const viewBottom = this.scrollY + this.height + 50;
    for (const layout of this.layouts) {
      if (layout.top + layout.height < viewTop) continue;
      if (layout.top > viewBottom) break;
      const page = this.pages[layout.number - 1];
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(left + 2, layout.top + 3, m.pageWidth, layout.height);
      ctx.fillStyle = colors.page;
      ctx.fillRect(left, layout.top, m.pageWidth, layout.height);
      // Highlights under the text.
      for (const h of this.highlights) {
        if (h.page !== layout.number) continue;
        ctx.fillStyle = h.kind === 'key' ? colors.key : h.kind === 'current' ? colors.current : colors.match;
        for (const line of linesForRange(layout, h.start, h.end)) {
          const [x0, x1] = spanInLine(page.text, line, h.start, h.end, this.contentWidth, this.measure);
          const lh = line.heading ? m.lineHeight * 1.3 : m.lineHeight;
          ctx.fillRect(left + m.padding + x0 - 2, layout.top + line.y - m.fontSize * 1.05, x1 - x0 + 4, lh * 0.9);
        }
      }
      ctx.fillStyle = colors.text;
      for (const line of layout.lines) {
        const y = layout.top + line.y;
        if (y < viewTop || y > viewBottom + m.lineHeight) continue;
        const dim = this.options.focusMode && this.focusLine && (this.focusLine.page !== layout.number || Math.abs(this.focusLine.y - (y - m.fontSize * 0.35)) > m.lineHeight * 2.5);
        ctx.globalAlpha = dim ? 0.35 : 1;
        ctx.font = font(m, line.heading);
        const text = page.text.slice(line.start, line.end).replace(/\n/g, ' ');
        if (line.rtl) {
          ctx.direction = 'rtl';
          ctx.textAlign = 'right';
          ctx.fillText(text, left + m.pageWidth - m.padding, y);
        } else {
          ctx.direction = 'ltr';
          ctx.textAlign = 'left';
          ctx.fillText(text, left + m.padding, y);
        }
      }
      ctx.globalAlpha = 1;
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.font = `12px ${'system-ui, sans-serif'}`;
      ctx.fillStyle = colors.muted;
      ctx.fillText(String(layout.number), left + m.pageWidth / 2, layout.top + layout.height - 12);
      if (layout.scanned) {
        ctx.font = `15px system-ui, sans-serif`;
        ctx.fillText('🖼  Scanned image with no text layer', left + m.pageWidth / 2, layout.top + layout.height / 2);
      }
    }
    if (this.options.showRoute && this.route) {
      ctx.strokeStyle = 'rgba(220, 40, 120, 0.5)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      this.route.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.pages.length) {
      if (this.options.focusMode) ctx.globalAlpha = 0.55;
      this.spider.draw(ctx, colors);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Flying keywords, in screen space.
    ctx.font = `600 15px ${'system-ui, sans-serif'}`;
    ctx.textAlign = 'center';
    for (const p of this.particles) {
      const e = p.t * p.t;
      const x = p.x + (p.tx - p.x) * e;
      const y = p.y + (p.ty - p.y) * e - Math.sin(p.t * Math.PI) * 60;
      ctx.globalAlpha = 1 - p.t * 0.4;
      const w = ctx.measureText(p.text).width + 14;
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 14, w, 24, 12);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(p.text, x, y + 3);
    }
    ctx.globalAlpha = 1;
    this.onAfterDraw?.(ctx, this.width, this.height);
  }

  private handleClick(e: MouseEvent): void {
    if (!this.onWordClick) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + this.scrollY;
    const layout = this.layouts.find((l) => y >= l.top && y <= l.top + l.height);
    if (!layout) return;
    const page = this.pages[layout.number - 1];
    const line = layout.lines.find((l) => {
      const lh = l.heading ? this.metrics.lineHeight * 1.3 : this.metrics.lineHeight;
      return y >= layout.top + l.y - this.metrics.fontSize * 1.05 && y <= layout.top + l.y - this.metrics.fontSize * 1.05 + lh;
    });
    if (!line) return;
    const words = [...page.text.slice(line.start, line.end).matchAll(/[\p{L}\p{M}\p{N}'’-]+/gu)];
    for (const w of words) {
      const s = line.start + (w.index ?? 0);
      const eIdx = s + w[0].length;
      const [x0, x1] = spanInLine(page.text, line, s, eIdx, this.contentWidth, this.measure);
      const px = x - this.pageLeft - this.metrics.padding;
      if (px >= x0 - 2 && px <= x1 + 2) {
        this.onWordClick(layout.number, s, w[0], e.clientX, e.clientY);
        return;
      }
    }
  }
}
