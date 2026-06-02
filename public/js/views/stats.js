/**
 * stats.js — Vue Statistiques avec graphique en barres, nuage de mots, filtres avancés
 */
import TrackingTypeModel from '../models/tracking-type.js';
import TrackingEntryModel from '../models/tracking-entry.js';
import TagModel from '../models/tag.js';
import {
  PERIOD_PRESETS,
  getPeriodRange,
  getGranularity,
  groupByPeriod,
  formatPeriodLabel,
  computeNumericStats,
  computeDurationTotal,
} from '../services/stats.service.js';
import { escapeHtml, formatDate } from '../utils.js';

export default async function statsView() {
  const [types, allTags] = await Promise.all([
    TrackingTypeModel.getAll(),
    TagModel.getAll(),
  ]);

  if (types.length === 0) {
    return {
      html: `<div class="view-stats"><div class="empty-state-box"><p>No tracking type found. Create a type and add entries first.</p></div></div>`,
      title: 'Stats',
    };
  }

  const typeOptions = types.map(t =>
    `<option value="${escapeHtml(t.id)}">${escapeHtml(t.icon || '')} ${escapeHtml(t.name)}</option>`
  ).join('');

  const periodOptions = [...PERIOD_PRESETS, { value: 'custom', label: 'Custom' }]
    .map(p => `<option value="${p.value}" ${p.value === '30d' ? 'selected' : ''}>${p.label}</option>`)
    .join('');

  const today    = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const tagChips = allTags.map(t => `
    <span class="chip chip--sm" data-id="${escapeHtml(t.id)}" style="--chip-bg: ${escapeHtml(t.color)}">
      ${escapeHtml(t.name)}
    </span>`).join('');

  const html = `
    <div class="view-stats">
      <section class="editor-section">
        <h2 class="editor-section-title">Filters</h2>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label" for="stats-type">Tracking type</label>
            <select id="stats-type" class="form-select">
              <option value="">— Select a type —</option>
              ${typeOptions}
            </select>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label" for="stats-period">Period</label>
            <select id="stats-period" class="form-select">${periodOptions}</select>
          </div>
        </div>
        <div id="custom-range" class="form-row hidden" style="margin-top:8px">
          <div class="form-group">
            <label class="form-label" for="stats-start">From</label>
            <input type="date" id="stats-start" class="form-input" value="${monthAgo}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="stats-end">To</label>
            <input type="date" id="stats-end" class="form-input" value="${today}" />
          </div>
        </div>
        ${allTags.length > 0 ? `
        <div style="margin-top:12px">
          <label class="form-label" style="margin-bottom:6px;display:block">Filter by tags</label>
          <div class="chips-selector" id="stats-tag-chips">${tagChips}</div>
        </div>` : ''}
        <div style="margin-top:12px">
          <label class="toggle-switch" for="stats-include-notes">
            <input type="checkbox" id="stats-include-notes" />
            <span class="toggle-switch__track" aria-hidden="true">
              <span class="toggle-switch__thumb"></span>
            </span>
            <span class="toggle-switch__label">Include comments in the word cloud</span>
          </label>
        </div>
      </section>

      <div id="stats-results">
        <p class="empty-state" style="margin-top:16px">Select a type to view statistics.</p>
      </div>
    </div>`;

  return { html, title: 'Stats', bind: bindStatsEvents };
}

// ---- Rendu des résultats ----

