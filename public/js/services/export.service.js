/**
 * export.service.js — Export / Import / Reset des données
 */
import db from '../db.js';
import { showToast } from '../utils.js';
import router from '../router.js';

/**
 * Télécharge toutes les données en JSON
 */
export async function exportData() {
  try {
    const data = await db.exportAll();
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
    showToast('Export téléchargé.', 'success');
  } catch (err) {
    showToast(`Erreur export : ${err.message}`, 'error');
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
      throw new Error('Fichier invalide : format non reconnu.');
    }
    await db.importAll(data, replace);
    showToast(`Import réussi (${replace ? 'remplacement' : 'fusion'}).`, 'success');
    router.navigate('dashboard');
  } catch (err) {
    showToast(`Erreur import : ${err.message}`, 'error');
  }
}

/**
 * Supprime toutes les données
 */
export async function resetData() {
  try {
    await db.resetAll();
    showToast('Toutes les données ont été supprimées.', 'success');
    router.navigate('dashboard');
  } catch (err) {
    showToast(`Erreur reset : ${err.message}`, 'error');
  }
}
