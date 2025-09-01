const CACHE_NAME = 'presensi-shell-v1';
const OFFLINE_URL = './index.html';

const ASSETS_TO_CACHE = [
  './index.html',
  './karyawan.html',
  './admin.html',
  './karyawan.js',
  './admin.js',
  './manifest.webmanifest',
  // Jika ada file CSS eksternal kecil, bisa ditambahkan di sini
];

// Install: precache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: bersihkan cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: coba cache dulu, lalu network, fallback ke offline
self.addEventListener('fetch', event => {
  const request = event.request;
  // hanya GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then(networkResponse => {
          // simpan di cache dinamis
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // fallback ke shell jika HTML
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});