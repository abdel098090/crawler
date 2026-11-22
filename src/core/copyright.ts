// Respecting authors and copyright.
//
// These rules are the foundation of Ankabut. Rules 1 to 3 are ALWAYS on,
// in the user version and in the developer version. Nothing in this file
// takes a "developer" switch for rules 1 to 3, on purpose.
//
// Rule 1: never open DRM or password protected files, never try to bypass protection.
// Rule 2: respect PDF permission flags. If copying/extraction is disabled, do not extract.
// Rule 3: never export or copy the full text. Exports hold only key points,
//         short quotes (one or two sentences, with page numbers), counts and the user's notes.
// Rule 4: the user confirms they own the file or have the right to use it.
//         Only rule 4 may be relaxed, and only in developer mode for the developer's own samples.

export class ProtectedFileError extends Error {
  /** Short machine code so the UI can show a translated, polite message. */
  constructor(
    public code: 'password' | 'drm' | 'no-copy' | 'unsupported',
    message: string,
  ) {
    super(message);
    this.name = 'ProtectedFileError';
  }
}

export class ExportBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportBlockedError';
  }
}

// ---------------------------------------------------------------------------
// Rule 1: detect protected files from their first bytes.
// ---------------------------------------------------------------------------

/** Bytes at the start of an OLE "compound file". Encrypted Office files use this container. */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_MAGIC = [0x50, 0x4b]; // "PK"

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

/**
 * A normal .docx is a ZIP file. A password protected or rights-managed (DRM)
 * .docx is wrapped in an OLE container instead. We refuse those and never try to open them.
 */
export function assertDocxNotProtected(bytes: Uint8Array): void {
  if (startsWith(bytes, OLE_MAGIC)) {
    throw new ProtectedFileError(
      'password',
      'This Word file is password protected or rights managed. Ankabut does not open protected files.',
    );
  }
  if (!startsWith(bytes, ZIP_MAGIC)) {
    throw new ProtectedFileError('unsupported', 'This does not look like a normal .docx file.');
  }
}

/** Ebook formats that usually carry DRM. We do not support them at all. */
const DRM_EXTENSIONS = ['epub', 'azw', 'azw3', 'kfx', 'mobi', 'acsm', 'ibooks', 'lcpl', 'lcpdf'];

export function assertNotDrmFormat(fileName: string): void {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (DRM_EXTENSIONS.includes(ext)) {
    throw new ProtectedFileError(
      'drm',
      'Ebook files like this often carry DRM protection, so Ankabut does not open them.',
    );
  }
}

/** pdf.js throws an error named PasswordException for password protected PDFs. */
export function isPdfPasswordError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  return name === 'PasswordException';
}

// ---------------------------------------------------------------------------
// Rule 2: PDF permission flags.
// ---------------------------------------------------------------------------

/** The PDF spec bit for "copy or extract text" (pdf.js calls it PermissionFlag.COPY). */
export const PDF_PERMISSION_COPY = 0x10;

/**
 * pdf.js returns null when the PDF has no restrictions, or a list of the
 * permissions that ARE granted. If COPY is not in that list, the author
 * disabled copying and extraction, and we stop.
 */
