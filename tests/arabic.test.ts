import { describe, expect, it } from 'vitest';
import { assessArabic, fixArabicText, normalizeArabic, reverseVisualLine, stemArabic } from '../src/text/arabic';
import { normalizeWord, tokenize } from '../src/text/tokenize';

describe('Arabic normalization', () => {
  it('removes tashkeel and tatweel', () => {
    expect(normalizeArabic('مَكْتَبَةٌ')).toBe('مكتبه');
    expect(normalizeArabic('كتـــاب')).toBe('كتاب');
  });
  it('unifies alef forms', () => {
    expect(normalizeArabic('أحمد إسلام آمن')).toBe('احمد اسلام امن');
  });
  it('unifies ta marbuta and ya variants', () => {
    expect(normalizeArabic('مدرسة')).toBe('مدرسه');
    expect(normalizeArabic('مستشفى')).toBe('مستشفي');
  });
  it('turns PDF presentation forms back into normal letters', () => {
    // "سلام" written with shaped glyphs (initial, medial, medial, final forms).
    const shaped = 'ﺳﻼﻡ';
    expect(normalizeArabic(shaped)).toBe('سلام');
  });
});

describe('Arabic light stemming', () => {
  it('treats المكتبة and مكتبة as the same word', () => {
    expect(stemArabic(normalizeArabic('المكتبة'))).toBe(stemArabic(normalizeArabic('مكتبة')));
  });
  it('strips combined prefixes', () => {
    expect(stemArabic(normalizeArabic('والمكتبة'))).toBe(stemArabic(normalizeArabic('مكتبة')));
    expect(stemArabic(normalizeArabic('بالمكتبة'))).toBe(stemArabic(normalizeArabic('مكتبة')));
  });
  it('strips common suffixes', () => {
    expect(stemArabic('معلمون')).toBe('معلم');
    expect(stemArabic('كتابها')).toBe('كتاب');
  });
  it('keeps short words and words that just start with a prefix letter', () => {
    expect(stemArabic('باب')).toBe('باب');
    expect(stemArabic('كتاب')).toBe('كتاب');
  });
  it('tokenize gives the same stem to different written forms', () => {
    const t = tokenize('المَكتبة مكتبةٌ والمكتبة');
    expect(new Set(t.map((x) => x.stem)).size).toBe(1);
    expect(normalizeWord('المَكتبة')).toBe('المكتبه');
  });
});

describe('broken Arabic from PDFs', () => {
  const good =
    'الجدار الناري هو جهاز أمني يقوم بتصفية حركة الشبكة باستخدام مجموعة من القواعد. تتم مقارنة كل حزمة تصل إلى الجدار الناري مع القواعد قبل السماح لها بالمرور في الشبكة.';
  it('accepts correct Arabic', () => {
    expect(assessArabic(good)).toBe('ok');
  });
  it('detects reversed Arabic and fixes it', () => {
    const reversed = good
      .split('\n')
      .map((l) => Array.from(l).reverse().join(''))
      .join('\n');
    expect(assessArabic(reversed)).toBe('reversed');
    const fixed = fixArabicText(reversed);
    expect(fixed.fixed).toBe(true);
    expect(fixed.text).toBe(good);
  });
  it('keeps numbers and Latin words readable when reversing', () => {
    // A PDF stored this line in visual order: Arabic letters backwards, Latin and digits normal.
    const visual = 'TLS 2023 ' + Array.from('عام').reverse().join('');
    expect(reverseVisualLine(visual)).toBe('عام 2023 TLS');
  });
  it('detects scrambled Arabic (letters split apart)', () => {
    const scrambled = Array.from(good.replace(/\s/g, '')).join(' ');
    expect(assessArabic(scrambled)).toBe('scrambled');
  });
});
