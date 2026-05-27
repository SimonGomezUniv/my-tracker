/**
 * app.js — Bootstrap de l'application Node Tracker
 */

import router from './router.js';
import { registerServiceWorker } from './pwa.js';
import dashboardView from './views/dashboard.js';
import newEntryView, { editEntryView } from './views/new-entry.js';
import historyView from './views/history.js';
import statsView from './views/stats.js';
import settingsView from './views/settings.js';
import tagsView from './views/tags.js';
import typesListView from './views/types/list.js';
import typesEditorView from './views/types/editor.js';
import groupsListView from './views/groups/list.js';
import groupsEditorView from './views/groups/editor.js';

// --- Enregistrement des routes ---

router.register('dashboard', async () => dashboardView());
router.register('new-entry', async (params) => newEntryView(params));
router.register('history', async () => historyView());
router.register('stats', async () => statsView());
router.register('settings', async () => settingsView());
router.register('tags', async () => tagsView());
router.register('types', async (params) => {
  if (params.length > 0 && params[0] === 'edit') return typesEditorView(params.slice(1));
  if (params.length > 0 && params[0] === 'new') return typesEditorView([]);
  return typesListView();
});
router.register('groups', async (params) => {
  if (params.length > 0 && params[0] === 'edit') return groupsEditorView(params.slice(1));
  if (params.length > 0 && params[0] === 'new') return groupsEditorView([]);
  return groupsListView();
});
router.register('entry', async (params) => {
  if (params[0] === 'edit') return editEntryView(params.slice(1));
  return {
    html: `<div class="view-error"><h2>Route inconnue</h2><a href="#/dashboard" class="btn btn-ghost">← Accueil</a></div>`,
    title: 'Erreur',
  };
});

// --- Init ---

async function init() {
  await registerServiceWorker();
  router.init();
}

init();
