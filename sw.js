'use strict';
const CACHE='pulse-shell-v1.1.1';
const SHELL=['/','/index.html','/app.js','/pwa.mjs','/style.css','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pulse-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
// Private data, links and media are never cached. Only the application shell.
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==self.location.origin||u.search||!SHELL.includes(u.pathname))return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
