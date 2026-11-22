# Ankabut progress log

## Final summary

Ankabut is finished as specified: a browser-only web app where an animated spider reads PDF, Word, text,
Markdown, photos and pasted notes in Arabic, French and English. All 12 steps of the priority list are built,
each with its own commit.

**Where things stand**
- 109 automated tests pass (`npm test`), the TypeScript check passes, and both the user and developer builds
  succeed.
- Every step was also checked in a real Chromium browser with the sample files in `tests/fixtures/`
  (English, French, Arabic and mixed PDFs, a scanned PDF, a password PDF, a no-copy PDF, a Word file) and a
  300-page book.
- The copyright rules came first and stay on everywhere. Protected files are refused, PDF permission flags
  are respected, and every export goes through a guard that only allows short quotes with page numbers.

**Things you should know (honest gaps)**
- OCR (scanned pages, scrambled Arabic, photos) uses tesseract.js, which downloads its engine and language
  data the first time. My sandbox blocked that download, so I could not run a real OCR pass end to end. The
  logic is tested with a fake OCR engine and failures are reported clearly. Please try it once in your own
  browser with a scanned page.
- Read aloud depends on the voices installed on the device. Some systems have no Arabic voice. The app says
  so when that happens.
- Translate on tap uses a small offline dictionary (about 150 study and security words) unless the browser
  has Chrome's on-device translator. That keeps the privacy promise, but coverage is limited.
- Pages are shown as clean re-flowed text, not as the original PDF picture.
- Summaries are extractive (real sentences only). That is what makes them trustworthy, but they will never
  paraphrase like a chatbot.

**Where to start reading the code** (beginner friendly order)
1. `src/core/copyright.ts`: the rules, with comments.
2. `src/text/arabic.ts`: Arabic normalization, stemming, and fixing PDF Arabic.
3. `src/analysis/analyze.ts`: how a book becomes keywords and key points.
4. `src/render/spider.ts`: the spider and its legs.
5. `src/ui/app.ts`: how the interface ties it together. Each feature has its own file in `src/ui/`.


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

### Step 10: Feature roadmap, items 1 to 10

**Plan (written before building).**

| # | Feature | Best approach | Tradeoffs |
|---|---|---|---|
| 1 | Glossary hunter | Collect terms the document itself defines ("X is...", "X est...", "X هو..."), acronyms with their expansion ("Transport Layer Security (TLS)"), and top keywords. The "simple explanation" is the document's own defining sentence, with its page. | No outside knowledge, so a term the book never defines gets "used on pages..." instead of a made-up definition. Honest, but less complete. |
| 2 | Translate on tap | Click a word on the page. Use the browser's built-in on-device Translator API when it exists (Chrome, private, offline). Otherwise a bundled trilingual dictionary of about 150 study and security terms. Otherwise say honestly that no offline translation is available. | Online translation services would be better but would send words off the device, which breaks the privacy promise. |
| 3 | Check against the page | Already true everywhere: key points, flashcards, quiz answers, glossary and explanations all carry a page link that walks the spider to the exact sentence and highlights it. I'll keep it that way for every new feature. | None. |
| 4 | Spaced repetition | A Leitner-style schedule (1, 2, 4, 8, 16, 32 days), stored per card in the browser. Due cards come first; "Again" resets a card to 1 day. | Simpler than SM-2 and easy to explain to students. Stored only on this device. |
| 5 | Mind map ending | A radial web on its own canvas: the main topic in the center, one branch per chapter (its top keyword), leaves for that chapter's keywords, joined by silk threads. Click a node to search it. Save as PNG. | A fixed radial layout is predictable and fast. A force-directed layout looks more organic but jitters and costs more. |
| 6 | Exam mode | Timed practice: 10 questions, 6 minutes, drawn only from the document, mixed difficulty, no feedback until the end, then a results list with pages. Premium later. | No feedback during the exam is realistic but less "instant feedback"; the review at the end fixes that. |
| 7 | Progress and streaks | Count pages read, words found, questions answered and cards reviewed, plus a daily streak, in browser storage. | Per device only, no accounts. |
| 8 | Scan photos | Already built: photos (PNG, JPG, WebP) go through OCR in the browser. Add a camera button on phones (`capture`). | OCR quality depends on the photo. The result carries an OCR warning. |
| 9 | Read aloud | The browser's speechSynthesis, one sentence at a time, picking an Arabic, French or English voice per sentence. The spider walks to each sentence as it is spoken. Premium later. | Voice quality depends on the device. Some systems have no Arabic voice; then we say so. |
| 10 | Video export | Record the canvas with MediaRecorder while the canvas is switched to a 9:16 frame, with a title and the motto drawn on top. Saves a WebM (MP4 where the browser supports it). Premium later. | WebM may need converting for some apps. Recording runs in real time. |

