/**
 * dashboard.js — Vue Tableau de bord
 */

import db from '../db.js';
import { renderEntryCard } from './history.js';
import {
  PERIOD_PRESETS,
  getPeriodRange,
  getGranularity,
  groupByPeriod,
  formatPeriodLabel,
  computeDurationTotal,
} from '../services/stats.service.js';
import { getHomeConfig } from '../services/home-customization.service.js';
import { escapeHtml } from '../utils.js';

export default async function dashboardView() {
  const [types, entries, groups, tags] = await Promise.all([
    db.getAll('trackingTypes'),
    db.getAll('trackingEntries'),
    db.getAll('trackingGroups'),
    db.getAll('tags'),
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

  const widgetsData = renderHomeWidgets(homeConfig.widgets, { types, entries, tags });

  const quickLinks = types.slice(0, 6).map(t => `
    <a href="#/new-entry/${t.id}" class="quick-card" style="--color: ${t.color || '#6366f1'}">
      <span class="quick-icon">${t.icon || '📍'}</span>
      <span class="quick-name">${t.name}</span>
    </a>`).join('');

  const html = `
    <div class="view-dashboard">

      ${countCards.length > 0 ? `<section class="dashboard-stats">${countCards.join('')}</section>` : ''}

      ${renderSections({ types, quickLinks, recentHtml, entries, widgetsData }, homeConfig.sectionOrder)}

    </div>`;

  return { html, title: 'Dashboard', bind: bindDashboardWidgets };
}

function renderHomeWidgets(widgets, context) {
  if (!Array.isArray(widgets) || widgets.length === 0) return { html: '', count: 0 };

  const typeMap = Object.fromEntries(context.types.map(t => [t.id, t]));
  const tagMap = Object.fromEntries(context.tags.map(t => [t.id, t]));

  const cards = widgets.map(widget => {
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
    const key = new Date(e.timestamp).toISOString().slice(0, 10);
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
    const key = d.toISOString().slice(0, 10);
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
  const sectionMap = {
    quick: data.types.length > 0
      ? `
      <section class="dashboard-section">
        <h2>Quick entry</h2>
        <div class="quick-grid">
          ${data.quickLinks}
          <a href="#/types" class="quick-card quick-card--add">
            <span class="quick-icon">➕</span>
            <span class="quick-name">New type</span>
          </a>
        </div>
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
    history: `
      <section class="dashboard-section dashboard-section--recent">
        <h2>Recent entries</h2>
        <div class="recent-list">${data.recentHtml}</div>
        ${data.entries.length > 5 ? `<a href="#/history" class="btn btn-ghost">View full history</a>` : ''}
      </section>`,
  };

  const normalized = Array.isArray(sectionOrder) ? sectionOrder : [];
  const ordered = [...normalized, 'quick', 'widgets', 'history']
    .filter((key, idx, arr) => ['quick', 'widgets', 'history'].includes(key) && arr.indexOf(key) === idx);

  return ordered.map(key => sectionMap[key]).join('');
}

function bindDashboardWidgets() {
  const toggleBtn = document.getElementById('btn-toggle-home-widgets');
  const widgetsContainer = document.getElementById('dashboard-home-widgets');
  if (!toggleBtn || !widgetsContainer) return;

  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.dataset.expanded === 'true';
    widgetsContainer.classList.toggle('dashboard-home-widgets--collapsed', expanded);
    toggleBtn.dataset.expanded = expanded ? 'false' : 'true';
    toggleBtn.textContent = expanded ? 'See more' : 'See less';
  });
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

function buildWordFrequency(entries, type) {
  const freq = {};
  const stringFields = (type.fields || []).filter(f => f.type === 'string');
  entries.forEach(e => {
    if (e.note?.trim()) tokenize(e.note).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
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
