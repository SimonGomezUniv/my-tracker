/**
 * types/list.js — Vue Liste des types de tracking
 */
import TrackingTypeModel from '../../models/tracking-type.js';
import { escapeHtml, showToast } from '../../utils.js';

export default async function typesListView() {
  const html = `
    <div class="view-list">
      <div class="view-header">
        <p class="view-subtitle">Types define what you can track and which fields each entry contains.</p>
        <a href="#/types/new" class="btn btn-primary">➕ New type</a>
      </div>
      <div id="types-container"></div>
    </div>`;

  return { html, title: 'Tracking types', bind: bindTypesListEvents };
}

async function renderTypesList() {
  const container = document.getElementById('types-container');
  if (!container) return;
  const types = await TrackingTypeModel.getAll();

  if (types.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <p>No tracking type defined yet.</p>
        <a href="#/types/new" class="btn btn-primary">Create my first type</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="items-grid">
      ${types.map(t => `
        <div class="item-card" style="--card-color: ${escapeHtml(t.color || '#6366f1')}">
          <div class="item-card-header">
            <span class="item-icon">${escapeHtml(t.icon || '📍')}</span>
            <div class="item-card-actions">
              <a href="#/types/edit/${escapeHtml(t.id)}" class="btn btn-sm btn-secondary" title="Edit">✏️</a>
              <button class="btn btn-sm btn-danger btn-delete-item"
                data-id="${escapeHtml(t.id)}"
                data-name="${escapeHtml(t.name)}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="item-card-body">
            <h3 class="item-name">${escapeHtml(t.name)}</h3>
            ${t.description ? `<p class="item-description">${escapeHtml(t.description)}</p>` : ''}
            <div class="item-meta">
              <span class="badge">${t.fields?.length || 0} field${(t.fields?.length || 0) !== 1 ? 's' : ''}</span>
              ${(t.tags?.length > 0) ? `<span class="badge badge-primary">${t.tags.length} tag${t.tags.length > 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
          <div class="item-card-footer">
            <a href="#/new-entry/${escapeHtml(t.id)}" class="btn btn-sm btn-primary btn-full">➕ New entry</a>
          </div>
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete type "${btn.dataset.name}"? Existing entries will no longer be shown.`)) return;
      await TrackingTypeModel.delete(btn.dataset.id);
      showToast(`Type "${btn.dataset.name}" deleted.`, 'success');
      await renderTypesList();
    });
  });
}

function bindTypesListEvents() {
  renderTypesList();
}
