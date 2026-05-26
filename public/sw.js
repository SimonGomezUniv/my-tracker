/**
 * sw.js — Service Worker PROD
 * Stratégie : Cache-first pour les assets statiques, Network-first pour /env.js
 */

const CACHE_NAME = 'node-tracker-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/css/components.css',
  '/js/app.js',
  '/js/router.js',
  '/js/db.js',
  '/js/store.js',
  '/js/pwa.js',
  '/js/views/dashboard.js',
  '/js/views/new-entry.js',
  '/js/views/history.js',
  '/js/views/stats.js',
  '/js/views/settings.js',
  '/js/views/types/list.js',
  '/js/views/types/editor.js',
  '/js/views/groups/list.js',
  '/js/views/groups/editor.js',
  '/js/views/tags.js',
  '/js/models/tag.js',
  '/js/models/tracking-type.js',
  '/js/models/tracking-group.js',
  '/js/models/tracking-entry.js',
  '/js/services/stats.service.js',
  '/js/services/export.service.js',
];

self.addEventListener('install', (event) => {
  console.log('[sw] Install — mise en cache des assets');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[sw] Activate — nettoyage anciens caches');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first pour /env.js (données dynamiques injectées par le serveur)
  if (url.pathname === '/env.js') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first pour tous les autres assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
