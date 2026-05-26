/**
 * sw-dev.js — Service Worker DEV
 * Stratégie : Network-only, aucun cache
 * Permet le rechargement immédiat des ressources pendant le développement.
 */

const SW_NAME = 'node-tracker-dev';

self.addEventListener('install', () => {
  console.log(`[${SW_NAME}] Install — network-only mode`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[${SW_NAME}] Activate`);
  // Supprimer tous les caches existants en mode dev
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Network-only : on ne met rien en cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
