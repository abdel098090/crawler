import { describe, expect, it } from 'vitest';
import { assessArabic, fixArabicText, normalizeArabic, repairLamAlef, repairTanweenA, reverseVisualLine, stemArabic } from '../src/text/arabic';
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

describe('Backwards "لا" ligature from Word/LibreOffice PDFs', () => {
  it('repairs the swapped lam-alef forms', () => {
    const broken = 'الشبكة هي مجموعة من األجهزة. أوًال نختبر. ال يراها إال األشخاص. ليس دليًال.';
    const { text, fixed } = repairLamAlef(broken);
    expect(fixed).toBe(true);
    expect(text).toBe('الشبكة هي مجموعة من الأجهزة. أولاً نختبر. لا يراها إلا الأشخاص. ليس دليلاً.');
  });
  it('leaves correct Arabic alone, including real words with أل and ال', () => {
    const good = 'سأل الطالب عن مثال في الأمن. ألم يقرأ الكتاب؟ لا أعرف.';
    expect(repairLamAlef(good)).toEqual({ text: good, fixed: false });
  });
  it('needs at least two clear signs before changing anything', () => {
    const oneSign = 'كلمة األول فقط و ال';
    expect(repairLamAlef(oneSign).fixed).toBe(false);
  });
  it('runs inside fixArabicText', () => {
    expect(fixArabicText('من األجهزة الى األشخاص في الشبكة').text).toContain('الأجهزة');
  });
});

describe('pdf.js tanween read as "A", and junk letters from broken fonts', () => {
  it('turns a glued "A" back into tanween and repairs the word', () => {
    const fromPdfJs = 'تنبيه واحد ليس دليال A كافياA على وقوع هجوم. أوال Aإلى الموجه.';
    expect(fixArabicText(fromPdfJs).text).toBe('تنبيه واحد ليس دليلاً كافياً على وقوع هجوم. أولاً إلى الموجه.');
  });
  it('keeps a real Latin "A" that stands apart', () => {
    const real = 'هذه الفئة A من الشبكات وتلك الفئة B';
    expect(repairTanweenA(real)).toBe(real);
  });
  it('calls a page with Latin junk inside Arabic words scrambled, so OCR takes over', () => {
    const junk = 'ﺍǄﻔﺼﻞ ﺍǄﻭﻝ ﻣﺎ ﻫﻲ ﺍǄﺸﺒﻜﺔ ﺍǄﺸﺒﻜﺔ ﻫﻲ ﻣﺠﻤﻮﻋﺔ ﻣﻦ ﺍǄﺟﻬﺰﺓ ﺍǄﻤﺘﺼǁﺔ ﺑﺒﻌﻀﻬﺎ';
    expect(assessArabic(junk)).toBe('scrambled');
  });
});

describe('one glued "A" on a page with the broken لا pattern', () => {
  it('is repaired too', () => {
    const page = 'من األجهزة الى األشخاص. فإنه يرسلها أوًال Aإلى الموجه.';
    expect(fixArabicText(page).text).toBe('من الأجهزة الى الأشخاص. فإنه يرسلها أولاً إلى الموجه.');
  });
});
