// Ankabut service worker: makes the app open with no internet.
// Generated at build time from pwa/sw-template.js; do not edit dist/sw.js.
//
// - All app files are saved on install (the list comes from the build).
// - Pages: network first, so a new version arrives when online; saved copy offline.
// - App files and the OCR language files: saved copy first (they never change).
// - Never touches: the local AI (port 11434), uploads, anything that is not GET.
// - A new version waits until the student taps "Reload", so an open page never breaks.

const VERSION = '__VERSION__';
const CACHE = `ankabut-${VERSION}`;
const FILES = __FILES__;
const CDN = ['https://cdn.jsdelivr.net/', 'https://tessdata.projectnaptha.com/'];

function strategyFor(url, request) {
  if (request.method !== 'GET') return 'bypass';
  if (url.port === '11434') return 'bypass';
  if (url.origin === self.location.origin) return request.mode === 'navigate' ? 'network-first' : 'cache-first';
  if (CDN.some((c) => url.href.startsWith(c))) return 'cache-first';
  return 'bypass';
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ankabut-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

async function cacheFirst(request) {
  // ignoreVary: servers often send "Vary: Origin", and a module import asks with an Origin
  // header while the install step did not. File names are unique per version, so this is safe.
  const hit = await caches.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./', copy));
    }
    return res;
  } catch {
    return (await caches.match('./', { ignoreVary: true })) || (await caches.match('./index.html', { ignoreVary: true })) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const how = strategyFor(url, event.request);
  if (how === 'bypass') return;
  event.respondWith(how === 'network-first' ? networkFirst(event.request) : cacheFirst(event.request));
});
