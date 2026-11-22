# Plan: math, pictures and local AI

Started 2026-11-22. Tick a box when it is done and tested.

## Part A: Math and science books

- [x] **A1. Warning note** for students: formulas come out broken from PDFs, so check the real page. Shown in the app when a file has formulas, and in the README.
- [x] **A2. Formula detector:** find lines where the math is broken (lost ², ≠, fractions split over lines).
- [x] **A3. Real page picture:** every key point with a formula gets a "📷 See the real page" button that shows the original PDF page.
- [x] **A4. No quiz from broken math:** the quiz and flashcards skip sentences with broken formulas, so a student never learns a wrong formula.
- [x] **A5. Definition and theorem cards:** find "Definition", "Theorem", "Formula", "Rule" in EN, FR, ES, AR and make flashcards from them.
- [x] **A6. Practice problems** with new numbers, answers calculated by code (never guessed):
  - [x] quadratic equations
  - [x] linear equations
  - [x] percentages
  - [x] binary and decimal
  - [x] subnetting (CSIS 1250)
- [x] **A7. Worked example coach:** hide the steps of the book's examples, the student guesses the next step.

## Part B: Pictures and photos

- [x] **B1. Test:** a photo of a page with text next to a diagram. Does OCR read the text and skip the drawing?
- [x] **B2. Tips for students:** crop to the text, good light, straight photo.

## Part C: Local AI (optional, off by default)

- [x] **C1. Connect to Ollama** on the same computer only (localhost). Nothing goes to the internet.
- [x] **C2. "Ask my local AI"** to explain a key point. The AI only gets the pages being read, and must answer from them.
- [x] **C3. Clear label:** "AI answer, can be wrong, check the quote on page X."
- [x] **C4. Install guide** at the end of the README: install Ollama, pull one small model, turn it on in Settings.
- [x] **C5. Works fine without it:** students who do not want AI never see it.

## Part D: Easier to use (later)

- [x] D1. Focus timer (25 min read, 5 min break)
- [x] D2. Daily goal: "read 10 pages today"
- [ ] D3. "Check this quote" button that flashes the exact line
- [ ] D4. "This idea is in both files" in Library mode
- [ ] D5. Install on a phone (PWA)
- [ ] D6. MIT license (waiting for your name), then make the repo public

## Rules so nothing breaks

1. Every new part gets automatic tests before it is merged.
2. Every new part is tried in a real browser with a real file.
3. New work goes on its own branch, `main` only gets tested work.
4. When something cannot be checked (like voices), it is said clearly.
