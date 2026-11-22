import { describe, expect, it } from 'vitest';
import { addFocusBlock, addPages, clock, freshToday, goalStatus, isPaused, newTimer, pause, resume, rollover, start, stop, tick, timeLeft } from '../src/study/focus';

const MIN = 60_000;

describe('focus timer', () => {
  it('runs focus, then break, then stops', () => {
    let t = start(newTimer(25, 5), 0);
    expect(t.phase).toBe('focus');
    expect(timeLeft(t, 60_000)).toBe(24 * MIN);
    expect(tick(t, 24 * MIN).event).toBeNull();
    const a = tick(t, 25 * MIN);
    expect(a.event).toBe('focus-done');
    t = a.timer;
    expect(t.phase).toBe('break');
    expect(timeLeft(t, 25 * MIN)).toBe(5 * MIN);
    const b = tick(t, 30 * MIN);
    expect(b.event).toBe('break-done');
    expect(b.timer.phase).toBe('idle');
  });

  it('pauses and resumes without losing time', () => {
    let t = start(newTimer(25, 5), 0);
    t = pause(t, 10 * MIN);
    expect(isPaused(t)).toBe(true);
    expect(timeLeft(t, 99 * MIN)).toBe(15 * MIN);
    expect(tick(t, 99 * MIN).event).toBeNull();
    t = resume(t, 100 * MIN);
    expect(timeLeft(t, 100 * MIN)).toBe(15 * MIN);
    expect(tick(t, 115 * MIN).event).toBe('focus-done');
  });

  it('stop keeps the chosen lengths', () => {
    const t = stop(start(newTimer(45, 10), 0));
    expect(t).toEqual(newTimer(45, 10));
  });

  it('shows a clock', () => {
    expect(clock(25 * MIN)).toBe('25:00');
    expect(clock(65_000)).toBe('1:05');
    expect(clock(400)).toBe('0:01');
  });
});

describe('daily goal', () => {
  const day1 = new Date(2026, 10, 22, 10);
  const day2 = new Date(2026, 10, 23, 9);

  it('counts each page once per day', () => {
    let d = freshToday(day1);
    d = addPages(d, 'book.pdf', [1, 2, 3], day1);
    d = addPages(d, 'book.pdf', [2, 3, 4], day1);
    d = addPages(d, 'notes.pdf', [1], day1);
    expect(goalStatus(d, 10, day1)).toEqual({ read: 5, goal: 10, share: 0.5, reached: false });
  });

  it('starts again at midnight', () => {
    let d = addPages(freshToday(day1), 'book.pdf', [1, 2, 3, 4, 5], day1);
    d = addFocusBlock(d, day1);
    expect(goalStatus(d, 5, day1).reached).toBe(true);
    expect(goalStatus(d, 5, day2).read).toBe(0);
    expect(rollover(d, day2).focusBlocks).toBe(0);
    d = addPages(d, 'book.pdf', [6], day2);
    expect(d.pages).toEqual(['book.pdf#6']);
  });

  it('goal 0 means no goal', () => {
    expect(goalStatus(addPages(freshToday(day1), 'b', [1], day1), 0, day1)).toEqual({ read: 1, goal: 0, share: 0, reached: false });
  });
});
