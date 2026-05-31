import ChallengeModel from '../../models/challenge.js';
import TrackingEntryModel from '../../models/tracking-entry.js';
import TrackingTypeModel from '../../models/tracking-type.js';
import { computeChallengeStats, challengeTypeLabel } from '../../services/challenge-stats.service.js';
import { escapeHtml, showToast } from '../../utils.js';

export default async function challengesListView() {
  const html = `
    <div class="view-list">
      <div class="view-header">
        <p class="view-subtitle">Group several tracked items into one challenge period while keeping each item streak and reward separate.</p>
        <a href="#/challenges/new" class="btn btn-primary">➕ New challenge</a>
      </div>
      <div id="challenges-container"></div>
    </div>`;

  return { html, title: 'Challenges', bind: bindChallengesListEvents };
}

async function renderChallengesList() {
  const container = document.getElementById('challenges-container');
  if (!container) return;

  const [challenges, allEntries, types] = await Promise.all([
    ChallengeModel.getAll(),
    TrackingEntryModel.getAll(),
    TrackingTypeModel.getAll(),
  ]);
  const typeMap = Object.fromEntries(types.map(type => [type.id, type]));

  if (challenges.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <p>No challenge created yet.</p>
        <a href="#/challenges/new" class="btn btn-primary">Create my first challenge</a>
      </div>`;
    return;
  }

  const cards = challenges
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(challenge => {
      const stats = computeChallengeStats(challenge, allEntries);
      const statusBadgeClass = stats.status === 'completed' ? 'badge-success' : stats.status === 'failed' ? 'badge-danger' : 'badge-primary';
      const statusLabel = stats.status === 'completed' ? 'Completed' : stats.status === 'failed' ? 'Failed' : 'Active';
      const itemLabel = (challenge.items || [])
        .map(item => {
          const type = typeMap[item.trackingTypeId];
          if (!type) return null;
          const field = (type.fields || []).find(fieldItem => fieldItem.name === item.fieldName);
          const measureLabel = field ? field.label : 'entries';
          return `${item.name} · ${type.name} → ${measureLabel}`;
        })
        .filter(Boolean)
        .join(', ');
      const previewHtml = stats.itemStats.slice(0, 3).map(({ item, stats: itemStats }) => `
        <div class="challenge-item-preview">
          <div class="challenge-item-preview__header">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${itemStats.progress}%</span>
          </div>
          <div class="challenge-progress">
            <div class="challenge-progress__bar"><span style="width:${itemStats.progress}%"></span></div>
          </div>
          <div class="challenge-item-preview__meta">
            <span>${escapeHtml(challengeTypeLabel(item.challengeType))}</span>
            <span>🔥 ${itemStats.currentStreak}</span>
            <span>✅ ${itemStats.successRate}%</span>
          </div>
        </div>`).join('');

      return `
        <article class="item-card" style="--card-color: ${escapeHtml(challenge.color || '#2563eb')}">
          <div class="item-card-header">
            <span class="item-icon">${escapeHtml(challenge.icon || '🎯')}</span>
            <div class="item-card-actions">
              <a href="#/challenges/entry/${encodeURIComponent(challenge.id)}" class="btn btn-sm btn-secondary" title="Progress">📝</a>
              <a href="#/challenges/edit/${escapeHtml(challenge.id)}" class="btn btn-sm btn-secondary" title="Edit">✏️</a>
              <button class="btn btn-sm btn-danger btn-delete-challenge" data-id="${escapeHtml(challenge.id)}" data-name="${escapeHtml(challenge.name)}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="item-card-body">
            <h3 class="item-name">${escapeHtml(challenge.name)}</h3>
            ${challenge.description ? `<p class="item-description">${escapeHtml(challenge.description)}</p>` : ''}
            ${itemLabel ? `<p class="item-description">Items: ${escapeHtml(itemLabel)}</p>` : ''}
            <div class="item-meta" style="margin-bottom:8px">
              <span class="badge ${statusBadgeClass}">${statusLabel}</span>
              ${challenge.category ? `<span class="badge">${escapeHtml(challenge.category)}</span>` : ''}
              <span class="badge">${stats.completedItems}/${stats.itemCount} items completed</span>
            </div>
            <div class="challenge-progress">
              <div class="challenge-progress__bar"><span style="width:${stats.progress}%"></span></div>
              <div class="challenge-progress__meta">
                <span>${stats.progress}%</span>
                <span>${stats.completedItems}/${stats.itemCount} completed</span>
              </div>
            </div>
            <div class="challenge-kpis">
              <span>🔥 ${stats.currentStreak}</span>
              <span>🏆 ${stats.bestStreak}</span>
              <span>✅ ${stats.successRate}%</span>
            </div>
            ${previewHtml ? `<div class="challenge-item-preview-list">${previewHtml}</div>` : ''}
          </div>
        </article>`;
    }).join('');

  container.innerHTML = `<div class="items-grid">${cards}</div>`;

  container.querySelectorAll('.btn-delete-challenge').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete challenge "${btn.dataset.name}"?`)) return;
      await ChallengeModel.delete(btn.dataset.id);
      showToast(`Challenge "${btn.dataset.name}" deleted.`, 'success');
      await renderChallengesList();
    });
  });
}

function bindChallengesListEvents() {
  renderChallengesList();
}
