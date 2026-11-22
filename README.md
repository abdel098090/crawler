# Ankabut 🕷 · عنكبوت

**A trilingual spider that reads books with you.** Arabic, French and English.

> I help you read. I don't read for you.

Inspired by the idea of lulu38m/spider-crawler.

[English](#english) · [Français](#français) · [العربية](#العربية)

---

## English

### What it is

You drop in a book (PDF, Word, text, Markdown, a photo of a page, or notes you paste). A small animated
spider walks across the real pages, scrolls by itself, highlights the key sentences and flings the
keywords into a side panel. When it finishes, it explains the topic in a few simple lines and offers you a
quick check. It feels like a small game, but the point is learning: quizzes, flashcards that come back
before you forget them, and explaining the topic back to the spider.

Everything runs in your browser. **Your files never leave your device.**

### Main features

- **Arabic first.** Full right-to-left layout. Arabic letters are joined properly, the spider walks Arabic
  lines from right to left, and Arabic that comes out of a PDF reversed is fixed automatically. If it comes
  out scrambled, Ankabut switches to OCR.
- **Three languages** for the interface, keywords and summaries, with automatic detection and support for
  mixed documents.
- **Key points you can trust.** Every key point is a real sentence from a real page, with a link that walks
  the spider to it. Key points are spread across the whole book (no "missing middle"), and a coverage bar
  always says how many pages were read and which were skipped, and why.
- **Smart chunking.** Long books are split by chapter (or into blocks of 15 to 20 pages). You can accept the
  plan, pick a page range, or pick chapters.
- **Command panel.** Type "Take the key points from 10 to 20", "Explain this section simply" or
  "Find every 'cloud'", in English, French or Arabic.
- **Word Hunt.** List words, and the spider hunts every match with a live score. Export CSV or Markdown.
- **Study mode.** Flashcards with spaced repetition, adaptive quizzes, exam mode, speed round, "in your own
  words", "use it" tasks, and "explain it to the spider" (the Feynman technique).
- **Library mode.** Several files at once, with one combined keyword list and one combined Word Hunt.
- **Also:** glossary hunter, translate on tap, mind map, read aloud, vertical video export for
  TikTok/Reels/Shorts, progress and streaks, study document export (Markdown, PDF, Anki, Notion), fast mode,
  focus mode, reduced motion, keyboard controls and adjustable text size.

### Respecting authors and copyright

People spend years writing books. Ankabut must never become a tool for copying them.

1. It never opens DRM-protected or password-protected files and never tries to get around protection.
2. It reads the PDF permission flags. If the author turned off copying, it says so politely and stops.
3. It never exports the full text. Exports hold key points as short quotes (one or two sentences, each with a
   page number), counts, and your own notes. A guard checks every export.
4. Before reading, you confirm that you own the file or have the right to use it for personal study.

Rules 1 to 3 are always on, in every version. No software can reliably tell whether a book is under
copyright (almost all recent writing is), so these rules are the realistic, honest protection.

### Why there is no "AI-writing detector"

Ankabut does not label text as written by AI, on purpose. These detectors are unreliable, and they often
wrongly flag people writing in their second or third language, which is exactly who this tool is for. A
false accusation can do real harm to a student. Instead, the "About this document" tab shows the document's
own metadata when it exists: author, publisher, title and date.

### Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev              # user version, open the address it prints
npm run dev:developer    # developer version
npm test                 # all tests
npm run build            # user version build in dist/
npm run build:developer  # developer version build in dist-developer/
```

### Two versions

- **User version:** the normal app with every copyright rule on.
- **Developer version:** for testing with your own sample files. It shows timings, extraction logs and the
  spider's planned route on the page. Files whose names start with `sample-` skip the consent question.
  Copyright rules 1 to 3 stay on here too.

### Free now, premium later

Everything is free at launch. `src/core/flags.ts` is the single place that marks each feature as free or
premium, so a subscription can be added later without a rewrite. Features marked ✦ in the app may become
premium: Library mode, Exam mode, Read aloud, Video export and very large books. Reading, key points,
Word Hunt and basic flashcards stay free. There are no payments in the code.

### Honest limits

- Summaries are extractive: the spider picks real sentences, it does not write new ones. Its own short
  explanations only use the book's keywords and are always labelled "Spider's explanation".
- Pages are shown as clean re-flowed text, not as the original PDF picture.
- OCR and the on-device translator download their engines the first time (never your file).
- Translate on tap uses a small offline dictionary when the browser has no built-in translator.

### Project map

```
src/core       copyright rules, feature flags, shared types
src/loaders    PDF, Word, text, Markdown, OCR
src/text       Arabic normalization and stemming, languages, stopwords, sentences
src/analysis   keywords, TextRank summary, chunking, explanations, glossary, trust checks
src/hunt       search and Word Hunt
src/study      quizzes, flashcards, spaced repetition, feedback, progress
src/export     study document, Anki, Word Hunt CSV and Markdown
src/render     the canvas, page layout, the spider, its route, the mind map
src/worker     the Web Worker that does heavy analysis off the main thread
src/ui         the interface, one file per feature
tests          unit tests with real English, French, Arabic and mixed PDFs
```

The full build story, with every decision, is in [PROGRESS.md](PROGRESS.md).

---

## Français

### Qu’est-ce que c’est ?

Vous déposez un livre (PDF, Word, texte, Markdown, photo d’une page ou notes collées). Une petite araignée
animée parcourt les vraies pages, défile toute seule, surligne les phrases clés et lance les mots-clés dans
un panneau latéral. À la fin, elle explique le sujet en quelques lignes simples et vous propose une
vérification rapide. On dirait un petit jeu, mais le but est d’apprendre : quiz, cartes mémoire qui
reviennent avant l’oubli, et explication du sujet à l’araignée.

Tout fonctionne dans votre navigateur. **Vos fichiers ne quittent jamais votre appareil.**

### Fonctions principales

- **L’arabe d’abord** : mise en page de droite à gauche, lettres bien liées, correction automatique de l’arabe
  inversé venant des PDF, et OCR si le texte est illisible.
- **Trois langues** pour l’interface, les mots-clés et les résumés, avec détection automatique et documents
  mixtes.
- **Des points clés fiables** : chaque point est une vraie phrase d’une vraie page, répartie sur tout le livre,
  avec une barre de couverture qui dit toujours ce qui a été lu ou ignoré.
- **Découpage intelligent** des longs livres par chapitre ou par blocs de 15 à 20 pages.
- **Panneau de commandes**, **Chasse aux mots**, **mode Étude**, **mode Bibliothèque**, glossaire, traduction
  au toucher, carte mentale, lecture à voix haute, export vidéo vertical, progrès et séries, exports
  (Markdown, PDF, Anki, Notion).

### Respect des auteurs et du droit d’auteur

1. Jamais de fichiers protégés par DRM ou par mot de passe, et aucun contournement.
2. Les autorisations du PDF sont respectées : si la copie est interdite, l’araignée ne lit pas.
3. Jamais d’export du texte complet : seulement des points clés en citations courtes (une ou deux phrases avec
   la page), des nombres et vos notes.
4. Avant la lecture, vous confirmez que le fichier vous appartient ou que vous avez le droit de l’utiliser.

Les règles 1 à 3 restent actives dans toutes les versions.

### Pourquoi pas de « détecteur d’IA » ?

Ces détecteurs se trompent souvent et accusent à tort les personnes qui écrivent dans une deuxième ou
troisième langue, c’est-à-dire notre public. Ankabut affiche plutôt les métadonnées du document : auteur,
éditeur, titre et date.

### Lancer le projet

```bash
npm install
npm run dev            # version utilisateur
npm run dev:developer  # version développeur (journaux, temps, trajet de l’araignée)
npm test
```

Tout est gratuit au lancement. `src/core/flags.ts` indique pour chaque fonction si elle est gratuite ou
premium plus tard (✦ dans l’application).

---

<div dir="rtl">

## العربية

### ما هو عنكبوت؟

تضع كتابا (PDF أو Word أو نصا أو Markdown أو صورة صفحة أو ملاحظات تلصقها)، فيمشي عنكبوت صغير متحرك على الصفحات
الحقيقية، وينزل وحده عبر المستند، ويظلل الجمل المهمة، ويرمي الكلمات المفتاحية إلى لوحة جانبية. وفي النهاية يشرح
الموضوع ببضعة أسطر بسيطة ويقترح عليك تحققا سريعا. التجربة تشبه لعبة صغيرة، لكن الهدف هو التعلم: اختبارات، وبطاقات
تعود قبل أن تنساها، وأن تشرح الموضوع للعنكبوت بنفسك.

كل شيء يعمل داخل متصفحك. **ملفاتك لا تغادر جهازك أبدا.**

### أهم الميزات

- **العربية أولا**: اتجاه كامل من اليمين إلى اليسار، وحروف متصلة بشكل صحيح، ويمشي العنكبوت على السطر العربي من
  اليمين إلى اليسار. النص العربي المقلوب القادم من ملفات PDF يصحح تلقائيا، وإذا كان مبعثرا ينتقل البرنامج إلى
  التعرف الضوئي على الحروف.
- **ثلاث لغات** للواجهة والكلمات المفتاحية والملخص، مع اكتشاف تلقائي للغة ودعم المستندات المختلطة.
- **نقاط رئيسية موثوقة**: كل نقطة جملة حقيقية من صفحة حقيقية، موزعة على الكتاب كله، وشريط التغطية يخبرك دائما بما
  قرئ وما تم تخطيه ولماذا.
- **تقسيم ذكي** للكتب الطويلة حسب الفصول أو إلى أجزاء من 15 إلى 20 صفحة.
- **لوحة الأوامر**، و**صيد الكلمات**، و**وضع الدراسة**، و**وضع المكتبة**، والمصطلحات، والترجمة بلمسة، والخريطة
  الذهنية، والقراءة بصوت عال، وتصدير فيديو عمودي، والتقدم والأيام المتتالية، والتصدير إلى Markdown وPDF وAnki
  وNotion.

### احترام المؤلفين وحقوق النشر

١. لا يفتح البرنامج أبدا الملفات المحمية بإدارة الحقوق الرقمية أو بكلمة مرور، ولا يحاول تجاوز أي حماية.

٢. يحترم أذونات ملف PDF: إذا منع المؤلف النسخ فلن يقرأ العنكبوت الملف.

٣. لا يصدر النص الكامل أبدا: فقط نقاط رئيسية في اقتباسات قصيرة (جملة أو جملتان مع رقم الصفحة)، وأعداد، وملاحظاتك.

٤. قبل القراءة تؤكد أنك تملك الملف أو لديك الحق في استخدامه للدراسة الشخصية.

القواعد من ١ إلى ٣ مفعلة دائما في كل النسخ.

### لماذا لا يوجد «كاشف للكتابة بالذكاء الاصطناعي»؟

هذه الكاشفات غير موثوقة، وكثيرا ما تتهم خطأ من يكتبون بلغتهم الثانية أو الثالثة، وهم جمهورنا بالضبط. لذلك يعرض
عنكبوت بدلا منها بيانات المستند نفسه عند وجودها: المؤلف والناشر والعنوان والتاريخ.

### التشغيل

</div>

```bash
npm install
npm run dev            # نسخة المستخدم
npm run dev:developer  # نسخة المطور
npm test
```

<div dir="rtl">

كل الميزات مجانية عند الإطلاق. الملف <code>src/core/flags.ts</code> يحدد لكل ميزة هل هي مجانية أم قد تصبح مميزة لاحقا
(وتظهر بعلامة ✦ في التطبيق).

> أساعدك على القراءة، ولا أقرأ بدلا منك.

</div>
