import ChallengeModel from '../models/challenge.js';
import TrackingEntryModel from '../models/tracking-entry.js';
import { computeChallengeStats } from './challenge-stats.service.js';
import { toLocalDateKey } from '../utils.js';
import { showToast } from '../utils.js';

const STORAGE_KEY = 'my-tracker-challenge-reminders-v1';
const PREFS_STORAGE_KEY = 'my-tracker-challenge-reminder-prefs-v1';

function dayKey(date = new Date()) {
  return toLocalDateKey(date);
}

function getReminderState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveReminderState(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function normalizeReminderPreferences(raw) {
  const prefs = raw && typeof raw === 'object' ? raw : {};
  const thresholdHour = Number(prefs.thresholdHour);
  return {
    enabled: prefs.enabled !== false,
    thresholdHour: Number.isFinite(thresholdHour)
      ? Math.max(0, Math.min(23, Math.floor(thresholdHour)))
      : 18,
  };
}

export function getChallengeReminderPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || '{}');
    return normalizeReminderPreferences(parsed);
  } catch {
    return normalizeReminderPreferences({});
  }
}

export function updateChallengeReminderPreferences(patch = {}) {
  const current = getChallengeReminderPreferences();
  const next = normalizeReminderPreferences({ ...current, ...patch });
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function exportChallengeReminderState() {
  return {
    notificationsByDay: getReminderState(),
    preferences: getChallengeReminderPreferences(),
  };
}

export function importChallengeReminderState(value) {
  const state = value && typeof value === 'object' ? value : {};

  const notificationsByDay = state.notificationsByDay;
  if (notificationsByDay && typeof notificationsByDay === 'object') {
    const normalizedNotifications = Object.fromEntries(
      Object.entries(notificationsByDay)
        .filter(([key, sent]) => typeof key === 'string' && typeof sent === 'boolean'),
    );
    saveReminderState(normalizedNotifications);
  } else {
    saveReminderState({});
  }

  updateChallengeReminderPreferences(state.preferences || {});
}

export function getNotificationPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestReminderPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

function shouldNotifyToday(challenge, item, itemStats, state, today) {
  if (!item?.remindersEnabled) return false;
  if (today < challenge.startDate || today > challenge.endDate) return false;
  if (itemStats.status !== 'active') return false;

  const todayValue = itemStats.dayTotals.get(today) || 0;
  const enoughToday = item.challengeType === 'boolean'
    ? todayValue >= 1
    : todayValue >= item.targetValue;

  if (enoughToday) return false;
  return state[`${today}:${challenge.id}:${item.id}`] !== true;
}

function buildReminderMessage(challenge, item) {
  if (item.challengeType === 'boolean') {
    return `${challenge.name}: mark ${item.name} for today.`;
  }
  return `${challenge.name}: ${item.name} is still below ${item.targetValue}${item.unit ? ` ${item.unit}` : ''} today.`;
}

export async function runChallengeRemindersOnOpen() {
  const prefs = getChallengeReminderPreferences();
  if (!prefs.enabled) return [];

  const currentHour = new Date().getHours();
  if (currentHour < prefs.thresholdHour) return [];

  const [challenges, entries] = await Promise.all([
    ChallengeModel.getAll(),
    TrackingEntryModel.getAll(),
  ]);

  const today = dayKey();
  const state = getReminderState();
  const pending = [];

  challenges.forEach(challenge => {
    const stats = computeChallengeStats(challenge, entries);
    stats.itemStats.forEach(({ item, stats: itemStats }) => {
      if (shouldNotifyToday(challenge, item, itemStats, state, today)) {
        pending.push({
          challenge,
          item,
          message: buildReminderMessage(challenge, item),
        });
        state[`${today}:${challenge.id}:${item.id}`] = true;
      }
    });
  });

  if (pending.length === 0) return [];

  saveReminderState(state);

  if (getNotificationPermissionState() === 'granted') {
    pending.slice(0, 3).forEach(reminder => {
      new Notification(reminder.item.name, {
        body: reminder.message,
        tag: `challenge-reminder-${reminder.challenge.id}-${reminder.item.id}`,
      });
    });
  } else {
    showToast(pending[0].message, 'info', 3200);
  }

  return pending;
}
