import { describe, expect, it } from 'vitest';
import { arcControl, curvePoint, grabPhase, GRAB_GHOST_MS, GRAB_GLITCH_MS, GRAB_GLOW_MS, TEAR_AT } from '../src/render/effects';
import { solveChain } from '../src/render/ik';
import { WireSpider } from '../src/render/wirespider';
import { resolveTheme } from '../src/ui/theme';

const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('inverse kinematics (FABRIK)', () => {
  it('reaches the target and keeps every bone its length', () => {
    const joints = [{ x: 0, y: 0 }, { x: 0, y: 80 }, { x: 0, y: 160 }, { x: 0, y: 210 }];
    const lengths = [80, 80, 50];
    solveChain(joints, lengths, { x: 120, y: 90 }, { x: 0, y: 200 }, 10);
    expect(d(joints[3], { x: 120, y: 90 })).toBeLessThan(1);
    for (let i = 0; i < 3; i++) expect(d(joints[i], joints[i + 1])).toBeCloseTo(lengths[i], 0);
  });
  it('bends the knee toward the pole (outward), not under the body', () => {
    const hip = { x: 0, y: 0 };
    const target = { x: 150, y: 0 };
    const out = solveChain([hip, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 }], [80, 80, 50], target, { x: 60, y: -200 }, 10);
    expect(out[1].y).toBeLessThan(0); // knee on the pole side
  });
  it('stretches straight toward a target out of reach', () => {
    const out = solveChain([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], [10, 10, 10], { x: 100, y: 0 }, null);
    expect(out[3].x).toBeCloseTo(30);
  });
});

describe('wireframe spider', () => {
  // A grid of fake "word" anchors, like words on lines of text.
  const anchors: { x: number; y: number }[] = [];
  for (let y = 0; y < 3000; y += 29) for (let x = 0; x < 900; x += 55) anchors.push({ x, y });
  const snap = (p: { x: number; y: number }) => {
    let best = p;
    let bd = 46;
    for (const a of anchors) {
      const dd = d(a, p);
      if (dd < bd) [best, bd] = [a, dd];
    }
    return { ...best };
  };

  it('plants feet on words, steps in two alternating groups, and keeps legs attached', () => {
    const s = new WireSpider(450, 200);
    s.snap = snap;
    s.teleport({ x: 450, y: 200 }, Math.PI / 2);
    const isAnchor = (p: { x: number; y: number }) => anchors.some((a) => a.x === p.x && a.y === p.y);
    let steps = 0;
    for (let f = 0; f < 600; f++) {
      s.moveToward({ x: 450, y: 2600 }, 260, 1 / 60);
      s.update(1 / 60, 260);
      // Never both groups in the air at the same time.
      expect(s.stepping(0) && s.stepping(1)).toBe(false);
      for (const l of s.legs) {
        if (l.stepT < 0) expect(isAnchor(l.foot)).toBe(true);
        else steps++;
        // The leg chain is connected: bones keep their length.
        for (let i = 0; i < 3; i++) expect(d(l.joints[i], l.joints[i + 1])).toBeCloseTo(s.bones[i], 0);
      }
    }
    expect(steps).toBeGreaterThan(100);
    expect(s.trail.length).toBeGreaterThan(20);
  });
  it('is about 3 to 4 times bigger than the classic spider', () => {
    const s = new WireSpider(0, 0);
    const xs = s.legs.map((l) => l.foot.x);
    const ys = s.legs.map((l) => l.foot.y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(span).toBeGreaterThan(250); // the classic spider spans about 90 px
  });
});

describe('grab effect timeline', () => {
  it('goes glow, glitch, ghost, done, and tears off after the glitch', () => {
    expect(grabPhase(0).phase).toBe('glow');
    expect(grabPhase(GRAB_GLOW_MS + 1).phase).toBe('glitch');
    expect(grabPhase(TEAR_AT + 1).phase).toBe('ghost');
    expect(grabPhase(GRAB_GLOW_MS + GRAB_GLITCH_MS + GRAB_GHOST_MS + 1).phase).toBe('done');
  });
  it('flies along a curve that starts and ends in the right places and arcs upward', () => {
    const a = { x: 100, y: 500 };
    const b = { x: 1200, y: 80 };
    const c = arcControl(a, b);
    expect(curvePoint(a, c, b, 0)).toEqual(a);
    expect(curvePoint(a, c, b, 1)).toEqual(b);
    expect(curvePoint(a, c, b, 0.5).y).toBeLessThan((a.y + b.y) / 2);
  });
});

describe('themes', () => {
  it('Dark lab while crawling is lab only during a walk', () => {
    expect(resolveTheme('lab-crawl', true)).toBe('lab');
    expect(resolveTheme('lab-crawl', false)).toBe(null);
    expect(resolveTheme('lab', false)).toBe('lab');
    expect(resolveTheme('light', true)).toBe('light');
  });
});
