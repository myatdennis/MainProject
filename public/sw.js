// Production Service Worker: Caching for static assets and API responses

const swUrl = new URL(self.location.href);
const versionTag = swUrl.searchParams.get('v') || 'legacy';
const scopeHost = (() => {
  try {
    const scopeUrl = new URL((self.registration && self.registration.scope) || self.location.origin);
    return scopeUrl.host.replace(/[^a-z0-9-]/gi, '-');
  } catch {
    return 'default-scope';
  }
})();

const CACHE_VERSION = `v5-${versionTag}-${scopeHost}`;
const CACHE_NAME = `mainproject-static-${CACHE_VERSION}`;
const BUNDLE_CACHE = `mainproject-bundles-${CACHE_VERSION}`;
const IMAGE_CACHE = `mainproject-img-${scopeHost}-v2`;
const FONT_CACHE = `mainproject-font-${scopeHost}-v2`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
  // Add more static assets as needed
];
const OFFLINE_FALLBACK = '/offline.html';
const MAX_IMAGE_ENTRIES = 60;
const CACHE_WHITELIST = [CACHE_NAME, BUNDLE_CACHE, IMAGE_CACHE, FONT_CACHE];


self.addEventListener('install', event => {
  const hadExistingController = Boolean(self.registration && self.registration.active);
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
      if (hadExistingController) {
        await notifyClients({ type: 'SW_UPDATE_AVAILABLE', version: CACHE_VERSION });
      }
    } catch (e) {
      console.error('[SW] Install error:', e);
    }
  })());
  self.skipWaiting();
});


self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => !CACHE_WHITELIST.includes(key))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
    await notifyClients({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
  })());
});


self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept service worker script updates or manifest requests
  if (url.pathname === '/sw.js' || url.pathname === '/service-worker.js') {
    return;
  }
  if (url.pathname === '/sw-version.json') {
    event.respondWith(fetch(request));
    return;
  }

  // Bypass API, websocket, and upgrade requests so we never interfere with auth flows or SSE/WS handshakes
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/ws') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  event.respondWith(handleRequest(request, url));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const IMAGE_REGEX = /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i;
const FONT_REGEX = /\.(woff2?|ttf|otf|eot)$/i;
const SCRIPT_REGEX = /\.(mjs|js)$/i;
const STYLE_REGEX = /\.css$/i;

async function handleRequest(request, url) {
  try {
    if (IMAGE_REGEX.test(url.pathname)) {
      return await handleImageRequest(request);
    }

    if (FONT_REGEX.test(url.pathname)) {
      return await handleFontRequest(request);
    }

    if (
      SCRIPT_REGEX.test(url.pathname) ||
      STYLE_REGEX.test(url.pathname) ||
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'worker'
    ) {
      return await networkFirst(request, BUNDLE_CACHE);
    }

    return await handleStaticRequest(request);
  } catch (error) {
    console.error('[SW] Fetch handler error', error);
    if (request.mode === 'navigate') {
      const fallback = await caches.match(OFFLINE_FALLBACK);
      if (fallback) {
        return fallback;
      }
    }
    return new Response('Service unavailable', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Refresh in background without delaying the response.
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
          limitCacheEntries(cache, MAX_IMAGE_ENTRIES);
        }
      })
      .catch(err => console.warn('[SW] Background image refresh failed', err));
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
      limitCacheEntries(cache, MAX_IMAGE_ENTRIES);
    }
    return response;
  } catch (error) {
    console.warn('[SW] Image request failed', error);
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function handleFontRequest(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
      })
      .catch(err => console.warn('[SW] Background font refresh failed', err));
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Font request failed', error);
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function handleStaticRequest(request) {
  const isDocumentRequest =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isDocumentRequest) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      console.warn('[SW] Document request failed, falling back to cache', error);
      const cachedDocument = await caches.match(request);
      if (cachedDocument) {
        return cachedDocument;
      }
      const fallback = await caches.match(OFFLINE_FALLBACK);
      if (fallback) {
        return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  }

  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Static request failed', error);
    return new Response('Service unavailable', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Helper: Limit cache entries for images
async function limitCacheEntries(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

async function networkFirst(request, cacheName = CACHE_NAME) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function notifyClients(message) {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of allClients) {
    client.postMessage(message);
  }
}
