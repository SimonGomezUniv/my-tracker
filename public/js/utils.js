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
 * Génère un identifiant compatible avec les navigateurs sans crypto.randomUUID()
 */
export function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
 * Retourne une date locale au format YYYY-MM-DD (sans conversion UTC).
 */
export function toLocalDateKey(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
