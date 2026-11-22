# Ankabut 🕷 · عنكبوت

**A spider that reads books with you.** English, French, Arabic and Spanish.

### ▶ Easy start on Windows or Mac: 3 steps, no typing

1. Install **Node.js** (free): go to **https://nodejs.org**, click the big **LTS** button, open the file and click **Next** until it's done.
2. Download Ankabut: on this GitHub page click the green **Code** button → **Download ZIP**, then unzip it (double-click the ZIP).
3. In the unzipped folder, double-click **`Start Ankabut (Windows).bat`** or **`Start Ankabut (Mac).command`**. Your browser opens Ankabut by itself.

Full guide with pictures of each warning: [English](#easy-start-no-typing) · [Français](#démarrage-facile-sans-rien-taper) · [العربية](#البدء-السهل-بدون-كتابة-أوامر)

Your files never leave your device. (An online version is planned for later.)

### 🧮 Math, science and photos: read this first

**Books with formulas (math, physics, chemistry, statistics):**
- A PDF does not keep formulas as text. **x² can show as x2**, ≠ can break, fractions can fall apart. The words around them are fine.
- Ankabut warns you with a **🧮 card**, marks those key points **"Formula"**, and never puts a broken formula in a quiz or flashcard.
- **Learn formulas from the real page:** press **📷 See the real page** (it has a 🔍 zoom for phones).
- **For one formula you need:** take a clear screenshot or photo of **just that area** and open it in Ankabut.
- Check numbers and signs (−, ±, ²) with your book or teacher before an exam.

**Photos of pages:**
- Crop to the **text**. Good light, phone held straight above the page.
- Text next to a diagram is read. Short labels inside the diagram (like "Router R1") are listed in **About this document**, not mixed into your sentences.
- Small OCR mistakes are possible: check important details on the original.

### 🤖 Local AI (optional): your own AI, on your own computer

Ankabut works fully **without** AI. If you want an AI to explain key points, you can connect **Ollama**, a free app that runs AI models **on your computer**. Your book never goes to the internet: Ankabut refuses any address that is not your own computer.

1. Install Ollama from **https://ollama.com/download** (Windows, Mac or Linux), open it.
2. Download one small model, once (about 2 GB). Open a terminal (Windows: PowerShell, Mac: Terminal) and type:
   ```
   ollama pull qwen2.5:3b
   ```
   It speaks English, French, Spanish and Arabic. A computer with 8 GB of memory is enough.
3. In Ankabut: **⚙ Settings → My local AI → Use my local AI**. You should see **✅ Connected**.
4. Each key point now has **🤖 Ask my AI**.

Good to know:
- The AI only gets the pages around the key point, and is told to answer from them and give the page.
- **AI answers can be wrong.** Each answer says which page to check.
- To stop using it, untick the box: every AI button disappears.
- Problems: "Ollama is not running" → open the Ollama app. "No model" → do step 2.

<details><summary>Français · العربية · Español</summary>

**Français :** un PDF ne garde pas les formules comme du texte (x² peut devenir x2). Ankabut affiche une carte 🧮, marque ces points « Formule » et ne les met jamais dans un quiz. Apprends les formules avec **📷 Voir la vraie page**. Pour une formule précise, fais une capture nette de cette zone seulement. Pour les photos : recadre sur le texte, bonne lumière, téléphone bien droit.

**العربية:** ملف PDF لا يحفظ المعادلات كنص (قد تظهر x² على شكل x2). يعرض عنكبوت بطاقة 🧮 ويعلّم هذه النقاط بكلمة «معادلة» ولا يضعها أبدا في الاختبارات. تعلّم المعادلات من زر **📷 اعرض الصفحة الحقيقية**. لمعادلة معينة، التقط صورة واضحة لتلك المنطقة فقط. للصور: قصّ الصورة على النص، إضاءة جيدة، والهاتف مستقيم فوق الصفحة.

**Español:** un PDF no guarda las fórmulas como texto (x² puede verse como x2). Ankabut muestra una tarjeta 🧮, marca esos puntos como «Fórmula» y nunca los pone en un cuestionario. Aprende las fórmulas con **📷 Ver la página real**. Para una fórmula concreta, haz una captura nítida solo de esa zona. Para fotos: recorta al texto, buena luz y el teléfono recto sobre la página.

</details>

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

### Easy start (no typing)

This is the simplest way. You never open a terminal. It works the same on Windows 10/11 and on any Mac.

**Step 1: install Node.js (only once).**
Node.js is the free engine that runs Ankabut on your computer. Go to **https://nodejs.org**, click the big
**LTS** button, open the downloaded file, and click **Next** (Windows) or **Continue** (Mac) until it says
it's finished. Keep all the default options.

**Step 2: download Ankabut.**
On the GitHub page of Ankabut, click the green **Code** button, then **Download ZIP**. Open your
**Downloads** folder and double-click the ZIP to unzip it. You get a folder called `crawler-main`. You can
move that folder anywhere, for example to your Desktop or Documents.

> The repository is private for now, so you must be signed in to GitHub with an account that was invited.

**Step 3: double-click the launcher.**

* **Windows:** double-click **`Start Ankabut (Windows).bat`**. If a blue box says *"Windows protected your PC"*,
  click **More info**, then **Run anyway**. This appears because the file is new, not because it's harmful.
* **Mac:** double-click **`Start Ankabut (Mac).command`**. The first time, macOS says it *"cannot be opened
  because it is from an unidentified developer"*. Click **Done**, then **right-click** the file (or
  Control-click), choose **Open**, and click **Open** again. You only do this once.

