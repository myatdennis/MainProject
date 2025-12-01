// Production Service Worker: Caching for static assets and API responses

const CACHE_NAME = 'mainproject-cache-v3';
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
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Try to add all static assets; avoid install failure if fallback is missing
      try {
        await cache.addAll([...STATIC_ASSETS, OFFLINE_FALLBACK]);
      } catch (err) {
        // If the offline fallback isn't present, still continue install and cache the rest
        // Avoid failing the install so old SW doesn't remain active and return stale content
        console.warn('[SW] Warning: failed to cache some assets during install:', err);
        try {
          await cache.addAll(STATIC_ASSETS);
        } catch (inner) {
          console.error('[SW] Failed to cache static assets during install:', inner);
        }
      }
    } catch (e) {
      console.error('[SW] Install error:', e);
    }
  })());
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

  // Bypass API and WebSocket-like endpoints so service worker doesn't interfere with auth, cookies, and preflight requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    return;
  }

  // Images: stale-while-revalidate, limit cache size
  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const fetchAndCache = fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
              limitCacheEntries(cache, MAX_IMAGE_ENTRIES);
            }
            return response;
          })
          .catch(() => cached || new Response('', { status: 503 }));
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
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached || new Response('', { status: 503 }));
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
      }).catch(async () => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          const fallback = await caches.match(OFFLINE_FALLBACK);
          return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
        // If not navigation, return a standard 503 response so it's a valid Response
        return new Response('Service unavailable', { status: 503, statusText: 'Service Unavailable' });
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