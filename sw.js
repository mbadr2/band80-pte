// Offline cache for the Band 80 phone app. Bump VERSION after every update so phones fetch the new files.
const VERSION = 'band80-v3';
const SHELL = ['./', './index.html', './app.js', './bank.js', './bank2.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // network first, cache as fallback, so updates arrive as soon as the phone is online
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (new URL(req.url).origin === location.origin || req.url.includes('fonts.g'))) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
