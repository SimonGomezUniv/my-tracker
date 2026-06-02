import { toLocalDateKey } from '../utils.js';

function toDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function dayKey(date) {
  return toLocalDateKey(date);
}

function rangeDays(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  const days = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(dayKey(d));
  }

  return days;
}

function evaluateDaySuccess(item, dayTotal) {
  if (item.challengeType === 'boolean') return dayTotal >= 1;
  if (item.challengeType === 'daily') return dayTotal >= item.targetValue;
  if (item.challengeType === 'duration') return dayTotal >= item.targetValue;
  // For cumulative challenges, a day is considered successful if there is progress.
  return dayTotal > 0;
}

function parseDurationToMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function computeSourceContribution(entry, item) {
  // If no field is linked, the item tracks number of entries.
  if (!item.fieldName) return 1;

  // A linked field means "sum this field value".
  const rawValue = entry.data?.[item.fieldName];
  if (typeof rawValue === 'boolean') return rawValue ? 1 : 0;

  const durationMinutes = parseDurationToMinutes(rawValue);
  if (durationMinutes !== null) return durationMinutes;

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function computeChallengeItemStats(challenge, item, trackingEntries = []) {
  const relevantEntries = trackingEntries.filter(entry => {
    if (!entry?.trackingTypeId || !entry?.timestamp) return false;
    return entry.trackingTypeId === item.trackingTypeId;
  });
  const relevantEntriesInPeriod = [];

  const dayTotals = new Map();
  let totalValue = 0;

  relevantEntries.forEach(entry => {
    const entryDate = toLocalDateKey(entry.timestamp);
    if (!entryDate) return;
    if (entryDate < challenge.startDate || entryDate > challenge.endDate) return;

    relevantEntriesInPeriod.push(entry);

    const contribution = computeSourceContribution(entry, item);
    if (!contribution) return;

    dayTotals.set(entryDate, (dayTotals.get(entryDate) || 0) + contribution);
    totalValue += contribution;
  });

  const today = new Date();
  const todayKey = dayKey(today);
  const startDate = challenge.startDate;
  const endDate = challenge.endDate;
  const elapsedEnd = todayKey < endDate ? todayKey : endDate;

  const periodDays = rangeDays(startDate, endDate);
  const elapsedDays = elapsedEnd >= startDate ? rangeDays(startDate, elapsedEnd) : [];

  const successfulElapsedDays = elapsedDays.filter(day => evaluateDaySuccess(item, dayTotals.get(day) || 0));
  const completedDays = successfulElapsedDays.length;

  let currentStreak = 0;
  for (let i = elapsedDays.length - 1; i >= 0; i--) {
    const day = elapsedDays[i];
    const isSuccess = evaluateDaySuccess(item, dayTotals.get(day) || 0);
    if (!isSuccess) break;
    currentStreak++;
  }

  let bestStreak = 0;
  let running = 0;
  elapsedDays.forEach(day => {
    const isSuccess = evaluateDaySuccess(item, dayTotals.get(day) || 0);
    if (isSuccess) {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  });

  const elapsedCount = Math.max(1, elapsedDays.length);
  const successRate = Math.round((completedDays / elapsedCount) * 100);
  const hasEnded = todayKey > endDate;

  const isRecurringDailyObjective = item.challengeType === 'boolean' || item.challengeType === 'daily';
  const periodDayCount = Math.max(1, periodDays.length);
  const progress = isRecurringDailyObjective
    ? Math.max(0, Math.min(100, Math.round((completedDays / periodDayCount) * 100)))
    : Math.max(0, Math.min(100, Math.round(((item.challengeType === 'cumulative' || item.challengeType === 'duration') ? totalValue : completedDays) / item.targetValue * 100)));

  const isCompleted = isRecurringDailyObjective
    ? hasEnded && completedDays === periodDays.length
    : progress >= 100;
  const status = isCompleted ? 'completed' : (hasEnded ? 'failed' : 'active');

  return {
    itemId: item.id,
    itemName: item.name,
    progress,
    currentStreak,
    bestStreak,
    successRate,
    completedDays,
    totalValue,
    entriesCount: relevantEntriesInPeriod.length,
    relevantEntries: relevantEntriesInPeriod,
    dayTotals,
    elapsedDays: elapsedDays.length,
    periodDays: periodDays.length,
    status,
  };
}

export function computeChallengeStats(challenge, trackingEntries = []) {
  const items = Array.isArray(challenge.items) ? challenge.items : [];
  const itemStats = items.map(item => ({
    item,
    stats: computeChallengeItemStats(challenge, item, trackingEntries),
  }));

  const itemCount = itemStats.length;
  const completedItems = itemStats.filter(entry => entry.stats.status === 'completed').length;
  const activeItems = itemStats.filter(entry => entry.stats.status === 'active').length;
  const failedItems = itemStats.filter(entry => entry.stats.status === 'failed').length;
  const progress = itemCount > 0
    ? Math.round(itemStats.reduce((sum, entry) => sum + entry.stats.progress, 0) / itemCount)
    : 0;
  const currentStreak = itemStats.reduce((max, entry) => Math.max(max, entry.stats.currentStreak), 0);
  const bestStreak = itemStats.reduce((max, entry) => Math.max(max, entry.stats.bestStreak), 0);
  const successRate = itemCount > 0
    ? Math.round(itemStats.reduce((sum, entry) => sum + entry.stats.successRate, 0) / itemCount)
    : 0;
  const totalValue = itemStats.reduce((sum, entry) => sum + entry.stats.totalValue, 0);
  const completedDays = itemStats.reduce((sum, entry) => sum + entry.stats.completedDays, 0);
  const periodDays = itemStats.reduce((max, entry) => Math.max(max, entry.stats.periodDays), 0);
  const todayKey = dayKey(new Date());
  const hasEnded = todayKey > challenge.endDate;
  const status = itemCount > 0 && completedItems === itemCount
    ? 'completed'
    : (hasEnded ? 'failed' : 'active');

  return {
    progress,
    currentStreak,
    bestStreak,
    successRate,
    completedDays,
    totalValue,
    periodDays,
    status,
    itemCount,
    completedItems,
    activeItems,
    failedItems,
    itemStats,
  };
}

export function challengeTypeLabel(type) {
  if (type === 'boolean') return 'Boolean';
  if (type === 'cumulative') return 'Cumulative';
  if (type === 'daily') return 'Daily';
  if (type === 'duration') return 'Duration';
  return 'Challenge';
}
