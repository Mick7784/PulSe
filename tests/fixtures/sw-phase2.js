// Snapshot of the service worker shipped at 9701756, for the upgrade regression.
'use strict';
const CACHE='pulse-public-v1.1.2';
const PUBLIC_SHELL=['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/offline.html'];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('pulse-shell-')||key.startsWith('pulse-public-'))&&key!==CACHE).map(key=>caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.search)return;
  if(event.request.mode==='navigate') {
    event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
    return;
  }
  if(!PUBLIC_SHELL.includes(url.pathname))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
