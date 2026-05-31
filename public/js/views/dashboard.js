/**
 * dashboard.js — Vue Tableau de bord
 */

import db from '../db.js';
import ChallengeModel from '../models/challenge.js';
import { renderEntryCard } from './history.js';
import {
  PERIOD_PRESETS,
  getPeriodRange,
  getGranularity,
  groupByPeriod,
  formatPeriodLabel,
  computeDurationTotal,
} from '../services/stats.service.js';
import { computeChallengeStats, challengeTypeLabel } from '../services/challenge-stats.service.js';
import { getHomeConfig } from '../services/home-customization.service.js';
import { escapeHtml, toLocalDateKey } from '../utils.js';

export default async function dashboardView() {
  const [types, entries, groups, tags, challenges] = await Promise.all([
    db.getAll('trackingTypes'),
    db.getAll('trackingEntries'),
    db.getAll('trackingGroups'),
    db.getAll('tags'),
    ChallengeModel.getAll(),
  ]);
  const homeConfig = getHomeConfig();

  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  const typeMap = Object.fromEntries(types.map(t => [t.id, t]));

  const renderedRecentCards = recentEntries
    .map(e => renderEntryCard(e, typeMap[e.trackingTypeId], false))
    .filter(Boolean)
    .join('');

  const recentHtml = renderedRecentCards || '<p class="empty-state">No entries yet.</p>';

  const countCards = [];
  if (homeConfig.showCounts.entries) {
    countCards.push(`
      <div class="stat-card">
        <span class="stat-value">${entries.length}</span>
        <span class="stat-label">Total entries</span>
      </div>`);
  }
  if (homeConfig.showCounts.types) {
    countCards.push(`
      <div class="stat-card">
        <span class="stat-value">${types.length}</span>
        <span class="stat-label">Tracking types</span>
      </div>`);
  }
  if (homeConfig.showCounts.groups) {
    countCards.push(`
      <div class="stat-card">
        <span class="stat-value">${groups.length}</span>
        <span class="stat-label">Groups</span>
      </div>`);
  }

  const widgetsData = renderHomeWidgets(homeConfig.widgets, { types, entries, tags, challenges });

  const quickLinks = types.map(t => `
    <a href="#/new-entry/${t.id}" class="quick-card" style="--color: ${t.color || '#6366f1'}">
      <span class="quick-icon">${t.icon || '📍'}</span>
      <span class="quick-name">${t.name}</span>
    </a>`).join('');

  const checklistHtml = homeConfig.showChecklist === false
    ? ''
    : renderTodayChecklist(challenges, entries, typeMap);

  const html = `
    <div class="view-dashboard">

      ${countCards.length > 0 ? `<section class="dashboard-stats">${countCards.join('')}</section>` : ''}

      ${renderSections({ types, quickLinks, recentHtml, entries, widgetsData, checklistHtml, homeConfig }, homeConfig.sectionOrder)}

    </div>`;

  return { html, title: 'Dashboard', bind: bindDashboardWidgets };
}

function renderTodayChecklist(challenges, entries, typeMap) {
  const today = toLocalDateKey();
  const pending = [];

  challenges.forEach(challenge => {
    const stats = computeChallengeStats(challenge, entries);
    stats.itemStats.forEach(({ item, stats: itemStats }) => {
      if (!item?.remindersEnabled) return;
      if (today < challenge.startDate || today > challenge.endDate) return;
      if (itemStats.status !== 'active') return;

      const todayValue = itemStats.dayTotals.get(today) || 0;
      const doneToday = item.challengeType === 'boolean'
        ? todayValue >= 1
        : todayValue >= item.targetValue;
      if (doneToday) return;

      pending.push({ challenge, item, itemStats, todayValue });
    });
  });

  if (pending.length === 0) {
    return `
      <section class="dashboard-section dashboard-section--checklist">
        <h2>Today checklist</h2>
        <p class="empty-state">All reminder-enabled challenge items are done for today.</p>
      </section>`;
  }

  const cards = pending
    .sort((a, b) => b.itemStats.currentStreak - a.itemStats.currentStreak)
    .slice(0, 8)
    .map(({ challenge, item, itemStats, todayValue }) => {
      const type = typeMap[item.trackingTypeId];
      const targetLabel = item.challengeType === 'boolean'
        ? 'Done / Not done'
        : `${todayValue} / ${item.targetValue}${item.unit ? ` ${item.unit}` : ''}`;
      return `
        <a class="checklist-item" href="#/new-entry/${escapeHtml(item.trackingTypeId)}" style="--checklist-color:${escapeHtml(challenge.color || '#2563eb')}">
          <div class="checklist-item__header">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(type?.icon || '📍')} ${escapeHtml(type?.name || 'Tracking')}</span>
          </div>
          <div class="checklist-item__meta">
            <span>${escapeHtml(challenge.name)}</span>
            <span>${escapeHtml(targetLabel)}</span>
            <span>🔥 ${itemStats.currentStreak}</span>
          </div>
        </a>`;
    }).join('');

  return `
    <section class="dashboard-section dashboard-section--checklist">
      <h2>Today checklist</h2>
      <div class="checklist-list">${cards}</div>
    </section>`;
}

