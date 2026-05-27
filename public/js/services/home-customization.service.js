/**
 * home-customization.service.js — Persistance de la personnalisation de la Home
 */

import { PERIOD_PRESETS } from './stats.service.js';

const STORAGE_KEY = 'my-tracker-home-config-v1';
const ALLOWED_WIDGET_KINDS = new Set(['word-cloud', 'duration-total', 'entries-chart', 'calendar']);
const ALLOWED_PERIODS = new Set(PERIOD_PRESETS.map(p => p.value));

const DEFAULT_CONFIG = {
  showCounts: {
    entries: true,
    types: true,
    groups: true,
  },
  sectionOrder: ['quick', 'widgets', 'history'],
  widgets: [],
};

const DEFAULT_SECTION_ORDER = ['quick', 'widgets', 'history'];

function sanitizeWidget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!ALLOWED_WIDGET_KINDS.has(raw.kind)) return null;

  const period = ALLOWED_PERIODS.has(raw.period) ? raw.period : '30d';
  const rawIds = Array.isArray(raw.trackingTypeIds)
    ? raw.trackingTypeIds
    : [raw.trackingTypeId].filter(Boolean);
  const trackingTypeIds = [...new Set(rawIds.map(v => String(v || '').trim()).filter(Boolean))];

  if (trackingTypeIds.length === 0) return null;
  if (raw.kind !== 'calendar' && trackingTypeIds.length > 1) {
    trackingTypeIds.splice(1);
  }

  return {
    id: String(raw.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)),
    kind: raw.kind,
    trackingTypeIds,
    period,
    tagIds: Array.isArray(raw.tagIds) ? [...new Set(raw.tagIds.map(String))] : [],
  };
}

function sanitizeSectionOrder(value) {
  const requested = Array.isArray(value) ? value.map(String) : [];
  const seen = new Set();
  const order = [];
  requested.forEach(key => {
    if (!DEFAULT_SECTION_ORDER.includes(key) || seen.has(key)) return;
    seen.add(key);
    order.push(key);
  });
  DEFAULT_SECTION_ORDER.forEach(key => {
    if (!seen.has(key)) order.push(key);
  });
  return order;
}

function sanitizeConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const showCounts = cfg.showCounts && typeof cfg.showCounts === 'object' ? cfg.showCounts : {};

  return {
    showCounts: {
      entries: showCounts.entries !== false,
      types: showCounts.types !== false,
      groups: showCounts.groups !== false,
    },
    sectionOrder: sanitizeSectionOrder(cfg.sectionOrder),
    widgets: Array.isArray(cfg.widgets)
      ? cfg.widgets.map(sanitizeWidget).filter(Boolean)
      : [],
  };
}

export function getHomeConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_CONFIG,
        showCounts: { ...DEFAULT_CONFIG.showCounts },
        sectionOrder: [...DEFAULT_CONFIG.sectionOrder],
        widgets: [],
      };
    }
    const parsed = JSON.parse(raw);
    return sanitizeConfig(parsed);
  } catch {
    return {
      ...DEFAULT_CONFIG,
      showCounts: { ...DEFAULT_CONFIG.showCounts },
      sectionOrder: [...DEFAULT_CONFIG.sectionOrder],
      widgets: [],
    };
  }
}

export function saveHomeConfig(config) {
  const sanitized = sanitizeConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function updateHomeCounts(patch) {
  const current = getHomeConfig();
  current.showCounts = {
    ...current.showCounts,
    ...patch,
  };
  return saveHomeConfig(current);
}

export function addHomeWidget(widgetInput) {
  const current = getHomeConfig();
  const widget = sanitizeWidget(widgetInput);
  if (!widget) throw new Error('Widget invalide');
  current.widgets.push(widget);
  return saveHomeConfig(current);
}

export function updateHomeSectionOrder(order) {
  const current = getHomeConfig();
  current.sectionOrder = sanitizeSectionOrder(order);
  return saveHomeConfig(current);
}

export function removeHomeWidget(widgetId) {
  const current = getHomeConfig();
  current.widgets = current.widgets.filter(w => w.id !== widgetId);
  return saveHomeConfig(current);
}
