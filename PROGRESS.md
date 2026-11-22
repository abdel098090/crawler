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

### Step 4: Smart chunking for long documents

- The page count is known the moment a file loads. The user never types it.
- `src/analysis/chunking.ts` looks for chapter headings in English, French and Arabic ("Chapter 3",
  "Chapitre 2", "الفصل الثاني" and so on). With two or more chapters it chunks by chapter, and splits any
  chapter longer than 40 pages. Without chapters it uses even blocks of about 15 to 20 pages.
- Long documents (more than 20 pages) show a reading plan first (`choosePlan` in `src/ui/app.ts`): "This
  book has 300 pages. For the best results I'll read it in 20 chunks." The user can accept, choose a page
  range, or tick specific chapters.
- The worker reads one chunk at a time and reports progress per chunk ("Reading chunk 7/20"), then merges
  the chunk results into the whole-book summary. Pages outside the chosen range are listed in the
  coverage bar, so nothing is cut off silently.
- Checked in the browser with a 300-page book: plan shown, read and walked with no errors.

### Step 5: Command panel and Word Hunt mode (phase 5)

- **Command panel** (left side, `src/ui/commands.ts`). The user types what the spider should do, in
  English, French or Arabic. `src/commands/parse.ts` understands "Take the key points" (optionally
  "from 10 to 20"), "Explain this section simply", and "Find every 'cloud'". Eastern Arabic digits
  (١٠) work too. Anything else is treated as a search.
- **Search** (`src/hunt/search.ts`). Matching uses normalized forms (accents, tashkeel, alef forms,
  Arabic prefixes, plurals), but the highlight sits on the word exactly as written on the page. The panel
  shows "certificate: 4 matches", previous and next buttons (also keys N and P), and a list of matches.
  Clicking a match makes the spider walk there. A word that is not in the document gets an honest
  "I could not find it. I won't guess." Clicking a keyword chip searches for it.
- **Explain this section simply** (`src/analysis/explain.ts`). It takes the chunk on screen and shows the
  spider's one-line frame ("In simple words, pages 1 to 3 are mostly about firewall, key and encryption"),
  then the definitions and simplest sentences from those pages, each with its page link.
- **Word Hunt** (`src/ui/wordhunt.ts`). The user lists words. The spider walks the whole range and catches
  every match, with a live score: words found, pages searched, time. At the end a results table (word,
  count, pages) can be exported as CSV or Markdown (`src/export/hunt.ts`). Exports contain no book text.
- Tests: `tests/hunt.test.ts` (normalized matching in all three languages, hunt counts, exports, the
  command parser in three languages, explanations). Checked in the browser.

### Step 6: Learning science priorities 1, 7 and 14

A new **Study** tab (`src/ui/study.ts`) where the learner does active work.

1. **Testing effect: quizzes** (`src/study/quiz.ts`). Each question is a real key sentence with one keyword
   blanked out. Wrong options are other keywords from the same book and language. Feedback is instant,
   right or wrong, with the correct answer and a "Check page 2" link that walks the spider to the source.
   Questions mix chunks (interleaving), and the difficulty adapts: three right in a row moves from 3
   options to 4 options to typing the answer; two wrong in a row moves back down.
2. **Generation effect: "In your own words"** (`compareOwnWords` in `src/study/feedback.ts`). The learner
   sees only the page and the topic words, writes the point first, then reveals the spider's version (the
   real quote). The ideas they covered show in green, the ones they missed in amber.
3. **Feynman technique: "Explain it to the spider"** (`checkTeaching`). The learner explains the topic in
   simple words. The spider points out gaps using the document: top ideas not mentioned (each with the real
   sentence and page that explains it), words that appear nowhere in the document, and numbers that are not
   in the document. It never judges style and never guesses.

Also added a tiny event bus on the app (`app.events`) so later features (progress, streaks, celebrations)
can react to quiz answers and teaching. Tests: `tests/study.test.ts`.

### Step 7: Study mode (phase 6) and "The spider explains at the end"

- **Flashcards** (`src/study/flashcards.ts`, shown in `src/ui/studymode.ts`). Two kinds: a keyword on the
  front with a real sentence on the back, and "fill in the blank" cards from key sentences. Every card has
  a "Check page" link. "Again" puts a card back a few places later in the session. The Study tab now opens
  on Flashcards, next to Quiz, In your own words and Explain it to the spider.
- **The spider explains at the end** (`explainDocument` in `src/analysis/explain.ts`). When the walk
  finishes, the spider gives a short explanation in its own words: one line for the whole document and one
  per part, built only from the keywords and anchored to real key sentences. It is labelled "Spider's
  explanation" so it is never confused with a quote. The sentence uses the document's language and only
  keywords from that language.
- **Study document** (`src/export/study.ts`). Markdown, and PDF through the browser's print dialog. It holds
  the document's metadata, coverage, the spider's explanation, key points as short quotes with page numbers,
  keywords, the user's searches with pages, Word Hunt counts, and the user's own notes. Every quote passes
  through the copyright guard, and the whole document is checked for long copied runs. It never contains the
  full text. Labels follow the interface language.