function renderHomeWidgets(widgets, context) {
  if (!Array.isArray(widgets) || widgets.length === 0) return { html: '', count: 0 };

  const typeMap = Object.fromEntries(context.types.map(t => [t.id, t]));
  const tagMap = Object.fromEntries(context.tags.map(t => [t.id, t]));
  const challengeMap = Object.fromEntries((context.challenges || []).map(challenge => [challenge.id, challenge]));

  const cards = widgets.map(widget => {
    if (widget.kind === 'challenge-summary') {
      return renderChallengeSummaryWidget(context.challenges || [], context.entries || []);
    }

    if (widget.kind === 'challenge-card') {
      const challenge = challengeMap[widget.challengeId];
      if (!challenge) {
        return `
          <article class="home-widget-card">
            <header class="home-widget-header"><h3>Invalid widget</h3></header>
            <p class="empty-state">The linked challenge was deleted.</p>
          </article>`;
      }
      return renderChallengeCardWidget(challenge, context.entries || [], typeMap);
    }

    const widgetTypeIds = Array.isArray(widget.trackingTypeIds)
      ? widget.trackingTypeIds
      : (widget.trackingTypeId ? [widget.trackingTypeId] : []);
    const selectedTypes = widgetTypeIds.map(id => typeMap[id]).filter(Boolean);
    const primaryType = selectedTypes[0];

    if (!primaryType) {
      return `
        <article class="home-widget-card">
          <header class="home-widget-header"><h3>Invalid widget</h3></header>
          <p class="empty-state">The linked type was deleted.</p>
        </article>`;
    }

    const { start, end } = getPeriodRange(widget.period || '30d');
    const scopedEntries = context.entries.filter(e => {
      if (!widgetTypeIds.includes(e.trackingTypeId)) return false;
      const ts = new Date(e.timestamp);
      if (ts < start || ts > end) return false;
      if (Array.isArray(widget.tagIds) && widget.tagIds.length > 0) {
        return widget.tagIds.some(tagId => e.tags?.includes(tagId));
      }
      return true;
    });

    const periodLabel = PERIOD_PRESETS.find(p => p.value === widget.period)?.label || 'Last 30 days';
    const tagLabel = widget.tagIds?.length
      ? widget.tagIds.map(id => tagMap[id]?.name).filter(Boolean).join(', ')
      : 'All tags';

    let bodyHtml = '<p class="empty-state">No data for this widget in the selected period.</p>';

    if (scopedEntries.length > 0) {
      if (widget.kind === 'word-cloud') {
        bodyHtml = renderWordCloudInline(buildWordFrequency(scopedEntries, primaryType));
      } else if (widget.kind === 'duration-total') {
        const durationFields = (primaryType.fields || []).filter(f => f.type === 'duration');
        const blocks = durationFields.map(f => {
          const d = computeDurationTotal(scopedEntries, f.name);
          if (!d) return '';
          const value = d.hours > 0
            ? `${d.hours}h${d.minutes > 0 ? String(d.minutes).padStart(2, '0') : ''}`
            : `${d.minutes}min`;
          return `<div class="home-widget-duration-row"><strong>${escapeHtml(f.label)}</strong><span>${value}</span></div>`;
        }).filter(Boolean).join('');
        bodyHtml = blocks || '<p class="empty-state">No duration field for this type.</p>';
      } else if (widget.kind === 'entries-chart') {
        bodyHtml = renderWidgetBarChart(scopedEntries, start, end);
      } else if (widget.kind === 'calendar') {
        bodyHtml = renderMiniCalendar(scopedEntries, typeMap, widgetTypeIds, end);
      }
    }

    const titleByKind = {
      'word-cloud': 'Word cloud',
      'duration-total': 'Total duration',
      'entries-chart': 'Entries per day',
      'calendar': 'Calendar',
    };

    return `
      <article class="home-widget-card">
        <header class="home-widget-header">
          <h3>${titleByKind[widget.kind] || 'Widget'} · ${widget.kind === 'calendar' && selectedTypes.length > 1
            ? `${selectedTypes.length} types`
            : `${escapeHtml(primaryType.icon || '📍')} ${escapeHtml(primaryType.name)}`}</h3>
          <p>${escapeHtml(periodLabel)} · ${escapeHtml(tagLabel)}</p>
        </header>
        <div class="home-widget-body">${bodyHtml}</div>
      </article>`;
  }).join('');

  return { html: cards, count: widgets.length };
}

