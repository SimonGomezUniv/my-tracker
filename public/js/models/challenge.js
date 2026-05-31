import db from '../db.js';
import { generateId } from '../utils.js';

const ALLOWED_TYPES = new Set(['boolean', 'cumulative', 'daily', 'duration']);
const ALLOWED_PRESETS = new Set(['1w', '1m', '1q', '1y']);
const ALLOWED_SOURCE_METRICS = new Set(['count', 'sum']);

function normalizeItem(item = {}, baseItem = {}, index = 0) {
  const trackingTypeId = String(item.trackingTypeId ?? baseItem.trackingTypeId ?? '').trim();
  const fieldName = String(item.fieldName ?? baseItem.fieldName ?? '').trim();
  const challengeType = ALLOWED_TYPES.has(item.challengeType) ? item.challengeType : (ALLOWED_TYPES.has(baseItem.challengeType) ? baseItem.challengeType : 'daily');
  const metric = ALLOWED_SOURCE_METRICS.has(item.metric) ? item.metric : (ALLOWED_SOURCE_METRICS.has(baseItem.metric) ? baseItem.metric : (fieldName ? 'sum' : 'count'));
  const parsedTarget = Number(item.targetValue ?? baseItem.targetValue ?? 1);

  return {
    id: String(item.id || baseItem.id || `item_${index + 1}`),
    name: String(item.name ?? baseItem.name ?? '').trim(),
    description: String(item.description ?? baseItem.description ?? '').trim(),
    trackingTypeId,
    fieldName,
    metric,
    challengeType,
    targetValue: Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 1,
    unit: String(item.unit ?? baseItem.unit ?? '').trim(),
    rewardsEnabled: item.rewardsEnabled !== undefined ? !!item.rewardsEnabled : !!baseItem.rewardsEnabled,
    remindersEnabled: item.remindersEnabled !== undefined ? !!item.remindersEnabled : !!baseItem.remindersEnabled,
  };
}

function migrateLegacySourcesToItems(base = {}) {
  const legacySources = Array.isArray(base.sources) ? base.sources : [];
  if (legacySources.length === 0) return [];

  return legacySources
    .map((source, index) => normalizeItem({
      id: source.id || `item_${index + 1}`,
      name: base.name ? `${base.name} ${index + 1}` : `Item ${index + 1}`,
      trackingTypeId: source.trackingTypeId,
      fieldName: source.fieldName,
      metric: source.metric,
      challengeType: base.challengeType || 'daily',
      targetValue: base.targetValue || 1,
      unit: base.unit || '',
      rewardsEnabled: !!base.rewardsEnabled,
      remindersEnabled: !!base.remindersEnabled,
    }, {}, index))
    .filter(item => item.trackingTypeId);
}

function normalizeItems(items = [], existingItems = [], base = {}) {
  const fallback = Array.isArray(existingItems) && existingItems.length > 0
    ? existingItems
    : migrateLegacySourcesToItems(base);
  const raw = Array.isArray(items) && items.length > 0 ? items : fallback;

  return raw
    .map((item, index) => normalizeItem(item, existingItems[index] || fallback[index] || {}, index))
    .filter(item => item.trackingTypeId && item.name);
}

function normalizeStoredChallenge(data = {}) {
  return normalizeChallengeInput(data, data);
}

function normalizeChallengeInput(data = {}, existing = null) {
  const base = existing || {};
  const periodMode = data.periodMode === 'preset' ? 'preset' : (data.periodMode === 'fixed' ? 'fixed' : (base.periodMode || 'fixed'));
  const startDate = String(data.startDate || base.startDate || new Date().toISOString().slice(0, 10)).slice(0, 10);

  let endDate = String(data.endDate || base.endDate || startDate).slice(0, 10);
  if (periodMode === 'preset' && ALLOWED_PRESETS.has(data.preset)) {
    endDate = computePresetEndDate(startDate, data.preset);
  }
  const items = normalizeItems(data.items, base.items, base);

  return {
    ...base,
    name: String(data.name ?? base.name ?? '').trim(),
    description: String(data.description ?? base.description ?? '').trim(),
    category: String(data.category ?? base.category ?? '').trim(),
    icon: String(data.icon ?? base.icon ?? '🎯').trim() || '🎯',
    color: String(data.color ?? base.color ?? '#2563eb'),
    periodMode,
    startDate,
    endDate,
    preset: ALLOWED_PRESETS.has(data.preset) ? data.preset : (ALLOWED_PRESETS.has(base.preset) ? base.preset : '1m'),
    items,
  };
}

function computePresetEndDate(startDate, preset) {
  const d = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return startDate;

  const out = new Date(d);
  if (preset === '1w') out.setDate(out.getDate() + 6);
  else if (preset === '1m') out.setMonth(out.getMonth() + 1, out.getDate() - 1);
  else if (preset === '1q') out.setMonth(out.getMonth() + 3, out.getDate() - 1);
  else if (preset === '1y') out.setFullYear(out.getFullYear() + 1, out.getMonth(), out.getDate() - 1);

  return out.toISOString().slice(0, 10);
}

function validateChallenge(challenge) {
  if (!challenge.name) throw new Error('Challenge name is required.');
  if (!challenge.startDate || !challenge.endDate) throw new Error('Start and end dates are required.');
  if (new Date(challenge.endDate) < new Date(challenge.startDate)) throw new Error('End date must be after start date.');
  if (!Array.isArray(challenge.items) || challenge.items.length === 0) throw new Error('At least one tracked item is required.');

  challenge.items.forEach(item => {
    if (!item.name) throw new Error('Each challenge item requires a name.');
    if (!item.trackingTypeId) throw new Error(`Item "${item.name || 'Untitled'}" requires a tracking type.`);
    if (!ALLOWED_TYPES.has(item.challengeType)) throw new Error(`Item "${item.name || 'Untitled'}" has an invalid objective type.`);
    if (!(item.targetValue > 0)) throw new Error(`Item "${item.name || 'Untitled'}" must have a target greater than 0.`);
  });
}

const ChallengeModel = {
  async getAll() {
    const challenges = await db.getAll('challenges');
    return challenges.map(normalizeStoredChallenge);
  },

  async get(id) {
    const challenge = await db.get('challenges', id);
    return challenge ? normalizeStoredChallenge(challenge) : null;
  },

  async create(data) {
    const challenge = {
      id: generateId(),
      ...normalizeChallengeInput(data),
      createdAt: new Date().toISOString(),
    };
    validateChallenge(challenge);
    await db.put('challenges', challenge);
    return challenge;
  },

  async update(id, data) {
    const existing = await db.get('challenges', id);
    if (!existing) throw new Error(`Challenge ${id} not found`);
    const updated = {
      id,
      ...normalizeChallengeInput(data, existing),
      createdAt: existing.createdAt,
    };
    validateChallenge(updated);
    await db.put('challenges', updated);
    return updated;
  },

  delete: (id) => db.delete('challenges', id),

  computePresetEndDate,
};

export default ChallengeModel;
