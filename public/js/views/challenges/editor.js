import ChallengeModel from '../../models/challenge.js';
import TrackingTypeModel from '../../models/tracking-type.js';
import router from '../../router.js';
import { escapeHtml, showToast, toLocalDateKey } from '../../utils.js';

const TYPE_OPTIONS = [
  { value: 'boolean', label: 'Boolean (success days)' },
  { value: 'cumulative', label: 'Cumulative total' },
  { value: 'daily', label: 'Daily minimum' },
  { value: 'duration', label: 'Duration total' },
];

const PRESET_OPTIONS = [
  { value: '1w', label: '1 week' },
  { value: '1m', label: '1 month' },
  { value: '1q', label: '1 quarter' },
  { value: '1y', label: '1 year' },
];

const ITEM_PRESETS = {
  reps: { label: 'Daily total', challengeType: 'daily', targetValue: 100, unit: 'reps', preferredFieldTypes: ['numeric'], remindersEnabled: false, rewardsEnabled: true },
  duration: { label: 'Session duration', challengeType: 'duration', targetValue: 5, unit: 'min', preferredFieldTypes: ['duration'], remindersEnabled: false, rewardsEnabled: true },
  boolean: { label: 'Daily yes/no', challengeType: 'boolean', targetValue: 1, unit: '', preferredFieldTypes: ['boolean'], remindersEnabled: true, rewardsEnabled: true },
};

export default async function challengesEditorView(params) {
  const challengeId = params[0] || null;
  let existing = null;

  if (challengeId) {
    existing = await ChallengeModel.get(challengeId);
    if (!existing) {
      return {
        html: `<div class="view-error"><h2>Challenge not found</h2><a href="#/challenges" class="btn btn-ghost">← Back</a></div>`,
        title: 'Error',
      };
    }
  }

  const trackingTypes = await TrackingTypeModel.getAll();
  const itemRows = (existing?.items?.length ? existing.items : [{
    id: 'item_1',
    name: '',
    trackingTypeId: '',
    fieldName: '',
    metric: 'count',
    challengeType: 'daily',
    targetValue: 1,
    unit: '',
    rewardsEnabled: false,
    remindersEnabled: false,
  }])
    .map((item, index) => renderItemRow(item, trackingTypes, index))
    .join('');

  const presetOptionsHtml = PRESET_OPTIONS
    .map(opt => `<option value="${opt.value}" ${opt.value === (existing?.preset || '1m') ? 'selected' : ''}>${opt.label}</option>`)
    .join('');

  const startDate = existing?.startDate || toLocalDateKey();
  const endDate = existing?.endDate || startDate;

  const html = `
    <div class="view-editor">
      <a href="#/challenges" class="btn btn-ghost btn-back">← Back to challenges</a>
      <form id="challenge-form" novalidate>

        <section class="editor-section">
          <h2 class="editor-section-title">General information</h2>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="challenge-name">Name <span class="required-star">*</span></label>
              <input id="challenge-name" class="form-input" type="text" value="${escapeHtml(existing?.name || '')}" placeholder="e.g. June running streak" required />
            </div>
            <div class="form-group form-group--narrow">
              <label class="form-label" for="challenge-icon">Icon</label>
              <input id="challenge-icon" class="form-input form-input--center" type="text" maxlength="2" value="${escapeHtml(existing?.icon || '🎯')}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="challenge-description">Description</label>
              <input id="challenge-description" class="form-input" type="text" value="${escapeHtml(existing?.description || '')}" placeholder="Optional description" />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label" for="challenge-category">Category</label>
              <input id="challenge-category" class="form-input" type="text" value="${escapeHtml(existing?.category || '')}" placeholder="Health, Sport, Reading..." />
            </div>
          </div>
        </section>

        <section class="editor-section">
          <h2 class="editor-section-title">Tracked items</h2>
          <p class="text-muted">Each item keeps its own progress, streak, reward and reminder settings. The challenge only groups them into one period.</p>
          <div id="challenge-items-list" class="challenge-sources-list">${itemRows}</div>
          <button type="button" id="btn-add-challenge-item" class="btn btn-secondary">➕ Add item</button>
        </section>

        <section class="editor-section">
          <h2 class="editor-section-title">Period</h2>
          <div class="form-row">
            <label class="checkbox-label"><input type="radio" name="challenge-period-mode" value="fixed" ${(existing?.periodMode || 'fixed') === 'fixed' ? 'checked' : ''} /> Fixed dates</label>
            <label class="checkbox-label"><input type="radio" name="challenge-period-mode" value="preset" ${(existing?.periodMode || 'fixed') === 'preset' ? 'checked' : ''} /> Preset duration</label>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="challenge-start-date">Start date</label>
              <input id="challenge-start-date" class="form-input" type="date" value="${startDate}" required />
            </div>
            <div class="form-group" style="flex:1" id="challenge-end-date-group">
              <label class="form-label" for="challenge-end-date">End date</label>
              <input id="challenge-end-date" class="form-input" type="date" value="${endDate}" required />
            </div>
            <div class="form-group" style="flex:1" id="challenge-preset-group">
              <label class="form-label" for="challenge-preset">Preset</label>
              <select id="challenge-preset" class="form-select">${presetOptionsHtml}</select>
            </div>
          </div>
        </section>
        <div class="form-actions form-actions--main">
          <button type="submit" class="btn btn-primary">💾 ${existing ? 'Update challenge' : 'Create challenge'}</button>
          <a href="#/challenges" class="btn btn-ghost">Cancel</a>
        </div>
      </form>
    </div>`;

  return {
    html,
    title: existing ? `Edit: ${existing.name}` : 'New challenge',
    bind: () => bindChallengesEditorEvents(existing, trackingTypes),
  };
}