function renderChallengeCardWidget(challenge, allEntries, typeMap) {
  const stats = computeChallengeStats(challenge, allEntries);
  const statusBadgeClass = stats.status === 'completed' ? 'badge-success' : stats.status === 'failed' ? 'badge-danger' : 'badge-primary';
  const statusLabel = stats.status === 'completed' ? 'Completed' : stats.status === 'failed' ? 'Failed' : 'Active';

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
        <span class="challenge-item-preview__pill">🔥 ${itemStats.currentStreak}</span>
        <span class="challenge-item-preview__pill">✅ ${itemStats.successRate}%</span>
      </div>
    </div>`).join('');

  return `
    <article class="item-card" style="--card-color: ${escapeHtml(challenge.color || '#2563eb')}">
      <div class="item-card-header">
        <span class="item-icon">${escapeHtml(challenge.icon || '🎯')}</span>
        <div class="item-card-actions">
          <a href="#/challenges/entry/${encodeURIComponent(challenge.id)}" class="btn btn-sm btn-secondary" title="Progress">📝</a>
          <a href="#/challenges/edit/${encodeURIComponent(challenge.id)}" class="btn btn-sm btn-secondary" title="Edit">✏️</a>
        </div>
      </div>
      <div class="item-card-body">
        <h3 class="item-name">${escapeHtml(challenge.name)}</h3>
        ${challenge.description ? `<p class="item-description">${escapeHtml(challenge.description)}</p>` : ''}
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
}

function renderChallengeSummaryWidget(challenges, entries) {
  const challengeStats = challenges
    .map(challenge => ({ challenge, stats: computeChallengeStats(challenge, entries) }))
    .sort((left, right) => {
      const statusWeight = status => (status === 'active' ? 0 : status === 'completed' ? 1 : 2);
      const byStatus = statusWeight(left.stats.status) - statusWeight(right.stats.status);
      if (byStatus !== 0) return byStatus;
      return right.stats.progress - left.stats.progress;
    });

  const activeCount = challengeStats.filter(item => item.stats.status === 'active').length;
  const completedCount = challengeStats.filter(item => item.stats.status === 'completed').length;
  const bestStreak = challengeStats.reduce((max, item) => Math.max(max, item.stats.currentStreak), 0);

  const bodyHtml = challengeStats.length === 0
    ? '<p class="empty-state">No challenge created yet.</p>'
    : `
      <div class="challenge-widget-overview">
        <div class="challenge-widget-metric"><strong>${activeCount}</strong><span>Active</span></div>
        <div class="challenge-widget-metric"><strong>${completedCount}</strong><span>Completed</span></div>
        <div class="challenge-widget-metric"><strong>${bestStreak}</strong><span>Best current streak</span></div>
      </div>
      <div class="challenge-widget-list">
        ${challengeStats.slice(0, 3).map(({ challenge, stats }) => `
          <a href="#/challenges/entry/${encodeURIComponent(challenge.id)}" class="challenge-widget-item" style="--challenge-color:${escapeHtml(challenge.color || '#2563eb')}">
            <div class="challenge-widget-item__header">
              <span>${escapeHtml(challenge.icon || '🎯')} ${escapeHtml(challenge.name)}</span>
              <strong>${stats.completedItems}/${stats.itemCount}</strong>
            </div>
            <div class="challenge-progress">
              <div class="challenge-progress__bar"><span style="width:${stats.progress}%"></span></div>
            </div>
            <div class="challenge-widget-item__meta">
              <span>🔥 ${stats.currentStreak}</span>
              <span>✅ ${stats.successRate}%</span>
              <span>🧩 ${stats.itemCount} items</span>
            </div>
          </a>`).join('')}
      </div>
      <a href="#/challenges" class="btn btn-ghost btn-sm">Open challenges</a>`;

  return `
    <article class="home-widget-card home-widget-card--challenge">
      <header class="home-widget-header">
        <h3>Challenges overview</h3>
        <p>Progress derived from your linked tracker entries.</p>
      </header>
      <div class="home-widget-body">${bodyHtml}</div>
    </article>`;
}

