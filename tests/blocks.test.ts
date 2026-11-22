import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { extractPdf, type PdfJsLike } from '../src/loaders/pdf';
import { definitionCards, findBlocks, splitSteps, workedExamples } from '../src/study/blocks';

// The exact text Ankabut gets from a real LaTeX math chapter (lost powers become lone "2" lines).
const quad = `Chapter 3: Quadratic Equations

2
Definition. A quadratic equation is an equation of the form ax +bx+c = 0,
2
where a ̸= 0. The number ∆ = b − 4ac is called the discriminant.
2
Theorem (Quadratic Formula). The solutions of ax + bx + c = 0 are
√
−b ± b2 − 4ac
x = .
2a
If the discriminant is positive, the equation has two real solutions. If the
discriminant is zero, it has one real solution. If the discriminant is negative,
it has no real solution.
2
Example 3.1. Solve x − 5x + 6 = 0. Here a = 1, b = −5 and c = 6, so
5±1
∆ = 25 − 24 = 1. Then x = , so x = 3 or x = 2.
2
2
Exercise 3.2. Solve 2x + 3x − 2 = 0 and check your answer.
Summary. The discriminant tells us how many real solutions a quadratic
equation has. The quadratic formula always works when a ̸= 0.`;

const pages = [{ number: 1, text: quad }];

describe('labelled blocks', () => {
  it('finds definition, theorem, example and exercise with their names', () => {
    const b = findBlocks(pages);
    expect(b.map((x) => [x.kind, x.label])).toEqual([
      ['definition', 'Definition'],
      ['theorem', 'Theorem (Quadratic Formula)'],
      ['example', 'Example 3.1'],
      ['exercise', 'Exercise 3.2'],
    ]);
    expect(b[0].name).toBe('quadratic equation');
    expect(b[1].name).toBe('Quadratic Formula');
    expect(b.every((x) => x.page === 1)).toBe(true);
    expect(b[1].formula).toBe(true);
  });

  it('makes definition cards, including "is called the …"', () => {
    const cards = definitionCards(pages);
    expect(cards.map((c) => c.term)).toEqual(['quadratic equation', 'Quadratic Formula', 'discriminant']);
    expect(cards[0].text).toMatch(/^A quadratic equation is an equation of the form/);
    expect(cards[2].text).toBe('The number ∆ = b − 4ac is called the discriminant.');
    // Both have broken math, so the app must point to the real page.
    expect(cards[0].formula && cards[2].formula).toBe(true);
  });

  it('makes a worked example: the task, then one step per sentence', () => {
    const [ex] = workedExamples(pages);
    expect(ex.label).toBe('Example 3.1');
    expect(ex.problem).toBe('Solve x − 5x + 6 = 0.');
    expect(ex.steps).toEqual(['Here a = 1, b = −5 and c = 6, so ∆ = 25 − 24 = 1.', 'Then x = , so x = 3 or x = 2.']);
    expect(ex.formula).toBe(true);
  });

  it('works in French, Spanish and Arabic', () => {
    const fr = definitionCards([{ number: 2, text: 'Définition : Un réseau est un ensemble d’appareils reliés.\nCet ensemble est appelé le réseau local.' }]);
    expect(fr.map((c) => c.term)).toEqual(['réseau', 'réseau local']);
    const es = workedExamples([{ number: 3, text: 'Ejemplo 1. Calcula el 20 % de 50. Primero escribe 20 / 100. Luego multiplica por 50 y da 10.' }]);
    expect(es[0].problem).toBe('Calcula el 20 % de 50.');
    expect(es[0].steps).toHaveLength(2);
    const ar = findBlocks([{ number: 4, text: 'تعريف: البوابة الافتراضية هي واجهة الموجه في الشبكة المحلية.' }]);
    expect(ar[0].kind).toBe('definition');
  });

  it('does not see labels in the middle of a sentence', () => {
    expect(findBlocks([{ number: 1, text: 'This is an example of a network. For example: PC1 pings PC2.' }])).toEqual([]);
  });

  it('keeps decimals inside a step', () => {
    expect(splitSteps('The rate is 3.5 percent. Then multiply.')).toEqual(['The rate is 3.5 percent.', 'Then multiply.']);
  });

  it('works on the real PDF file, end to end', async () => {
    const r = await extractPdf(new Uint8Array(readFileSync('tests/fixtures/math-quadratic.pdf')), pdfjs as unknown as PdfJsLike);
    expect(definitionCards(r.pages).map((c) => c.term)).toEqual(['quadratic equation', 'Quadratic Formula', 'discriminant']);
    expect(workedExamples(r.pages)[0].problem).toMatch(/^Solve/);
  });
});
