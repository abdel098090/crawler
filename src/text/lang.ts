// Language detection for Arabic, French and English.
//
// Arabic is easy: it has its own alphabet. French and English share the Latin
// alphabet, so we count how many very common words of each language appear,
// plus French accents. This works well on sentences and pages.

import type { Lang } from '../core/types';
import { arabicRatio } from './arabic';
import { latinNorm, STOPWORDS } from './stopwords';

const FR_MARKERS = new Set(['le', 'la', 'les', 'des', 'est', 'et', 'une', 'du', 'dans', 'pour', 'que', 'qui', 'sur', 'pas', 'au', 'avec', 'ce', 'sont', 'par', 'plus']);
const EN_MARKERS = new Set(['the', 'and', 'is', 'of', 'to', 'in', 'that', 'it', 'for', 'with', 'are', 'this', 'on', 'was', 'be', 'by', 'as', 'not', 'or', 'from']);

export function detectLang(text: string): Lang {
  if (arabicRatio(text) > 0.4) return 'ar';
  const words = (text.match(/[\p{L}']+/gu) ?? []).map(latinNorm);
  let fr = 0;
  let en = 0;
  for (const w of words) {
    if (FR_MARKERS.has(w)) fr += 2;
    else if (STOPWORDS.fr.has(w) && !STOPWORDS.en.has(w)) fr += 1;
    if (EN_MARKERS.has(w)) en += 2;
    else if (STOPWORDS.en.has(w) && !STOPWORDS.fr.has(w)) en += 1;
  }
  fr += (text.match(/[éèêàùçôîâûëï]/gi)?.length ?? 0) * 0.5;
  return fr > en ? 'fr' : 'en';
}

/** Which languages appear in a list of sentences, most common first. */
export function languagesOf(langs: Lang[]): Lang[] {
  const counts: Record<Lang, number> = { ar: 0, fr: 0, en: 0 };
  for (const l of langs) counts[l]++;
  const total = langs.length || 1;
  return (Object.keys(counts) as Lang[])
    .filter((l) => counts[l] / total >= 0.05 || (counts[l] >= 3 && counts[l] / total >= 0.01))
    .sort((a, b) => counts[b] - counts[a]);
}

export function isRtl(lang: Lang): boolean {
  return lang === 'ar';
}
