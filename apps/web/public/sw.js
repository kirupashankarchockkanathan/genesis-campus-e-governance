// Minimal service worker: makes the portal installable and keeps the app shell available offline.
// API calls and uploads are never cached, so people always see current data and nothing private is stored.
const CACHE = 'ccp-shell-v1';
const SHELL = ['/', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (
    e.request.method !== 'GET' ||
    url.origin !== location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/uploads/')
  )
    return;
  // Pages: network first, fall back to the cached shell when offline. Static assets: cache first.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ??
        fetch(e.request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        }),
    ),
  );
});
