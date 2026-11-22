// "Does it really run?" check, used on Windows, macOS and Linux in CI.
// 1. serves the built app (dist/) with Vite's preview server, from Node itself
//    (no shell commands, so it behaves the same on every system);
// 2. opens it in headless Chromium, loads a sample PDF in each language,
//    accepts the consent question, and waits for real key points;
// 3. checks that a protected PDF is still refused;
// 4. fails on any page error.
// Run after `npm run build`. Needs the `playwright` package and its Chromium.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const fixture = (name) => fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url));

const server = await preview({ preview: { port: 4173, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' });
const url = 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
let failed = false;
try {
  for (const file of ['sample-en.pdf', 'sample-fr.pdf', 'sample-ar.pdf']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url);
    await page.setInputFiles('input[type=file]', fixture(file));
    await page.locator('#consent-box').check();
    await page.locator('.modal .btn.primary').click();
    await page.keyboard.press('s');
    await page.waitForFunction(() => document.querySelectorAll('aside.left .kp').length > 0, null, { timeout: 60000 });
    const points = await page.locator('aside.left .kp').count();
    console.log(`${file}: ${points} key points, ${errors.length} page errors`);
    if (errors.length) {
      console.error(errors);
      failed = true;
    }
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(url);
  await page.setInputFiles('input[type=file]', fixture('sample-password.pdf'));
  await page.locator('#consent-box').check();
  await page.locator('.modal .btn.primary').click();
  const msg = await page.locator('.modal').innerText({ timeout: 30000 });
  if (!/password protected/i.test(msg)) {
    console.error('Protected PDF was not refused!');
    failed = true;
  } else console.log('sample-password.pdf: refused, as it should be');
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(failed ? 1 : 0);