A black window (Windows) or a Terminal window (Mac) opens. **The very first time** it downloads what
Ankabut needs, which takes 1 to 3 minutes. Then your browser opens Ankabut by itself.

**Every next time:** just double-click the same launcher. It starts in a few seconds.

**To stop Ankabut:** close the black window or the Terminal window.

| What you see | What to do |
|---|---|
| "Node.js is not installed yet" and nodejs.org opens | Do step 1, then double-click the launcher again. |
| "Your Node.js is too old" | Install the **LTS** version from nodejs.org again, then retry. |
| "The download failed" | Check your internet and retry. On Windows, close other programs (antivirus can slow it). |
| The browser didn't open | Open your browser yourself and go to **http://localhost:5173** |
| Mac: "permission denied" | Open Terminal, type `chmod +x ` (with a space), drag the `.command` file into Terminal, press Enter. |

### Use it online (later)

An online version (nothing to install, works on phones) is planned for later. It needs the repository to be
public or a paid GitHub plan, see [Publishing the online version](#publishing-the-online-version). For now,
use the **Easy start** above.

### Setup and usage guide (with the terminal)

You only need this if you prefer the terminal, or want to run Ankabut on your own computer, change the code, or use the developer
version. You need **Node.js 22 LTS** (20.19 or newer also works) and **Git**.

> The repository is private for now, so `git clone` will ask you to sign in to GitHub. If you prefer, on the
> GitHub page click **Code → Download ZIP**, unzip it, and skip the clone step.

#### Windows (10 and 11)

1. **Install Node.js.** Go to https://nodejs.org, download the **LTS** "Windows Installer (.msi)", run it and
   keep the default options (they add Node to your PATH). Or, in a terminal: `winget install OpenJS.NodeJS.LTS`
2. **Install Git.** Download it from https://git-scm.com/download/win and keep the defaults, or run
   `winget install Git.Git`. Git for Windows includes a sign-in helper for GitHub.
3. **Open a new terminal** (Start menu, type `cmd` or `PowerShell`) and check:
   ```
   node -v
   npm -v
   ```
   `node -v` should print `v22.x` (or at least `v20.19`).
4. **Get the code and install:**
   ```
   git clone https://github.com/abdel098090/crawler.git
   cd crawler
   npm install
   ```
5. **Run it:** `npm run dev`
6. **Open it:** go to http://localhost:5173 in Edge, Chrome or Firefox. To stop it, press `Ctrl+C` in the
   terminal.

#### macOS (Intel and Apple Silicon)

1. **Install Node.js.** Download the **LTS** "macOS Installer (.pkg)" from https://nodejs.org and open it. If
   macOS says the installer "can't be opened" (Gatekeeper), open **System Settings → Privacy & Security**,
   scroll down and click **Open Anyway**, then confirm. With Homebrew you can run `brew install node`
   instead.
2. **Install Git.** Open **Terminal** (`Cmd+Space`, type Terminal) and run `git --version`. If Git is missing,
   macOS offers to install the **Command Line Developer Tools**. Click **Install** and wait.
3. **Get the code and install:**
   ```
   cd ~
   git clone https://github.com/abdel098090/crawler.git
   cd crawler
   npm install
   ```
   If Terminal asks for access to your Documents or Downloads folder, click **Allow** (or keep the project
   in your home folder as above, which needs no permission).
4. **Run it:** `npm run dev`, then open http://localhost:5173 in Safari, Chrome or Firefox. Stop with `Ctrl+C`.
   If macOS asks whether **node** may "accept incoming network connections", you can click **Deny**. That
   only matters for opening the app from another device.

#### Linux: Ubuntu and Debian

The `nodejs` package in Ubuntu and Debian is usually too old (Ubuntu 24.04 ships Node 18). Use the
NodeSource packages instead:

```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v        # should print v22.x

git clone https://github.com/abdel098090/crawler.git
cd crawler
npm install
npm run dev
```

Open http://localhost:5173 in Firefox or Chromium. Stop with `Ctrl+C`.

#### Linux: Kali

Kali Rolling usually has a recent Node. Try the normal packages first:

```bash
sudo apt update
sudo apt install -y nodejs npm git
node -v
```

If `node -v` prints something lower than `v20.19`, use the NodeSource commands from the Ubuntu and Debian
section above (Kali is based on Debian), or install Node with nvm (no `sudo` needed):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.zshrc      # Kali's default shell is zsh. With bash, use: source ~/.bashrc
nvm install 22
```

Then clone, install and run exactly as on Ubuntu. Firefox ESR, which comes with Kali, works fine.

#### Phones: Android and iPhone

> **Not available yet:** phones need the online version, which is planned for later.

Ankabut works on phones through the online version. You don't install anything from a store.

- **Android (Chrome):** open https://abdel098090.github.io/crawler/, tap the **⋮** menu, then
  **Add to Home screen** (or **Install app**), then **Install**. Ankabut gets its own icon and opens full screen.
- **iPhone and iPad (Safari):** open the same link in **Safari**, tap the **Share** button (the square with an
  arrow), scroll down, tap **Add to Home Screen**, then **Add**.

To open a book, tap **Choose files** and pick a PDF or Word file from your Files app, or tap **📷** to
photograph a page. Your file stays on the phone. On older phones, turn on **Reduce motion** in the header to
keep things smooth with big books.

**Testing on your phone while the app runs on your computer:** run `npm run dev -- --host`. The terminal
prints a "Network" address such as `http://192.168.1.20:5173`. Open it on a phone connected to the same Wi-Fi.

#### Common errors and how to fix them

**Windows**

| What you see | What to do |
|---|---|
| `'node' is not recognized` or `'npm' is not recognized` | Close the terminal and open a new one. If it still fails, run the Node installer again and keep "Add to PATH" ticked. |
| `npm.ps1 cannot be loaded because running scripts is disabled on this system` | That's a PowerShell rule. Use **Command Prompt** (`cmd`) instead, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| `EPERM` or a very slow `npm install` | Antivirus is scanning `node_modules`. Close VS Code and other editors, run `npm install` again, or exclude the project folder from real-time scanning. |
| A Windows Defender Firewall window | It appears only with `--host`. Allow **Private networks** if you want phone access, otherwise cancel. |
| `git clone` asks for a username and password | The repository is private. Choose "Sign in with your browser", or use **Download ZIP**. |

**macOS**

| What you see | What to do |
|---|---|
| "can't be opened because Apple cannot check it" | System Settings → Privacy & Security → **Open Anyway**. |
| `zsh: command not found: node` (Homebrew on Apple Silicon) | Run `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile`, then open a new Terminal. |
| `xcrun: error: invalid active developer path` | Run `xcode-select --install` and accept. |
| `EACCES: permission denied` | Never use `sudo npm install` inside the project. Fix the cache once with `sudo chown -R $(whoami) ~/.npm`. |

**Linux (Ubuntu, Debian, Kali)**

| What you see | What to do |
|---|---|
| `Vite requires Node.js version 20.19+ or 22.12+`, or `SyntaxError` during `npm run dev` | Your Node is too old. Install Node 22 with NodeSource or nvm (see above). |
| `ENOSPC: System limit for number of file watchers reached` | Run `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p` |
| `EACCES` errors | Don't run `npm install` with `sudo` inside the project. On Kali as root, it is fine to run as root, just don't mix root and normal-user installs in the same folder. |

**Every system**

| What you see | What to do |
|---|---|
| `Port 5173 is in use` | Something else uses that port. Run `npm run dev -- --port 5174` and open http://localhost:5174 |
| `npm ERR! code ENOENT ... package.json` | You are in the wrong folder. Run `cd crawler` first. |
| "This file is protected" when opening a book | That's the copyright protection working: the PDF has a password, or its author turned off copying. Ankabut won't read it, by design. |
| A scanned PDF shows "no text layer" | Open **About this document → Read scanned pages with OCR**. The first time needs internet to download the OCR engine. |
| On a phone, "Add to Home Screen" is missing | You are inside another app's browser (Instagram, WhatsApp, Gmail). Open the link in Safari or Chrome. |
| The page stays blank | Update your browser. Ankabut needs a recent Chrome, Edge, Firefox or Safari 16.4+. |

#### Using the app, in 6 steps

1. Drop a file on the page (or **Choose files**, or paste notes). Several files at once open Library mode.
2. Confirm that you own the file or have the right to use it. Nothing is uploaded.
3. Long books show a reading plan: read everything, a page range, or chosen chapters.
4. Watch the spider, or press **Skip to results** (`S`). Use `Space` to pause and `+`/`-` for speed.
5. Use the panels: **Tell the spider** on the left, **Keywords**, **Word Hunt**, **Study**, **Summary** on the right.
6. Export a study document, Anki cards, or Word Hunt results from the **Summary** and **Word Hunt** tabs.

The **⚙** button holds the theme (Dark lab while crawling, Dark lab, system, light, dark) and the spider style
(wireframe or classic cartoon). Press `?` for every keyboard shortcut.

#### Publishing the online version

These steps are for the repository owner. They are needed once.

1. Merge the work branch into `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/pages.yml` then builds and publishes the site on every push to `main`
   (or run it by hand from the **Actions** tab). The address is https://abdel098090.github.io/crawler/
4. Pages for a **private** repository needs a paid GitHub plan (Pro, Team or Enterprise), and even then the
   published site is public. On the free plan, the repository must be public to use Pages.

Every push is also built and tested on Windows, macOS and Linux by `.github/workflows/ci.yml`.

#### Developer commands

```bash
npm run dev:developer    # developer version: timings, extraction logs, the spider's route, fps
npm test                 # all unit tests
npm run build            # user version, in dist/
npm run build:developer  # developer version, in dist-developer/
npm run smoke            # after a build: opens the built app in a browser and reads sample PDFs
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

### Démarrage facile (sans rien taper)

C’est la façon la plus simple. Vous n’ouvrez jamais de terminal. Pareil sur Windows 10/11 et sur Mac.

**Étape 1 : installer Node.js (une seule fois).**
Node.js est le moteur gratuit qui fait tourner Ankabut sur votre ordinateur. Allez sur **https://nodejs.org**,
cliquez sur le gros bouton **LTS**, ouvrez le fichier téléchargé et cliquez sur **Suivant** (Windows) ou
**Continuer** (Mac) jusqu’à la fin. Gardez les options par défaut.

**Étape 2 : télécharger Ankabut.**
Sur la page GitHub d’Ankabut, cliquez sur le bouton vert **Code**, puis **Download ZIP**. Ouvrez le dossier
**Téléchargements** et double-cliquez sur le ZIP pour le décompresser. Vous obtenez un dossier `crawler-main`,
que vous pouvez déplacer où vous voulez (Bureau, Documents…).

> Le dépôt est privé pour l’instant : il faut être connecté à GitHub avec un compte invité.

**Étape 3 : double-cliquer sur le lanceur.**

* **Windows :** double-cliquez sur **`Start Ankabut (Windows).bat`**. Si une fenêtre bleue dit *« Windows a
  protégé votre ordinateur »*, cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.
  Elle apparaît parce que le fichier est nouveau, pas parce qu’il est dangereux.
* **Mac :** double-cliquez sur **`Start Ankabut (Mac).command`**. La première fois, macOS dit qu’il *« ne peut
  pas être ouvert car il provient d’un développeur non identifié »*. Cliquez sur **OK**, puis faites un
  **clic droit** sur le fichier, choisissez **Ouvrir**, puis encore **Ouvrir**. Une seule fois suffit.

Une fenêtre noire (Windows) ou Terminal (Mac) s’ouvre. **La toute première fois**, elle télécharge ce
dont Ankabut a besoin (1 à 3 minutes). Ensuite votre navigateur ouvre Ankabut tout seul.

**Les fois suivantes :** double-cliquez simplement sur le même lanceur.

**Pour arrêter Ankabut :** fermez la fenêtre noire ou la fenêtre Terminal.

| Ce que vous voyez | Que faire |
|---|---|
| « Node.js is not installed yet » et nodejs.org s’ouvre | Faites l’étape 1, puis relancez. |
| « Your Node.js is too old » | Réinstallez la version **LTS** depuis nodejs.org. |
| « The download failed » | Vérifiez internet et relancez. Sous Windows, fermez les autres programmes. |
| Le navigateur ne s’ouvre pas | Ouvrez-le vous-même et allez sur **http://localhost:5173** |

### Utiliser en ligne (plus tard)

Une version en ligne (rien à installer, marche sur téléphone) est prévue pour plus tard. En attendant,
utilisez le **Démarrage facile** ci-dessus.

### Guide d’installation et d’utilisation (avec le terminal)

Utile seulement pour lancer Ankabut sur votre ordinateur, modifier le code ou utiliser la version
développeur. Il faut **Node.js 22 LTS** (20.19 ou plus récent marche aussi) et **Git**.

> Le dépôt est privé pour l’instant : `git clone` vous demandera de vous connecter à GitHub. Sinon, sur la
> page GitHub, cliquez sur **Code → Download ZIP**, décompressez, et sautez l’étape du clone.

Les commandes du projet sont les mêmes partout :

```
git clone https://github.com/abdel098090/crawler.git
cd crawler
npm install
npm run dev
```

Ensuite, ouvrez http://localhost:5173 dans votre navigateur. Pour arrêter : `Ctrl+C` dans le terminal.

#### Windows (10 et 11)

1. **Node.js** : sur https://nodejs.org, téléchargez le « Windows Installer (.msi) » **LTS**, lancez-le et
   gardez les options par défaut. Ou dans un terminal : `winget install OpenJS.NodeJS.LTS`
2. **Git** : https://git-scm.com/download/win (options par défaut) ou `winget install Git.Git`.
3. Ouvrez un **nouveau** terminal (`cmd` ou PowerShell) et vérifiez `node -v` (au moins `v20.19`) et `npm -v`.
4. Lancez les commandes du projet ci-dessus, puis ouvrez http://localhost:5173 dans Edge, Chrome ou Firefox.

#### macOS (Intel et Apple Silicon)

1. **Node.js** : téléchargez l’« macOS Installer (.pkg) » **LTS** sur https://nodejs.org. Si macOS dit que
   l’installeur « ne peut pas être ouvert » (Gatekeeper), allez dans **Réglages Système → Confidentialité et
   sécurité** et cliquez sur **Ouvrir quand même**. Avec Homebrew : `brew install node`.
2. **Git** : dans le **Terminal**, tapez `git --version`. Si Git manque, macOS propose d’installer les **outils de
   ligne de commande** : cliquez sur **Installer**.
3. Faites `cd ~`, puis les commandes du projet. Si le Terminal demande l’accès à Documents ou Téléchargements,
   cliquez sur **Autoriser**. Si macOS demande si **node** peut « accepter les connexions entrantes », vous
   pouvez refuser.

#### Linux : Ubuntu et Debian

Le paquet `nodejs` d’Ubuntu et Debian est souvent trop ancien. Utilisez NodeSource :

```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

Puis les commandes du projet.

#### Linux : Kali

```bash
sudo apt update
sudo apt install -y nodejs npm git
node -v
```

Si la version est inférieure à `v20.19`, utilisez les commandes NodeSource ci-dessus (Kali est basé sur
Debian) ou nvm :

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.zshrc
nvm install 22
```

#### Téléphones : Android et iPhone

> **Pas encore disponible :** les téléphones ont besoin de la version en ligne, prévue pour plus tard.

- **Android (Chrome)** : ouvrez le lien de la version en ligne, menu **⋮** → **Ajouter à l’écran d’accueil**
  (ou **Installer l’application**) → **Installer**.
- **iPhone et iPad (Safari)** : ouvrez le lien dans **Safari**, bouton **Partager** (carré avec une flèche) →
  **Sur l’écran d’accueil** → **Ajouter**.

Pour ouvrir un livre, touchez **Choisir des fichiers** ou **📷** pour photographier une page. Le fichier reste
sur le téléphone. Sur un téléphone ancien, activez **Réduire les animations**.

Pour tester sur votre téléphone pendant que l’application tourne sur l’ordinateur : `npm run dev -- --host`,
puis ouvrez l’adresse « Network » affichée, sur le même Wi-Fi.

#### Erreurs fréquentes

| Système | Message | Solution |
|---|---|---|
| Windows | `'node' n’est pas reconnu` | Fermez et rouvrez le terminal. Sinon, relancez l’installeur Node. |
| Windows | `npm.ps1 ne peut pas être chargé` | Utilisez `cmd`, ou une fois : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Windows | `EPERM` ou installation très lente | L’antivirus analyse `node_modules`. Fermez les éditeurs et relancez `npm install`. |
| Windows | Fenêtre du pare-feu | Elle n’apparaît qu’avec `--host`. Autorisez « Réseaux privés » seulement pour l’accès téléphone. |
| macOS | « ne peut pas être ouvert » | Réglages Système → Confidentialité et sécurité → **Ouvrir quand même**. |
| macOS | `zsh: command not found: node` | Avec Homebrew : `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile`, puis nouveau Terminal. |
| macOS | `xcrun: error: invalid active developer path` | `xcode-select --install` |
| macOS, Linux | `EACCES: permission denied` | N’utilisez jamais `sudo npm install` dans le projet. macOS : `sudo chown -R $(whoami) ~/.npm` |
| Linux | `Vite requires Node.js version 20.19+` | Node trop ancien : installez Node 22 (NodeSource ou nvm). |
| Linux | `ENOSPC: System limit for number of file watchers reached` | `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p` |
| Tous | `Port 5173 is in use` | `npm run dev -- --port 5174` puis http://localhost:5174 |
| Tous | « Ce fichier est protégé » | C’est la protection du droit d’auteur : PDF avec mot de passe ou copie interdite. C’est voulu. |
| Téléphone | Pas d’« Ajouter à l’écran d’accueil » | Vous êtes dans le navigateur d’une autre app (Instagram, WhatsApp). Ouvrez le lien dans Safari ou Chrome. |
| Tous | Page blanche | Mettez à jour le navigateur (Chrome, Edge, Firefox récents ou Safari 16.4+). |

#### Utiliser l’application en 6 étapes

1. Déposez un fichier (ou **Choisir des fichiers**, ou collez des notes). Plusieurs fichiers ouvrent la Bibliothèque.
2. Confirmez que le fichier vous appartient ou que vous avez le droit de l’utiliser. Rien n’est envoyé.
3. Pour un long livre, choisissez le plan : tout lire, des pages, ou des chapitres.
4. Regardez l’araignée ou appuyez sur **Aller aux résultats** (`S`). `Espace` pour la pause, `+`/`-` pour la vitesse.
5. Utilisez les panneaux : **Dites à l’araignée** à gauche, **Mots-clés**, **Chasse aux mots**, **Étude**, **Résumé** à droite.
6. Exportez un document d’étude, des cartes Anki ou les résultats de la chasse.

Le bouton **⚙** contient le thème (Labo sombre pendant la lecture, Labo sombre, système, clair, sombre) et le
style de l’araignée (filaire ou dessin animé classique). Appuyez sur `?` pour voir tous les raccourcis.

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

### البدء السهل (بدون كتابة أوامر)

هذه أسهل طريقة، ولن تحتاج إلى فتح الطرفية أبداً. الخطوات نفسها على Windows 10/11 وعلى Mac.

**الخطوة 1: ثبّت Node.js (مرة واحدة فقط).**
Node.js هو المحرك المجاني الذي يشغّل عنكبوت على حاسوبك. ادخل إلى **https://nodejs.org** واضغط على الزر الكبير
**LTS**، ثم افتح الملف الذي نزل واضغط **Next** (في Windows) أو **Continue** (في Mac) حتى ينتهي التثبيت. اترك كل الخيارات كما هي.

**الخطوة 2: نزّل عنكبوت.**
في صفحة عنكبوت على GitHub اضغط على الزر الأخضر **Code** ثم **Download ZIP**. افتح مجلد **التنزيلات** واضغط مرتين على
ملف ZIP لفكّه. ستحصل على مجلد اسمه <code>crawler-main</code> ويمكنك نقله إلى أي مكان، مثل سطح المكتب.

> المستودع خاص حالياً، لذلك يجب أن تكون مسجلاً في GitHub بحساب تمت دعوته.

**الخطوة 3: اضغط مرتين على ملف التشغيل.**

* **Windows:** اضغط مرتين على <code>Start Ankabut (Windows).bat</code>. إذا ظهرت نافذة زرقاء تقول «Windows protected your PC»
  فاضغط **More info** ثم **Run anyway**. تظهر لأن الملف جديد، وليس لأنه ضار.
* **Mac:** اضغط مرتين على <code>Start Ankabut (Mac).command</code>. في المرة الأولى سيقول macOS إنه لا يمكن فتحه لأنه من
  مطوّر غير معروف. اضغط **Done**، ثم اضغط **بالزر الأيمن** على الملف واختر **Open** ثم **Open** مرة أخرى. تفعل هذا مرة واحدة فقط.

ستفتح نافذة سوداء (Windows) أو نافذة Terminal (Mac). **في المرة الأولى فقط** تنزّل ما يحتاجه عنكبوت، وهذا يأخذ من دقيقة
إلى 3 دقائق. بعدها يفتح المتصفح عنكبوت وحده.

**في المرات القادمة:** اضغط مرتين على ملف التشغيل نفسه فقط.

**لإيقاف عنكبوت:** أغلق النافذة السوداء أو نافذة Terminal.

| ماذا ترى | ماذا تفعل |
|---|---|
| «Node.js is not installed yet» ويفتح موقع nodejs.org | نفّذ الخطوة 1 ثم أعد التشغيل. |
| «Your Node.js is too old» | ثبّت نسخة **LTS** من nodejs.org من جديد. |
| «The download failed» | تأكد من الإنترنت وأعد المحاولة. |
| المتصفح لم يُفتح | افتحه بنفسك واذهب إلى **http://localhost:5173** |

### الاستخدام عبر الإنترنت (لاحقاً)

النسخة الإلكترونية (بدون تثبيت، وتعمل على الهاتف) مخطط لها لاحقاً. حالياً استخدم **البدء السهل** أعلاه.

### دليل التثبيت والاستخدام

تحتاج هذا الدليل فقط إذا أردت تشغيل عنكبوت على حاسوبك أو تعديل الشيفرة أو استخدام نسخة المطور. تحتاج إلى
**Node.js 22 LTS** (أو 20.19 وما بعدها) وإلى **Git**.

> المستودع خاص حاليا، لذلك سيطلب منك الأمر <code>git clone</code> تسجيل الدخول إلى GitHub. يمكنك بدلا من ذلك الضغط على
> **Code ← Download ZIP** في صفحة GitHub، ثم فك الضغط وتخطي خطوة النسخ.

أوامر المشروع نفسها على كل الأنظمة:

</div>

```
git clone https://github.com/abdel098090/crawler.git
cd crawler
npm install
npm run dev
```

<div dir="rtl">

بعد ذلك افتح <code>http://localhost:5173</code> في المتصفح. للإيقاف اضغط <code>Ctrl+C</code> في الطرفية.

#### ويندوز (10 و11)

١. **Node.js**: من الموقع nodejs.org نزّل «Windows Installer (.msi)» بنسخة **LTS**، وشغّله واترك الخيارات الافتراضية. أو اكتب في الطرفية: <code>winget install OpenJS.NodeJS.LTS</code>

٢. **Git**: من git-scm.com/download/win بالخيارات الافتراضية، أو <code>winget install Git.Git</code>

٣. افتح طرفية **جديدة** (<code>cmd</code> أو PowerShell) وتأكد من <code>node -v</code> (على الأقل v20.19) ومن <code>npm -v</code>

٤. نفّذ أوامر المشروع أعلاه، ثم افتح <code>http://localhost:5173</code> في Edge أو Chrome أو Firefox.

#### ماك (Intel وApple Silicon)

١. **Node.js**: نزّل «macOS Installer (.pkg)» بنسخة **LTS** من nodejs.org. إذا قال النظام إن المثبت «لا يمكن فتحه» (Gatekeeper)، افتح **إعدادات النظام ← الخصوصية والأمان** واضغط **فتح على أي حال**. أو مع Homebrew: <code>brew install node</code>

٢. **Git**: في **الطرفية (Terminal)** اكتب <code>git --version</code>. إذا لم يكن موجودا سيعرض النظام تثبيت **أدوات سطر الأوامر**، فاضغط **تثبيت**.

٣. اكتب <code>cd ~</code> ثم أوامر المشروع. إذا طلبت الطرفية الوصول إلى مجلد المستندات أو التنزيلات اضغط **سماح**. وإذا سأل النظام هل يسمح لـ node «بقبول الاتصالات الواردة» يمكنك الرفض.

#### لينكس: أوبونتو وديبيان

حزمة <code>nodejs</code> في أوبونتو وديبيان غالبا قديمة، لذلك استخدم NodeSource:

</div>

```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

<div dir="rtl">

ثم أوامر المشروع.

#### لينكس: كالي

</div>

```bash
sudo apt update
sudo apt install -y nodejs npm git
node -v
```

<div dir="rtl">

إذا كانت النسخة أقل من v20.19 فاستخدم أوامر NodeSource أعلاه (كالي مبنية على ديبيان) أو nvm:

</div>

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.zshrc
nvm install 22
```

<div dir="rtl">

#### الهواتف: أندرويد وآيفون

> **غير متاح حالياً:** الهواتف تحتاج إلى النسخة الإلكترونية، وهي مخطط لها لاحقاً.

- **أندرويد (Chrome)**: افتح رابط النسخة الإلكترونية، ثم القائمة **⋮** ← **إضافة إلى الشاشة الرئيسية** (أو **تثبيت التطبيق**) ← **تثبيت**.
- **آيفون وآيباد (Safari)**: افتح الرابط في **Safari**، ثم زر **المشاركة** (مربع مع سهم) ← **إضافة إلى الشاشة الرئيسية** ← **إضافة**.

لفتح كتاب اضغط **اختر ملفات** أو **📷** لتصوير صفحة. الملف يبقى على هاتفك. على الهواتف القديمة فعّل **تقليل الحركة**.

لتجربة التطبيق على هاتفك وهو يعمل على حاسوبك: شغّل <code>npm run dev -- --host</code> ثم افتح عنوان «Network» الظاهر من هاتف متصل بنفس شبكة الواي فاي.

#### أخطاء شائعة وحلولها

| النظام | ما تراه | الحل |
|---|---|---|
| ويندوز | <code>'node' is not recognized</code> | أغلق الطرفية وافتح واحدة جديدة، وإلا فأعد تشغيل مثبت Node. |
| ويندوز | <code>npm.ps1 cannot be loaded</code> | استخدم <code>cmd</code> أو نفّذ مرة واحدة: <code>Set-ExecutionPolicy -Scope CurrentUser RemoteSigned</code> |
| ويندوز | <code>EPERM</code> أو تثبيت بطيء جدا | برنامج الحماية يفحص <code>node_modules</code>. أغلق المحررات وأعد <code>npm install</code>. |
| ويندوز | نافذة جدار الحماية | تظهر فقط مع <code>--host</code>. اسمح بالشبكات الخاصة فقط إذا أردت الوصول من الهاتف. |
| ماك | «لا يمكن فتحه» | إعدادات النظام ← الخصوصية والأمان ← **فتح على أي حال**. |
| ماك | <code>zsh: command not found: node</code> | مع Homebrew نفّذ: <code>echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile</code> ثم افتح طرفية جديدة. |
| ماك | <code>xcrun: error: invalid active developer path</code> | <code>xcode-select --install</code> |
| ماك ولينكس | <code>EACCES: permission denied</code> | لا تستخدم <code>sudo npm install</code> داخل المشروع أبدا. على ماك: <code>sudo chown -R $(whoami) ~/.npm</code> |
| لينكس | <code>Vite requires Node.js version 20.19+</code> | نسخة Node قديمة: ثبّت Node 22 عبر NodeSource أو nvm. |
| لينكس | <code>ENOSPC: System limit for number of file watchers reached</code> | <code>echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p</code> |
| الكل | <code>Port 5173 is in use</code> | <code>npm run dev -- --port 5174</code> ثم افتح المنفذ 5174 |
| الكل | «هذا الملف محمي» | هذه حماية حقوق النشر تعمل: ملف PDF بكلمة مرور أو النسخ ممنوع. هذا مقصود. |
| الهاتف | لا يوجد «إضافة إلى الشاشة الرئيسية» | أنت داخل متصفح تطبيق آخر (إنستغرام، واتساب). افتح الرابط في Safari أو Chrome. |
| الكل | صفحة بيضاء | حدّث المتصفح (Chrome أو Edge أو Firefox حديث، أو Safari 16.4 وما بعده). |

#### استخدام التطبيق في 6 خطوات

١. أسقط ملفا في الصفحة (أو **اختر ملفات**، أو الصق ملاحظات). عدة ملفات تفتح وضع المكتبة.

٢. أكد أنك تملك الملف أو لديك الحق في استخدامه. لا يتم رفع أي شيء.

٣. للكتب الطويلة اختر الخطة: الكتاب كله، أو صفحات، أو فصول.

٤. شاهد العنكبوت أو اضغط **انتقل إلى النتائج** (<code>S</code>). <code>Space</code> للإيقاف المؤقت و<code>+</code> و<code>-</code> للسرعة.

٥. استخدم اللوحات: **اطلب من العنكبوت** على جانب، و**الكلمات المفتاحية** و**صيد الكلمات** و**دراسة** و**الملخص** على الجانب الآخر.

٦. صدّر وثيقة دراسة أو بطاقات Anki أو نتائج صيد الكلمات.

زر **⚙** فيه المظهر (المختبر الداكن أثناء الزحف، المختبر الداكن، النظام، فاتح، داكن) وشكل العنكبوت (هيكل سلكي أو كرتوني كلاسيكي). اضغط <code>?</code> لرؤية كل الاختصارات.

كل الميزات مجانية عند الإطلاق. الملف <code>src/core/flags.ts</code> يحدد لكل ميزة هل هي مجانية أم قد تصبح مميزة لاحقا
(وتظهر بعلامة ✦ في التطبيق).

> أساعدك على القراءة، ولا أقرأ بدلا منك.

</div>
