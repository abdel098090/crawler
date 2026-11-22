// The spider. An original design: a round teal body, an amber back marking,
// big friendly eyes and little round reading glasses (it reads books, after all).
//
// How the legs work:
// - Each of the 8 legs has a hip (fixed on the body) and a foot (planted on the page).
// - Inverse kinematics (IK) finds where the knee must be so that a two-part leg
//   reaches from the hip to the foot. With two segments, this is the law of cosines.
// - Legs step in two alternating groups, like real spiders: while group A
//   steps, group B stays planted, then they swap.

export interface Vec {
  x: number;
  y: number;
}

interface Leg {
  side: -1 | 1; // -1 left, 1 right
  /** Hip position relative to the body center, in body space (x forward). */
  hip: Vec;
  /** Where the foot likes to rest, relative to body center, in body space. */
  rest: Vec;
  foot: Vec;
  stepFrom: Vec;
  stepTo: Vec;
  stepT: number; // 0..1 while stepping, -1 when planted
  group: 0 | 1;
}

const UPPER = 26;
const LOWER = 30;

function rotate(v: Vec, a: number): Vec {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}
function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}
function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Two-bone IK. Given a hip, a foot and the two bone lengths, returns the knee.
 * `bend` picks which side the knee bends to (+1 or -1).
 */
export function solveKnee(hip: Vec, foot: Vec, l1: number, l2: number, bend: number): Vec {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  // Law of cosines: angle at the hip between the hip-foot line and the upper bone.
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const ang = base + a * bend;
  return { x: hip.x + Math.cos(ang) * l1, y: hip.y + Math.sin(ang) * l1 };
}

export class Spider {
  pos: Vec = { x: 0, y: 0 };
  angle = 0;
  legs: Leg[] = [];
  trail: Vec[] = [];
  /** 0..1 happiness pulse, used for small celebrations. */
  joy = 0;
  scale = 1;
  private activeGroup: 0 | 1 = 0;
  private blink = 0;

