/**
 * dashboard.js — Vue Tableau de bord
 */

import db from '../db.js';

export default async function dashboardView() {
  const [types, entries, groups] = await Promise.all([
    db.getAll('trackingTypes'),
    db.getAll('trackingEntries'),
    db.getAll('trackingGroups'),
  ]);

  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  const typeMap = Object.fromEntries(types.map(t => [t.id, t]));

  const recentHtml = recentEntries.length
    ? recentEntries.map(e => {
        const type = typeMap[e.trackingTypeId];
        const date = new Date(e.timestamp).toLocaleString('fr-FR');
        return `
          <div class="entry-card">
            <span class="entry-icon">${type?.icon || '📍'}</span>
            <div class="entry-info">
              <strong>${type?.name || 'Inconnu'}</strong>
              <small>${date}</small>
            </div>
          </div>`;
      }).join('')
    : '<p class="empty-state">Aucune saisie pour l\'instant.</p>';

  const quickLinks = types.slice(0, 6).map(t => `
    <a href="#/new-entry/${t.id}" class="quick-card" style="--color: ${t.color || '#6366f1'}">
      <span class="quick-icon">${t.icon || '📍'}</span>
      <span class="quick-name">${t.name}</span>
    </a>`).join('');

  const html = `
    <div class="view-dashboard">

      <section class="dashboard-stats">
        <div class="stat-card">
          <span class="stat-value">${entries.length}</span>
          <span class="stat-label">Saisies totales</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${types.length}</span>
          <span class="stat-label">Types de tracking</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${groups.length}</span>
          <span class="stat-label">Groupes</span>
        </div>
      </section>

      ${types.length > 0 ? `
      <section class="dashboard-section">
        <h2>Saisie rapide</h2>
        <div class="quick-grid">
          ${quickLinks}
          <a href="#/types" class="quick-card quick-card--add">
            <span class="quick-icon">➕</span>
            <span class="quick-name">Nouveau type</span>
          </a>
        </div>
      </section>` : `
      <section class="dashboard-section onboarding">
        <div class="onboarding-box">
          <h2>Bienvenue sur My Tracker !</h2>
          <p>Commencez par créer un <strong>type de tracking</strong> pour définir ce que vous souhaitez suivre.</p>
          <a href="#/types" class="btn btn-primary">Créer mon premier type</a>
        </div>
      </section>`}

      <section class="dashboard-section">
        <h2>Dernières saisies</h2>
        <div class="recent-list">${recentHtml}</div>
        ${entries.length > 5 ? `<a href="#/history" class="btn btn-ghost">Voir tout l'historique</a>` : ''}
      </section>

    </div>`;

  return { html, title: 'Tableau de bord' };
}