- **Anki cards** (tab-separated import file) and a **Notion-ready Markdown** file.
- **My notes** on the left, saved on this device.
- Fixes found while testing in the browser: two-word keywords no longer cross sentence ends; the spider's
  explanation no longer mixes languages; only new cards "pop" in (re-drawing a panel used to replay the
  animation and flicker); toasts stack instead of overlapping; spider legs no longer stretch after a fast jump.
- Tests: `tests/export.test.ts` (a 300-page book export stays far below the limits).

### Step 8: The remaining Known problems (5 to 15)

| # | Problem | How Ankabut handles it |
|---|---|---|
| 5 | Wrong numbers and quotes | Key points are cut from the page by character position, so numbers, dates and quotes are exact. The spider's own sentences only insert keywords, never numbers. Test: "copies numbers exactly from the page". |
| 6 | Section by section | Each chunk (chapter) is summarized first, then merged into the whole-book summary (step 4). |
| 7 | Shallow summaries | New "Go deeper" link on every quote (`src/analysis/deeper.ts`): the sentence before and after, plus the most related sentences elsewhere in the book, each with its page. |
| 8 | Multiple files | Every key point shows its file and page in Library mode (step 9 builds on `fileLabel`). |
| 9 | Honest "not found" | Search, explain, and teach all say "I could not find it. I won't guess." |
| 10 | Confidence label | Every card says "Direct quote" or "Spider's explanation". |
| 11 | Scanned pages | Detected (image but no text), shown on the page, listed in coverage. New "Read scanned pages with OCR" button in the About tab. If OCR cannot run, the user is told why. |
| 12 | Big files | PDF pages load one by one with progress and short pauses, analysis runs in a Web Worker, and the canvas only draws visible pages. 300 pages tested. |
| 13 | Privacy | Message in the header and drop zone, plus a Content Security Policy that stops the page from sending data anywhere. |
| 14 | Fast mode | Toggle in the header: results appear right away with no walk. |
| 15 | Accessibility | Keyboard controls for everything (press ? for the list), text size buttons A− / A+ (also [ and ]), a Reduce motion toggle (on by default if the system asks for it), visible focus outlines, and a screen-reader live region that announces each key point the spider finds, because a canvas is silent to screen readers. |

Also added a test that every English interface string exists in French and Arabic.
Files: `src/ui/quality.ts`, `src/analysis/deeper.ts`.

### Step 9: Library mode (phase 7)

- Drop several files at once (`src/ui/library.ts`). One consent question covers all of them. Each file is
  prepared and analysed in the worker, then the spider walks the files one after another.
- **One combined keyword list** (`mergeKeywords` in `src/analysis/library.ts`). Each keyword remembers which
  files it came from, with counts and pages (hover a chip). Keywords shared by several files rank higher and
  show "· 2📄".
- **One combined Word Hunt report.** The hunt runs on every file, the spider walks file to file, and the
  table and CSV get a "file" column.
- **Always shows the file** (Known problem 8). Every key point card in Library mode says "sample-fr.pdf · p. 2".
  Clicking it opens that file and walks the spider to the sentence. Each file keeps its own highlights.
- A **Library** tab lists every file with its coverage and number of key points, and lets you switch files.
- The study document, flashcards, quiz and Anki export include every file.
- Tests: `tests/library.test.ts` uses three real PDFs. Checked in the browser with English, French and
  Arabic PDFs together.

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
- A document counts as "long" above 20 pages. Shorter documents start reading right away with no plan
  dialog, because a plan for 5 pages would only slow the user down.
- Commands are understood with simple patterns, not an AI model. It is private, instant, works offline
  and behaves the same every time. Unknown commands fall back to a search.
- Word Hunt matching for Arabic uses the light stem, so مكتبة also catches المكتبة and والمكتبة. A side
  effect is that a few related words can match too (for example مكتبة and مكتب). For a study tool,
  finding a little too much is safer than missing matches.
- Quiz questions are "fill in the blank" built from real sentences, so every question and answer comes
  from the document. Generating free-form questions would need an AI model and could invent content.
- "Explain it to the spider" checks ideas by keyword coverage. It is honest about what it is: it can tell
  you what you left out or what is not in the book, but it cannot judge whether your reasoning is right.
- PDF export uses the browser's own print dialog ("Save as PDF"). A JavaScript PDF library would have to
  embed Arabic fonts and do Arabic shaping itself, which is large and error-prone. The browser already does
  it perfectly.
- Two-word keywords need at least 3 appearances. With 2, small documents filled the list with chance pairs.
- OCR (tesseract.js) downloads its engine and language data from a CDN the first time. In my test sandbox
  that download was blocked, so I could not run a real OCR pass end to end. The code path is tested with a
  fake OCR function, and failure is reported to the user. Please try "Read scanned pages with OCR" in a
  normal browser.
- In Library mode every file is read completely, with no reading plan dialog per file. Asking a plan
  question for each of several files would be tiring. The user can still use "Take the key points from
  X to Y" on the file that is open.
