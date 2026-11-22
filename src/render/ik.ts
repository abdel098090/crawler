// Inverse kinematics for multi-joint legs, with FABRIK.
//
// FABRIK ("Forward And Backward Reaching Inverse Kinematics") is a simple way to
// bend a chain of bones so its tip touches a target:
//   1. backward pass: put the tip ON the target, then pull each joint back toward
//      the previous one, keeping every bone its own length;
//   2. forward pass: put the root back on the hip, and pull each joint forward
//      the same way.
// A few rounds of this and the chain settles. Before solving we nudge the middle
// joints toward a "pole" point outside the body, which makes the knees bend
// OUTWARD like a real spider's, instead of folding under the body.

export interface Vec {
  x: number;
  y: number;
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Moves `from` so it sits exactly `len` away from `anchor`, along the line between them. */
function place(anchor: Vec, from: Vec, len: number): Vec {
  const d = dist(anchor, from) || 1e-6;
  return { x: anchor.x + ((from.x - anchor.x) / d) * len, y: anchor.y + ((from.y - anchor.y) / d) * len };
}

/**
 * Solves a chain in place. `joints[0]` is the hip (fixed), the last joint is the
 * foot. `lengths[i]` is the bone between joints[i] and joints[i+1].
 */
export function solveChain(joints: Vec[], lengths: number[], target: Vec, pole: Vec | null, iterations = 4, poleStrength = 0.3): Vec[] {
  const n = joints.length;
  const root = { ...joints[0] };
  const total = lengths.reduce((a, b) => a + b, 0);
  // Out of reach: stretch straight toward the target.
  if (dist(root, target) >= total) {
    for (let i = 1; i < n; i++) joints[i] = place(joints[i - 1], target, lengths[i - 1]);
    return joints;
  }
  // Pole bias: pull the middle joints toward the outside.
  if (pole) {
    for (let i = 1; i < n - 1; i++) {
      joints[i] = { x: joints[i].x + (pole.x - joints[i].x) * poleStrength, y: joints[i].y + (pole.y - joints[i].y) * poleStrength };
    }
  }
  for (let it = 0; it < iterations; it++) {
    joints[n - 1] = { ...target };
    for (let i = n - 2; i >= 0; i--) joints[i] = place(joints[i + 1], joints[i], lengths[i]);
    joints[0] = { ...root };
    for (let i = 1; i < n; i++) joints[i] = place(joints[i - 1], joints[i], lengths[i - 1]);
    if (dist(joints[n - 1], target) < 0.5) break;
  }
  return joints;
}
