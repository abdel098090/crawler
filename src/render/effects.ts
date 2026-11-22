// Visual effects for catching words.
//
// Grab (a keyword is caught):
//   0 – 260 ms   a colored glowing bar lights up under the word
//   260 – 480 ms a short glitch: the word splits into red/cyan/blue copies and
//                horizontal slices of it jump sideways
//   480 ms       the word "tears off": a copy flies along a curved line into the
//                Keywords panel, and a faint colored block stays where it was
//   480 – 2000   the block fades away and the page word shows again
//
// Extra polish: corner brackets snap around the word and a silk thread shoots
// from the spider to it (lock-on), sparks burst when it tears off, the flying
// word trails glitter on a silk thread, and a ripple pops where it lands.
//
// Hunt hit (Word Hunt found a match):
//   a glowing outline box draws itself around the match, then the spider bites
//   it: a small flash ring and a bright box.
//
// The timeline functions are pure (easy to test). Drawing is done by the view.

export const GRAB_GLOW_MS = 260;
export const GRAB_GLITCH_MS = 220;
export const GRAB_GHOST_MS = 1520;
export const FLY_MS = 760;
export const BOX_MS = 240;
export const BITE_MS = 280;
/** How long the landing ripple lasts. */
export const RIPPLE_MS = 520;

/** One spark of a burst (window coordinates, pixels per second). */
export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  t0: number;
  life: number;
  size: number;
}

export type GrabPhase = 'glow' | 'glitch' | 'ghost' | 'done';

export function grabPhase(elapsed: number): { phase: GrabPhase; p: number } {
  if (elapsed < GRAB_GLOW_MS) return { phase: 'glow', p: elapsed / GRAB_GLOW_MS };
  const g = elapsed - GRAB_GLOW_MS;
  if (g < GRAB_GLITCH_MS) return { phase: 'glitch', p: g / GRAB_GLITCH_MS };
  const h = g - GRAB_GLITCH_MS;
  if (h < GRAB_GHOST_MS) return { phase: 'ghost', p: h / GRAB_GHOST_MS };
  return { phase: 'done', p: 1 };
}

/** The moment the word tears off and starts flying. */
export const TEAR_AT = GRAB_GLOW_MS + GRAB_GLITCH_MS;

export interface Pt {
  x: number;
  y: number;
}

/** A point on a quadratic curve from a to b, bent through control point c. */
export function curvePoint(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** A control point that makes the flight arc upward and sideways, not a straight line. */
export function arcControl(a: Pt, b: Pt): Pt {
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - Math.max(80, Math.abs(b.x - a.x) * 0.25);
  return { x: mx, y: my };
}

/** Smooth start and end (ease in-out). */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Deterministic jitter for the glitch slices, so it looks random but costs nothing. */
export function jitter(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v) - 0.5;
}

export interface WordBox {
  page: number;
  start: number;
  end: number;
  /** Document coordinates of the word's box. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the text baseline is, and how to draw it. */
  baseline: number;
  rtl: boolean;
  heading: boolean;
  text: string;
}

export interface GrabFx {
  box: WordBox;
  color: string;
  t0: number;
  torn: boolean;
  onTear: () => void;
}

export interface HuntFx {
  box: WordBox;
  color: string;
  t0: number;
  biteT0: number | null;
}

export interface Flyer {
  text: string;
  from: Pt;
  ctrl: Pt;
  to: Pt;
  color: string;
  t0: number;
  rtl: boolean;
  onArrive?: () => void;
}
