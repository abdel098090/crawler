// Developer script: builds the sample PDFs used by the tests.
// Run with: node scripts/make-pdf-fixtures.mjs   (needs Playwright + Chromium)
// The files are named "sample-..." because they are the developer's own samples.
import { createRequire } from 'node:module';
// Playwright is pre-installed globally in this environment, so we load it with require().
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const texts = JSON.parse(readFileSync(new URL('./fixture-texts.json', import.meta.url), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function html(lang, chapters, title, author) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const body = chapters
    .map(([h, p]) => `<section style="page-break-after:always"><h1>${esc(h)}</h1><p>${esc(p)}</p><p>${esc(p)}</p></section>`)
    .join('');
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <meta name="author" content="${esc(author)}">
  <style>body{font-family:'DejaVu Sans';font-size:14px;line-height:1.6;margin:40px}</style></head><body>${body}</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function make(file, markup) {
  await page.setContent(markup, { waitUntil: 'load' });
  await page.pdf({ path: `tests/fixtures/${file}`, format: 'A5' });
  console.log('wrote', file);
}
for (const lang of ['en', 'fr', 'ar']) {
  const t = texts[lang];
  await make(`sample-${lang}.pdf`, html(lang, t.chapters, t.title, t.author));
}
// Mixed: an Arabic chapter, then English, then French.
await make(
  'sample-mixed.pdf',
  html('en', [texts.ar.chapters[0], texts.en.chapters[1], texts.fr.chapters[1]], 'Mixed', 'Ankabut'),
);
// Scanned-like page: only an image, no text layer.
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 300, height: 200 } });
await make(
  'sample-scanned.pdf',
  `<!doctype html><html><body><img style="width:300px" src="data:image/png;base64,${png.toString('base64')}"></body></html>`,
);
await browser.close();
