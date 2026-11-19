// Service worker: la app abre y se usa sin internet con lo último descargado.
// La página se pide primero a la red (para ver siempre la versión nueva) y si no hay red se usa la copia.
// Los cambios hechos sin conexión NO pasan por aquí: los guarda la cola de la app y se suben solos.
const CACHE = 'catalogo-equipos-v3';
const FOTOS = 'catalogo-fotos-v1';
const BASE = ['./', 'index.html', 'logo.png', 'icon-192.png', 'icon-512.png', 'manifest.json', '../MDE-MT/config.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FOTOS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.includes('script.google')) return;                 // datos: siempre en línea (la app guarda su copia)

  // Fotos de Drive: la guardada al instante y se actualiza por detrás (así se ven sin señal)
  if (u.hostname === 'drive.google.com' && u.pathname.startsWith('/thumbnail') || u.hostname.endsWith('googleusercontent.com')) {
    e.respondWith(caches.open(FOTOS).then(async c => {
      const g = await c.match(r);
      const red = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }).catch(() => g);
      return g || red;
    }));
    return;
  }

  const libreria = /cdnjs|jsdelivr|fonts\.(googleapis|gstatic)/.test(u.hostname);
  if (u.origin === location.origin || libreria) {
    e.respondWith(fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
  }
});
