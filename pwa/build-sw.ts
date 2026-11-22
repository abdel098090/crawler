// Turns pwa/sw-template.js into dist/sw.js with the exact list of files to save.
import { createHash } from 'node:crypto';

/** Files the phone saves for offline use: every built file except source maps and the worker itself. */
export function offlineFiles(names: string[]): string[] {
  const keep = names.filter((n) => !n.endsWith('.map') && n !== 'sw.js' && !n.startsWith('.'));
  return ['./', ...keep.map((n) => `./${n}`)].filter((v, i, a) => a.indexOf(v) === i).sort();
}

export function buildServiceWorker(template: string, names: string[]): string {
  const files = offlineFiles(names);
  // The version changes whenever any file name (hashed by Vite) changes.
  const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
  return template.replace("'__VERSION__'", JSON.stringify(version)).replace('__FILES__', JSON.stringify(files, null, 2));
}
