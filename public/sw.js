// Production Service Worker: Caching for static assets and API responses

const CACHE_NAME = 'mainproject-cache-v2';
const IMAGE_CACHE = 'mainproject-img-cache-v1';
const FONT_CACHE = 'mainproject-font-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
  // Add more static assets as needed
];
const OFFLINE_FALLBACK = '/offline.html';
const MAX_IMAGE_ENTRIES = 60;


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([...STATIC_ASSETS, OFFLINE_FALLBACK]))
  );
  self.skipWaiting();
});


self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => ![CACHE_NAME, IMAGE_CACHE, FONT_CACHE].includes(key))
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});


self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isImage = /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i.test(url.pathname);
  const isFont = /\.(woff2?|ttf|otf|eot)$/i.test(url.pathname);

  // API requests: network first, fallback to cache
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images: stale-while-revalidate, limit cache size
  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const fetchAndCache = fetch(request)
          .then(response => {
            if (response.status === 200) {
              cache.put(request, response.clone());
              limitCacheEntries(cache, MAX_IMAGE_ENTRIES);
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchAndCache;
      })
    );
    return;
  }

  // Fonts: stale-while-revalidate
  if (isFont) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const fetchAndCache = fetch(request)
          .then(response => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchAndCache;
      })
    );
    return;
  }

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_FALLBACK);
        }
      })
    )
  );
});

// Helper: Limit cache entries for images
async function limitCacheEntries(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}