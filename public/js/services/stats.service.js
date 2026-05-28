/**
 * stats.service.js — Calculs statistiques
 */

export const PERIOD_PRESETS = [
  { value: '7d',         label: 'Last 7 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '30d',        label: 'Last 30 days' },
  { value: '3m',         label: 'Last 3 months' },
  { value: '1y',         label: 'Last 1 year' },
];

/**
 * Retourne {start, end} Date pour un preset donné
 */
export function getPeriodRange(preset) {
  let end = new Date();
  let start = new Date();
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);
  switch (preset) {
    case '7d':  start.setDate(start.getDate() - 6);          break;
    case '30d': start.setDate(start.getDate() - 29);         break;
    case '3m':  start.setMonth(start.getMonth() - 3);        break;
    case '1y':  start.setFullYear(start.getFullYear() - 1);  break;
    case 'this-month':
      start.setDate(1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'last-month':
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    default: start.setDate(start.getDate() - 29);
  }
  return { start, end };
}

/**
 * Choisit la granularité en fonction de la durée de la période
 */
export function getGranularity(start, end) {
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (days <= 14) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}

/**
 * Groupe les entrées par période
 * @returns {Map<string, entry[]>}
 */
export function groupByPeriod(entries, granularity) {
  const groups = new Map();
  entries.forEach(entry => {
    const d = new Date(entry.timestamp);
    let key;
    if (granularity === 'day') {
      key = d.toISOString().slice(0, 10);
    } else if (granularity === 'week') {
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      key = mon.toISOString().slice(0, 10);
    } else {
      key = d.toISOString().slice(0, 7); // YYYY-MM
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return groups;
}

/**
 * Formate une clé de période pour l'affichage
 */
export function formatPeriodLabel(key, granularity) {
  if (granularity === 'day') {
    const [, m, d] = key.split('-');
    return `${d}/${m}`;
  }
  if (granularity === 'week') {
    const [, m, d] = key.split('-');
    return `${d}/${m}`;
  }
  // month
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

/**
 * Calcule les stats numériques pour un champ donné
 */
export function computeNumericStats(entries, fieldName) {
  const nums = entries
    .map(e => e.data?.[fieldName])
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter(n => !isNaN(n));
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    count: nums.length,
    sum,
    avg: sum / nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

/**
 * Calcule le total des durées HH:MM pour un champ donné
 */
export function computeDurationTotal(entries, fieldName) {
  let totalMinutes = 0;
  let count = 0;
  entries.forEach(e => {
    const val = e.data?.[fieldName];
    if (!val || typeof val !== 'string') return;
    const match = val.trim().match(/^(\d+):([0-5]\d)$/);
    if (!match) return;
    totalMinutes += parseInt(match[1]) * 60 + parseInt(match[2]);
    count++;
  });
  if (count === 0) return null;
  return {
    count,
    totalMinutes,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}
