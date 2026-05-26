/**
 * pwa.js — Enregistrement du Service Worker selon l'environnement
 * NODE_ENV est injecté par le serveur via /env.js (window.__ENV__)
 */

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[pwa] Service Workers non supportés dans ce navigateur.');
    return;
  }

  const env = window.__ENV__?.NODE_ENV || 'dev';
  const swFile = env === 'prod' ? '/sw.js' : '/sw-dev.js';

  try {
    const registration = await navigator.serviceWorker.register(swFile);
    console.log(`[pwa] Service Worker enregistré (${env}) :`, registration.scope);

    // En prod, écouter les mises à jour disponibles
    if (env === 'prod') {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateNotification();
          }
        });
      });
    }
  } catch (err) {
    console.error('[pwa] Échec enregistrement Service Worker :', err);
  }
}

function showUpdateNotification() {
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>Une nouvelle version est disponible.</span>
    <button onclick="window.location.reload()">Mettre à jour</button>
  `;
  document.body.appendChild(banner);
}
