// Finds text that contains a math or science formula.
//
// A PDF does not store "x²": it stores "x" and a small "2" placed higher. When
// the text is pulled out, the position is lost, so x² becomes "x2", ≠ becomes
// a broken sign, and a fraction is split over three lines. Text like that must
// not be used for a quiz or a flashcard, because a student could learn a wrong
// formula. The app shows the real page picture instead.

/** Signs that only appear in math: square root, sums, integrals, ±, ≠ (also the broken "̸="), Greek letters, arrows. */
const STRONG = /[√∑∏∫±∓≠≤≥≈∞∆Δ∂∇πθλμσΩω→⇒⇔∈∉⊂⊆∪∩∀∃·×÷⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉̸]/;
const OPERATOR = /[=<>+−*/^]/;
/** A one letter variable on its own ("a = 1", "x + 3"), or a letter glued to a number from a lost power ("x2", "ax2", "b2"). */
const VARIABLE = /(?:^|[\s(=+−-])[a-zA-Z](?=$|[\s)=+−-])/;
const LOST_POWER = /(?:^|[\s(=+−-])[a-z]{1,2}\d(?=$|[\s)=+−,.-])/;
/** A number or "2a" left alone at the start, from a fraction split over lines ("2a If the …"). */
const ORPHAN_START = /^\s*(?:\d+[a-z]?|[a-z]\d?)\s+[A-Z]/;

export function hasFormula(text: string): boolean {
  if (STRONG.test(text)) return true;
  if (ORPHAN_START.test(text)) return true;
  if (!OPERATOR.test(text)) return false;
  return VARIABLE.test(text) || LOST_POWER.test(text);
}

/** How much of a document is math: the share of its lines that hold a formula. */
export function formulaShare(pages: { text: string }[]): { lines: number; withFormula: number; pages: number[] } {
  let lines = 0;
  let withFormula = 0;
  const found = new Set<number>();
  pages.forEach((p, i) => {
    for (const line of p.text.split('\n')) {
      if (!line.trim()) continue;
      lines++;
      if (hasFormula(line)) {
        withFormula++;
        found.add(i + 1);
      }
    }
  });
  return { lines, withFormula, pages: [...found] };
}

/** True when a file has enough formulas that the student should be warned. */
export function isMathHeavy(pages: { text: string }[]): boolean {
  const s = formulaShare(pages);
  return s.withFormula >= 3 || (s.lines > 0 && s.withFormula / s.lines >= 0.05 && s.withFormula >= 1);
}
