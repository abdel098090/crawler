// Free now, premium later.
//
// ONE place decides which features are free and which may become premium.
// Today everything is free (LAUNCH_FREE). Later, flipping LAUNCH_FREE to false
// and setting the user's plan is enough to put the premium features behind a
// subscription, with no rewrite. No payments are built.

export type Tier = 'free' | 'premium';
export type Plan = 'free' | 'premium';

export const FEATURES = {
  reading: 'free',
  keyPoints: 'free',
  wordHunt: 'free',
  flashcards: 'free',
  quiz: 'free',
  commands: 'free',
  studyDocument: 'free',
  glossary: 'free',
  translate: 'free',
  mindMap: 'free',
  progress: 'free',
  ocr: 'free',
  library: 'premium',
  exam: 'premium',
  readAloud: 'premium',
  videoExport: 'premium',
  largeBooks: 'premium',
} as const satisfies Record<string, Tier>;

export type Feature = keyof typeof FEATURES;

/** During the launch, every feature is free. */
export const LAUNCH_FREE = true;

/** Books longer than this count as "very large books" (a premium feature later). */
export const LARGE_BOOK_PAGES = 500;

let plan: Plan = 'free';
export function setPlan(p: Plan): void {
  plan = p;
}
export function getPlan(): Plan {
  return plan;
}

export function tierOf(feature: string): Tier {
  return (FEATURES as Record<string, Tier>)[feature] ?? 'free';
}

export function isEnabled(feature: string, opts: { plan?: Plan; launchFree?: boolean } = {}): boolean {
  if (tierOf(feature) === 'free') return true;
  if (opts.launchFree ?? LAUNCH_FREE) return true;
  return (opts.plan ?? plan) === 'premium';
}
