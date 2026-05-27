/**
 * theme.service.js — Gestion du thème UI (light / dark / auto)
 */

const STORAGE_KEY = 'my-tracker-theme-preference';
const ALLOWED = new Set(['auto', 'light', 'dark']);

let mediaListenerAttached = false;

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function sanitizeTheme(value) {
  const v = String(value || '').trim().toLowerCase();
  return ALLOWED.has(v) ? v : 'auto';
}

export function getThemePreference() {
  return sanitizeTheme(localStorage.getItem(STORAGE_KEY) || 'auto');
}

export function applyThemePreference(preference = getThemePreference()) {
  const normalized = sanitizeTheme(preference);
  const root = document.documentElement;

  if (normalized === 'auto') {
    root.setAttribute('data-theme', getSystemTheme());
    root.setAttribute('data-theme-mode', 'auto');
  } else {
    root.setAttribute('data-theme', normalized);
    root.setAttribute('data-theme-mode', normalized);
  }

  return normalized;
}

export function setThemePreference(preference) {
  const normalized = sanitizeTheme(preference);
  localStorage.setItem(STORAGE_KEY, normalized);
  applyThemePreference(normalized);
  return normalized;
}

export function startThemeAutoSync() {
  if (mediaListenerAttached) return;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', () => {
    if (getThemePreference() === 'auto') {
      applyThemePreference('auto');
    }
  });
  mediaListenerAttached = true;
}
