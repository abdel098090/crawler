// Cleans text that OCR read from a photo or a scanned page.
//
// OCR gives one line of text per printed line, so a sentence that wraps over
// two lines comes out cut in half. It also reads the small labels inside
// diagrams ("Router R1", "PC1", "192.168.10.0/24") as if they were text.
//
// Here we:
// 1. join the lines of each paragraph back into full sentences
//    (and "net-" + "work" back into "network"),
// 2. set aside paragraphs that look like diagram labels: only very short
//    lines and no sentence ending. They are not thrown away: they are
//    returned so the app can tell the student what was left out.

export interface CleanOcr {
  text: string;
  /** Short labels that looked like they belong to a diagram or picture. */
  labels: string[];
}

const SENTENCE_END = /[.?!:;؟。»”"')\]]$/;
const words = (line: string) => line.split(/\s+/).filter(Boolean);

function joinLines(lines: string[]): string {
  let out = '';
  for (const line of lines) {
    if (!out) out = line;
    // "net-" at the end of a line followed by a lowercase word: one word split by the printer.
    else if (/[a-zà-ÿ]-$/.test(out) && /^[a-zà-ÿ]/.test(line)) out = out.slice(0, -1) + line;
    else out += ' ' + line;
  }
  return out;
}

function looksLikeLabels(lines: string[]): boolean {
  if (lines.some((l) => SENTENCE_END.test(l))) return false;
  const all = lines.flatMap(words);
  const avg = all.length / lines.length;
  if (avg < 3.5) return true;
  // Labels are names and numbers ("Switch S1 Switch S2"). Real sentences always have
  // lowercase words ("the", "is", "network"). Arabic has no capitals, so only the length rule applies there.
  const latin = all.filter((w) => /^[A-Za-zÀ-ÿ]/.test(w));
  const lower = latin.filter((w) => /^[a-zà-ÿ]/.test(w)).length;
  return latin.length >= all.length * 0.6 && lower / latin.length < 0.2;
}

export function cleanOcrText(raw: string): CleanOcr {
  const paragraphs = raw
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((p) => p.length);
  // OCR often puts a blank line after every printed line. Glue a piece back onto the one
  // before when that one does not end a sentence and this one goes on with a small letter
  // (or, in Arabic, which has no small letters, when both are long text lines).
  for (let i = paragraphs.length - 1; i > 0; i--) {
    const prev = paragraphs[i - 1][paragraphs[i - 1].length - 1];
    const first = paragraphs[i][0];
    const arabicFlow = /[؀-ۿ]/.test(first) && words(prev).length >= 4 && words(first).length >= 2;
    if (!SENTENCE_END.test(prev) && (/^[a-zà-ÿ]/.test(first) || arabicFlow)) {
      paragraphs[i - 1].push(...paragraphs[i]);
      paragraphs.splice(i, 1);
    }
  }
  const kept: string[] = [];
  const labels: string[] = [];
  paragraphs.forEach((lines, i) => {
    const next = paragraphs[i + 1];
    const isTitle = i === 0 && lines.length <= 2;
    // A short line right before a real paragraph is a heading, not a label.
    const isHeading = lines.length === 1 && words(lines[0]).length <= 8 && !!next && !looksLikeLabels(next);
    if (!isTitle && !isHeading && looksLikeLabels(lines)) {
      labels.push(...lines);
      return;
    }
    // Headings and titles stay on their own line; text lines are joined into sentences.
    kept.push(isTitle || isHeading ? lines.join(' ') : joinLines(lines));
  });
  return { text: kept.join('\n\n'), labels };
}