async function renderStatsResults(typeId, start, end, filterTagIds = new Set(), includeNotes = false) {
  const container = document.getElementById('stats-results');
  if (!container) return;

  if (!typeId) {
    container.innerHTML = `<p class="empty-state" style="margin-top:16px">Select a type to view statistics.</p>`;
    return;
  }

  container.innerHTML = '<div class="loading-screen" style="padding:40px"><span class="loading-spinner"></span></div>';

  const [type, allEntries] = await Promise.all([
    TrackingTypeModel.get(typeId),
    TrackingEntryModel.getInRange(start, end, typeId),
  ]);

  if (!type) { container.innerHTML = `<p class="empty-state">Type not found.</p>`; return; }

  // Filtre par tags
  const entries = filterTagIds.size > 0
    ? allEntries.filter(e => e.tags?.some(tid => filterTagIds.has(tid)))
    : allEntries;

  const total       = entries.length;
  const granularity = getGranularity(start, end);
  const grouped     = groupByPeriod(entries, granularity);
  const periodKeys  = Array.from(grouped.keys()).sort();
  const maxCount    = Math.max(1, ...periodKeys.map(k => grouped.get(k)?.length || 0));

  // Résumé numérique (numeric + rating)
  const numFields = (type.fields || []).filter(f => ['numeric', 'rating'].includes(f.type));
  const numStatsHtml = numFields.map(field => {
    const stats = computeNumericStats(entries, field.name);
    if (!stats) return '';
    const value = field.type === 'rating'
      ? stats.avg.toFixed(1) + ' ★'
      : stats.sum % 1 === 0 ? stats.sum : stats.sum.toFixed(2);
    const sublabel = field.type === 'rating' ? 'average' : 'total';
    return `<div class="stat-card">
      <span class="stat-value">${value}</span>
      <span class="stat-label">${escapeHtml(field.label)} (${sublabel})</span>
    </div>`;
  }).join('');

  // Total heures (champs duration)
  const durationFields = (type.fields || []).filter(f => f.type === 'duration');
  const durationStatsHtml = durationFields.map(field => {
    const dur = computeDurationTotal(entries, field.name);
    if (!dur) return '';
    const display = dur.hours > 0
      ? `${dur.hours}h${dur.minutes > 0 ? String(dur.minutes).padStart(2, '0') : ''}`
      : `${dur.minutes}min`;
    return `<div class="stat-card">
      <span class="stat-value">${display}</span>
      <span class="stat-label">${escapeHtml(field.label)} (total)</span>
    </div>`;
  }).join('');

  // Graphique en barres CSS
  const chartHtml = periodKeys.length > 1 ? `
    <section class="editor-section">
      <h2 class="editor-section-title">Trend</h2>
      <div class="chart-container">
        <div class="chart-bars">
          ${periodKeys.map(key => {
            const count = grouped.get(key)?.length || 0;
            const pct   = Math.round((count / maxCount) * 100);
            return `<div class="chart-bar-col">
              <span class="chart-bar-count">${count > 0 ? count : ''}</span>
              <div class="chart-bar-fill" style="height:${count > 0 ? Math.max(pct, 4) : 0}%"></div>
              <span class="chart-bar-label">${formatPeriodLabel(key, granularity)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>` : '';

  const calendarHtml = renderStatsCalendar(entries, type, start, end);

  // Nuage de mots (notes + champs string)
  const wordCloudHtml = renderWordCloud(buildWordFrequency(entries, type, { includeNotes }));

  // Liste des saisies
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const listHtml = sorted.length > 0
    ? sorted.map(e => renderEntryCardCompact(e, type)).join('')
    : `<p class="empty-state">No entries during this period.</p>`;

  container.innerHTML = `
    <div class="dashboard-stats" style="margin-bottom:16px">
      <div class="stat-card">
        <span class="stat-value">${total}</span>
        <span class="stat-label">Entries in period</span>
      </div>
      ${numStatsHtml}
      ${durationStatsHtml}
    </div>
    ${chartHtml}
    ${calendarHtml}
    ${wordCloudHtml}
    <section class="editor-section">
      <h2 class="editor-section-title">Entries list (${total})</h2>
      <div class="history-list">${listHtml}</div>
    </section>`;
}

function getMonthsInRange(startDate, endDate) {
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= limit) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function renderStatsCalendar(entries, type, startDate, endDate) {
  if (!entries.length) return '';

  const byDay = new Map();
  entries.forEach(e => {
    const d = new Date(e.timestamp);
    const key = d.toISOString().slice(0, 10);
    const arr = byDay.get(key) || [];
    arr.push(e);
    byDay.set(key, arr);
  });

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const months = getMonthsInRange(startDate, endDate);
  const monthBlocks = months.map(({ year, month }) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const rangeStartKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const rangeEndKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    const monthStartKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEndKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const activeStartKey = monthStartKey < rangeStartKey ? rangeStartKey : monthStartKey;
    const activeEndKey = monthEndKey > rangeEndKey ? rangeEndKey : monthEndKey;
    const activeDays = [];
    const cursor = new Date(`${activeStartKey}T00:00:00`);
    const limit = new Date(`${activeEndKey}T00:00:00`);
    while (cursor <= limit) {
      activeDays.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const cells = [];

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        cells.push('<div class="calendar-cell calendar-cell--empty"></div>');
        continue;
      }

      const d = new Date(year, month, dayNum);
      const key = d.toISOString().slice(0, 10);
      const inRange = key >= rangeStartKey && key <= rangeEndKey;
      const dayEntries = inRange ? (byDay.get(key) || []) : [];
      const hasData = dayEntries.length > 0;
      const value = hasData ? computeCalendarValue(dayEntries, type) : '';

      cells.push(`
        <div class="calendar-cell ${inRange ? 'calendar-cell--active' : 'calendar-cell--empty'} ${hasData ? 'calendar-cell--active' : ''}">
          <span class="calendar-day">${dayNum}</span>
          ${hasData ? `<span class="calendar-icon">${escapeHtml(type.icon || '📍')}</span>` : ''}
          ${hasData ? `<span class="calendar-value">${escapeHtml(value)}</span>` : ''}
        </div>`);
    }

    return `
      <section class="calendar-month-block">
        <div class="calendar-widget-header">${escapeHtml(firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))}</div>
        <div class="calendar-weekdays">${weekDays.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="calendar-grid">${cells.join('')}</div>
      </section>`;
  }).join('');

  return `
    <section class="editor-section">
      <h2 class="editor-section-title">Calendar</h2>
      <div class="calendar-widget calendar-widget--range">${monthBlocks}</div>
    </section>`;
}

function computeCalendarValue(entries, type) {
  const fields = type.fields || [];

  const durationField = fields.find(f => f.type === 'duration');
  if (durationField) {
    const total = computeDurationTotal(entries, durationField.name);
    if (total) {
      return total.hours > 0
        ? `${total.hours}h${String(total.minutes).padStart(2, '0')}`
        : `${total.minutes}m`;
    }
  }

  const ratingField = fields.find(f => f.type === 'rating');
  if (ratingField) {
    const vals = entries.map(e => Number(e.data?.[ratingField.name])).filter(v => !isNaN(v));
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return `${avg.toFixed(1)}★`;
    }
  }

  const numericField = fields.find(f => f.type === 'numeric');
  if (numericField) {
    const vals = entries.map(e => Number(e.data?.[numericField.name])).filter(v => !isNaN(v));
    if (vals.length > 0) {
      const sum = vals.reduce((a, b) => a + b, 0);
      return String(sum % 1 === 0 ? sum : sum.toFixed(1));
    }
  }

  return `${entries.length}`;
}

// ---- Nuage de mots ----

const STOPWORDS = new Set([
  'le','la','les','de','du','des','un','une','et','en','à','au','aux',
  'est','que','qui','pour','par','sur','avec','dans','plus','tout','pas',
  'je','tu','il','elle','nous','vous','ils','elles','on','se','ce','cet',
  'cette','ces','mon','ma','mes','ton','ta','tes','son','sa','ses',
  'mais','où','donc','car','ni','comme','très','bien','ça','fait','après',
  'the','a','an','and','is','in','on','at','to','for','of','or','not',
  'this','that','it','was','he','she','they','be','are','were','been',
  'have','has','had','do','did','my','your','his','her','its','our','their',
  'what','which','when','where','who','how','can','will','would','all',
]);

const WORD_COLORS = [
  'var(--color-primary)', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#8b5cf6', '#ef4444',
];

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-zàâäéèêëîïôùûüœç0-9\s'-]/g, ' ')
    .split(/[\s'-]+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function buildWordFrequency(entries, type, options = {}) {
  const freq = {};
  const stringFields = (type.fields || []).filter(f => f.type === 'string');
  const includeNotes = !!options.includeNotes;
  entries.forEach(e => {
    if (includeNotes && e.note?.trim()) tokenize(e.note).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    stringFields.forEach(f => {
      const val = e.data?.[f.name];
      if (val?.trim()) tokenize(val).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    });
  });
  return freq;
}

function renderWordCloud(freq) {
  const words = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60);
  if (words.length === 0) return '';
  const max = words[0][1];
  const wordsHtml = words.map(([word, count]) => {
    const size   = (0.75 + (count / max) * 1.75).toFixed(2);
    const weight = count / max > 0.5 ? '600' : '400';
    // couleur déterministe par mot
    const colorIdx = word.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % WORD_COLORS.length;
    const color = WORD_COLORS[colorIdx];
    return `<span class="word-cloud-word" style="font-size:${size}rem;font-weight:${weight};color:${color}" title="${count}×">${escapeHtml(word)}</span>`;
  }).join('');
  return `
    <section class="editor-section">
      <h2 class="editor-section-title">Word cloud</h2>
      <div class="word-cloud">${wordsHtml}</div>
    </section>`;
}

function renderEntryCardCompact(entry, type) {
  const date = formatDate(entry.timestamp);
  const fieldsHtml = (type.fields || []).slice(0, 3).map(f => {
    const val = entry.data?.[f.name];
    if (val === null || val === undefined || val === '') return '';
    let display = String(val);
    if (f.type === 'boolean') display = val ? 'Yes' : 'No';
    if (f.type === 'rating') {
      const v = parseInt(val) || 0;
      display = '★'.repeat(Math.min(v, 5)) + '☆'.repeat(Math.max(0, 5 - v));
    }
    return `<span class="entry-field-chip"><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(display)}</span>`;
  }).filter(Boolean).join('');

  return `
    <div class="entry-item">
      <div class="entry-item-top">
        <div class="entry-item-meta">
          <span class="entry-item-date">${date}</span>
        </div>
      </div>
      ${fieldsHtml ? `<div class="entry-fields-row">${fieldsHtml}</div>` : ''}
      ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ''}
    </div>`;
}

// ---- Binding ----

function bindStatsEvents() {
  const filterTagIds = new Set();

  const getFilters = () => {
    const typeId = document.getElementById('stats-type')?.value || '';
    const period = document.getElementById('stats-period')?.value || '30d';
    if (period === 'custom') {
      const s = document.getElementById('stats-start')?.value;
      const e = document.getElementById('stats-end')?.value;
      if (!s || !e) return null;
      return { typeId, start: new Date(s + 'T00:00:00'), end: new Date(e + 'T23:59:59'), filterTagIds };
    }
    const { start, end } = getPeriodRange(period);
    return { typeId, start, end, filterTagIds };
  };

  const refresh = () => {
    const f = getFilters();
    if (f) {
      const includeNotes = document.getElementById('stats-include-notes')?.checked || false;
      renderStatsResults(f.typeId, f.start, f.end, f.filterTagIds, includeNotes);
    }
  };

  document.getElementById('stats-type')?.addEventListener('change', refresh);
  document.getElementById('stats-period')?.addEventListener('change', (e) => {
    document.getElementById('custom-range').classList.toggle('hidden', e.target.value !== 'custom');
    refresh();
  });
  document.getElementById('stats-start')?.addEventListener('change', refresh);
  document.getElementById('stats-end')?.addEventListener('change', refresh);
  document.getElementById('stats-include-notes')?.addEventListener('change', refresh);

  document.querySelectorAll('#stats-tag-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (filterTagIds.has(id)) { filterTagIds.delete(id); chip.classList.remove('chip--selected'); }
      else { filterTagIds.add(id); chip.classList.add('chip--selected'); }
      refresh();
    });
  });
}
