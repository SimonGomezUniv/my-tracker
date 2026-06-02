import ChallengeModel from '../../models/challenge.js';
import TrackingEntryModel from '../../models/tracking-entry.js';
import TrackingTypeModel from '../../models/tracking-type.js';
import { computeChallengeStats, challengeTypeLabel } from '../../services/challenge-stats.service.js';
import { computeItemRewards, getUnlockedRewardMap, getRewardKey } from '../../services/challenge-rewards.service.js';
import { escapeHtml, toLocalDateKey } from '../../utils.js';

function toDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function dayKey(date) {
  return toLocalDateKey(date);
}

function rangeDays(startDate, endDate) {
  const days = [];
  for (let cursor = toDate(startDate); cursor <= toDate(endDate); cursor.setDate(cursor.getDate() + 1)) {
    days.push(dayKey(cursor));
  }
  return days;
}

function evaluateDaySuccess(item, dayTotal) {
  if (item.challengeType === 'boolean') return dayTotal >= 1;
  if (item.challengeType === 'daily') return dayTotal >= item.targetValue;
  if (item.challengeType === 'duration') return dayTotal >= item.targetValue;
  return dayTotal > 0;
}

function groupDaysByMonth(startDate, endDate) {
  const months = [];
  const cursor = new Date(toDate(startDate).getFullYear(), toDate(startDate).getMonth(), 1);
  const limit = new Date(toDate(endDate).getFullYear(), toDate(endDate).getMonth(), 1);

  while (cursor <= limit) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function renderChallengeHeatmap(challenge, item, stats) {
  const monthBlocks = groupDaysByMonth(challenge.startDate, challenge.endDate)
    .map(({ year, month }) => {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const monthStartKey = dayKey(firstDay) < challenge.startDate ? challenge.startDate : dayKey(firstDay);
      const monthEndKey = dayKey(lastDay) > challenge.endDate ? challenge.endDate : dayKey(lastDay);
      const activeDays = rangeDays(monthStartKey, monthEndKey);
      const startOffset = (firstDay.getDay() + 6) % 7;
      const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
      const maxDayTotal = Math.max(1, ...activeDays.map(key => stats.dayTotals.get(key) || 0));
      const completedDays = activeDays.filter(key => evaluateDaySuccess(item, stats.dayTotals.get(key) || 0)).length;

      const cells = [];
      for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
        const dayNumber = cellIndex - startOffset + 1;
        if (dayNumber < 1 || dayNumber > lastDay.getDate()) {
          cells.push('<div class="challenge-heatmap-cell challenge-heatmap-cell--empty"></div>');
          continue;
        }

        const current = new Date(year, month, dayNumber);
        const key = dayKey(current);
        const inChallengeRange = key >= challenge.startDate && key <= challenge.endDate;
        const dayTotal = inChallengeRange ? (stats.dayTotals.get(key) || 0) : 0;
        const success = inChallengeRange && evaluateDaySuccess(item, dayTotal);
        const intensity = inChallengeRange && dayTotal > 0 ? Math.max(0.18, Math.min(1, dayTotal / maxDayTotal)) : 0;

        cells.push(`
          <div
            class="challenge-heatmap-cell ${inChallengeRange ? 'challenge-heatmap-cell--in-range' : 'challenge-heatmap-cell--empty'} ${success ? 'challenge-heatmap-cell--success' : ''}"
            style="--heat-opacity:${intensity.toFixed(2)}"
            title="${escapeHtml(`${key} · ${dayTotal}${item.unit ? ` ${item.unit}` : ''}${success ? ' · success' : ''}`)}"
          >
            <span>${dayNumber}</span>
          </div>`);
      }

      return `
        <section class="challenge-heatmap-month">
          <div class="challenge-heatmap-month__header">
            <h3>${escapeHtml(firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))}</h3>
            <p>${completedDays} successful day${completedDays > 1 ? 's' : ''} / ${activeDays.length}</p>
          </div>
          <div class="challenge-heatmap-weekdays">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>
          <div class="challenge-heatmap-grid">${cells.join('')}</div>
        </section>`;
    })
    .join('');

  return `
    <div class="challenge-heatmap">
      ${monthBlocks}
    </div>`;
}

