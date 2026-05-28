/**
 * export.service.js — Export / Import / Reset des données
 */
import db from '../db.js';
import { showToast } from '../utils.js';
import router from '../router.js';
import { getHomeConfig, saveHomeConfig } from './home-customization.service.js';

/**
 * Télécharge toutes les données en JSON
 */
export async function exportData() {
  try {
    const data = await db.exportAll();
    data.__appConfig = {
      home: getHomeConfig(),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `node-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Export downloaded.', 'success');
  } catch (err) {
    showToast(`Export error: ${err.message}`, 'error');
  }
}

/**
 * Importe un fichier JSON exporté précédemment
 * @param {File} file
 * @param {boolean} replace - vider la DB avant import
 */
export async function importData(file, replace = true) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.trackingTypes && !data.trackingEntries) {
      throw new Error('Invalid file: unrecognized format.');
    }
    await db.importAll(data, replace);

    // Restaurer la configuration UI exportée (si présente).
    const importedHomeConfig = data.__appConfig?.home;
    if (importedHomeConfig) {
      saveHomeConfig(importedHomeConfig);
    }

    showToast(`Import successful (${replace ? 'replace' : 'merge'}).`, 'success');
    router.navigate('dashboard');
  } catch (err) {
    showToast(`Import error: ${err.message}`, 'error');
  }
}

/**
 * Supprime toutes les données
 */
export async function resetData() {
  try {
    await db.resetAll();
    showToast('All data has been deleted.', 'success');
    router.navigate('dashboard');
  } catch (err) {
    showToast(`Reset error: ${err.message}`, 'error');
  }
}
