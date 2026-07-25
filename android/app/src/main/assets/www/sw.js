/* RunArena service worker — app-shell cache + runtime caching for offline use. */
// Keep this version in sync with src/version.js (VERSION). A changed cache name
// is what triggers the in-app "new version available" update prompt.
const CACHE = 'runarena-1.5.0';

// Core shell precached on install. Other same-origin modules and CDN assets are
// cached at runtime the first time they're requested.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './src/styles.css',
  './src/main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

self.addEventListener('install', (e) => {
  // Precache, then WAIT — the page shows an "update available" prompt and only
  // activates the new version when the user taps refresh (see the message
  // handler below). This avoids swapping code out from under an open session.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

// The page asks the waiting worker to take over when the user accepts the update.
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(res) {
  return res && res.status === 200 && (res.type === 'basic' || res.type === 'cors');
}

// Our own app code (HTML + JS) is served NETWORK-FIRST so an online user always
// runs the latest version — cache is only a fallback (offline). This prevents
// the "stuck on a stale/broken cached build" problem. Everything else (CSS,
// icons, CDN libs, map tiles, fonts) stays cache-first for speed/offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isAppCode = sameOrigin && (req.mode === 'navigate' || url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/'));

  if (isAppCode) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        fetch(req)
          .then((res) => { if (cacheable(res)) cache.put(req, res.clone()); return res; })
          .catch(() => cache.match(req).then((c) => c || cache.match('./index.html')))
      )
    );
    return;
  }

  // cache-first + background revalidate for everything else
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => { if (cacheable(res)) cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