function renderWidgetBarChart(entries, start, end) {
  const granularity = getGranularity(start, end);
  const grouped = groupByPeriod(entries, granularity);
  const keys = Array.from(grouped.keys()).sort();
  if (keys.length === 0) return '<p class="empty-state">No data.</p>';

  const maxCount = Math.max(1, ...keys.map(k => grouped.get(k)?.length || 0));
  return `
    <div class="chart-container">
      <div class="chart-bars home-widget-bars">
        ${keys.map(key => {
          const count = grouped.get(key)?.length || 0;
          const pct = Math.round((count / maxCount) * 100);
          return `<div class="chart-bar-col">
            <span class="chart-bar-count">${count > 0 ? count : ''}</span>
            <div class="chart-bar-fill" style="height:${count > 0 ? Math.max(pct, 4) : 0}%"></div>
            <span class="chart-bar-label">${formatPeriodLabel(key, granularity)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderMiniCalendar(entries, typeMap, selectedTypeIds, endDate) {
  const focus = new Date(endDate);
  const year = focus.getFullYear();
  const month = focus.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const byDay = new Map();
  entries.forEach(e => {
    const key = toLocalDateKey(e.timestamp);
    if (!key) return;
    const arr = byDay.get(key) || [];
    arr.push(e);
    byDay.set(key, arr);
  });

  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      cells.push('<div class="calendar-cell calendar-cell--empty"></div>');
      continue;
    }
    const d = new Date(year, month, dayNum);
    const key = toLocalDateKey(d);
    const dayEntries = byDay.get(key) || [];
    const hasData = dayEntries.length > 0;
    const valueLabel = hasData ? computeCalendarValue(dayEntries, typeMap) : '';
    const icons = hasData
      ? [...new Set(dayEntries.map(e => typeMap[e.trackingTypeId]?.icon || '📍'))].slice(0, 3)
      : [];
    cells.push(`
      <div class="calendar-cell ${hasData ? 'calendar-cell--active' : ''}">
        <span class="calendar-day">${dayNum}</span>
        ${hasData ? `<span class="calendar-icon-stack">${icons.map(i => `<span class="calendar-icon">${escapeHtml(i)}</span>`).join('')}</span>` : ''}
        ${hasData ? `<span class="calendar-value">${escapeHtml(valueLabel)}</span>` : ''}
      </div>`);
  }

  return `
    <div class="calendar-widget">
      <div class="calendar-widget-header">${escapeHtml(monthLabel)}</div>
      <div class="calendar-weekdays">${weekDays.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="calendar-grid">${cells.join('')}</div>
    </div>`;
}

function computeCalendarValue(entries, typeMap) {
  for (const entry of entries) {
    const t = typeMap[entry.trackingTypeId];
    const fields = t?.fields || [];
    const durationField = fields.find(f => f.type === 'duration');
    if (durationField) {
      const d = computeDurationTotal(entries.filter(e => e.trackingTypeId === entry.trackingTypeId), durationField.name);
      if (d) {
        return d.hours > 0 ? `${d.hours}h${String(d.minutes).padStart(2, '0')}` : `${d.minutes}m`;
      }
    }
  }
  return `${entries.length}`;
}

