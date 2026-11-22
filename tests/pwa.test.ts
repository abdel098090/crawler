import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildServiceWorker, offlineFiles } from '../pwa/build-sw';

const template = readFileSync('pwa/sw-template.js', 'utf8');
const names = ['index.html', 'assets/index-abc.js', 'assets/index-abc.js.map', 'assets/pdf.worker-x.mjs', 'icon-192.png', 'manifest.webmanifest', 'sw.js'];

describe('phone install (service worker)', () => {
  it('saves every app file, but not source maps or itself', () => {
    expect(offlineFiles(names)).toEqual(['./', './assets/index-abc.js', './assets/pdf.worker-x.mjs', './icon-192.png', './index.html', './manifest.webmanifest']);
  });

  it('fills in the list and a version, leaving no placeholder', () => {
    const sw = buildServiceWorker(template, names);
    expect(sw).not.toMatch(/__FILES__|__VERSION__/);
    expect(sw).toContain('"./assets/index-abc.js"');
  });

  it('a new build gets a new version, the same build the same one', () => {
    const v = (s: string) => /const VERSION = "([0-9a-f]+)"/.exec(s)![1];
    expect(v(buildServiceWorker(template, names))).toBe(v(buildServiceWorker(template, names)));
    expect(v(buildServiceWorker(template, [...names, 'assets/new-1.js']))).not.toBe(v(buildServiceWorker(template, names)));
  });

  it('never caches the local AI or uploads', () => {
    const sw = buildServiceWorker(template, names);
    const strategyFor = new Function('self', `${/function strategyFor[\s\S]*?\n}\n/.exec(sw)![0]}; const CDN = ${/const CDN = (\[.*\]);/.exec(sw)![1]}; return strategyFor;`)({ location: { origin: 'https://ankabut.app' } });
    const req = (method: string, mode = 'cors') => ({ method, mode });
    expect(strategyFor(new URL('http://localhost:11434/api/chat'), req('POST'))).toBe('bypass');
    expect(strategyFor(new URL('http://localhost:11434/api/tags'), req('GET'))).toBe('bypass');
    expect(strategyFor(new URL('https://ankabut.app/'), req('GET', 'navigate'))).toBe('network-first');
    expect(strategyFor(new URL('https://ankabut.app/assets/a.js'), req('GET'))).toBe('cache-first');
    expect(strategyFor(new URL('https://tessdata.projectnaptha.com/4.0.0/ara.traineddata.gz'), req('GET'))).toBe('cache-first');
    expect(strategyFor(new URL('https://evil.example/x.js'), req('GET'))).toBe('bypass');
  });
});

describe('offline lookups', () => {
  it('ignore "Vary: Origin", or module files fail offline (real bug found 2026-11-22)', () => {
    const sw = readFileSync('pwa/sw-template.js', 'utf8');
    const lookups = sw.match(/caches\.match\([^)]*\)/g) ?? [];
    expect(lookups.length).toBeGreaterThan(0);
    for (const l of lookups) expect(l).toContain('ignoreVary: true');
  });
});
