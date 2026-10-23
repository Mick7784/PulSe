'use strict';
const CACHE='pulse-shell-v1-20261023-bridge1';
const SHELL=['/','/index.html','/app.js','/style.css','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
// Do not cache private JSON, photos, tracked URLs or analytics.
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==self.location.origin||!SHELL.includes(u.pathname))return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
