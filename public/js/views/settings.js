/**
 * settings.js — Vue Paramètres (Export / Import / Reset)
 * La logique export/import sera complétée en Phase 5.
 */

import TrackingTypeModel from '../models/tracking-type.js';
import TagModel from '../models/tag.js';
import { PERIOD_PRESETS } from '../services/stats.service.js';
import {
  getHomeConfig,
  updateHomeCounts,
  addHomeWidget,
  removeHomeWidget,
  updateHomeSectionOrder,
} from '../services/home-customization.service.js';
import { getThemePreference, setThemePreference } from '../services/theme.service.js';
import { escapeHtml, showToast } from '../utils.js';

export default async function settingsView() {
  const env = window.__ENV__?.NODE_ENV || 'dev';
  const currentTheme = getThemePreference();
  const [types, tags] = await Promise.all([
    TrackingTypeModel.getAll(),
    TagModel.getAll(),
  ]);
  const homeConfig = getHomeConfig();

  const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
  const tagMap = Object.fromEntries(tags.map(t => [t.id, t]));

  const typeOptions = types.map(t =>
    `<option value="${escapeHtml(t.id)}">${escapeHtml(t.icon || '')} ${escapeHtml(t.name)}</option>`
  ).join('');

  const periodOptions = PERIOD_PRESETS
    .map(p => `<option value="${p.value}" ${p.value === '30d' ? 'selected' : ''}>${escapeHtml(p.label)}</option>`)
    .join('');

  const tagOptions = tags.map(t =>
    `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`
  ).join('');

  const widgetLabels = {
    'word-cloud': 'Word cloud',
    'duration-total': 'Total duration',
    'entries-chart': 'Entry chart',
    'calendar': 'Calendar',
  };

  const widgetsHtml = homeConfig.widgets.length > 0
    ? homeConfig.widgets.map(w => {
        const widgetTypeIds = Array.isArray(w.trackingTypeIds)
          ? w.trackingTypeIds
          : [w.trackingTypeId].filter(Boolean);
        const typeLabel = widgetTypeIds
          .map(id => {
            const t = typeMap[id];
            return t ? `${t.icon || '📍'} ${t.name}` : null;
          })
          .filter(Boolean)
          .join(', ');
        const period = PERIOD_PRESETS.find(p => p.value === w.period)?.label || 'Last 30 days';
        const tagsLabel = w.tagIds?.length
          ? w.tagIds.map(id => tagMap[id]?.name).filter(Boolean).join(', ')
          : 'All tags';
        return `
          <div class="home-widget-config-item">
            <div>
              <strong>${escapeHtml(widgetLabels[w.kind] || 'Widget')}</strong>
              <p class="text-muted">${escapeHtml(typeLabel || 'Deleted type')} · ${escapeHtml(period)} · ${escapeHtml(tagsLabel)}</p>
            </div>
            <button class="btn btn-sm btn-danger btn-remove-home-widget" data-id="${escapeHtml(w.id)}">Remove</button>
          </div>`;
      }).join('')
    : '<p class="text-muted">No widgets configured.</p>';

  const sectionLabels = {
    quick: 'Quick entry',
    widgets: 'Custom stats',
    history: 'Home history',
  };

  const sectionOrderHtml = homeConfig.sectionOrder.map((section, index) => `
    <div class="home-order-item">
      <strong>${escapeHtml(sectionLabels[section] || section)}</strong>
      <div class="home-order-actions">
        <button class="btn btn-sm btn-secondary btn-home-order-up" data-section="${escapeHtml(section)}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-sm btn-secondary btn-home-order-down" data-section="${escapeHtml(section)}" ${index === homeConfig.sectionOrder.length - 1 ? 'disabled' : ''}>↓</button>
      </div>
    </div>`).join('');

  const html = `
    <div class="view-settings">

      <section class="settings-section">
        <h2>Tracking structure</h2>
        <p>Manage your tracking setup here: types, groups, and tags.</p>
        <div class="import-zone">
          <a href="#/types" class="btn btn-secondary settings-mobile-icon-btn" title="Tracking types">
            <span class="btn-glyph" aria-hidden="true">🏷️</span><span class="btn-text">Tracking types</span>
          </a>
          <a href="#/groups" class="btn btn-secondary settings-mobile-icon-btn" title="Groups">
            <span class="btn-glyph" aria-hidden="true">📁</span><span class="btn-text">Groups</span>
          </a>
          <a href="#/tags" class="btn btn-secondary settings-mobile-icon-btn" title="Tags">
            <span class="btn-glyph" aria-hidden="true">🔖</span><span class="btn-text">Tags</span>
          </a>
        </div>
      </section>

      <section class="settings-section">
        <h2>Home customization</h2>
        <p>Choose visible counters and add stats widgets to Home.</p>

        <div class="settings-subsection">
          <h3>Theme</h3>
          <div class="form-group" style="max-width:280px">
            <label class="form-label" for="theme-mode">Display mode</label>
            <select id="theme-mode" class="form-select">
              <option value="auto" ${currentTheme === 'auto' ? 'selected' : ''}>Auto (follow device)</option>
              <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
            </select>
          </div>
        </div>

        <div class="settings-subsection">
          <h3>Visible counters</h3>
          <div class="settings-toggle-grid">
            <label class="checkbox-label"><input type="checkbox" id="home-show-entries" ${homeConfig.showCounts.entries ? 'checked' : ''} /> Number of entries</label>
            <label class="checkbox-label"><input type="checkbox" id="home-show-types" ${homeConfig.showCounts.types ? 'checked' : ''} /> Number of tracking types</label>
            <label class="checkbox-label"><input type="checkbox" id="home-show-groups" ${homeConfig.showCounts.groups ? 'checked' : ''} /> Number of groups</label>
          </div>
        </div>

        <div class="settings-subsection">
          <h3>Add a stats widget</h3>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="home-widget-kind">Widget type</label>
              <select id="home-widget-kind" class="form-select">
                <option value="word-cloud">Word cloud</option>
                <option value="duration-total">Total duration</option>
                <option value="entries-chart">Entry chart</option>
                <option value="calendar">Calendar</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label" for="home-widget-type">Tracking type</label>
              <select id="home-widget-type" class="form-select">
                <option value="">— Select —</option>
                ${typeOptions}
              </select>
            </div>
            <div class="form-group hidden" style="flex:1" id="home-widget-types-multi-group">
              <label class="form-label" for="home-widget-types-multi">Tracking types (calendar)</label>
              <select id="home-widget-types-multi" class="form-select" multiple size="4">${typeOptions}</select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="home-widget-period">Relative time</label>
              <select id="home-widget-period" class="form-select">${periodOptions}</select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label" for="home-widget-tags">Tag filters</label>
              <select id="home-widget-tags" class="form-select" multiple size="4">${tagOptions}</select>
            </div>
          </div>

          <button id="btn-add-home-widget" class="btn btn-secondary settings-mobile-icon-btn" title="Add widget" ${types.length === 0 ? 'disabled' : ''}>
            <span class="btn-glyph" aria-hidden="true">➕</span><span class="btn-text">Add widget</span>
          </button>
        </div>

        <div class="settings-subsection">
          <h3>Home block order</h3>
          <div class="home-order-list">${sectionOrderHtml}</div>
        </div>

        <div class="settings-subsection">
          <h3>Active widgets</h3>
          <div id="home-widgets-config-list" class="home-widget-config-list">${widgetsHtml}</div>
        </div>
      </section>

      <section class="settings-section">
        <h2>Export data</h2>
        <p>Download all your data as JSON for backup.</p>
        <button id="btn-export" class="btn btn-primary settings-mobile-icon-btn" title="Export data">
          <span class="btn-glyph" aria-hidden="true">⬇️</span><span class="btn-text">Export data</span>
        </button>
      </section>

      <section class="settings-section">
        <h2>Import data</h2>
        <p>Restore your data from a previously exported JSON file.</p>
        <div class="import-zone">
          <label for="import-file" class="btn btn-secondary settings-mobile-icon-btn" title="Choose JSON file">
            <span class="btn-glyph" aria-hidden="true">📂</span><span class="btn-text">Choose JSON file</span>
          </label>
          <input type="file" id="import-file" accept=".json" style="display:none" />
          <span id="import-filename" class="import-filename">No file selected</span>
        </div>
        <div class="import-options">
          <label class="checkbox-label">
            <input type="checkbox" id="import-replace" checked />
            Replace all existing data
          </label>
        </div>
        <button id="btn-import" class="btn btn-secondary settings-mobile-icon-btn" title="Import" disabled>
          <span class="btn-glyph" aria-hidden="true">⬆️</span><span class="btn-text">Import</span>
        </button>
      </section>

      <section class="settings-section settings-section--danger">
        <h2>Reset</h2>
        <p>Delete <strong>all</strong> data (types, groups, entries, tags). This action is irreversible.</p>
        <button id="btn-reset" class="btn btn-danger settings-mobile-icon-btn" title="Delete everything">
          <span class="btn-glyph" aria-hidden="true">🗑️</span><span class="btn-text">Delete everything</span>
        </button>
      </section>

      <section class="settings-section settings-section--info">
        <h2>Information</h2>
        <ul class="info-list">
          <li><strong>Version:</strong> 1.0.0</li>
          <li><strong>Mode:</strong> <code>${env}</code></li>
          <li><strong>Storage:</strong> IndexedDB (browser)</li>
        </ul>
      </section>

    </div>`;

  return { html, title: 'Settings', bind: bindSettingsEvents };
}

