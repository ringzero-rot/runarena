/* RunArena service worker — app-shell cache + runtime caching for offline use. */
// Keep this version in sync with src/version.js (VERSION). A changed cache name
// is what triggers the in-app "new version available" update prompt.
const CACHE = 'runarena-1.0.0';

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

// Cache-first with background refresh (stale-while-revalidate) for GET requests.
// Map tiles and fonts get cached on first use so a previously viewed area works
// offline. Non-GET and cross-scheme requests pass straight through.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