function renderItemRow(item, trackingTypes, index) {
  const typeOptions = trackingTypes
    .map(type => `<option value="${escapeHtml(type.id)}" ${type.id === item.trackingTypeId ? 'selected' : ''}>${escapeHtml(type.icon || '')} ${escapeHtml(type.name)}</option>`)
    .join('');

  const selectedType = trackingTypes.find(type => type.id === item.trackingTypeId);
  const fieldOptions = [
    `<option value="" ${!item.fieldName ? 'selected' : ''}>Count entries</option>`,
    ...(selectedType?.fields || [])
      .filter(field => ['numeric', 'duration', 'boolean'].includes(field.type))
      .map(field => `<option value="${escapeHtml(field.name)}" ${field.name === item.fieldName ? 'selected' : ''}>${escapeHtml(field.label)}</option>`),
  ].join('');

  const typeOptionsHtml = TYPE_OPTIONS
    .map(opt => `<option value="${opt.value}" ${opt.value === (item.challengeType || 'daily') ? 'selected' : ''}>${opt.label}</option>`)
    .join('');

  return `
    <div class="challenge-source-row challenge-source-row--item" data-index="${index}">
      <div class="challenge-item-row__header">
        <h3 class="challenge-item-row__title">Item ${index + 1}</h3>
        <button type="button" class="btn btn-sm btn-danger btn-remove-challenge-source">Remove</button>
      </div>
      <div class="challenge-item-presets">
        ${Object.entries(ITEM_PRESETS).map(([key, preset]) => `<button type="button" class="btn btn-sm btn-ghost btn-challenge-item-preset" data-preset="${escapeHtml(key)}">${escapeHtml(preset.label)}</button>`).join('')}
      </div>
      <div class="form-group" style="flex:1 1 100%">
        <label class="form-label">Item name</label>
        <input class="form-input challenge-item-name" type="text" value="${escapeHtml(item.name || '')}" placeholder="e.g. Push-ups / Handstand / Closed kitchen" />
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Tracking type</label>
        <select class="form-select challenge-source-type">
          <option value="">— Select —</option>
          ${typeOptions}
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Measure</label>
        <select class="form-select challenge-source-field">
          ${fieldOptions}
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Objective type</label>
        <select class="form-select challenge-item-type">${typeOptionsHtml}</select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Target</label>
        <input class="form-input challenge-item-target" type="number" min="1" step="any" value="${escapeHtml(String(item.targetValue || 1))}" />
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Unit</label>
        <input class="form-input challenge-item-unit" type="text" value="${escapeHtml(item.unit || '')}" placeholder="reps, min..." />
      </div>
      <div class="form-group" style="flex:1 1 100%">
        <label class="checkbox-label"><input class="challenge-item-rewards-enabled" type="checkbox" ${item.rewardsEnabled ? 'checked' : ''} /> Enable rewards for this item</label>
        <label class="checkbox-label"><input class="challenge-item-reminders-enabled" type="checkbox" ${item.remindersEnabled ? 'checked' : ''} /> Enable reminders for this item</label>
      </div>
    </div>`;
}

function fillFieldOptions(fieldSelect, selectedType, selectedValue = '') {
  if (!fieldSelect) return;
  const options = [
    `<option value="" ${!selectedValue ? 'selected' : ''}>Count entries</option>`,
    ...(selectedType?.fields || [])
      .filter(field => ['numeric', 'duration', 'boolean'].includes(field.type))
      .map(field => `<option value="${escapeHtml(field.name)}" ${field.name === selectedValue ? 'selected' : ''}>${escapeHtml(field.label)}</option>`),
  ];
  fieldSelect.innerHTML = options.join('');
}

