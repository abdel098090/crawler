// DocView: one canvas that draws the pages, the highlights, the spider and
// the catch effects. It also runs the walk along a planned route.
//
// Performance notes (60 fps on a 300-page book):
// - only the pages on screen are drawn;
// - theme colors are read from CSS once and cached, not every frame;
// - word positions (where feet can land) are computed once per page, lazily;
// - legs are drawn as one path per pass; the "glow" is a wide faint stroke,
//   not the slow canvas shadowBlur;
// - flying words use a separate overlay canvas that is only redrawn while
//   something is flying.

import type { DocPage } from '../core/types';
import {
  arcControl, BITE_MS, BOX_MS, curvePoint, ease, FLY_MS, grabPhase, jitter, TEAR_AT,
  type Flyer, type GrabFx, type HuntFx, type Pt, type WordBox,
} from './effects';
import { font, layoutDocument, linesForRange, spanInLine, type LayoutMetrics, type PageLayout } from './layout';
import { planRoute, type Route, type Stop, type Waypoint } from './route';
import { Spider } from './spider';
import { WireSpider, type AllSpiderColors, type SpiderLike } from './wirespider';

export interface Highlight {
  page: number;
  start: number;
  end: number;
  kind: 'key' | 'match' | 'current' | 'focus' | 'vocab';
  /** Own color for this highlight (vocabulary words each get one). */
  color?: string;
}

export type SpiderStyle = 'wire' | 'cartoon';

/** Options for a grabbed word or sentence that flies to a side panel. */
export interface GrabOptions {
  /** Its own color (vocabulary words keep their color). A neon color otherwise. */
  color?: string;
  /** Where it lands. The Keywords panel otherwise. */
  target?: () => Pt | null;
  /** Text shown while flying, for example a shortened sentence. The word itself otherwise. */
  label?: string;
}

export interface ViewOptions {
  fastMode: boolean;
  reducedMotion: boolean;
  focusMode: boolean;
  showRoute: boolean;
  spiderStyle: SpiderStyle;
}

export interface WalkHandlers {
  onArrive?: (stop: Stop) => void;
  onFinish?: (stop: Stop, screenPos: { x: number; y: number }) => void;
  onPage?: (page: number) => void;
  onDone?: () => void;
}

interface ViewColors extends AllSpiderColors {
  bg: string;
  page: string;
  text: string;
  muted: string;
  key: string;
  match: string;
  current: string;
  accent: string;
  neon: string[];
  dark: boolean;
}

function readColors(): ViewColors {
  const cs = typeof getComputedStyle === 'undefined' ? null : getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;
  const bg = v('--canvas-bg', '#e6ecea');
  return {
    bg,
    page: v('--page-bg', '#ffffff'),
    text: v('--page-text', '#1d2428'),
    muted: v('--muted', '#6b777d'),
    key: v('--hl-key', 'rgba(255, 190, 60, 0.45)'),
    match: v('--hl-match', 'rgba(40, 170, 160, 0.35)'),
    current: v('--hl-current', 'rgba(230, 90, 60, 0.55)'),
    accent: v('--accent', '#1f7a7f'),
    body: v('--spider-body', '#1f5f63'),
    mark: v('--spider-mark', '#f0a531'),
    leg: v('--spider-leg', '#17474a'),
    eye: v('--spider-eye', '#ffffff'),
    glass: v('--spider-glass', '#f0a531'),
    silk: v('--silk', 'rgba(120, 140, 150, 0.55)'),
    wire: v('--wire', '#1f7a7f'),
    wireGlow: v('--wire-glow', 'rgba(31, 122, 127, 0.16)'),
    joint: v('--wire-joint', '#d6337a'),
    wireBody: v('--wire-body', '#2b59c3'),
    neon: [v('--neon-cyan', '#0098a8'), v('--neon-pink', '#c2188f'), v('--neon-blue', '#2b59c3'), v('--neon-yellow', '#b8860b')],
    dark: v('--is-dark', '0') === '1',
  };
}

