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

## Decisions

- Developer samples are recognised by file name (`sample-...` or `ankabut-sample...`). It is the
  simplest honest way to mark "files the developer created" without any upload.
- Owner-password PDFs that open without a password are read only if their permission flags allow
  copying. We never ask for or try passwords.
