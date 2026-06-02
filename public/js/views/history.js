/**
 * history.js — Vue Historique avec filtres
 */
import TrackingTypeModel from '../models/tracking-type.js';
import TrackingEntryModel from '../models/tracking-entry.js';
import TagModel from '../models/tag.js';
import { escapeHtml, showToast, formatDate } from '../utils.js';

export default async function historyView() {
  const [types, allTags] = await Promise.all([
    TrackingTypeModel.getAll(),
    TagModel.getAll(),
  ]);

  const typeOptions = types.map(t =>
    `<option value="${escapeHtml(t.id)}">${escapeHtml(t.icon || '')} ${escapeHtml(t.name)}</option>`
  ).join('');

  const tagChips = allTags.map(t => `
    <span class="chip chip--sm" data-id="${escapeHtml(t.id)}" style="--chip-bg: ${escapeHtml(t.color)}">
      ${escapeHtml(t.name)}
    </span>`).join('');

  const endDate  = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const html = `
    <div class="view-history">
      <section class="editor-section history-filters">
        <h2 class="editor-section-title">Filters</h2>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label" for="hist-type">Type</label>
            <select id="hist-type" class="form-select">
              <option value="">All types</option>
              ${typeOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="hist-start">From</label>
            <input type="date" id="hist-start" class="form-input" value="${startDate}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="hist-end">To</label>
            <input type="date" id="hist-end" class="form-input" value="${endDate}" />
          </div>
          <div class="form-group form-group--checkbox-align">
            <label class="form-label">&nbsp;</label>
            <button id="hist-clear" class="btn btn-ghost btn-sm">Reset</button>
          </div>
        </div>
        ${allTags.length > 0 ? `
        <div>
          <label class="form-label" style="margin-bottom:6px; display:block">Tags</label>
          <div class="chips-selector" id="hist-tag-chips">${tagChips}</div>
        </div>` : ''}
      </section>

      <div id="history-results"></div>
    </div>`;

  return { html, title: 'History', bind: () => bindHistoryEvents() };
}

// ---- Rendu des résultats ----

async function renderHistoryResults(filterTypeId, startDate, endDate, filterTagIds) {
  const container = document.getElementById('history-results');
  if (!container) return;
  container.innerHTML = '<div class="loading-screen" style="padding:32px"><span class="loading-spinner"></span></div>';

  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date(0);
  const end   = endDate   ? new Date(endDate   + 'T23:59:59') : new Date();

  const [allTypes, entries] = await Promise.all([
    TrackingTypeModel.getAll(),
    TrackingEntryModel.getInRange(start, end, filterTypeId || null),
  ]);
  const typeMap = Object.fromEntries(allTypes.map(t => [t.id, t]));

  const filtered = filterTagIds.size > 0
    ? entries.filter(e => e.tags?.some(tid => filterTagIds.has(tid)))
    : entries;

  const sorted = [...filtered].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box" style="margin-top:16px">
        <p>No entries found for these filters.</p>
        <a href="#/new-entry" class="btn btn-primary">Create an entry</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="history-header">
      <span class="badge badge-primary">${sorted.length} entr${sorted.length > 1 ? 'ies' : 'y'}</span>
    </div>
    <div class="history-list">
      ${sorted.map(entry => renderEntryCard(entry, typeMap[entry.trackingTypeId], true)).join('')}
    </div>`;

  container.querySelectorAll('.btn-delete-entry').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      await TrackingEntryModel.delete(btn.dataset.id);
      showToast('Entry deleted.', 'success');
      const typeId  = document.getElementById('hist-type')?.value || '';
      const start   = document.getElementById('hist-start')?.value || '';
      const end     = document.getElementById('hist-end')?.value || '';
      const tagFilter = new Set(
        [...document.querySelectorAll('#hist-tag-chips .chip--selected')].map(c => c.dataset.id)
      );
      await renderHistoryResults(typeId, start, end, tagFilter);
    });
  });
}

// ---- Carte d'entrée ----

export function renderEntryCard(entry, type, showActions = false) {
  if (!type) return '';
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
          <span class="entry-item-icon">${escapeHtml(type.icon || '📍')}</span>
          <span class="entry-item-type">${escapeHtml(type.name)}</span>
          <span class="entry-item-date">${date}</span>
        </div>
        ${showActions ? `
        <div class="entry-item-actions">
          <a href="#/entry/edit/${escapeHtml(entry.id)}" class="btn btn-sm btn-secondary" title="Edit">✏️</a>
          <button class="btn btn-sm btn-danger btn-delete-entry" data-id="${escapeHtml(entry.id)}" title="Delete">🗑️</button>
        </div>` : ''}
      </div>
      ${fieldsHtml ? `<div class="entry-fields-row">${fieldsHtml}</div>` : ''}
      ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ''}
    </div>`;
}

// ---- Binding ----

function bindHistoryEvents() {
  const filterTagIds = new Set();

  const refresh = () => {
    const typeId = document.getElementById('hist-type')?.value || '';
    const start  = document.getElementById('hist-start')?.value || '';
    const end    = document.getElementById('hist-end')?.value || '';
    renderHistoryResults(typeId, start, end, filterTagIds);
  };

  document.getElementById('hist-type')?.addEventListener('change', refresh);
  document.getElementById('hist-start')?.addEventListener('change', refresh);
  document.getElementById('hist-end')?.addEventListener('change', refresh);

  document.getElementById('hist-clear')?.addEventListener('click', () => {
    document.getElementById('hist-type').value = '';
    document.getElementById('hist-start').value = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    document.getElementById('hist-end').value = new Date().toISOString().slice(0, 10);
    filterTagIds.clear();
    document.querySelectorAll('#hist-tag-chips .chip').forEach(c => c.classList.remove('chip--selected'));
    refresh();
  });

  document.querySelectorAll('#hist-tag-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (filterTagIds.has(id)) { filterTagIds.delete(id); chip.classList.remove('chip--selected'); }
      else { filterTagIds.add(id); chip.classList.add('chip--selected'); }
      refresh();
    });
  });

  refresh();
}
