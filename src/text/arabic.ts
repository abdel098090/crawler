// Arabic text helpers: normalization, light stemming, and fixing broken
// Arabic that comes out of PDFs.

/** Harakat (short vowel marks), shadda, sukun, Quranic marks, superscript alef. */
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
const TATWEEL = /ـ/g;
const ARABIC_LETTER = /[ء-يٱ-ۓﭐ-﷿ﹰ-﻿]/;
const ARABIC_LETTERS_G = /[ء-يٱ-ۓ]/g;
/** "Presentation forms" are the shaped glyph versions of letters. PDFs often store these. */
const PRESENTATION_FORMS = /[ﭐ-﷿ﹰ-﻿]/;

export function hasArabic(text: string): boolean {
  return ARABIC_LETTER.test(text);
}

export function arabicRatio(text: string): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return 0;
  const ar = text.normalize('NFKC').match(ARABIC_LETTERS_G)?.length ?? 0;
  return ar / letters;
}

/**
 * Makes Arabic text comparable:
 * - NFKC turns shaped "presentation form" glyphs back into normal letters
 * - remove tashkeel (diacritics) and tatweel (the stretching line)
 * - أ إ آ ٱ become ا, ة becomes ه, ى becomes ي, ؤ becomes و, ئ becomes ي
 */
export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

// Prefixes from longest to shortest. We always keep at least 3 letters of stem.
const PREFIXES = ['وبال', 'وكال', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك'];
const SUFFIXES = ['تهما', 'كما', 'هما', 'ات', 'ون', 'ين', 'ان', 'ها', 'هم', 'هن', 'كم', 'كن', 'نا', 'يه', 'يا', 'ه', 'ي', 'ك'];

/**
 * A light stemmer. It is not a full morphological analyser, it only strips
 * the most common prefixes and suffixes so that "المكتبة" and "مكتبة" count as one word.
 * Input should already be normalized.
 */
export function stemArabic(word: string): string {
  let w = word;
  // Suffixes first: "كتابها" -> "كتاب". Then prefixes: "المكتب" -> "مكتب".
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  // One-letter prefixes like و ب ل ف ك only come off when what remains is still long,
  // because many words simply start with those letters (for example "باب" or "كتاب").
  for (const p of PREFIXES) {
    const minRest = p.length === 1 ? 4 : 3;
    if (w.startsWith(p) && w.length - p.length >= minRest) {
      w = w.slice(p.length);
      break;
    }
  }
  return w;
}

// ---------------------------------------------------------------------------
// Broken Arabic from PDFs
// ---------------------------------------------------------------------------

export type ArabicQuality = 'ok' | 'reversed' | 'scrambled' | 'none';

function arabicWords(text: string): string[] {
  return normalizeArabic(text)
    .split(/[^ء-ي]+/)
    .filter((w) => w.length >= 2);
}

/**
 * Looks at Arabic text and guesses whether its letters are in the right order.
 *
 * Why this works: in correct Arabic, a huge number of words START with "ال"
 * (the word "the"). When a PDF gives us the letters backwards, those words
 * END with "لا" instead. We count both patterns and compare.
 * "Scrambled" means we see lots of lone letters or no clear pattern, which is
 * what happens when a PDF has a broken font map. Then we need OCR.
 */
export function assessArabic(text: string): ArabicQuality {
  const words = arabicWords(text);
  let forward = 0;
  let backward = 0;
  for (const w of words) {
    if (w.startsWith('ال')) forward++;
    if (w.endsWith('لا')) backward++;
  }
  // Lone Arabic letters separated by spaces mean letters got split apart.
  const tokens = normalizeArabic(text).split(/\s+/).filter((t) => /[ء-ي]/.test(t));
  const singles = tokens.filter((t) => t.replace(/[^ء-ي]/g, '').length === 1).length;
  if (tokens.length >= 8 && singles / tokens.length > 0.35) return 'scrambled';
  if (words.length < 8) return words.length === 0 ? 'none' : 'ok';
  if (backward > forward * 2 && backward >= 3) return 'reversed';
  if (forward >= 2 || forward >= backward) return 'ok';
  // Very few "ال" either way across many words is unusual for real Arabic.
  return words.length > 40 && forward + backward < words.length * 0.02 ? 'scrambled' : 'ok';
}

/**
 * Reverses a line that was stored in visual order (right-to-left letters
 * written left-to-right). Numbers and Latin words inside the line keep
 * their own reading order.
 */
export function reverseVisualLine(line: string): string {
  const reversed = Array.from(line).reverse().join('');
  // Runs of Latin letters or digits got reversed too, so flip them back.
  return reversed.replace(/[A-Za-z0-9À-ɏ.,:%/\-]+/g, (run) => Array.from(run).reverse().join(''));
}

/** Fixes reversed Arabic line by line, and turns presentation forms into normal letters. */
export function fixArabicText(text: string): { text: string; quality: ArabicQuality; fixed: boolean } {
  const quality = assessArabic(text);
  let out = PRESENTATION_FORMS.test(text) ? text.normalize('NFKC') : text;
  if (quality === 'reversed') {
    out = out
      .split('\n')
      .map((line) => (hasArabic(line) ? reverseVisualLine(line) : line))
      .join('\n');
    const after = assessArabic(out);
    return { text: out, quality: after === 'ok' ? 'reversed' : 'scrambled', fixed: after === 'ok' };
  }
  return { text: out, quality, fixed: false };
}
