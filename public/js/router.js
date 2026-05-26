/**
 * router.js — Hash router pour la SPA
 * Usage:
 *   router.register('dashboard', () => '<div>...</div>')
 *   router.navigate('#/dashboard')
 */

const router = (() => {
  const routes = new Map();
  let currentRoute = null;
  const listeners = [];

  /**
   * Enregistre une route
   * @param {string} name - Identifiant de la route (ex: 'dashboard')
   * @param {Function} handler - Fonction async qui retourne un Node ou du HTML
   */
  function register(name, handler) {
    routes.set(name, handler);
  }

  /**
   * Navigue vers un hash
   * @param {string} hash - ex: '#/dashboard' ou 'dashboard'
   */
  function navigate(hash) {
    const path = hash.replace(/^#\/?/, '');
    window.location.hash = `#/${path}`;
  }

  /**
   * Résout la route courante depuis window.location.hash
   */
  async function resolve() {
    const hash = window.location.hash || '#/dashboard';
    const path = hash.replace(/^#\/?/, '').split('?')[0];

    // Gestion des routes avec paramètres ex: types/edit/uuid
    const segments = path.split('/');
    const routeName = segments[0] || 'dashboard';
    const params = segments.slice(1);

    const handler = routes.get(routeName);
    const container = document.getElementById('view-container');
    const pageTitle = document.getElementById('page-title');

    // Mettre à jour les liens actifs
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.route === routeName);
    });

    if (!handler) {
      container.innerHTML = `
        <div class="view-error">
          <h2>Page introuvable</h2>
          <p>La route <code>${path}</code> n'existe pas.</p>
          <a href="#/dashboard" class="btn btn-primary">Retour au tableau de bord</a>
        </div>`;
      return;
    }

    container.innerHTML = '<div class="loading-screen"><span class="loading-spinner"></span></div>';

    try {
      const result = await handler(params);
      container.innerHTML = result.html;
      if (result.title && pageTitle) pageTitle.textContent = result.title;
      if (typeof result.bind === 'function') {
        requestAnimationFrame(() => result.bind());
      }
      currentRoute = { name: routeName, params };
      listeners.forEach(fn => fn(currentRoute));
    } catch (err) {
      console.error('[router] Erreur lors du rendu de la route', routeName, err);
      container.innerHTML = `
        <div class="view-error">
          <h2>Erreur de chargement</h2>
          <p>${err.message}</p>
        </div>`;
    }
  }

  /**
   * S'abonner aux changements de route
   * @param {Function} fn
   */
  function onChange(fn) {
    listeners.push(fn);
  }

  /**
   * Démarre le router (écoute hashchange)
   */
  function init() {
    window.addEventListener('hashchange', resolve);
    resolve(); // résoudre la route initiale
  }

  /**
   * Retourne la route courante
   */
  function getCurrent() {
    return currentRoute;
  }

  return { register, navigate, init, onChange, getCurrent };
})();

export default router;
