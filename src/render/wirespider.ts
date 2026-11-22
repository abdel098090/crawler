// The wireframe spider: my own design for Ankabut.
//
// It is a thin glowing skeleton. A small body made only of line segments
// (a hexagon for the head part, a long diamond for the abdomen, and a spine),
// and 8 long legs with 3 bones each (2 visible joints plus the hip), drawn as
// thin lines with small dots at the joints. There is no face on purpose.
//
// Movement:
// - each foot plants on a REAL word of the page (the view gives us a `snap`
//   function that moves a point onto the nearest word);
// - legs step in two alternating groups (like real spiders: front-left,
//   middle-right... step together, then the other four);
// - every leg is solved with FABRIK inverse kinematics (see ik.ts), bending
//   outward;
// - a faint silk line trails behind.

import { solveChain, type Vec } from './ik';

export interface SpiderColors {
  wire: string;
  wireGlow: string;
  joint: string;
  wireBody: string;
  silk: string;
}

/** Colors for both spider styles (the classic cartoon uses body/mark/leg/eye/glass). */
export type AllSpiderColors = SpiderColors & { body: string; mark: string; leg: string; eye: string; glass: string };

/** What the view needs from any spider (the wireframe one or the classic cartoon). */
export interface SpiderLike {
  pos: Vec;
  angle: number;
  trail: Vec[];
  teleport(p: Vec, angle?: number): void;
  moveToward(target: Vec, speed: number, dt: number): boolean;
  update(dt: number, speed: number): void;
  celebrate(): void;
  draw(ctx: CanvasRenderingContext2D, colors: AllSpiderColors): void;
  biteAt?(p: Vec): void;
  setScale?(s: number): void;
  snap?: (p: Vec) => Vec;
}

interface WireLeg {
  side: -1 | 1;
  index: number;
  hip: Vec; // body space
  rest: Vec; // body space
  foot: Vec; // world space
  joints: Vec[]; // world space: hip, knee, ankle, foot
  stepFrom: Vec;
  stepTo: Vec;
  stepT: number; // -1 when planted
  group: 0 | 1;
}

// Base geometry at scale 1 (body space: x points forward).
const HIP_X = [9, 4, -1, -6];
const REST_X = [150, 62, -40, -128];
const REST_Y = [105, 150, 148, 112];
const BONES = [84, 82, 50];
const STEP_TRIGGER = 46;