  constructor(x = 0, y = 0) {
    this.pos = { x, y };
    // Hips along the front half of the body; feet fan out wide.
    const hipX = [10, 4, -2, -8];
    const restX = [52, 22, -12, -42];
    const restY = [40, 54, 54, 44];
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1] as const) {
        const group = ((i + (side === 1 ? 1 : 0)) % 2) as 0 | 1;
        const hip = { x: hipX[i], y: side * 8 };
        const rest = { x: restX[i], y: side * restY[i] };
        const foot = add(this.pos, rotate(rest, this.angle));
        this.legs.push({ side, hip, rest, foot, stepFrom: foot, stepTo: foot, stepT: -1, group });
      }
    }
  }

  /** Puts the spider somewhere instantly, with feet planted around it. */
  teleport(p: Vec, angle = this.angle): void {
    this.pos = { ...p };
    this.angle = angle;
    for (const l of this.legs) {
      l.foot = add(this.pos, rotate(l.rest, this.angle));
      l.stepT = -1;
    }
    this.trail = [];
  }

  /** Moves the body toward a target point. Returns true when it got there. */
  moveToward(target: Vec, speed: number, dt: number): boolean {
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d > 0.5) {
      const want = Math.atan2(dy, dx);
      let diff = want - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * Math.min(1, dt * 8);
    }
    if (d <= step) {
      this.pos = { ...target };
      return true;
    }
    this.pos = { x: this.pos.x + (dx / d) * step, y: this.pos.y + (dy / d) * step };
    return false;
  }

  /** Updates the legs. Call every frame after moving the body. */
  update(dt: number, speed: number): void {
    const stepDuration = Math.max(0.06, Math.min(0.22, 22 / Math.max(1, speed)));
    let anyStepping = false;
    for (const l of this.legs) {
      if (l.stepT >= 0) {
        l.stepT += dt / stepDuration;
        if (l.stepT >= 1) {
          l.stepT = -1;
          l.foot = l.stepTo;
        } else {
          anyStepping = true;
          const t = l.stepT;
          const ease = t * t * (3 - 2 * t);
          l.foot = {
            x: l.stepFrom.x + (l.stepTo.x - l.stepFrom.x) * ease,
            y: l.stepFrom.y + (l.stepTo.y - l.stepFrom.y) * ease,
          };
        }
      }
    }
    // A foot left far behind (after a fast jump) steps right away, so legs never stretch.
    for (const l of this.legs) {
      if (l.stepT >= 0) continue;
      const target = add(this.pos, rotate(l.rest, this.angle));
      if (dist(l.foot, target) > 70) {
        l.stepFrom = l.foot;
        l.stepTo = target;
        l.stepT = 0.5;
      }
    }
    if (!anyStepping) {
      // Which legs of the active group drifted too far from their resting spot?
      const group = this.legs.filter((l) => l.group === this.activeGroup);
      const needs = group.some((l) => dist(l.foot, add(this.pos, rotate(l.rest, this.angle))) > 18);
      if (needs) {
        // Step a bit ahead of the rest spot in the direction of travel, so the gait looks natural.
        const ahead = rotate({ x: 12, y: 0 }, this.angle);
        for (const l of group) {
          l.stepFrom = l.foot;
          l.stepTo = add(add(this.pos, rotate(l.rest, this.angle)), ahead);
          l.stepT = 0;
        }
      }
      this.activeGroup = this.activeGroup === 0 ? 1 : 0;
    }
    // Silk trail.
    const last = this.trail[this.trail.length - 1];
    if (!last || dist(last, this.pos) > 6) {
      this.trail.push({ ...this.pos });
      if (this.trail.length > 90) this.trail.shift();
    }
    this.joy = Math.max(0, this.joy - dt * 0.8);
    this.blink = (this.blink + dt) % 4;
  }

  celebrate(): void {
    this.joy = 1;
  }

  draw(ctx: CanvasRenderingContext2D, colors: { body: string; mark: string; leg: string; silk: string; eye: string; glass: string }): void {
    // Silk trail first, so it sits under the spider.
    if (this.trail.length > 1) {
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = colors.silk;
      ctx.beginPath();
      this.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineTo(this.pos.x, this.pos.y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Legs
    for (const l of this.legs) {
      const hip = add(this.pos, rotate(l.hip, this.angle));
      const knee = solveKnee(hip, l.foot, UPPER, LOWER, l.side === 1 ? -1 : 1);
      const lift = l.stepT >= 0 ? Math.sin(l.stepT * Math.PI) * 6 : 0;
      ctx.strokeStyle = colors.leg;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(hip.x, hip.y);
      ctx.lineTo(knee.x, knee.y - lift);
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(knee.x, knee.y - lift);
      ctx.lineTo(l.foot.x, l.foot.y);
      ctx.stroke();
    }
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    const bounce = 1 + this.joy * 0.12 * Math.sin(this.joy * 20);
    ctx.scale(bounce, bounce);
    // Abdomen (back part)
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(-20, 0, 19, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Amber marking: a small open book shape on the back
    ctx.fillStyle = colors.mark;
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.quadraticCurveTo(-22, -9, -20, -4);
    ctx.quadraticCurveTo(-18, -9, -12, -6);
    ctx.lineTo(-12, 6);
    ctx.quadraticCurveTo(-18, 3, -20, 7);
    ctx.quadraticCurveTo(-22, 3, -28, 6);
    ctx.closePath();
    ctx.fill();
    // Head (front part)
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(6, 0, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes, with a blink now and then
    const open = this.blink > 3.85 ? 0.15 : 1;
    for (const s of [-1, 1]) {
      ctx.fillStyle = colors.eye;
      ctx.beginPath();
      ctx.ellipse(11, s * 5, 4, 4 * open, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.body;
      ctx.beginPath();
      ctx.arc(12.5, s * 5, 1.6 * open, 0, Math.PI * 2);
      ctx.fill();
      // Reading glasses
      ctx.strokeStyle = colors.glass;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(11, s * 5, 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(11, -0.5);
    ctx.lineTo(11, 0.5);
    ctx.stroke();
    // A small smile that gets bigger when the spider is happy
    ctx.strokeStyle = colors.eye;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(14, 0, 3 + this.joy * 2, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }
}
