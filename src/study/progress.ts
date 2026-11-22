// Progress and streaks: pages read, words found, questions answered,
// cards reviewed, and how many days in a row the learner studied.

export interface Progress {
  pagesRead: number;
  wordsFound: number;
  questions: number;
  correct: number;
  cardsReviewed: number;
  /** Days with study activity, as YYYY-MM-DD, newest last. */
  days: string[];
}

export function emptyProgress(): Progress {
  return { pagesRead: 0, wordsFound: 0, questions: 0, correct: 0, cardsReviewed: 0, days: [] };
}

export function dayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function record(p: Progress, change: Partial<Omit<Progress, 'days'>>, now = new Date()): Progress {
  const next: Progress = { ...p, days: [...p.days] };
  for (const [k, v] of Object.entries(change) as [keyof Omit<Progress, 'days'>, number][]) next[k] += v;
  const today = dayString(now);
  if (next.days[next.days.length - 1] !== today) next.days.push(today);
  if (next.days.length > 400) next.days = next.days.slice(-400);
  return next;
}

/** Days in a row up to today (or up to yesterday, so the streak is not lost before you study today). */
export function streak(p: Progress, now = new Date()): number {
  const set = new Set(p.days);
  const d = new Date(now);
  if (!set.has(dayString(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dayString(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