function renderSections(data, sectionOrder = []) {
  const compactQuickEntry = data.homeConfig?.quickEntryCompact !== false;

  const sectionMap = {
    quick: data.types.length > 0
      ? `
      <section class="dashboard-section">
        <h2>Quick entry</h2>
        ${compactQuickEntry
          ? `
            <div class="quick-entry-compact">
              <button type="button" id="btn-toggle-quick-entry" class="quick-card quick-card--add quick-card--toggle" aria-expanded="false" aria-controls="quick-entry-panel" aria-label="Afficher quick entry">
                <span class="quick-icon" aria-hidden="true">➕</span>
                <span class="quick-name">Quick entry</span>
              </button>
              <div id="quick-entry-panel" class="quick-entry-compact__panel hidden">
                <div class="quick-grid">
                  ${data.quickLinks}
                  <a href="#/types" class="quick-card quick-card--add">
                    <span class="quick-icon">➕</span>
                    <span class="quick-name">New type</span>
                  </a>
                </div>
              </div>
            </div>`
          : `
            <div class="quick-grid">
              ${data.quickLinks}
              <a href="#/types" class="quick-card quick-card--add">
                <span class="quick-icon">➕</span>
                <span class="quick-name">New type</span>
              </a>
            </div>`}
      </section>`
      : `
      <section class="dashboard-section onboarding">
        <div class="onboarding-box">
          <h2>Welcome to My Tracker!</h2>
          <p>Start by creating a <strong>tracking type</strong> to define what you want to track.</p>
          <a href="#/types" class="btn btn-primary">Create my first type</a>
        </div>
      </section>`,
    widgets: data.widgetsData?.html
      ? `
      <section class="dashboard-section dashboard-section--widgets">
        <h2>Custom stats</h2>
        <div id="dashboard-home-widgets" class="dashboard-home-widgets dashboard-home-widgets--collapsed">${data.widgetsData.html}</div>
        ${data.widgetsData.count > 3
          ? '<button type="button" id="btn-toggle-home-widgets" class="btn btn-secondary btn-sm home-widgets-toggle" data-expanded="false">See more</button>'
          : ''}
      </section>`
      : '',
    checklist: data.checklistHtml || '',
    history: `
      <section class="dashboard-section dashboard-section--recent">
        <h2>Recent entries</h2>
        <div class="recent-list">${data.recentHtml}</div>
        ${data.entries.length > 5 ? `<a href="#/history" class="btn btn-ghost">View full history</a>` : ''}
      </section>`,
  };

  const normalized = Array.isArray(sectionOrder) ? sectionOrder : [];
  const ordered = [...normalized, 'quick', 'checklist', 'widgets', 'history']
    .filter((key, idx, arr) => ['quick', 'checklist', 'widgets', 'history'].includes(key) && arr.indexOf(key) === idx);

  return ordered.map(key => sectionMap[key]).join('');
}

function bindDashboardWidgets() {
  const toggleBtn = document.getElementById('btn-toggle-home-widgets');
  const widgetsContainer = document.getElementById('dashboard-home-widgets');
  if (toggleBtn && widgetsContainer) {
    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.dataset.expanded === 'true';
      widgetsContainer.classList.toggle('dashboard-home-widgets--collapsed', expanded);
      toggleBtn.dataset.expanded = expanded ? 'false' : 'true';
      toggleBtn.textContent = expanded ? 'See more' : 'See less';
    });
  }

  const quickToggleBtn = document.getElementById('btn-toggle-quick-entry');
  const quickPanel = document.getElementById('quick-entry-panel');
  if (quickToggleBtn && quickPanel) {
    quickToggleBtn.addEventListener('click', () => {
      const expanded = quickToggleBtn.getAttribute('aria-expanded') === 'true';
      quickToggleBtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      quickToggleBtn.setAttribute('aria-label', expanded ? 'Afficher quick entry' : 'Masquer quick entry');
      const icon = quickToggleBtn.querySelector('.quick-icon');
      const label = quickToggleBtn.querySelector('.quick-name');
      if (icon) {
        icon.textContent = expanded ? '➕' : '✕';
      }
      if (label) {
        label.textContent = expanded ? 'Quick entry' : 'Hide quick entry';
      }
      quickPanel.classList.toggle('hidden', expanded);
    });
  }
}

const STOPWORDS = new Set([
  'le','la','les','de','du','des','un','une','et','en','a','au','aux',
  'est','que','qui','pour','par','sur','avec','dans','plus','tout','pas',
  'je','tu','il','elle','nous','vous','ils','elles','on','se','ce','cet',
  'cette','ces','mon','ma','mes','ton','ta','tes','son','sa','ses',
  'mais','ou','donc','car','ni','comme','tres','bien','ca','fait','apres',
  'the','a','an','and','is','in','on','at','to','for','of','or','not',
  'this','that','it','was','he','she','they','be','are','were','been',
  'have','has','had','do','did','my','your','his','her','its','our','their',
]);

const WORD_COLORS = [
  'var(--color-primary)', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#8b5cf6', '#ef4444',
];

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
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

function renderWordCloudInline(freq) {
  const words = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 45);
  if (words.length === 0) return '<p class="empty-state">No significant words found.</p>';
  const max = words[0][1];
  const wordsHtml = words.map(([word, count]) => {
    const size = (0.72 + (count / max) * 1.4).toFixed(2);
    const weight = count / max > 0.5 ? '600' : '400';
    const colorIdx = word.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % WORD_COLORS.length;
    const color = WORD_COLORS[colorIdx];
    return `<span class="word-cloud-word" style="font-size:${size}rem;font-weight:${weight};color:${color}" title="${count}x">${escapeHtml(word)}</span>`;
  }).join('');
  return `<div class="word-cloud">${wordsHtml}</div>`;
}