export default async function challengesEntryView(params) {
  const challengeId = params[0] ? decodeURIComponent(params[0]) : null;
  if (!challengeId) {
    return {
      html: `<div class="view-error"><h2>Challenge id is missing</h2><a href="#/challenges" class="btn btn-ghost">← Back</a></div>`,
      title: 'Error',
    };
  }

  const challenge = await ChallengeModel.get(challengeId);
  if (!challenge) {
    return {
      html: `<div class="view-error"><h2>Challenge not found</h2><a href="#/challenges" class="btn btn-ghost">← Back</a></div>`,
      title: 'Error',
    };
  }

  const [entries, trackingTypes] = await Promise.all([
    TrackingEntryModel.getAll(),
    TrackingTypeModel.getAll(),
  ]);
  const typeMap = Object.fromEntries(trackingTypes.map(type => [type.id, type]));
  const stats = computeChallengeStats(challenge, entries);
  const unlockedRewards = getUnlockedRewardMap();
  const itemSectionsHtml = stats.itemStats.map(({ item, stats: itemStats }) => {
    const sourceType = typeMap[item.trackingTypeId];
    const sourceField = (sourceType?.fields || []).find(field => field.name === item.fieldName);
    const sourceLabel = sourceType
      ? `${sourceType.icon || '📍'} ${sourceType.name}${sourceField ? ` → ${sourceField.label}` : ' → entries'}`
      : 'Tracking source unavailable';
    const linkedEntries = Array.isArray(itemStats.relevantEntries) ? itemStats.relevantEntries : [];
    const recentEntries = [...linkedEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 12);
    const todayKey = toLocalDateKey();
    const todayTotal = itemStats.dayTotals.get(todayKey) || 0;
    const heatmapHtml = renderChallengeHeatmap(challenge, item, itemStats);
    const rewards = computeItemRewards(challenge, item, itemStats);
    const rewardsHtml = rewards.length > 0
      ? `<div class="challenge-rewards-list">${rewards.map(reward => {
          const unlocked = !!unlockedRewards[getRewardKey(challenge.id, item.id, reward.id)];
          return `<span class="challenge-reward-badge ${unlocked ? 'challenge-reward-badge--unlocked' : ''}" title="${escapeHtml(reward.label)}">${reward.icon} ${escapeHtml(reward.label)}</span>`;
        }).join('')}</div>`
      : '<p class="text-muted">No reward unlocked yet for this item.</p>';

    return `
      <section class="editor-section challenge-item-section">
        <div class="challenge-item-section__header">
          <div>
            <h2 class="editor-section-title">${escapeHtml(item.name)}</h2>
            <p class="text-muted">${escapeHtml(sourceLabel)}</p>
          </div>
          <div class="challenge-item-section__badges">
            <span class="badge">${escapeHtml(challengeTypeLabel(item.challengeType))}</span>
            ${item.rewardsEnabled ? '<span class="badge">Rewards on</span>' : ''}
            ${item.remindersEnabled ? '<span class="badge">Reminder on</span>' : ''}
          </div>
        </div>

        <div class="challenge-kpis">
          <span>🎯 Target: ${escapeHtml(String(item.targetValue))}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}</span>
          <span>📍 Today: ${escapeHtml(String(todayTotal))}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}</span>
          <span>🔥 Current streak: ${itemStats.currentStreak}</span>
          <span>🏆 Best streak: ${itemStats.bestStreak}</span>
          <span>✅ Success rate: ${itemStats.successRate}%</span>
        </div>

        <div class="challenge-progress">
          <div class="challenge-progress__bar"><span style="width:${itemStats.progress}%"></span></div>
          <div class="challenge-progress__meta">
            <span>${itemStats.progress}%</span>
            <span>${escapeHtml(String(itemStats.totalValue))}${item.unit ? ` / ${escapeHtml(String(item.targetValue))} ${escapeHtml(item.unit)}` : ` / ${escapeHtml(String(item.targetValue))}`}</span>
          </div>
        </div>

        <div>
          <h3 class="challenge-subsection-title">Rewards</h3>
          ${rewardsHtml}
        </div>

        <div>
          <h3 class="challenge-subsection-title">Daily history</h3>
          <p class="text-muted">This item is computed only from its linked tracker entries.</p>
          ${heatmapHtml}
        </div>

        <div>
          <h3 class="challenge-subsection-title">Linked tracker entries (${linkedEntries.length})</h3>
          ${recentEntries.length === 0 ? '<p class="empty-state">No linked entry found for this item in the challenge period.</p>' : `
            <div class="history-list">
              ${recentEntries.map(entry => {
                const type = typeMap[entry.trackingTypeId];
                const date = toLocalDateKey(entry.timestamp) || 'Unknown date';
                const time = Number.isNaN(new Date(entry.timestamp).getTime())
                  ? 'Unknown time'
                  : new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return `
                  <div class="entry-item">
                    <div class="entry-item-top">
                      <div class="entry-item-meta">
                        <span class="entry-item-type">${escapeHtml(type?.icon || '📍')} ${escapeHtml(type?.name || 'Tracking')}</span>
                        <span class="entry-item-date">${escapeHtml(date)} · ${escapeHtml(time)}</span>
                      </div>
                    </div>
                    ${(type?.fields || []).map(field => {
                      const value = entry.data?.[field.name];
                      if (value === null || value === undefined || value === '') return '';
                      return `<span class="entry-field-chip"><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(String(value))}</span>`;
                    }).filter(Boolean).join('')}
                    ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ''}
                  </div>`;
              }).join('')}
            </div>`}
        </div>
      </section>`;
  }).join('');

  const html = `
    <div class="view-entry-form">
      <a href="#/challenges" class="btn btn-ghost btn-back">← Back to challenges</a>

      <div class="entry-form-header">
        <span class="entry-form-icon">${escapeHtml(challenge.icon || '🎯')}</span>
        <div>
          <h2 class="entry-form-type-name">${escapeHtml(challenge.name)}</h2>
          <p class="text-muted">Progress ${stats.progress}% · ${stats.completedItems}/${stats.itemCount} items completed · 🔥 Best current streak ${stats.currentStreak}</p>
        </div>
      </div>

      <section class="editor-section">
        <h2 class="editor-section-title">Challenge overview</h2>
        ${challenge.description ? `<p class="text-muted">${escapeHtml(challenge.description)}</p>` : ''}
        <div class="challenge-kpis">
          <span>🧩 Items: ${stats.itemCount}</span>
          <span>✅ Completed items: ${stats.completedItems}</span>
          <span>⏳ Active items: ${stats.activeItems}</span>
          <span>❌ Failed items: ${stats.failedItems}</span>
          <span>✅ Success rate: ${stats.successRate}%</span>
          <span>🏆 Best streak: ${stats.bestStreak}</span>
          <span>📅 Period: ${escapeHtml(challenge.startDate)} → ${escapeHtml(challenge.endDate)}</span>
        </div>
      </section>

      ${itemSectionsHtml}
    </div>`;

  return {
    html,
    title: `Progress: ${challenge.name}`,
  };
}
