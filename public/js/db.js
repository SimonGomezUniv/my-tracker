/**
 * db.js — Abstraction IndexedDB
 *
 * Stores disponibles :
 *   - tags
 *   - trackingTypes
 *   - trackingGroups
 *   - trackingEntries
 *
 * Usage:
 *   import db from './db.js';
 *   await db.ready;
 *   const all = await db.getAll('tags');
 *   const item = await db.get('tags', id);
 *   await db.put('tags', { id, name, color });
 *   await db.delete('tags', id);
 *   await db.clear('tags');
 *   const all = await db.exportAll();
 *   await db.importAll(data);
 */

const DB_NAME = 'node-tracker';
const DB_VERSION = 1;

const STORES = ['tags', 'trackingTypes', 'trackingGroups', 'trackingEntries'];

const db = (() => {
  let _db = null;

  const ready = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      STORES.forEach(storeName => {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    request.onerror = (event) => {
      console.error('[db] Erreur ouverture IndexedDB', event.target.error);
      reject(event.target.error);
    };
  });

  function _tx(storeName, mode = 'readonly') {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }

  function _wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll(storeName) {
    await ready;
    return _wrap(_tx(storeName).getAll());
  }

  async function get(storeName, id) {
    await ready;
    return _wrap(_tx(storeName).get(id));
  }

  async function put(storeName, item) {
    await ready;
    if (!item.id) throw new Error(`[db.put] L'item doit avoir un champ 'id'`);
    return _wrap(_tx(storeName, 'readwrite').put(item));
  }

  async function remove(storeName, id) {
    await ready;
    return _wrap(_tx(storeName, 'readwrite').delete(id));
  }

  async function clear(storeName) {
    await ready;
    return _wrap(_tx(storeName, 'readwrite').clear());
  }

  /**
   * Retourne un export complet de toutes les données
   */
  async function exportAll() {
    await ready;
    const result = {};
    for (const storeName of STORES) {
      result[storeName] = await getAll(storeName);
    }
    result.__exportedAt = new Date().toISOString();
    result.__version = DB_VERSION;
    return result;
  }

  /**
   * Importe un backup complet (remplace tout)
   * @param {Object} data - Données exportées par exportAll()
   * @param {boolean} replace - Si true, vide les stores avant import
   */
  async function importAll(data, replace = true) {
    await ready;
    for (const storeName of STORES) {
      if (!data[storeName]) continue;
      if (replace) await clear(storeName);
      for (const item of data[storeName]) {
        await put(storeName, item);
      }
    }
  }

  /**
   * Vide complètement toutes les données
   */
  async function resetAll() {
    await ready;
    for (const storeName of STORES) {
      await clear(storeName);
    }
  }

  return { ready, getAll, get, put, delete: remove, clear, exportAll, importAll, resetAll };
})();

export default db;
