// Developer script: opens the app in Chromium, loads a sample file, and takes screenshots.
// Usage: start `npm run dev`, then: node scripts/smoke.mjs [file] [outDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const file = process.argv[2] ?? 'tests/fixtures/sample-ar.pdf';
const out = process.argv[3] ?? '.';
const url = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.setInputFiles('input[type=file]', file);
// Consent dialog (user version)
const box = page.locator('#consent-box');
if (await box.count()) {
  await box.check();
  await page.getByRole('button', { name: /Start reading|Commencer|ابدأ/ }).click();
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/walk.png` });
await page.keyboard.press('s');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/done.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