function applyPresetToRow(row, presetKey, trackingTypes) {
  const preset = ITEM_PRESETS[presetKey];
  if (!preset) return;

  row.querySelector('.challenge-item-type').value = preset.challengeType;
  row.querySelector('.challenge-item-target').value = String(preset.targetValue);
  row.querySelector('.challenge-item-unit').value = preset.unit;
  row.querySelector('.challenge-item-reminders-enabled').checked = preset.remindersEnabled;
  row.querySelector('.challenge-item-rewards-enabled').checked = preset.rewardsEnabled;

  const selectedTypeId = row.querySelector('.challenge-source-type')?.value || '';
  const selectedType = trackingTypes.find(type => type.id === selectedTypeId);
  const fieldSelect = row.querySelector('.challenge-source-field');
  fillFieldOptions(fieldSelect, selectedType, fieldSelect?.value || '');

  const matchingField = (selectedType?.fields || []).find(field => preset.preferredFieldTypes.includes(field.type));
  if (fieldSelect && matchingField) {
    fieldSelect.value = matchingField.name;
  }
}

function bindChallengesEditorEvents(existing, trackingTypes) {
  const endDateGroup = document.getElementById('challenge-end-date-group');
  const presetGroup = document.getElementById('challenge-preset-group');
  const itemsList = document.getElementById('challenge-items-list');
  const addItemButton = document.getElementById('btn-add-challenge-item');

  const syncPeriodMode = () => {
    const mode = document.querySelector('input[name="challenge-period-mode"]:checked')?.value || 'fixed';
    endDateGroup.classList.toggle('hidden', mode !== 'fixed');
    presetGroup.classList.toggle('hidden', mode !== 'preset');
  };

  document.querySelectorAll('input[name="challenge-period-mode"]').forEach(radio => {
    radio.addEventListener('change', syncPeriodMode);
  });
  syncPeriodMode();

  const bindSourceEvents = () => {
    itemsList.querySelectorAll('.challenge-source-row').forEach((row, index) => {
      row.dataset.index = String(index);
      row.querySelector('.challenge-item-row__title').textContent = `Item ${index + 1}`;

      row.querySelector('.challenge-source-type')?.addEventListener('change', (event) => {
        const selectedType = trackingTypes.find(type => type.id === event.target.value);
        const fieldSelect = row.querySelector('.challenge-source-field');
        fillFieldOptions(fieldSelect, selectedType, '');
      });

      row.querySelectorAll('.btn-challenge-item-preset').forEach(button => {
        button.addEventListener('click', () => {
          applyPresetToRow(row, button.dataset.preset, trackingTypes);
        });
      });

      row.querySelector('.btn-remove-challenge-source')?.addEventListener('click', () => {
        if (itemsList.children.length === 1) return;
        row.remove();
        bindSourceEvents();
      });
    });
  };

  addItemButton?.addEventListener('click', () => {
    itemsList.insertAdjacentHTML('beforeend', renderItemRow({ name: '', trackingTypeId: '', fieldName: '', metric: 'count', challengeType: 'daily', targetValue: 1, unit: '', rewardsEnabled: false, remindersEnabled: false }, trackingTypes, itemsList.children.length));
    bindSourceEvents();
  });

  bindSourceEvents();

  document.getElementById('challenge-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const mode = document.querySelector('input[name="challenge-period-mode"]:checked')?.value || 'fixed';
    const items = [...itemsList.querySelectorAll('.challenge-source-row')].map((row, index) => ({
      id: row.dataset.index || `item_${index + 1}`,
      name: row.querySelector('.challenge-item-name')?.value.trim() || '',
      trackingTypeId: row.querySelector('.challenge-source-type')?.value || '',
      fieldName: row.querySelector('.challenge-source-field')?.value || '',
      metric: row.querySelector('.challenge-source-field')?.value ? 'sum' : 'count',
      challengeType: row.querySelector('.challenge-item-type')?.value || 'daily',
      targetValue: Number(row.querySelector('.challenge-item-target')?.value || 1),
      unit: row.querySelector('.challenge-item-unit')?.value.trim() || '',
      rewardsEnabled: !!row.querySelector('.challenge-item-rewards-enabled')?.checked,
      remindersEnabled: !!row.querySelector('.challenge-item-reminders-enabled')?.checked,
    })).filter(item => item.trackingTypeId || item.name);

    const data = {
      name: document.getElementById('challenge-name').value.trim(),
      description: document.getElementById('challenge-description').value.trim(),
      category: document.getElementById('challenge-category').value.trim(),
      icon: document.getElementById('challenge-icon').value.trim() || '🎯',
      periodMode: mode,
      startDate: document.getElementById('challenge-start-date').value,
      endDate: document.getElementById('challenge-end-date').value,
      preset: document.getElementById('challenge-preset').value,
      items,
    };

    try {
      if (existing) {
        await ChallengeModel.update(existing.id, data);
        showToast('Challenge updated.', 'success');
      } else {
        await ChallengeModel.create(data);
        showToast('Challenge created.', 'success');
      }
      router.navigate('settings');
    } catch (err) {
      showToast(err.message || 'Unable to save challenge.', 'error');
    }
  });
}