function rot(v: Vec, a: number): Vec {
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

export class WireSpider implements SpiderLike {
  pos: Vec;
  angle = Math.PI / 2;
  trail: Vec[] = [];
  legs: WireLeg[] = [];
  snap?: (p: Vec) => Vec;
  private scale = 1;
  private joy = 0;
  private activeGroup: 0 | 1 = 0;
  private bite: { at: Vec; t: number } | null = null;
  private time = 0;

  constructor(x = 0, y = 0) {
    this.pos = { x, y };
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1] as const) {
        // Alternating tetrapod gait: L1 R2 L3 R4 in one group, R1 L2 R3 L4 in the other.
        const group = ((i + (side === 1 ? 1 : 0)) % 2) as 0 | 1;
        this.legs.push({ side, index: i, group, hip: { x: 0, y: 0 }, rest: { x: 0, y: 0 }, foot: { x, y }, joints: [], stepFrom: { x, y }, stepTo: { x, y }, stepT: -1 });
      }
    }
    this.setScale(1);
  }

  setScale(s: number): void {
    this.scale = s;
    for (const l of this.legs) {
      l.hip = { x: HIP_X[l.index] * s, y: l.side * 6 * s };
      l.rest = { x: REST_X[l.index] * s, y: l.side * REST_Y[l.index] * s };
    }
    this.teleport(this.pos, this.angle);
  }

  get bones(): number[] {
    return BONES.map((b) => b * this.scale);
  }

  private restWorld(l: WireLeg): Vec {
    return add(this.pos, rot(l.rest, this.angle));
  }

  private hipWorld(l: WireLeg): Vec {
    return add(this.pos, rot(l.hip, this.angle));
  }

  private plant(p: Vec): Vec {
    return this.snap ? this.snap(p) : p;
  }

  teleport(p: Vec, angle = this.angle): void {
    this.pos = { ...p };
    this.angle = angle;
    for (const l of this.legs) {
      l.foot = this.plant(this.restWorld(l));
      l.stepT = -1;
      l.joints = this.initialJoints(l);
    }
    this.trail = [];
  }

  /** A pre-bent starting pose, so the first IK solve already bends outward. */
  private initialJoints(l: WireLeg): Vec[] {
    const hip = this.hipWorld(l);
    const pole = this.pole(l);
    const b = this.bones;
    const knee = add(hip, scaleTo({ x: pole.x - hip.x, y: pole.y - hip.y }, b[0]));
    const ankle = add(knee, scaleTo({ x: l.foot.x - knee.x, y: l.foot.y - knee.y }, b[1]));
    return [hip, knee, ankle, { ...l.foot }];
  }

  /** A point outside the body, beside this leg: knees are pulled toward it. */
  private pole(l: WireLeg): Vec {
    const hip = this.hipWorld(l);
    const outward = rot({ x: l.rest.x * 0.35, y: l.side * 170 * this.scale }, this.angle);
    return add(hip, outward);
  }

  moveToward(target: Vec, speed: number, dt: number): boolean {
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d > 0.5) {
      let diff = Math.atan2(dy, dx) - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * Math.min(1, dt * 6);
    }
    if (d <= step) {
      this.pos = { ...target };
      return true;
    }
    this.pos = { x: this.pos.x + (dx / d) * step, y: this.pos.y + (dy / d) * step };
    return false;
  }

  biteAt(p: Vec): void {
    this.bite = { at: { ...p }, t: 0 };
  }

  celebrate(): void {
    this.joy = 1;
  }

  /** True while any leg of the given group is in the air. Used by the tests. */
  stepping(group: 0 | 1): boolean {
    return this.legs.some((l) => l.group === group && l.stepT >= 0);
  }

  update(dt: number, speed: number): void {
    this.time += dt;
    const stepDuration = Math.max(0.07, Math.min(0.26, 60 / Math.max(1, speed)));
    let anyStepping = false;
    for (const l of this.legs) {
      if (l.stepT < 0) continue;
      l.stepT += dt / stepDuration;
      if (l.stepT >= 1) {
        l.stepT = -1;
        l.foot = { ...l.stepTo };
      } else {
        anyStepping = true;
        const e = l.stepT * l.stepT * (3 - 2 * l.stepT);
        l.foot = { x: l.stepFrom.x + (l.stepTo.x - l.stepFrom.x) * e, y: l.stepFrom.y + (l.stepTo.y - l.stepFrom.y) * e };
      }
    }
    if (!anyStepping) {
      // Only one group may lift at a time. If this group has nowhere to go, the other gets its turn.
      for (let tries = 0; tries < 2; tries++) {
        const group = this.legs.filter((l) => l.group === this.activeGroup);
        const far = group.some((l) => dist(l.foot, this.restWorld(l)) > STEP_TRIGGER * this.scale);
        const veryFar = group.some((l) => dist(l.foot, this.restWorld(l)) > 3 * STEP_TRIGGER * this.scale);
        this.activeGroup = this.activeGroup === 0 ? 1 : 0;
        if (!far) continue;
        // Step a little ahead in the direction of travel, onto a real word.
        const ahead = rot({ x: 18 * this.scale, y: 0 }, this.angle);
        for (const l of group) {
          l.stepFrom = l.foot;
          l.stepTo = this.plant(add(this.restWorld(l), ahead));
          l.stepT = veryFar ? 0.4 : 0;
        }
        break;
      }
    }
    // Bite: the two front legs strike toward the word, then return.
    if (this.bite) {
      this.bite.t += dt / 0.32;
      if (this.bite.t >= 1) this.bite = null;
    }
    for (const l of this.legs) {
      let foot = l.foot;
      if (this.bite && l.index === 0) {
        const k = Math.sin(Math.min(1, this.bite.t) * Math.PI);
        foot = { x: foot.x + (this.bite.at.x - foot.x) * k * 0.85, y: foot.y + (this.bite.at.y - foot.y) * k * 0.85 };
      }
      if (!l.joints.length) l.joints = this.initialJoints(l);
      l.joints[0] = this.hipWorld(l);
      solveChain(l.joints, this.bones, foot, this.pole(l));
    }
    const last = this.trail[this.trail.length - 1];
    if (!last || dist(last, this.pos) > 8) {
      this.trail.push({ ...this.pos });
      if (this.trail.length > 140) this.trail.shift();
    }
    this.joy = Math.max(0, this.joy - dt * 1.2);
  }

  draw(ctx: CanvasRenderingContext2D, colors: SpiderColors): void {
    const s = this.scale;
    // Faint silk line behind, fading toward the old end.
    if (this.trail.length > 2) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.silk;
      const n = this.trail.length;
      for (let part = 0; part < 3; part++) {
        ctx.globalAlpha = 0.25 + part * 0.25;
        ctx.beginPath();
        const from = Math.floor((part * n) / 3);
        const to = part === 2 ? n : Math.floor(((part + 1) * n) / 3) + 1;
        for (let i = from; i < to; i++) (i === from ? ctx.moveTo : ctx.lineTo).call(ctx, this.trail[i].x, this.trail[i].y);
        if (part === 2) ctx.lineTo(this.pos.x, this.pos.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // All legs in one path per pass: a wide faint "glow" pass, then a thin bright line.
    const legsPath = new Path2D();
    for (const l of this.legs) {
      const j = l.joints;
      if (j.length < 4) continue;
      const lift = l.stepT >= 0 ? Math.sin(l.stepT * Math.PI) * 10 * s : 0;
      legsPath.moveTo(j[0].x, j[0].y);
      legsPath.lineTo(j[1].x, j[1].y - lift * 0.6);
      legsPath.lineTo(j[2].x, j[2].y - lift);
      legsPath.lineTo(j[3].x, j[3].y - lift * 0.3);
    }
    const body = this.bodyPath();
    const glowWidth = 5 + this.joy * 4;
    ctx.strokeStyle = colors.wireGlow;
    ctx.lineWidth = glowWidth;
    ctx.stroke(legsPath);
    ctx.stroke(body);
    ctx.strokeStyle = colors.wire;
    ctx.lineWidth = 1.4;
    ctx.stroke(legsPath);
    ctx.strokeStyle = colors.wireBody;
    ctx.lineWidth = 1.6;
    ctx.stroke(body);
    // Joint dots (knee and ankle), plus a tiny dot on each planted foot.
    const dots = new Path2D();
    const feet = new Path2D();
    for (const l of this.legs) {
      const j = l.joints;
      if (j.length < 4) continue;
      const lift = l.stepT >= 0 ? Math.sin(l.stepT * Math.PI) * 10 * s : 0;
      for (const [p, dy] of [[j[1], lift * 0.6], [j[2], lift]] as [Vec, number][]) {
        dots.moveTo(p.x + 2.4, p.y - dy);
        dots.arc(p.x, p.y - dy, 2.4, 0, Math.PI * 2);
      }
      feet.moveTo(j[3].x + 1.6, j[3].y);
      feet.arc(j[3].x, j[3].y - lift * 0.3, 1.6, 0, Math.PI * 2);
    }
    ctx.fillStyle = colors.joint;
    ctx.fill(dots);
    ctx.fillStyle = colors.wire;
    ctx.fill(feet);
  }

  /** The small body: a hexagon head, a diamond abdomen and a spine, all as lines. */
  private bodyPath(): Path2D {
    const s = this.scale;
    const p = new Path2D();
    const pt = (x: number, y: number) => add(this.pos, rot({ x: x * s, y: y * s }, this.angle));
    const poly = (pts: [number, number][]) => {
      pts.forEach(([x, y], i) => {
        const q = pt(x, y);
        if (i === 0) p.moveTo(q.x, q.y);
        else p.lineTo(q.x, q.y);
      });
      p.closePath();
    };
    poly([[16, 0], [11, -8], [0, -9], [-7, 0], [0, 9], [11, 8]]); // head part
    poly([[-9, 0], [-20, -11], [-42, -7], [-50, 0], [-42, 7], [-20, 11]]); // abdomen
    const a = pt(18, 0);
    const b = pt(-50, 0);
    p.moveTo(a.x, a.y);
    p.lineTo(b.x, b.y); // spine
    // Two short feelers (pedipalps) in front.
    for (const side of [-1, 1]) {
      const r = pt(16, side * 4);
      const t = pt(27, side * 9);
      p.moveTo(r.x, r.y);
      p.lineTo(t.x, t.y);
    }
    return p;
  }
}

function scaleTo(v: Vec, len: number): Vec {
  const d = Math.hypot(v.x, v.y) || 1;
  return { x: (v.x / d) * len, y: (v.y / d) * len };
}