/** Adds transparency to a #rrggbb color. */
function alpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export class DocView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pages: DocPage[] = [];
  layouts: PageLayout[] = [];
  metrics: LayoutMetrics = { pageWidth: 680, padding: 44, fontSize: 17, lineHeight: 29, gap: 28 };
  scrollY = 0;
  spider: SpiderLike = new WireSpider(0, 0);
  highlights: Highlight[] = [];
  options: ViewOptions = { fastMode: false, reducedMotion: false, focusMode: false, showRoute: false, spiderStyle: 'wire' };
  speed = 1;
  playing = false;
  route: Route | null = null;
  /** True from the start of a planned walk until it ends (used by the "Dark lab while crawling" theme). */
  crawling = false;
  onCrawlChange?: (crawling: boolean) => void;
  /** Where flying keywords should land, in window coordinates. */
  grabTarget?: () => Pt | null;
  fps = 60;
  private colors: ViewColors = readColors();
  private grabs: GrabFx[] = [];
  private hunts: HuntFx[] = [];
  private flyers: Flyer[] = [];
  private overlay: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private overlayDirty = false;
  private anchors = new Map<number, Pt[]>();
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
  private neonIndex = 0;
  /** A short speech bubble over the spider (its personality). */
  bubble: { text: string; until: number } | null = null;
  say(text: string, seconds = 2.5): void {
    if (this.options.focusMode) return; // stay calm during close reading
    this.bubble = { text, until: performance.now() + seconds * 1000 };
  }
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
    // Theme changes: re-read the colors once, instead of every frame.
    new MutationObserver(() => this.refreshColors()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.refreshColors());
    window.addEventListener('resize', () => this.sizeOverlay());
    this.setSpiderStyle('wire');
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  refreshColors(): void {
    this.colors = readColors();
  }

  /** Switches between the wireframe spider and the classic cartoon spider. */
  setSpiderStyle(style: SpiderStyle): void {
    const old = this.spider;
    this.options.spiderStyle = style;
    this.spider = style === 'cartoon' ? new Spider(old.pos.x, old.pos.y) : new WireSpider(old.pos.x, old.pos.y);
    this.spider.snap = (p) => this.snapToWord(p);
    this.spider.setScale?.(this.spiderScale());
    this.spider.teleport(old.pos, old.angle);
  }

  private spiderScale(): number {
    return Math.max(0.5, Math.min(1, this.metrics.pageWidth / 680));
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
    this.anchors.clear();
    this.spider.setScale?.(this.spiderScale());
  }

  setPages(pages: DocPage[]): void {
    this.pages = pages;
    this.highlights = [];
    this.route = null;
    this.playing = false;
    this.grabs = [];
    this.hunts = [];
    this.setCrawling(false);
    this.relayout();
    this.scrollY = 0;
    this.spider.teleport({ x: this.pageLeft + this.metrics.pageWidth / 2, y: this.metrics.padding }, Math.PI / 2);
  }

  relayout(): void {
    this.measureCache.clear();
    this.anchors.clear();
    this.layouts = layoutDocument(this.pages, this.metrics, this.measure, this.metrics.gap);
  }

  scrollBy(dy: number): void {
    this.scrollY = Math.max(0, Math.min(this.docHeight - this.height * 0.5, this.scrollY + dy));
    this.followPausedUntil = performance.now() + 2500;
  }

  private setCrawling(v: boolean): void {
    if (this.crawling === v) return;
    this.crawling = v;
    this.onCrawlChange?.(v);
  }

  // ------------------------------------------------------- word anchors
  /** Centers of the words on a page, in document coordinates. Computed once per page. */
  private pageAnchors(pageNumber: number): Pt[] {
    let list = this.anchors.get(pageNumber);
    if (list) return list;
    list = [];
    const layout = this.layouts[pageNumber - 1];
    const page = this.pages[pageNumber - 1];
    if (layout && page) {
      for (const line of layout.lines) {
        const y = layout.top + line.y - this.metrics.fontSize * 0.35;
        for (const w of page.text.slice(line.start, line.end).matchAll(/\S+/g)) {
          const s = line.start + (w.index ?? 0);
          const [x0, x1] = spanInLine(page.text, line, s, s + w[0].length, this.contentWidth, this.measure);
          list.push({ x: this.pageLeft + this.metrics.padding + (x0 + x1) / 2, y });
        }
      }
    }
    this.anchors.set(pageNumber, list);
    return list;
  }

  /** Moves a foot target onto the nearest real word, if one is close enough. */
  snapToWord(p: Pt): Pt {
    const radius = 46;
    let best: Pt | null = null;
    let bestD = radius;
    const page = this.pageAt(p.y);
    for (const n of [page - 1, page, page + 1]) {
      if (n < 1 || n > this.layouts.length) continue;
      const l = this.layouts[n - 1];
      if (p.y < l.top - radius || p.y > l.top + l.height + radius) continue;
      for (const a of this.pageAnchors(n)) {
        const dy = Math.abs(a.y - p.y);
        if (dy >= bestD) continue;
        const d = Math.hypot(a.x - p.x, dy);
        if (d < bestD) [best, bestD] = [a, d];
      }
    }
    return best ? { ...best } : p;
  }

  // ------------------------------------------------------- navigation
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

  /** Which page is at document height y (binary search, pages are sorted). */
  pageAt(y: number): number {
    let lo = 0;
    let hi = this.layouts.length - 1;
    if (hi < 0) return 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const l = this.layouts[mid];
      if (y > l.top + l.height + this.metrics.gap) lo = mid + 1;
      else hi = mid;
    }
    return this.layouts[lo].number;
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

  /** The box of a word on the page (first line only), in document coordinates. */
  wordBox(page: number, start: number, end: number): WordBox | null {
    const layout = this.layouts[page - 1];
    const p = this.pages[page - 1];
    if (!layout || !p) return null;
    const line = linesForRange(layout, start, end)[0];
    if (!line) return null;
    const e = Math.min(end, line.end);
    const [x0, x1] = spanInLine(p.text, line, start, e, this.contentWidth, this.measure);
    const m = this.metrics;
    const lh = line.heading ? m.lineHeight * 1.3 : m.lineHeight;
    return {
      page, start, end: e,
      x: this.pageLeft + m.padding + x0 - 2,
      y: layout.top + line.y - m.fontSize * 1.05,
      w: x1 - x0 + 4,
      h: lh * 0.9,
      baseline: layout.top + line.y,
      rtl: line.rtl,
      heading: line.heading,
      text: p.text.slice(start, e).replace(/\n/g, ' '),
    };
  }

  get contentWidth(): number {
    return this.metrics.pageWidth - this.metrics.padding * 2;
  }

  /** Effects are off in fast mode, with reduced motion, and in focus mode (calm reading). */
  get effectsOn(): boolean {
    return !this.options.fastMode && !this.options.reducedMotion && !this.options.focusMode;
  }

  // ------------------------------------------------------- walking
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
    this.setCrawling(true);
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
    this.end();
  }

  private end(): void {
    this.playing = false;
    const done = this.handlers.onDone;
    this.handlers = {};
    this.route = null;
    this.setCrawling(false);
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

  // ------------------------------------------------------- catch effects
  private nextNeon(): string {
    const c = this.colors.neon[this.neonIndex % this.colors.neon.length];
    this.neonIndex++;
    return c;
  }

  /**
   * Catches a keyword on the page: glow bar, glitch, tear-off and flight into the
   * Keywords panel. `onArrive` runs when the word lands (or at once when effects are off).
   */
  grabWord(page: number, start: number, end: number, onArrive: () => void, delayMs = 0, opts: GrabOptions = {}): void {
    const box = this.effectsOn ? this.wordBox(page, start, end) : null;
    if (!box) {
      onArrive();
      return;
    }
    const color = opts.color ?? this.nextNeon();
    const fx: GrabFx = {
      box,
      color,
      t0: performance.now() + delayMs,
      torn: false,
      onTear: () => this.launch(box, color, onArrive, opts),
    };
    this.grabs.push(fx);
  }

  private launch(box: WordBox, color: string, onArrive: () => void, opts: GrabOptions = {}): void {
    const rect = this.canvas.getBoundingClientRect();
    const from = { x: rect.left + box.x + box.w / 2, y: rect.top + box.y - this.scrollY + box.h / 2 };
    const to = opts.target?.() ?? this.grabTarget?.() ?? { x: rect.right - 20, y: rect.top + 20 };
    this.ensureOverlay();
    this.flyers.push({ text: opts.label ?? box.text, from, ctrl: arcControl(from, to), to, color, t0: performance.now(), rtl: box.rtl, onArrive });
  }

  /** Word Hunt: an outline box draws itself around a match. */
  huntBox(page: number, start: number, end: number): void {
    if (!this.effectsOn) return;
    const box = this.wordBox(page, start, end);
    if (box) this.hunts.push({ box, color: this.nextNeon(), t0: performance.now(), biteT0: null });
  }

  /** Word Hunt: the spider bites the match, with a small flash. */
  bite(page: number, start: number, end: number): void {
    if (!this.effectsOn) return;
    let fx = this.hunts.find((h) => h.box.page === page && h.box.start === start && h.biteT0 === null);
    if (!fx) {
      const box = this.wordBox(page, start, end);
      if (!box) return;
      fx = { box, color: this.nextNeon(), t0: performance.now() - BOX_MS, biteT0: null };
      this.hunts.push(fx);
    }
    fx.biteT0 = performance.now();
    this.spider.biteAt?.({ x: fx.box.x + fx.box.w / 2, y: fx.box.y + fx.box.h / 2 });
  }

  private ensureOverlay(): void {
    if (this.overlay) return;
    this.overlay = document.createElement('canvas');
    this.overlay.setAttribute('aria-hidden', 'true');
    Object.assign(this.overlay.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '45' });
    document.body.append(this.overlay);
    this.overlayCtx = this.overlay.getContext('2d');
    this.sizeOverlay();
  }

  private sizeOverlay(): void {
    if (!this.overlay) return;
    this.overlay.width = Math.round(innerWidth * this.dpr);
    this.overlay.height = Math.round(innerHeight * this.dpr);
  }

  // ------------------------------------------------------- frame loop
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
      const speedNow = this.route ? this.route.skimSpeed * this.speed : 100;
      if (this.route && this.routeIndex >= pts.length) {
        // A planned walk ends; a simple goTo jump just stops.
        if (this.crawling) this.end();
        else {
          this.playing = false;
          this.route = null;
        }
      }
      this.spider.update(dt, speedNow);
    } else {
      this.spider.update(dt, 100);
    }
    // Camera follows the spider unless the user is scrolling by hand.
    if (performance.now() > this.followPausedUntil) {
      const target = Math.max(0, this.spider.pos.y - this.height * 0.42);
      // Smooth follow, but jump when the spider is more than a screen away (fast skimming).
      const far = Math.abs(target - this.scrollY) > this.height * 0.8;
      const k = this.options.reducedMotion || far ? 1 : Math.min(1, dt * 4);
      this.scrollY += (target - this.scrollY) * k;
    }
    const now = performance.now();
    for (const g of this.grabs) {
      if (!g.torn && now - g.t0 >= TEAR_AT) {
        g.torn = true;
        g.onTear();
      }
    }
    this.grabs = this.grabs.filter((g) => grabPhase(now - g.t0).phase !== 'done');
    this.hunts = this.hunts.filter((h) => (h.biteT0 === null ? now - h.t0 < 8000 : now - h.biteT0 < BITE_MS + 900));
    const landed = this.flyers.filter((f) => now - f.t0 >= FLY_MS);
    if (landed.length) {
      this.flyers = this.flyers.filter((f) => now - f.t0 < FLY_MS);
      landed.forEach((f) => f.onArrive?.());
    }
    // If effects were turned off mid-flight, land everything at once.
    if (!this.effectsOn && (this.grabs.length || this.flyers.length || this.hunts.length)) {
      this.grabs.forEach((g) => !g.torn && g.onTear());
      this.flyers.forEach((f) => f.onArrive?.());
      this.grabs = [];
      this.flyers = [];
      this.hunts = [];
    }
  }

  private loop(time: number): void {
    const dt = Math.min(0.05, (time - (this.lastTime || time)) / 1000);
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.lastTime = time;
    this.step(dt);
    this.draw();
    this.drawOverlay();
    this.raf = requestAnimationFrame(this.loop);
  }

  draw(): void {
    const { ctx, metrics: m } = this;
    const colors = this.colors;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(0, -this.scrollY);
    const left = this.pageLeft;
    const viewTop = this.scrollY - 50;
    const viewBottom = this.scrollY + this.height + 50;
    // Group highlights by page once per frame (a big Word Hunt can have thousands).
    const byPage = new Map<number, Highlight[]>();
    for (const h of this.highlights) {
      let list = byPage.get(h.page);
      if (!list) byPage.set(h.page, (list = []));
      list.push(h);
    }
    const now = performance.now();
    for (let i = this.pageAt(viewTop) - 1; i < this.layouts.length; i++) {
      const layout = this.layouts[i];
      if (layout.top > viewBottom) break;
      if (layout.top + layout.height < viewTop) continue;
      const page = this.pages[layout.number - 1];
      ctx.fillStyle = colors.dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(left + 2, layout.top + 3, m.pageWidth, layout.height);
      ctx.fillStyle = colors.page;
      ctx.fillRect(left, layout.top, m.pageWidth, layout.height);
      for (const h of byPage.get(layout.number) ?? []) {
        ctx.fillStyle = h.color ?? (h.kind === 'key' ? colors.key : h.kind === 'current' ? colors.current : colors.match);
        for (const line of linesForRange(layout, h.start, h.end)) {
          const [x0, x1] = spanInLine(page.text, line, h.start, h.end, this.contentWidth, this.measure);
          const lh = line.heading ? m.lineHeight * 1.3 : m.lineHeight;
          ctx.fillRect(left + m.padding + x0 - 2, layout.top + line.y - m.fontSize * 1.05, x1 - x0 + 4, lh * 0.9);
        }
      }
      // Glow bars of words being grabbed sit under the text.
      for (const g of this.grabs) {
        if (g.box.page !== layout.number) continue;
        const { phase, p } = grabPhase(now - g.t0);
        if (phase === 'glow' || phase === 'glitch') this.drawGlowBar(g.box, g.color, phase === 'glow' ? p : 1);
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
      // Effects that sit on top of the text: glitch, torn-off ghost blocks, hunt boxes.
      for (const g of this.grabs) {
        if (g.box.page !== layout.number) continue;
        const { phase, p } = grabPhase(now - g.t0);
        if (phase === 'glitch') this.drawGlitch(g.box, now);
        else if (phase === 'ghost') this.drawGhost(g.box, g.color, p);
      }
      for (const hfx of this.hunts) if (hfx.box.page === layout.number) this.drawHunt(hfx, now);
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
      ctx.lineWidth = 1;
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
      this.drawBubble();
    }
    ctx.restore();
    if (this.options.showRoute) {
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.fillStyle = colors.muted;
      ctx.fillText(`${Math.round(this.fps)} fps`, 8, this.height - 8);
    }
    this.onAfterDraw?.(ctx, this.width, this.height);
  }

  private drawGlowBar(b: WordBox, color: string, p: number): void {
    const ctx = this.ctx;
    const w = b.w * Math.min(1, p * 1.6);
    const x = b.rtl ? b.x + b.w - w : b.x;
    ctx.fillStyle = alpha(color, 0.18);
    ctx.fillRect(x - 4, b.y - 3, w + 8, b.h + 6);
    ctx.fillStyle = alpha(color, 0.42);
    ctx.fillRect(x, b.y, w, b.h);
    ctx.fillStyle = color;
    ctx.fillRect(x, b.y + b.h - 2, w, 2);
  }

  private wordText(b: WordBox, color: string, dx = 0): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = font(this.metrics, b.heading);
    if (b.rtl) {
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillText(b.text, b.x + b.w - 2 + dx, b.baseline);
    } else {
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.fillText(b.text, b.x + 2 + dx, b.baseline);
    }
  }

  /** RGB split plus horizontal slices that jump sideways. */
  private drawGlitch(b: WordBox, now: number): void {
    const ctx = this.ctx;
    const seed = Math.floor(now / 45);
    ctx.save();
    ctx.fillStyle = this.colors.page;
    ctx.fillRect(b.x - 4, b.y - 2, b.w + 8, b.h + 4);
    ctx.globalAlpha = 0.85;
    this.wordText(b, '#ff2a6d', -3);
    this.wordText(b, '#05d9e8', 3);
    this.wordText(b, '#3d7bff', jitter(seed, 9) * 4);
    ctx.globalAlpha = 1;
    const slices = 4;
    for (let i = 0; i < slices; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x - 10, b.y + (b.h * i) / slices, b.w + 20, b.h / slices + 0.5);
      ctx.clip();
      this.wordText(b, this.colors.text, jitter(seed, i) * 12);
      ctx.restore();
    }
    ctx.restore();
  }

  /** The faint colored block left where the word was torn off, fading out. */
  private drawGhost(b: WordBox, color: string, p: number): void {
    const ctx = this.ctx;
    const a = 1 - p;
    ctx.fillStyle = this.colors.page;
    ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.fillRect(b.x - 1, b.y, b.w + 2, b.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = alpha(color, 0.3 * a);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = alpha(color, 0.55 * a);
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  }

  private drawHunt(fx: HuntFx, now: number): void {
    const ctx = this.ctx;
    const b = fx.box;
    const grow = Math.min(1, (now - fx.t0) / BOX_MS);
    const pad = 4 + (1 - grow) * 10;
    const fade = fx.biteT0 === null ? 1 : Math.max(0, 1 - (now - fx.biteT0 - BITE_MS) / 900);
    ctx.save();
    ctx.globalAlpha = grow * fade;
    // Glowing outline: a wide faint stroke, then a thin bright one.
    ctx.strokeStyle = alpha(fx.color, 0.25);
    ctx.lineWidth = 6;
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
    if (fx.biteT0 !== null) {
      const t = Math.min(1, (now - fx.biteT0) / BITE_MS);
      if (t < 1) {
        // The bite: a quick flash on the word and a ring that opens outward.
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = fx.color;
        ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 8 + t * (b.w / 2 + 26), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawBubble(): void {
    const { ctx, metrics: m, colors } = this;
    if (!this.bubble || performance.now() >= this.bubble.until) return;
    ctx.font = `600 14px "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif`;
    ctx.direction = /[؀-ۿ]/.test(this.bubble.text) ? 'rtl' : 'ltr';
    ctx.textAlign = 'center';
    const w = ctx.measureText(this.bubble.text).width + 20;
    const bx = Math.max(this.pageLeft + w / 2, Math.min(this.pageLeft + m.pageWidth - w / 2, this.spider.pos.x));
    const by = this.spider.pos.y - (this.options.spiderStyle === 'wire' ? 120 : 70);
    ctx.fillStyle = colors.page;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx - w / 2, by - 16, w, 30, 14);
    ctx.moveTo(bx - 6, by + 14);
    ctx.lineTo(this.spider.pos.x, by + 26);
    ctx.lineTo(bx + 6, by + 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.text;
    ctx.fillText(this.bubble.text, bx, by + 4);
    ctx.direction = 'ltr';
  }

  /** Flying words, on a window-sized overlay so they can land in the side panel. */
  private drawOverlay(): void {
    const o = this.overlayCtx;
    if (!o || !this.overlay) return;
    if (!this.flyers.length) {
      if (this.overlayDirty) {
        o.setTransform(1, 0, 0, 1, 0, 0);
        o.clearRect(0, 0, this.overlay.width, this.overlay.height);
        this.overlayDirty = false;
      }
      return;
    }
    this.overlayDirty = true;
    o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    o.clearRect(0, 0, innerWidth, innerHeight);
    const now = performance.now();
    o.font = `600 15px "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif`;
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    for (const f of this.flyers) {
      const t = Math.min(1, (now - f.t0) / FLY_MS);
      o.direction = f.rtl ? 'rtl' : 'ltr';
      const w = o.measureText(f.text).width + 18;
      // A short afterimage trail, then the word itself.
      for (let k = 3; k >= 0; k--) {
        const tk = Math.max(0, t - k * 0.035);
        const p = curvePoint(f.from, f.ctrl, f.to, ease(tk));
        const shrink = 1 - 0.45 * ease(tk);
        o.save();
        o.translate(p.x, p.y);
        o.rotate(Math.sin(tk * Math.PI) * -0.12);
        o.scale(shrink, shrink);
        o.globalAlpha = k === 0 ? 1 : 0.18 / k;
        if (k === 0) {
          o.fillStyle = alpha(f.color, 0.2);
          o.beginPath();
          o.roundRect(-w / 2 - 4, -16, w + 8, 32, 16);
          o.fill();
          o.fillStyle = this.colors.page;
          o.strokeStyle = f.color;
          o.lineWidth = 1.6;
          o.beginPath();
          o.roundRect(-w / 2, -12, w, 24, 12);
          o.fill();
          o.stroke();
          o.fillStyle = this.colors.text;
        } else o.fillStyle = f.color;
        o.fillText(f.text, 0, 1);
        o.restore();
      }
    }
    o.globalAlpha = 1;
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
