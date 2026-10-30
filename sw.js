'use strict';
// Bump for each application update so open clients can offer an explicit reload.
// No private application shell is cached.
const VERSION = 'pwa7-1';
const CACHE = 'pulse-public-' + VERSION;
const PUBLIC_ASSETS = new Map([
  ['/manifest.webmanifest', 'application/manifest+json'],
  ['/icon.svg', 'image/svg+xml'],
  ['/icon-192.png', 'image/png'],
  ['/icon-512.png', 'image/png'],
  ['/icon-maskable-192.png', 'image/png'],
  ['/icon-maskable-512.png', 'image/png'],
  ['/offline.html', 'text/html'],
  ['/offline.css', 'text/css']
]);

self.addEventListener('install', event => event.waitUntil((async () => {
  try {
    // Anonymous, fixed URLs only. Never cache a login redirect, an error or an API response.
    const assets = await Promise.all([...PUBLIC_ASSETS].map(async ([url, mime]) => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(new Request(url, {cache: 'reload', credentials: 'omit', redirect: 'error', signal: controller.signal}));
        if (response.status !== 200 || response.redirected ||
            response.headers.get('content-type')?.split(';')[0].trim() !== mime) {
          throw new Error('Installation asset unavailable');
        }
        // Drain each body now so simultaneous downloads cannot exhaust the connection pool.
        return [url, new Response(await response.arrayBuffer(), {headers: response.headers})];
      } finally {
        clearTimeout(timeout);
      }
    }));
    const cache = await caches.open(CACHE);
    await Promise.all(assets.map(([url, response]) => cache.put(url, response)));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
  // Updates stay waiting. Activation is requested only by an explicit action in the app.
})()));

self.addEventListener('message', event => {
  if (event.data?.type !== 'PULSE_ACTIVATE_UPDATE' || event.source?.type !== 'window') return;
  if (new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key =>
    (key.startsWith('pulse-shell-') || key.startsWith('pulse-public-')) && key !== CACHE
  ).map(key => caches.delete(key)));
  // Taking control never reloads a page; each page decides when it can safely reload.
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.search) return;
  if (event.request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html', {cacheName: CACHE})));
  } else if (PUBLIC_ASSETS.has(url.pathname)) {
    // Fetch fresh public metadata online; fallback is confined to this version's public assets.
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request, {cacheName: CACHE})));
  }
  // All API requests, application HTML/scripts, brand image and media remain network-only.
});
