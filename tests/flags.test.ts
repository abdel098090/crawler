import { describe, expect, it } from 'vitest';
import { FEATURES, isEnabled, tierOf } from '../src/core/flags';

describe('feature flags', () => {
  it('marks the planned free and premium features', () => {
    for (const f of ['reading', 'keyPoints', 'wordHunt', 'flashcards']) expect(tierOf(f)).toBe('free');
    for (const f of ['library', 'exam', 'readAloud', 'videoExport', 'largeBooks']) expect(tierOf(f)).toBe('premium');
  });
  it('everything is on during the free launch', () => {
    for (const f of Object.keys(FEATURES)) expect(isEnabled(f)).toBe(true);
  });
  it('after launch, premium features need the premium plan, free ones never do', () => {
    expect(isEnabled('library', { launchFree: false, plan: 'free' })).toBe(false);
    expect(isEnabled('library', { launchFree: false, plan: 'premium' })).toBe(true);
    expect(isEnabled('wordHunt', { launchFree: false, plan: 'free' })).toBe(true);
  });
});
