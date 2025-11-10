// Placeholder service worker to prevent 404 errors and disable all caching
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  // No-op: just pass through
});