// Spaced repetition with Leitner boxes.
//
// A card starts in box 0. "I knew it" moves it up one box, "Again" sends it
// back to box 0. Each box waits longer before the card comes back:
// 1, 2, 4, 8, 16, 32 days. So cards return just before you would forget them,
// and easy cards stop wasting your time.

export const BOX_DAYS = [1, 2, 4, 8, 16, 32];
const DAY = 24 * 60 * 60 * 1000;

export interface CardState {
  box: number;
  due: number; // timestamp
  reviews: number;
}

export function review(state: CardState | undefined, knew: boolean, now = Date.now()): CardState {
  const box = knew ? Math.min(BOX_DAYS.length - 1, (state?.box ?? -1) + 1) : 0;
  return { box, due: now + BOX_DAYS[box] * DAY, reviews: (state?.reviews ?? 0) + 1 };
}

export function isDue(state: CardState | undefined, now = Date.now()): boolean {
  return !state || state.due <= now;
}

/** Orders cards: overdue first (oldest first), then new cards, then not-yet-due ones. */
export function orderByDue<T extends { id: string }>(cards: T[], states: Record<string, CardState>, now = Date.now()): T[] {
  const rank = (c: T) => {
    const s = states[c.id];
    if (!s) return [1, 0];
    return s.due <= now ? [0, s.due] : [2, s.due];
  };
  return [...cards].sort((a, b) => {
    const [ra, da] = rank(a);
    const [rb, db] = rank(b);
    return ra - rb || da - db;
  });
}

export function dueCount(ids: string[], states: Record<string, CardState>, now = Date.now()): number {
  return ids.filter((id) => isDue(states[id], now)).length;
}
