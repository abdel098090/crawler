# Ankabut progress log

## Build log

### Step 1: Respecting authors and copyright

The copyright rules were built first so every later feature sits on top of them.

What I built:
- `src/core/copyright.ts` holds the rules. Rule 1 refuses protected Word files (encrypted
  .docx files are wrapped in an "OLE" container instead of a ZIP, so the first bytes give them
  away), DRM ebook formats (.epub, .azw3 and friends), and password PDFs. Rule 2 reads the PDF
  permission flags and stops when copying is turned off. Rule 3 is the export guard: every
  export goes through `assertExportSafe`, which only allows quotes of one or two sentences,
  each with a page number, and caps the total quoted text at 10% of the document (and never
  above 40,000 characters). A second check, `assertNoLongVerbatimRun`, blocks any export that
  contains 400 characters copied in a row. Rule 4 is the consent check (`mayRead`).
- `src/core/config.ts` says whether the developer version is running.
- `src/core/types.ts` is the shared vocabulary (pages, key points, keywords, and so on).
- `tests/copyright.test.ts` tests every rule.

Important: rules 1 to 3 have no "developer" switch at all. Only rule 4 checks developer mode,
and only for files named `sample-...`.

### Step 2: Core build, phases 1 to 4

Load files, show them with correct Arabic, find keywords and key points in three languages,
and the animated spider.

What I built, and which files matter:
- **Loading (phases 1 and 2).** `src/loaders/detect.ts` looks at the first bytes of a file to
  pick the right reader. `src/loaders/pdf.ts` reads PDFs with pdf.js and rebuilds lines in the right
  order (right to left for Arabic lines). `src/loaders/docx.ts` reads Word files with mammoth and gets
  the author and title from inside the file. `src/loaders/text.ts` handles text, Markdown and pasted
  notes, cutting them into "virtual pages" of about 2,800 characters. `src/loaders/browser.ts` ties it
  together in the browser.
- **Arabic.** `src/text/arabic.ts` normalizes Arabic (removes tashkeel and tatweel, unifies alef, ta
  marbuta and ya), does light stemming (so المكتبة and مكتبة count as one word), and detects Arabic that
  came out of a PDF reversed or scrambled. Reversed lines are flipped back automatically.
- **Three languages (phase 3).** `src/text/lang.ts` detects Arabic, French or English per sentence, so
  mixed documents work. `src/text/stopwords.ts` has stopword lists for all three. `src/text/tokenize.ts`
  splits sentences and words while remembering their exact position on the page.
- **Keywords and summary.** `src/analysis/keywords.ts` scores words and two-word terms (TF-IDF style).
  `src/analysis/summary.ts` ranks sentences with a TextRank-style score and picks them spread across the
  pages. `src/analysis/analyze.ts` runs the whole pipeline. It runs in a Web Worker
  (`src/worker/*`) so the animation never freezes.
- **The spider (phase 4).** `src/render/spider.ts` is my own spider design: teal body, an amber
  open-book mark on its back, and round reading glasses. Eight legs, two-bone inverse kinematics, two
  alternating leg groups, and a silk trail. `src/render/route.ts` plans the walk: skim pages with nothing
  important, slow down on key sentences, inside a time budget so a 300-page book takes minutes.
  `src/render/layout.ts` and `src/render/view.ts` draw the pages on one canvas, with Arabic lines drawn
  right to left by the browser (which also joins the letters correctly).
- **Interface.** `src/ui/app.ts` (the controller), `src/ui/i18n.ts` (English, French, Arabic text),
  `src/styles.css` (light and dark themes, phone layout).
- **Tests.** `tests/arabic.test.ts`, `tests/loaders.test.ts`, `tests/analysis.test.ts`. They use real
  PDFs in `tests/fixtures/` (English, French, Arabic, mixed, scanned, password, no-copy), built by
  `scripts/make-pdf-fixtures.mjs` and `scripts/make-other-fixtures.py`. A 300-page synthetic book is
  analysed in about a second.
- `scripts/smoke.mjs` opens the real app in Chromium, loads a file and takes screenshots.

### Step 3: Top priority fixes (Known problems 1 to 4)

These four decide whether people can trust the tool.

1. **No missing middle.** Every chunk gets a quota of key points, and inside a chunk the pages are split
   into bins so the best sentence of each bin is taken first (`pickSpread` in `src/analysis/summary.ts`).
   The whole-book summary takes the best points from every chunk. The Summary tab shows a small bar per
   part of the book (`spreadReport` in `src/analysis/verify.ts`), and a red bar would mean an empty part.
2. **No made-up content.** Key points are real sentences, cut from the page by their exact character
   positions. Before anything is shown, `verifyKeyPoints` checks that the text really sits at that spot on
   that page, and drops it if not. Every key point links to its page.
3. **No silent cutoff.** The coverage bar above the pages always says "Read X of Y pages" and lists every
   skipped page with the reason (scanned image, empty, outside the chosen range). Pages read with OCR are
   counted too.
4. **Broken Arabic from PDFs.** Reversed Arabic is detected and flipped back. Scrambled Arabic (letters
   split apart, broken font maps) switches to OCR automatically, using the `ocrPage` hook in
   `src/loaders/pdf.ts`. If OCR is not possible, the user gets a clear warning.

Tests: `tests/trust.test.ts` covers all four, including a fake PDF with reversed and scrambled Arabic.

## Decisions

- Developer samples are recognised by file name (`sample-...` or `ankabut-sample...`). It is the
  simplest honest way to mark "files the developer created" without any upload.
- Owner-password PDFs that open without a password are read only if their permission flags allow
  copying. We never ask for or try passwords.
- Pages are re-drawn from the extracted text instead of showing the PDF picture. This keeps Arabic
  right to left and correctly joined even when the PDF itself stored it badly, and lets the spider walk
  exactly on the words. The original layout (columns, images) is not shown.
- Text files have no pages, so "virtual pages" of about 2,800 characters are used. Page numbers for
  .docx and .txt files refer to these virtual pages.
- The Arabic stemmer is deliberately light (common prefixes and suffixes only). A full morphological
  analyser would be heavier and slower in the browser.
- No web fonts are downloaded (privacy and offline use). The app uses system fonts that include Arabic.
- A Content Security Policy in `index.html` blocks the page from talking to any server. The only
  allowed outside hosts are the OCR engine and language data download (never your file).
