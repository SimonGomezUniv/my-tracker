/**
 * store.js — State global réactif (pub/sub)
 *
 * Usage:
 *   import store from './store.js';
 *   store.subscribe('trackingTypes', (types) => { ... });
 *   store.set('trackingTypes', [...]);
 *   const types = store.get('trackingTypes');
 */

const store = (() => {
  const state = {
    trackingTypes: [],
    trackingGroups: [],
    trackingEntries: [],
    tags: [],
  };

  const listeners = {};

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    state[key] = value;
    if (listeners[key]) {
      listeners[key].forEach(fn => fn(value));
    }
  }

  function subscribe(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    // Appel immédiat avec la valeur courante
    fn(state[key]);
    return () => {
      listeners[key] = listeners[key].filter(f => f !== fn);
    };
  }

  return { get, set, subscribe };
})();

export default store;
