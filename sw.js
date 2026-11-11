// Service worker: la app abre sin internet con lo último descargado.
// La página se pide primero a la red (para ver siempre la versión nueva) y si no hay red se usa la copia.
const CACHE = 'catalogo-equipos-v1';
const BASE = ['./', 'index.html', 'logo.png', 'icon-192.png', 'icon-512.png', 'manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.includes('script.google')) return;                 // datos: siempre en línea
  const libreria = /cdnjs|jsdelivr|fonts\.(googleapis|gstatic)/.test(u.hostname);
  if (u.origin === location.origin || libreria) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
  }
});
