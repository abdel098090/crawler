// Focus timer and daily goal, as small pure functions (easy to test).
//
// Focus timer (the "Pomodoro" idea): read for a set time, then take a short
// break. Short, clear blocks help everyone, and especially students with ADHD.
//
// Daily goal: "read N pages today". A page counts once per day, so reading
// the same page again does not fake progress.

import { dayString } from './progress';

// ---------------------------------------------------------------- timer
export type Phase = 'idle' | 'focus' | 'break';

export interface Timer {
  phase: Phase;
  /** When the current phase ends (ms since 1970). 0 when idle or paused. */
  endsAt: number;
  /** Time left when paused (ms). 0 when running. */
  pausedLeft: number;
  focusMin: number;
  breakMin: number;
}

export const FOCUS_CHOICES = [15, 25, 45];
export const BREAK_CHOICES = [5, 10];

export function newTimer(focusMin = 25, breakMin = 5): Timer {
  return { phase: 'idle', endsAt: 0, pausedLeft: 0, focusMin, breakMin };
}

export function start(t: Timer, now = Date.now()): Timer {
  return { ...t, phase: 'focus', endsAt: now + t.focusMin * 60_000, pausedLeft: 0 };
}

export function pause(t: Timer, now = Date.now()): Timer {
  if (t.phase === 'idle' || t.pausedLeft) return t;
  return { ...t, pausedLeft: Math.max(0, t.endsAt - now), endsAt: 0 };
}

export function resume(t: Timer, now = Date.now()): Timer {
  if (t.phase === 'idle' || !t.pausedLeft) return t;
  return { ...t, endsAt: now + t.pausedLeft, pausedLeft: 0 };
}

export function stop(t: Timer): Timer {
  return newTimer(t.focusMin, t.breakMin);
}

export const isPaused = (t: Timer) => t.phase !== 'idle' && t.pausedLeft > 0;

export function timeLeft(t: Timer, now = Date.now()): number {
  if (t.phase === 'idle') return 0;
  return t.pausedLeft || Math.max(0, t.endsAt - now);
}

/** "24:05" */
export function clock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Moves the timer on. When a phase ends it says what happened:
 * a finished focus block starts the break, a finished break goes back to idle.
 * If the computer slept for a long time, it does not pretend breaks happened.
 */
export function tick(t: Timer, now = Date.now()): { timer: Timer; event: 'focus-done' | 'break-done' | null } {
  if (t.phase === 'idle' || t.pausedLeft || now < t.endsAt) return { timer: t, event: null };
  if (t.phase === 'focus') return { timer: { ...t, phase: 'break', endsAt: now + t.breakMin * 60_000 }, event: 'focus-done' };
  return { timer: newTimer(t.focusMin, t.breakMin), event: 'break-done' };
}

// ---------------------------------------------------------------- daily goal
export interface Today {
  /** YYYY-MM-DD */
  date: string;
  /** Pages read today, as "file name#page", each once. */
  pages: string[];
  focusBlocks: number;
  /** True once the goal was celebrated today, so it is only celebrated once. */
  celebrated: boolean;
}

export const GOAL_CHOICES = [0, 5, 10, 20, 30, 50];

export function freshToday(now = new Date()): Today {
  return { date: dayString(now), pages: [], focusBlocks: 0, celebrated: false };
}

/** A new day starts at midnight: yesterday's pages do not count today. */
export function rollover(d: Today, now = new Date()): Today {
  return d.date === dayString(now) ? d : freshToday(now);
}

export function addPages(d: Today, fileName: string, pages: number[], now = new Date()): Today {
  const cur = rollover(d, now);
  const set = new Set(cur.pages);
  for (const p of pages) set.add(`${fileName}#${p}`);
  // Keep the list small even after a huge book.
  return { ...cur, pages: [...set].slice(-2000) };
}

export function addFocusBlock(d: Today, now = new Date()): Today {
  const cur = rollover(d, now);
  return { ...cur, focusBlocks: cur.focusBlocks + 1 };
}

export function goalStatus(d: Today, goal: number, now = new Date()): { read: number; goal: number; share: number; reached: boolean } {
  const read = rollover(d, now).pages.length;
  if (!goal) return { read, goal: 0, share: 0, reached: false };
  return { read, goal, share: Math.min(1, read / goal), reached: read >= goal };
}
