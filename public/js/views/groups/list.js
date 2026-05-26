/**
 * groups/list.js — Vue Liste des groupes de tracking
 */
import TrackingGroupModel from '../../models/tracking-group.js';
import TrackingTypeModel from '../../models/tracking-type.js';
import { escapeHtml, showToast } from '../../utils.js';

export default async function groupsListView() {
  const html = `
    <div class="view-list">
      <div class="view-header">
        <p class="view-subtitle">Les groupes permettent de regrouper plusieurs types de tracking sous une même catégorie.</p>
        <a href="#/groups/new" class="btn btn-primary">➕ Nouveau groupe</a>
      </div>
      <div id="groups-container"></div>
    </div>`;

  return { html, title: 'Groupes', bind: bindGroupsListEvents };
}

async function renderGroupsList() {
  const container = document.getElementById('groups-container');
  if (!container) return;

  const [groups, types] = await Promise.all([
    TrackingGroupModel.getAll(),
    TrackingTypeModel.getAll(),
  ]);
  const typeMap = Object.fromEntries(types.map(t => [t.id, t]));

  if (groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <p>Aucun groupe défini.</p>
        <a href="#/groups/new" class="btn btn-primary">Créer mon premier groupe</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="items-grid">
      ${groups.map(g => {
        const memberTypes = (g.trackingTypeIds || [])
          .map(id => typeMap[id])
          .filter(Boolean);
        return `
        <div class="item-card" style="--card-color: ${escapeHtml(g.color || '#6366f1')}">
          <div class="item-card-header">
            <span class="item-icon">${escapeHtml(g.icon || '📁')}</span>
            <div class="item-card-actions">
              <a href="#/groups/edit/${escapeHtml(g.id)}" class="btn btn-sm btn-secondary" title="Modifier">✏️</a>
              <button class="btn btn-sm btn-danger btn-delete-item"
                data-id="${escapeHtml(g.id)}"
                data-name="${escapeHtml(g.name)}" title="Supprimer">🗑️</button>
            </div>
          </div>
          <div class="item-card-body">
            <h3 class="item-name">${escapeHtml(g.name)}</h3>
            ${g.description ? `<p class="item-description">${escapeHtml(g.description)}</p>` : ''}
            <div class="item-meta">
              <span class="badge">${memberTypes.length} type${memberTypes.length !== 1 ? 's' : ''}</span>
            </div>
            ${memberTypes.length > 0 ? `
              <div class="group-types-preview">
                ${memberTypes.slice(0, 4).map(t => `
                  <span class="mini-type-chip" style="border-color: ${escapeHtml(t.color)}">
                    ${escapeHtml(t.icon || '📍')} ${escapeHtml(t.name)}
                  </span>`).join('')}
                ${memberTypes.length > 4 ? `<span class="badge">+${memberTypes.length - 4}</span>` : ''}
              </div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  container.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Supprimer le groupe "${btn.dataset.name}" ?`)) return;
      await TrackingGroupModel.delete(btn.dataset.id);
      showToast(`Groupe "${btn.dataset.name}" supprimé.`, 'success');
      await renderGroupsList();
    });
  });
}

function bindGroupsListEvents() {
  renderGroupsList();
}
