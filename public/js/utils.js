/**
 * utils.js — Fonctions utilitaires partagées
 */

/**
 * Convertit une chaîne en identifiant snake_case
 * ex: "Date / Heure" -> "date_heure", "Durée (min)" -> "duree_min"
 */
export function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // supprime les accents
    .replace(/[^a-z0-9]+/g, '_')      // remplace les non-alphanums par _
    .replace(/^_+|_+$/g, '');         // supprime _ en début/fin
}

/**
 * Échappe les caractères HTML pour prévenir les injections XSS
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Affiche un toast de notification
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration
 */
export function showToast(message, type = 'info', duration = 3000) {
  document.querySelector('.toast-notification')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Formate une date ISO en format local français
 */
export function formatDate(isoString, options = {}) {
  if (!isoString) return '—';
  const defaults = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(isoString).toLocaleString('en-US', { ...defaults, ...options });
}

/**
 * Génère un nom de champ unique (snake_case) à partir d'un libellé,
 * en évitant les doublons dans la liste de champs existants.
 * @param {string} label
 * @param {Array} existingFields - tableau de { name, ... }
 * @param {number} excludeIndex - index à ignorer (pour les modifications)
 */
export function uniqueFieldName(label, existingFields = [], excludeIndex = -1) {
  const base = slugify(label) || 'champ';
  const existing = existingFields
    .filter((_, i) => i !== excludeIndex)
    .map(f => f.name);

  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