function bindSettingsEvents() {
  const refreshRoute = () => {
    window.location.hash = `#/settings?refresh=${Date.now()}`;
  };

  // Personnalisation Home
  const themeMode = document.getElementById('theme-mode');
  themeMode?.addEventListener('change', () => {
    const mode = setThemePreference(themeMode.value || 'auto');
    showToast(`Theme applied: ${mode}.`, 'success', 1200);
  });

  const showEntries = document.getElementById('home-show-entries');
  const showTypes = document.getElementById('home-show-types');
  const showGroups = document.getElementById('home-show-groups');

  const syncCounts = () => {
    updateHomeCounts({
      entries: !!showEntries?.checked,
      types: !!showTypes?.checked,
      groups: !!showGroups?.checked,
    });
    showToast('Home preferences updated.', 'success', 1400);
  };

  showEntries?.addEventListener('change', syncCounts);
  showTypes?.addEventListener('change', syncCounts);
  showGroups?.addEventListener('change', syncCounts);

  const addWidgetBtn = document.getElementById('btn-add-home-widget');
  const widgetKindSelect = document.getElementById('home-widget-kind');

  const updateTypeInputsVisibility = () => {
    const kind = widgetKindSelect?.value || 'word-cloud';
    document.getElementById('home-widget-type')?.closest('.form-group')?.classList.toggle('hidden', kind === 'calendar');
    document.getElementById('home-widget-types-multi-group')?.classList.toggle('hidden', kind !== 'calendar');
  };

  widgetKindSelect?.addEventListener('change', updateTypeInputsVisibility);
  updateTypeInputsVisibility();

  addWidgetBtn?.addEventListener('click', () => {
    const kind = widgetKindSelect?.value || 'word-cloud';
    const trackingTypeId = document.getElementById('home-widget-type')?.value || '';
    const trackingTypeIds = kind === 'calendar'
      ? [...(document.getElementById('home-widget-types-multi')?.selectedOptions || [])].map(o => o.value)
      : [trackingTypeId].filter(Boolean);
    const period = document.getElementById('home-widget-period')?.value || '30d';
    const tagSelect = document.getElementById('home-widget-tags');
    const tagIds = [...(tagSelect?.selectedOptions || [])].map(o => o.value);

    if (trackingTypeIds.length === 0) {
      showToast('Select at least one tracking type.', 'warning');
      return;
    }

    try {
      addHomeWidget({ kind, trackingTypeIds, period, tagIds });
      showToast('Widget added to Home.', 'success');
      refreshRoute();
    } catch (err) {
      showToast(err.message || 'Unable to add widget.', 'error');
    }
  });

  document.querySelectorAll('.btn-remove-home-widget').forEach(btn => {
    btn.addEventListener('click', () => {
      removeHomeWidget(btn.dataset.id);
      showToast('Widget removed.', 'success', 1200);
      refreshRoute();
    });
  });

  const currentOrder = getHomeConfig().sectionOrder;
  const moveSection = (section, direction) => {
    const idx = currentOrder.indexOf(section);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= currentOrder.length) return;
    [currentOrder[idx], currentOrder[next]] = [currentOrder[next], currentOrder[idx]];
    updateHomeSectionOrder(currentOrder);
    refreshRoute();
  };

  document.querySelectorAll('.btn-home-order-up').forEach(btn => {
    btn.addEventListener('click', () => moveSection(btn.dataset.section, -1));
  });
  document.querySelectorAll('.btn-home-order-down').forEach(btn => {
    btn.addEventListener('click', () => moveSection(btn.dataset.section, 1));
  });

  // Export / Import / Reset
  const exportBtn = document.getElementById('btn-export');
  const importFile = document.getElementById('import-file');
  const importFilename = document.getElementById('import-filename');
  const importBtn = document.getElementById('btn-import');
  const resetBtn = document.getElementById('btn-reset');

  let selectedFile = null;

  exportBtn?.addEventListener('click', async () => {
    const { exportData } = await import('../services/export.service.js');
    await exportData();
  });

  importFile?.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    importFilename.textContent = selectedFile ? selectedFile.name : 'No file selected';
    importBtn.disabled = !selectedFile;
  });

  importBtn?.addEventListener('click', async () => {
    if (!selectedFile) return;
    const replace = document.getElementById('import-replace')?.checked ?? true;
    const { importData } = await import('../services/export.service.js');
    await importData(selectedFile, replace);
  });

  resetBtn?.addEventListener('click', async () => {
    if (!confirm('Delete ALL data? This action is irreversible.')) return;
    const { resetData } = await import('../services/export.service.js');
    await resetData();
  });
}