export function assertPdfAllowsExtraction(permissions: number[] | null): void {
  if (permissions === null) return;
  if (!permissions.includes(PDF_PERMISSION_COPY)) {
    throw new ProtectedFileError(
      'no-copy',
      'The author of this PDF turned off copying and text extraction. Ankabut respects that choice and will not read it.',
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 3: the export guard. Every export goes through here.
// ---------------------------------------------------------------------------

export const MAX_QUOTE_CHARS = 320;
export const MAX_QUOTE_SENTENCES = 2;
/** All quotes together may never be more than this share of the document. */
export const MAX_QUOTE_SHARE = 0.1;
/** ...and never more than this many characters, even for a huge book. */
export const MAX_TOTAL_QUOTE_CHARS = 40000;

export interface ExportQuote {
  text: string;
  page: number;
  file?: string;
}

/** Count sentences in a quote, roughly, in all three languages. */
export function countSentences(text: string): number {
  const parts = text
    .split(/(?<=[.!?؟…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Math.max(1, parts.length);
}

/** Trim a quote to the allowed size. Used before showing "copy" actions too. */
export function shortenQuote(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?؟…])\s+/u).slice(0, MAX_QUOTE_SENTENCES).join(' ');
  if (sentences.length <= MAX_QUOTE_CHARS) return sentences;
  const cut = sentences.slice(0, MAX_QUOTE_CHARS - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 200 ? cut.slice(0, lastSpace) : cut) + '…';
}

/**
 * Checks a set of quotes before any export. It throws if anything breaks rule 3.
 * `documentChars` is the total length of the source document(s).
 */
export function assertExportSafe(quotes: ExportQuote[], documentChars: number): void {
  let total = 0;
  for (const q of quotes) {
    if (!Number.isFinite(q.page) || q.page < 1) {
      throw new ExportBlockedError('Every quote must carry its page number.');
    }
    if (q.text.length > MAX_QUOTE_CHARS + 1) {
      throw new ExportBlockedError('A quote is too long. Quotes are limited to one or two sentences.');
    }
    if (countSentences(q.text) > MAX_QUOTE_SENTENCES) {
      throw new ExportBlockedError('A quote has more than two sentences.');
    }
    total += q.text.length;
  }
  const limit = Math.min(MAX_TOTAL_QUOTE_CHARS, Math.max(600, documentChars * MAX_QUOTE_SHARE));
  if (total > limit) {
    throw new ExportBlockedError(
      'This export would contain too much of the original text, so it was blocked to protect the author.',
    );
  }
}

/**
 * Takes quotes in priority order and keeps as many as fit inside the rules,
 * shortening each one. The result always passes assertExportSafe.
 */
export function fitQuotesToLimit<T extends ExportQuote>(quotes: T[], documentChars: number): T[] {
  const limit = Math.min(MAX_TOTAL_QUOTE_CHARS, Math.max(600, documentChars * MAX_QUOTE_SHARE));
  const kept: T[] = [];
  let total = 0;
  for (const q of quotes) {
    const text = shortenQuote(q.text);
    if (total + text.length > limit) continue;
    total += text.length;
    kept.push({ ...q, text });
  }
  return kept;
}

/**
 * Final safety net for text exports (Markdown, CSV, and so on): no single
 * paragraph of the export may be a long verbatim run of the source text.
 * It looks for any window of 400 characters copied from the document.
 */
export function assertNoLongVerbatimRun(exportText: string, sourceText: string): void {
  const WINDOW = 400;
  const src = sourceText.replace(/\s+/g, ' ');
  const out = exportText.replace(/\s+/g, ' ');
  if (out.length < WINDOW || src.length < WINDOW) return;
  for (let i = 0; i + WINDOW <= out.length; i += 100) {
    const piece = out.slice(i, i + WINDOW);
    if (src.includes(piece)) {
      throw new ExportBlockedError('This export contains a long copy of the original text and was blocked.');
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 4: ownership consent. Only this rule has a developer relaxation.
// ---------------------------------------------------------------------------

export interface ConsentState {
  /** The user ticked "I own this file or have the right to use it for personal study". */
  confirmed: boolean;
}

/**
 * Returns true when reading may start. In developer mode the consent step can be
 * skipped for the developer's own sample files. Rules 1 to 3 do not depend on this.
 */
export function mayRead(consent: ConsentState, developerMode: boolean, isDeveloperSample: boolean): boolean {
  if (consent.confirmed) return true;
  return developerMode && isDeveloperSample;
}

/** Developer samples are files whose name starts with "sample-" or "ankabut-sample". */
export function isDeveloperSampleName(fileName: string): boolean {
  const n = fileName.toLowerCase();
  return n.startsWith('sample-') || n.startsWith('ankabut-sample');
}
