// Finds labelled blocks in textbooks: definitions, theorems, rules, examples.
//
// Textbooks mark their most important parts with a label at the start of a
// line: "Definition.", "Theorem (Quadratic Formula).", "Example 3.1.",
// "Définition :", "Ejemplo 2.", "تعريف:". We use those labels to build
// definition cards and the worked example coach. Also "X is called the Y"
// sentences become definition cards.
//
// Everything is a real quote with its page. When the text holds a formula,
// the block is marked, because PDF text breaks formulas: the app then points
// to the real page picture.

import { hasFormula } from '../text/math';

export type BlockKind = 'definition' | 'theorem' | 'rule' | 'example' | 'exercise' | 'other';

export interface TextBlock {
  kind: BlockKind;
  /** The label as printed: "Theorem (Quadratic Formula)", "Example 3.1". */
  label: string;
  /** What it is about: "quadratic equation", "Quadratic Formula". */
  name: string;
  /** The text after the label, lines joined. */
  body: string;
  page: number;
  /** True when the text has a formula that the PDF may have broken. */
  formula: boolean;
}

const WORDS: [BlockKind, string][] = [
  ['definition', 'Definitions?|Définitions?|Definici[oó]n(?:es)?|تعريف'],
  ['theorem', 'Theorems?|Th[ée]or[èe]mes?|Teoremas?|Lemmas?|Lemmes?|Corollar(?:y|ies)|Corollaires?|Corolarios?|Propositions?|Proposici[oó]n|مبرهنة|نظرية'],
  ['rule', 'Formulas?|Formules?|F[oó]rmulas?|Rules?|R[èe]gles?|Reglas?|Laws?|Lois?|Ley(?:es)?|Propert(?:y|ies)|Propri[ée]t[ée]s?|Propiedad(?:es)?|قاعدة|قانون|خاصية|صيغة'],
  ['example', 'Worked\\s+examples?|Examples?|Exemples?|Ejemplos?|مثال'],
  ['exercise', 'Exercises?|Exercices?|Ejercicios?|Problems?|Probl[èe]mes?|تمرين'],
  ['other', 'Summary|R[ée]sum[ée]|Resumen|Remarks?|Remarques?|Notes?|Notas?|Proofs?|Preuves?|D[ée]monstrations?|Demostraci[oó]n|Solutions?|Soluci[oó]n|ملخص|ملاحظة|برهان|الحل'],
];

/** A label at the start of a line: word, optional number, optional (name), then "." or ":". */
const LABEL = new RegExp(
  `^\\s*(?<word>${WORDS.map(([, w]) => w).join('|')})(?:\\s+(?<num>[\\d٠-٩]+(?:[.\\-][\\d٠-٩]+)*))?\\s*(?:\\((?<name>[^)]{2,60})\\))?\\s*[.:：]\\s*`,
  'iu',
);

function kindOf(word: string): BlockKind {
  for (const [k, w] of WORDS) if (new RegExp(`^(?:${w})$`, 'iu').test(word)) return k;
  return 'other';
}

/** Lines that are only leftovers of a formula: a lost power "2", a "√", "5±1". */
const LEFTOVER = /^\s*[\d√∓±−+=.,()a-z]{1,4}\s*$/;