**Improvement I added:** the mind map nodes and glossary entries are clickable searches, so every visual
leads back to the evidence.

**What I built (step 10):**
1. **Glossary hunter** (`src/analysis/glossary.ts`, Glossary tab). Defined terms with the document's own
   definition and page, acronyms with their expansion ("TLS = Transport Layer Security"), and top keywords
   with the pages they appear on. Every term is a clickable search.
2. **Translate on tap** (`src/translate/dictionary.ts`, `installTranslate` in `src/ui/roadmap.ts`). Click a
   word on the page: a small popover shows it in the other two languages. The offline dictionary answers at
   once; if the browser has an on-device translator (Chrome's Translator API) it upgrades the answer. If
   neither knows the word, it says so.
3. **Check against the page.** Every new feature (glossary, exam review, mind map) links back to its page.
4. **Spaced repetition** (`src/study/srs.ts`). Flashcards now use Leitner boxes (1, 2, 4, 8, 16, 32 days),
   saved on this device. Due cards come first and the Flashcards view shows "Due today".
5. **Mind map ending** (`src/render/mindmap.ts`). After the spider finishes (not in fast mode) the key ideas
   are woven into a web: main topic in the center, one branch per chapter, keywords as leaves, on silk rings.
   Nodes are clickable searches. Save as PNG. Also available from the Summary tab.
6. **Exam mode** (Study tab). 10 questions, 6 minutes, only from the document, mixed difficulty, no
   feedback until the end, then a review with page links.
7. **Progress and streaks** (`src/study/progress.ts`, Progress tab). Pages read, words found, questions,
   correct answers, cards reviewed, a day streak and a 4-week grid.
8. **Scan photos.** Photos already went through OCR; there is now a 📷 camera button for phones.
9. **Read aloud** (🔊 in the controls). Reads from the page on screen, sentence by sentence, with an
   Arabic, French or English voice per sentence. The spider walks to each sentence and highlights it. If
   the device has no voice for a language, the user is told.
10. **Video export** (🎬). The canvas switches to a 9:16 frame with the title and motto on top, the spider
   replays the read, and the recording downloads as MP4 or WebM. Tested in the browser: a real MP4 file was
   produced.

Tests: `tests/roadmap.test.ts`. Fix found in the browser: Chrome's on-device translator can hang, so the
dictionary answer now shows first and the translator gets 1.5 seconds to improve it.

### Step 11: The remaining learning science ideas

| # | Idea | Where it lives |
|---|---|---|
| 1 | Testing effect | Quiz, exam, speed round (steps 6, 10, 11) |
| 2 | Illusion of knowing | New: after every read the Summary offers "Quick check: 3 questions", with a one-line reason why. |
| 3 | Spaced repetition | Flashcards with Leitner boxes (step 10) |
| 4 | Instant feedback | Right or wrong at once, with the page (quiz, speed round) |
| 5 | Games serve learning | Word Hunt, speed round and exam all ask for recall or use; none is just watching |
| 6 | Use, not just memorize | New "Use it" tasks: "Give one real example of X", "What could go wrong if someone ignored X?" The spider checks that you used the idea and then shows the book's sentence to compare |
| 7 | Generation effect | "In your own words" (step 6) |
| 8 | Dual coding | Mind map web (step 10) |
| 9 | Cognitive load | Focus mode dims everything except the current lines, quiets the spider and stops flying keywords and speech bubbles |
| 10 | Interleaving | Quiz questions rotate between chapters (step 6) |
| 11 | Timed challenges | New "Speed round": 60 seconds, instant feedback after every answer |
| 12 | Emotion helps memory | New: the spider speaks in a small speech bubble ("Nice catch!", "Almost! Check the page.") in the document's language, and bounces when happy |
| 13 | Flow | Adaptive quiz difficulty (step 6) |
| 14 | Feynman technique | "Explain it to the spider" (step 6) |
| 15 | Protégé effect | New: ideas you teach the spider are remembered per book. The spider levels up and shows "Your spider learned 4 of 10 key ideas from you" |

Files: `src/study/learning.ts` (tested in `tests/roadmap.test.ts`), `src/ui/learning.ts`, speech bubble in
`src/render/view.ts`.

### Step 12: Versions, feature flags and the README (phase 8)

- **Feature flags** (`src/core/flags.ts`). One table marks each feature free or premium. `LAUNCH_FREE = true`
  turns everything on today. Later, setting it to false and setting the user's plan is all it takes.
  Premium-later features (Library, Exam, Read aloud, Video export, very large books over 500 pages) carry a
  small ✦ in the interface, explained in the About tab. No payments are built. Tests: `tests/flags.test.ts`.
- **Versions.** `npm run dev` / `npm run build` give the user version. `npm run dev:developer` /
  `npm run build:developer` give the developer version with a 🛠 badge, timings, extraction logs, and the
  spider's planned route drawn on the page. Checked in the browser: the developer version skipped consent
  for `sample-en.pdf`, but still refused `sample-password.pdf` and `sample-nocopy.pdf`, so rules 1 to 3 stay on.
- **README** in English, French and Arabic, with the inspiration credit line, the copyright rules, why there
  is no AI-writing detector, how to run both versions, the free/premium plan, honest limits and a project map.

### Redesign: the wireframe spider, grabbing effects and the Dark lab theme

Every feature, rule and copyright protection is unchanged. This only changes how the spider looks and moves,
and how catching words looks.

1. **A new spider, my own design** (`src/render/wirespider.ts`). It is a thin glowing wireframe skeleton,
   about 3 to 4 times bigger than before (feet span about 300 px instead of about 90). The body is small and
   made only of line segments: a hexagon head part, a long diamond abdomen, a spine and two short feelers.
   It has 8 long legs with 3 bones each, drawn as thin lines with small dots at the knee and ankle. No face.
   On narrow screens it shrinks (down to half size) so it still fits the page.
2. **Movement.** Feet plant on real words: the view computes the center of every word on a page (once per
   page) and `snapToWord` moves each foot target onto the nearest word. Legs step in two alternating groups,
   and a test checks that the two groups are never in the air at the same time. Each leg is solved with
   FABRIK inverse kinematics (`src/render/ik.ts`), with a "pole" point outside the body so the joints bend
   outward. A faint silk line fades out behind it.
3. **Dark lab theme** (`src/ui/theme.ts`, tokens in `src/styles.css`). Dark navy background, light page text,
   neon cyan, pink, blue and yellow. The new default setting is "Dark lab while the spider crawls": the
   theme turns on when a walk starts and goes back to your normal theme when it ends, with a short color
   fade. You can also pick Dark lab always, follow the system, light, or dark. A new ⚙ Settings button in
   the header holds the theme and spider style choices. Old saved settings were moved to the new defaults once.
4. **Grabbing effect** (`src/render/effects.ts`, drawn in `src/render/view.ts`). When the spider catches a
   keyword, the word is found at its exact spot in the sentence. It gets a neon glowing bar, then a short
   glitch (red, cyan and blue copies split apart, and horizontal slices jump sideways), then it tears off: a
   copy flies along a curved arc into the Keywords panel and lands there. A faint colored block stays where
   the word was, then fades. Flying words use a window-sized overlay canvas, so they can leave the page and
   land on the real panel (or the Keywords tab button, or the phone tab bar).
5. **Search hits.** In Word Hunt, when the spider reaches a match, a glowing outline box draws itself around
   it. When it finishes reading the match, it bites: the front legs strike at the word, with a small flash
   and an opening ring.
6. **Performance and accessibility.** Measured in Chromium on the 300-page book while crawling with effects:
   60 fps, worst frame 16.8 ms; during a Word Hunt: 60 fps. Speedups: theme colors are cached instead of
   read from CSS every frame (that was a hidden cost before), highlights are grouped per page once per frame,
   word positions are cached per page, legs are drawn as one path per pass with a cheap fake glow (no slow
   `shadowBlur`), page lookup is a binary search, and the overlay canvas only redraws while a word is flying.
   With Fast mode, Reduce motion or Focus mode on, there is no glitch, no flying word and no hunt box:
   keywords go straight into the panel. Turning effects off in the middle of an animation lands everything
   at once. The developer version shows an fps counter.
7. **The old cartoon spider is still there:** ⚙ Settings → Spider style → Classic cartoon.

Fix found while testing: on long books the spider skims so fast that the smooth camera fell more than a
screen behind it. The camera now jumps when the spider is far away and stays smooth otherwise.

Tested in the browser on the Arabic, French and English sample PDFs (theme switches on while crawling and
off after, glow, glitch, flight, ghost block, hunt box and bite, Arabic hunt on "التشفير"), plus the 300-page
book. New tests: `tests/spider.test.ts` (IK, gait, feet on words, size, effect timeline, curve, theme rules).

### Setup guides, GitHub Pages and testing on Windows, macOS and Linux

Copyright rules are unchanged. The cross-platform smoke test even re-checks that a protected PDF is refused.

**README.** A link to the online version sits at the top. Each language (English, French, Arabic) now has a
beginner-friendly guide: Windows, macOS (including the Gatekeeper "Open Anyway" step, the Command Line Tools
prompt, folder access and firewall prompts), Linux with commands for Ubuntu/Debian (NodeSource, because the
distro Node is too old) and Kali (apt first, NodeSource or nvm if needed), phones (Android "Add to Home screen",
iPhone Safari "Add to Home Screen"), a table of common errors per system, using the app in 6 steps, and the
one-time steps to publish the online version.

**GitHub Pages.**
- `.github/workflows/pages.yml` runs the tests, builds the user version and publishes `dist/` to Pages on every
  push to `main` (or by hand from the Actions tab).
- The build uses relative paths, so it works at `https://abdel098090.github.io/crawler/`. I tested this by
  serving the build under `/crawler/` and reading an Arabic PDF there on desktop and phone sizes, with no
  errors.
- Phones can install it: `public/manifest.webmanifest`, icons (192, 512, Apple touch 180) in the new
  wireframe style, and theme color meta tags.
- **Not live yet, and why:** the repository is private and Pages is not switched on. Three things only the
  owner can do: (1) merge the branch into `main`, (2) Settings → Pages → Source: "GitHub Actions", (3) Pages on
  a private repository needs a paid plan (Pro, Team or Enterprise), otherwise the repository must be made
  public. I did not change any repository settings.

**Tested on Windows, macOS and Linux.** `.github/workflows/ci.yml` runs on every push on `windows-latest`,
`macos-latest` and `ubuntu-latest`: `npm ci`, typecheck, all tests, both builds, then `scripts/ci-smoke.mjs`,
which serves the built app and opens it in headless Chromium, reads the English, French and Arabic PDFs, and
checks that the password PDF is refused. First run (commit 4dbc841): **all three passed every step.**

Differences found between systems:

| | Linux | macOS | Windows |
|---|---|---|---|
| `npm ci` | 3 s | 2 s | 11 s |
| `npm test` (117 tests) | 10 s | 3 s | 21 s |
| Smoke test in a browser | passed | passed | passed |

- Windows is the slowest at installing and testing (antivirus scanning and a slower file system on the runner),
  but the results are identical. The guide mentions the antivirus slowdown and `EPERM` fix.
- Windows runs npm scripts through `cmd`/PowerShell. The `&&` in our scripts works there, and I avoided shell
  tricks in the smoke test: it starts the preview server from Node itself, so there is no process to kill
  differently per system.
- Line endings: Git on Windows can rewrite line endings. A new `.gitattributes` keeps text files as LF and marks
  PDF, DOCX and images as binary, so the test PDFs can never be damaged.
- `package.json` now declares the Node versions Vite needs (`^20.19.0 || >=22.12.0`), so npm warns early on an
  old Node, the most common Linux problem.
- Developer-only fixture scripts (`scripts/make-*.py/mjs`) use `python3` and a global Playwright. On Windows
  `python3` may be called `py`. Normal users never need these scripts, because the fixtures are committed.
- Moved the workflows to `actions/checkout@v5` and `actions/setup-node@v5` after GitHub warned that v4 targets an
  old Node version.
- What I could not test directly: real phones, and the installed app on a home screen. The phone layout was
  tested in Chromium's phone emulation.

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
- The leg "glow" is a wide, faint line drawn under the thin bright line. Real canvas glow (`shadowBlur`) looks
  similar but costs much more per frame, and the spider is drawn 60 times a second.
- When a keyword spans two lines, only the part on its first line plays the effect. That is simpler, and
  hardly anyone would notice.
