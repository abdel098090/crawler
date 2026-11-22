import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { buildServiceWorker } from './pwa/build-sw';

/** Lists public/ files (icons, manifest) so the service worker saves them too. */
function publicFiles(dir = 'public', base = ''): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? publicFiles(join(dir, n), `${base}${n}/`) : [`${base}${n}`]));
}

/** Phone install: writes dist/sw.js with the exact list of built files. */
function serviceWorker(): Plugin {
  return {
    name: 'ankabut-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const names = [...Object.keys(bundle), ...publicFiles()];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: buildServiceWorker(readFileSync('pwa/sw-template.js', 'utf8'), names) });
    },
  };
}

// Vite builds the browser app. Vitest (the test runner) reads the "test" part.
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  plugins: [serviceWorker()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