function cleanBody(lines: string[]): string {
  return lines
    .filter((l) => !LEFTOVER.test(l))
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "A quadratic equation is an equation…" -> "quadratic equation". */
function subjectOf(body: string): string {
  const m = /^(?:an?\s+|the\s+|l[ae]s?\s+|l['’]|une?\s+|el\s+|los\s+|las\s+)?(.{2,60}?)\s+(?:is|are|means|est|sont|désigne|es|son|significa|هو|هي|يعني)\s/iu.exec(body);
  if (m) return m[1].trim();
  return body.split(/\s+/).slice(0, 5).join(' ');
}

export function findBlocks(pages: { number: number; text: string }[]): TextBlock[] {
  const out: TextBlock[] = [];
  for (const page of pages) {
    const lines = page.text.split('\n');
    let current: { kind: BlockKind; label: string; name: string; lines: string[] } | null = null;
    const flush = () => {
      if (current && current.kind !== 'other') {
        const body = cleanBody(current.lines);
        if (body.length >= 8) {
          out.push({
            kind: current.kind,
            label: current.label,
            name: current.name || (current.kind === 'definition' ? subjectOf(body) : current.label),
            body,
            page: page.number,
            formula: hasFormula(current.lines.join('\n')) || hasFormula(body),
          });
        }
      }
      current = null;
    };
    for (const line of lines) {
      const m = LABEL.exec(line);
      if (m?.groups) {
        flush();
        const word = m.groups.word;
        const label = [word, m.groups.num, m.groups.name ? `(${m.groups.name})` : ''].filter(Boolean).join(' ');
        current = { kind: kindOf(word), label, name: m.groups.name?.trim() ?? '', lines: [line.slice(m[0].length)] };
      } else if (!line.trim()) {
        flush();
      } else if (current) {
        current.lines.push(line);
      }
    }
    flush();
  }
  return out;
}

export interface DefinitionCard {
  id: string;
  kind: 'definition' | 'theorem' | 'rule';
  /** Front of the card: the name to recall. */
  term: string;
  /** Back of the card: the book's own words. */
  text: string;
  page: number;
  formula: boolean;
}

/** "… is called the discriminant." -> a definition card for "discriminant". */
const CALLED = /([^.!?؟]*?\b(?:is|are)\s+(?:called|known\s+as|named)\s+(?:the\s+|an?\s+)?([\p{L}][\p{L}\s'’-]{1,40}?)[.,;]|[^.!?؟]*?\b(?:est\s+appel[ée]e?|s['’]appelle|se\s+nomme)\s+(?:l[ae]\s+|l['’]|une?\s+)?([\p{L}][\p{L}\s'’-]{1,40}?)[.,;]|[^.!?؟]*?\b(?:se\s+llama|se\s+denomina|se\s+conoce\s+como)\s+(?:el\s+|la\s+|una?\s+)?([\p{L}][\p{L}\s'’-]{1,40}?)[.,;]|[^.!?؟]*?(?:يسمى|تسمى|يُسمى|تُسمى)\s+([\p{L}][\p{L}\s]{1,40}?)[.,،؛])/giu;

export function definitionCards(pages: { number: number; text: string }[]): DefinitionCard[] {
  const cards: DefinitionCard[] = [];
  const seen = new Set<string>();
  const add = (c: DefinitionCard) => {
    const key = c.term.toLowerCase();
    if (seen.has(key) || c.term.length < 2) return;
    seen.add(key);
    cards.push(c);
  };
  for (const b of findBlocks(pages)) {
    if (b.kind !== 'definition' && b.kind !== 'theorem' && b.kind !== 'rule') continue;
    // A definition's first sentence is the definition; a theorem keeps its full statement.
    const text = b.kind === 'definition' ? b.body.split(/(?<=[.!?؟])\s+(?=[\p{Lu}\p{Lo}])/u)[0] : b.body;
    add({ id: `${b.kind}:${b.page}:${b.name}`, kind: b.kind, term: b.name, text, page: b.page, formula: b.formula || hasFormula(text) });
  }
  for (const page of pages) {
    const flat = page.text.split('\n').filter((l) => !LEFTOVER.test(l)).join(' ').replace(/\s+/g, ' ');
    for (const m of flat.matchAll(CALLED)) {
      const term = (m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').trim();
      const sentence = m[1].trim().replace(/^[^\p{L}\p{N}]+/u, '');
      // Only the sentence itself, starting after the previous full stop.
      const start = Math.max(sentence.lastIndexOf('. '), sentence.lastIndexOf('؟ '));
      const text = start >= 0 ? sentence.slice(start + 2) : sentence;
      add({ id: `called:${page.number}:${term}`, kind: 'definition', term, text, page: page.number, formula: hasFormula(text) });
    }
  }
  return cards;
}

export interface WorkedExample {
  id: string;
  label: string;
  /** The task, first sentence: "Solve x² − 5x + 6 = 0." */
  problem: string;
  /** The book's solution, one step per sentence. */
  steps: string[];
  page: number;
  formula: boolean;
}

/** Splits a solution into steps: one sentence each. A decimal point like "3.5" does not end a sentence. */
export function splitSteps(text: string): string[] {
  return text
    .split(/(?<=[.!?؟])\s+(?=[\p{Lu}\p{Lo}(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function workedExamples(pages: { number: number; text: string }[]): WorkedExample[] {
  return findBlocks(pages)
    .filter((b) => b.kind === 'example')
    .map((b) => {
      const parts = splitSteps(b.body);
      return { id: `ex:${b.page}:${b.label}`, label: b.label, problem: parts[0] ?? b.body, steps: parts.slice(1), page: b.page, formula: b.formula };
    })
    // An example with no solution has nothing to coach.
    .filter((e) => e.steps.length > 0);
}
