const CACHE_NAME = 'huddle-admin-v1';
const STATIC_CACHE_NAME = 'huddle-admin-static-v1';
const API_CACHE_NAME = 'huddle-admin-api-v1';

// Resources to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/admin/dashboard',
  '/admin/users',
  '/admin/organizations',
  '/admin/courses',
  '/admin/surveys',
  '/manifest.json',
  // Add critical CSS and JS files here - these will be dynamically added by Vite
];

// API endpoints that should be cached
const CACHEABLE_API_PATTERNS = [
  /\/api\/users/,
  /\/api\/organizations/,
  /\/api\/courses/,
  /\/api\/surveys/,
  /\/api\/analytics/,
];

// Network-first strategy for critical data
const NETWORK_FIRST_PATTERNS = [
  /\/api\/auth/,
  /\/api\/notifications/,
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => url !== '/'));
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handlePageRequest(request));
  }
});

// Handle API requests with caching strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Network-first for critical APIs
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return networkFirst(request, API_CACHE_NAME);
  }
  
  // Cache-first for cacheable APIs
  if (CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return cacheFirst(request, API_CACHE_NAME);
  }
  
  // Default to network-only for other APIs
  return fetch(request);
}

// Handle static assets (cache-first)
async function handleStaticAsset(request) {
  return cacheFirst(request, STATIC_CACHE_NAME);
}

// Handle page requests (network-first with fallback)
async function handlePageRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache');
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for admin routes
    const url = new URL(request.url);
    if (url.pathname.startsWith('/admin')) {
      return new Response(
        getOfflinePage(),
        {
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    throw error;
  }
}

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {}); // Ignore network errors
    
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Cache miss and network failed:', error);
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache');
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Offline page HTML
function getOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Huddle Admin</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f9fafb;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .offline-container {
          text-align: center;
          max-width: 400px;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        .offline-icon {
          width: 64px;
          height: 64px;
          background-color: #fbbf24;
          border-radius: 50%;
          margin: 0 auto 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        h1 { color: #111827; margin-bottom: 0.5rem; }
        p { color: #6b7280; margin-bottom: 1.5rem; }
        .retry-btn {
          background-color: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }
        .retry-btn:hover { background-color: #2563eb; }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>It looks like you've lost your internet connection. Some features may be limited while offline.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Try Again
        </button>
        <p style="margin-top: 1rem; font-size: 12px; color: #9ca3af;">
          Cached data may still be available in your admin portal.
        </p>
      </div>
    </body>
    </html>
  `;
}

// Handle background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncFailedRequests());
  }
});

async function syncFailedRequests() {
  // Implement logic to retry failed requests when back online
  console.log('[SW] Syncing failed requests');
}