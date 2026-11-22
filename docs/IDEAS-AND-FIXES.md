# Ankabut: 20 ideas and 20 problems from students

Research done on 2026-11-22. I looked at what students and teachers say about
study and reading tools like NotebookLM, ChatPDF, text-to-speech apps and
flashcard apps. Each item says where Ankabut stands today.

Legend:
- ✅ **Already in Ankabut** (good to show a professor)
- 🟢 **Easy to add** (a few hours)
- 🟠 **Bigger job** (days)

---

## Part 1: 20 problems students complain about (what to fix or avoid)

| # | The complaint | Ankabut today |
|---|---|---|
| 1 | AI makes up facts that are not in the book (hallucination) | ✅ Ankabut does not invent text. Key points are real quotes from the file. |
| 2 | Wrong or missing page numbers on citations | ✅ Every key point links to its real page. 🟢 Add a "check it" button that jumps and flashes the exact line. |
| 3 | Answers sound confident even when they are wrong | ✅ Says "I could not find this. I won't guess." 🟢 Show this message more often. |
| 4 | Works badly outside English | ✅ English, French, Arabic, Spanish. |
| 5 | Scanned PDFs and photos are not read | ✅ OCR runs on the device. |
| 6 | Long textbooks fail or get cut off | ✅ Reading plan splits big books into chunks. 🟢 Test with a 500 page book. |
| 7 | Diagrams, tables and formulas are lost when the PDF becomes text | 🟠 Show the original page image next to the text. |
| 8 | Privacy: uploads go to a company server | ✅ Files never leave the device. Big selling point for schools. |
| 9 | Professors worry about uploading course material (copyright) | ✅ Local only, plus a consent box before reading. |
| 10 | Tools do the work for you, so you learn less (cheating fear) | ✅ Motto "I help you read. I don't read for you." Quiz, teach the spider, own words. |
| 11 | Too expensive, more subscriptions | ✅ Free and open source. |
| 12 | Upload limits and file size caps | ✅ No cap (only your computer's memory). |
| 13 | Robotic text-to-speech voice | ✅ **Done 11-22:** voice picker per language in Settings, on-device voices first. |
| 14 | Too many animations distract students with ADHD | ✅ Reduce motion, Fast mode, Focus mode. |
| 15 | Hard to read for dyslexic students | ✅ **Done 11-22:** Lexend or Atkinson Hyperlegible font, 3 line spacings. |
| 16 | Flashcard apps need too much setup | ✅ Cards are made for you, plus Anki export. |
| 17 | No phone version | 🟠 Make it installable on a phone (PWA). |
| 18 | Progress is lost when you change computers | 🟠 Optional export and import of your study data (still no server). |
| 19 | Hard to install for non tech students | ✅ Double click launchers. 🟠 A public website is better (needs the repo public). |
| 20 | Tool does not cite the source in APA or MLA for a paper | ✅ **Done 11-22:** 📎 Cite button on every quote, APA 7 and MLA 9, copy in one click. |

## Part 2: 20 ideas students and teachers would like (what to build)

| # | The idea | Ankabut today |
|---|---|---|
| 1 | Ask a question about the book and get the answer with the page | 🟠 Search answers exist, a "question box" would be new. |
| 2 | Chapter by chapter study plan for the week before an exam | 🟢 Use the reading plan plus "Due today". |
| 3 | Practice quiz with real questions from the book | ✅ Quiz and Exam mode. |
| 4 | Spaced repetition reminders | ✅ "Due today" and day streak. |
| 5 | Glossary of all terms in the book | ✅ Glossary tab. |
| 6 | Mind map of the chapter | ✅ Mind map tab. |
| 7 | Compare two or more files (lecture slides vs textbook) | ✅ Library mode. ✅ "Ideas in both files" done. |
| 8 | Read aloud with the word highlighted at the same time | ✅ **Done 11-22:** each spoken word lights up in yellow. |
| 9 | Translate a hard word with one tap | ✅ Tap to translate in 4 languages. |
| 10 | Explain like I am 12 | ✅ "Explain this section simply". |
| 11 | Export notes to Notion, Anki, PDF | ✅ All three. |
| 12 | Study group mode: share key points with classmates | 🟠 Share a small file, no server. |
| 13 | Teacher mode: a professor prepares a reading guide for a chapter | 🟠 A "guide file" students open with the book. |
| 14 | Canvas or school LMS link | 🟠 Later, after the school agrees. |
| 15 | Timer and breaks (Pomodoro) for focus | 🟢 Small timer next to the spider. |
| 16 | Daily goal: "read 10 pages today" | 🟢 Add to Progress. |
| 17 | Lecture audio recording linked to the pages | ✅ Record lecture audio. 🟠 Link to pages. |
| 18 | Math and code blocks shown correctly | 🟠 Needs the page image view (problem 7). |
| 19 | Works offline on a plane or with bad Wi Fi | ✅ After the first install, reading is local. 🟢 Check that OCR works offline. |
| 20 | Accessibility report for the school (screen reader, keyboard) | 🟢 Keyboard shortcuts exist. Run an accessibility check and write a one page report. |

---

## Best next 5 to do (my pick)

1. 🟢 Dyslexia font and line spacing (problem 15). Fast, and it shows care for all students.
2. 🟢 Copy citation in APA and MLA (problem 20). Professors love this.
3. 🟢 Word by word highlight while reading aloud (idea 8).
4. 🟢 Better voice picker (problem 13).
5. 🟠 Page image view for diagrams and tables (problem 7). The biggest gap.

## For the meeting with the professor

Lead with these, because they answer what professors worry about:
- **Privacy:** nothing is uploaded (problems 8 and 9).
- **No cheating:** it quotes the book with pages, it does not write for you (problems 1 and 10).
- **Free and open source** (problem 11).
- **Four languages** for international students (problem 4).

## Sources

- [AI Hallucination from Students' Perspective (arXiv, 2026)](https://arxiv.org/html/2602.17671v1)
- [Not Wrong, But Untrue: LLM Overconfidence in Document-Based Queries (arXiv)](https://arxiv.org/pdf/2509.25498)
- [NotebookLM 2.0 review: citation accuracy](https://www.thecompleteai.com/posts/notebooklm-2-0-review-citation-accuracy-academic-research)
- [Med student complaints about NotebookLM (Indie Hackers)](https://www.indiehackers.com/post/my-friend-in-med-school-kept-complaining-about-notebooklm-so-i-built-the-fix-4da5c53aa1)
- [NotebookLM for research: a hands-on guide](https://www.alfredscholar.com/blog/notebooklm-for-research-a-hands-on-guide/)
- [NotebookLM lacks a crucial feature (Android Authority)](https://www.androidauthority.com/notebooklm-lacks-crucial-feature-3603778/)
- [NotebookLM and large PDFs](https://www.sourclip.com/blog/notebooklm-large-pdfs)
- [NotebookLM upload limits](https://elephas.app/blog/how-to-upload-more-files-notebooklm)
- [NotebookLM OCR review](https://www.pdnob.com/ocr/notebooklm-ocr.html)
- [NotebookLM for teachers](https://monsha.ai/blog/notebooklm-for-teachers)
- [Can NotebookLM support English language learners? (ResearchGate)](https://www.researchgate.net/publication/394210939_Can_NotebookLM_Support_English_Language_Learners_A_Theoretical_Perspective_on_AI_Tools_in_Education)
- [Best study apps 2026 (Lexie)](https://www.lexielearn.com/best-study-app)
- [Best text to speech apps for students](https://www.audeus.com/blog/best-text-to-speech-apps-for-students)
- [Texthelp: reading and writing difficulties](https://www.texthelp.com/en-gb/resources/dsa-learning-needs-guide/reading-and-writing-difficulties)
- [Reading tools for dyslexic students](https://web-highlights.com/blog/reading-tools-for-dyslexic-students/)
- [Dawson et al. 2019, assistive technology for dyslexia (UF)](https://education.ufl.edu/patterson/files/2021/01/DawsonAntonenkoLaneZhu2019.pdf)
- [Professors cite data privacy and cheating as top AI concerns (GovTech)](https://www.govtech.com/education/higher-ed/professors-cite-data-privacy-cheating-among-top-ai-concerns)
- [Yale: protecting course materials and AI](https://poorvucenter.yale.edu/teaching/teaching-resource-library/ai-guidance-for-teachers/ai-course-assignment-design/protecting)
- [Bard College: privacy and generative AI on campus](https://www.bard.edu/wwwmedia/files/7137089/3/Privacy%20considerations%20for%20Generative%20AI%20on%20Campus.pdf)

Note: many of these sources are blog posts from companies that sell study apps, so treat them as signals, not hard proof. The academic papers and university guides are the strongest sources.
