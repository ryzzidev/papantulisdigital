const CACHE_NAME = 'papan-tulis-digital-v1';
const urlsToCache = [
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://files.catbox.moe/2ovfx4.png'
];

// Install Service Worker dan Cache File
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Aktivasi dan Bersihkan Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Ambil Sumber Daya (Fetch) secara Offline-First
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Fallback opsional jika offline total dan file tidak ada di cache
      });
    })
  );
});