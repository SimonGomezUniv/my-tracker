/**
 * new-entry.js — Vue Saisie / Édition d'une entrée de tracking
 */
import TrackingTypeModel from '../models/tracking-type.js';
import TrackingEntryModel from '../models/tracking-entry.js';
import TagModel from '../models/tag.js';
import { escapeHtml, showToast } from '../utils.js';
import router from '../router.js';

// ---- Vue principale (sélection de type ou formulaire) ----

export default async function newEntryView(params) {
  const typeId = params[0] || null;
  if (!typeId) return renderTypeSelector();

  const [type, allTags] = await Promise.all([
    TrackingTypeModel.get(typeId),
    TagModel.getAll(),
  ]);
  if (!type) {
    return {
      html: `<div class="view-error"><h2>Type not found</h2><a href="#/new-entry" class="btn btn-ghost">← Back</a></div>`,
      title: 'Error',
    };
  }
  return renderEntryForm(type, null, allTags);
}

// ---- Vue édition d'une entrée existante ----

export async function editEntryView(params) {
  const entryId = params[0] || null;
  if (!entryId) {
    return { html: `<div class="view-error"><h2>Missing identifier</h2><a href="#/history" class="btn btn-ghost">← Back</a></div>`, title: 'Error' };
  }
  const entry = await TrackingEntryModel.get(entryId);
  if (!entry) {
    return { html: `<div class="view-error"><h2>Entry not found</h2><a href="#/history" class="btn btn-ghost">← Back</a></div>`, title: 'Error' };
  }
  const [type, allTags] = await Promise.all([
    TrackingTypeModel.get(entry.trackingTypeId),
    TagModel.getAll(),
  ]);
  if (!type) {
    return { html: `<div class="view-error"><h2>Type not found</h2><a href="#/history" class="btn btn-ghost">← Back</a></div>`, title: 'Error' };
  }
  return renderEntryForm(type, entry, allTags);
}

// ---- Sélecteur de type (étape 1) ----

async function renderTypeSelector() {
  const types = await TrackingTypeModel.getAll();
  if (types.length === 0) {
    return {
      html: `<div class="view-entry-select"><div class="empty-state-box"><p>No tracking type defined yet. Create one first.</p><a href="#/types/new" class="btn btn-primary">Create a type</a></div></div>`,
      title: 'New entry',
    };
  }
  return {
    html: `
      <div class="view-entry-select">
        <p class="view-subtitle" style="margin-bottom:20px">Choose the tracking type for this entry.</p>
        <div class="items-grid">
          ${types.map(t => `
            <a href="#/new-entry/${escapeHtml(t.id)}" class="item-card item-card--link" style="--card-color: ${escapeHtml(t.color || '#6366f1')}">
              <div class="item-card-header"><span class="item-icon">${escapeHtml(t.icon || '📍')}</span></div>
              <div class="item-card-body">
                <h3 class="item-name">${escapeHtml(t.name)}</h3>
                ${t.description ? `<p class="item-description">${escapeHtml(t.description)}</p>` : ''}
              </div>
            </a>`).join('')}
        </div>
      </div>`,
    title: 'New entry',
  };
}

// ---- Formulaire de saisie ----

function renderEntryForm(type, existingEntry, allTags) {
  const selectedTagIds = new Set(existingEntry?.tags || []);

  // Timestamp local pour datetime-local input
  const toLocalISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const defaultTs = existingEntry ? toLocalISO(new Date(existingEntry.timestamp)) : toLocalISO(new Date());

  const fieldsHtml = (type.fields || []).map(f => renderFormField(f, existingEntry?.data?.[f.name])).join('');
  const tagsButtonLabel = `Tags${selectedTagIds.size > 0 ? ` (${selectedTagIds.size})` : ''}`;

  const tagsPopover = allTags.length > 0 ? `
    <div id="entry-tags-popover" class="entry-tags-popover hidden" aria-hidden="true">
      <div class="entry-tags-popover__panel">
        <div class="entry-tags-popover__header">
          <div>
            <h3>Select tags</h3>
            <p class="text-muted">Choose one or more tags for this entry.</p>
          </div>
          <button type="button" id="entry-tags-close" class="btn btn-ghost btn-icon" aria-label="Close tags panel">✕</button>
        </div>
        <div class="chips-selector entry-tags-popover__chips" id="entry-tags-chips">
          ${allTags.map(t => `
            <button type="button" class="chip ${selectedTagIds.has(t.id) ? 'chip--selected' : ''}"
                  data-id="${escapeHtml(t.id)}" style="--chip-bg: ${escapeHtml(t.color)}">
              ${escapeHtml(t.name)}
            </button>`).join('')}
        </div>
        <div class="entry-tags-popover__actions">
          <button type="button" id="entry-tags-clear" class="btn btn-ghost">Clear</button>
          <div class="entry-tags-popover__spacer"></div>
          <button type="button" id="entry-tags-done" class="btn btn-primary">Done</button>
        </div>
      </div>
    </div>` : '';

  const backUrl = existingEntry ? '#/history' : '#/new-entry';

  const html = `
    <div class="view-entry-form">
      <a href="${backUrl}" class="btn btn-ghost btn-back">← Back</a>
      <div class="entry-form-header" style="border-left-color: ${escapeHtml(type.color || '#6366f1')}">
        <span class="entry-form-icon">${escapeHtml(type.icon || '📍')}</span>
        <div>
          <h2 class="entry-form-type-name">${escapeHtml(type.name)}</h2>
          ${type.description ? `<p class="text-muted">${escapeHtml(type.description)}</p>` : ''}
        </div>
      </div>

      <form id="entry-form" novalidate>
        <section class="editor-section">
          <div class="entry-compact-header">
            <label class="form-label entry-compact-header__label" for="entry-timestamp">Date</label>
            <input type="datetime-local" id="entry-timestamp" class="form-input" value="${defaultTs}" required />
            ${allTags.length > 0 ? `<button type="button" id="entry-tags-open" class="btn btn-secondary entry-tags-button">${tagsButtonLabel}</button>` : ''}
          </div>
        </section>

        ${type.fields.length > 0 ? `
        <section class="editor-section">
          <h2 class="editor-section-title">Data</h2>
          ${fieldsHtml}
        </section>` : ''}

        <details class="entry-note-details" ${existingEntry?.note ? 'open' : ''}>
          <summary class="editor-section-title entry-note-details__summary">Note</summary>
          <section class="editor-section entry-note-details__content">
            <div class="form-group">
              <textarea id="entry-note" class="form-textarea" placeholder="Optional note..." rows="2">${escapeHtml(existingEntry?.note || '')}</textarea>
            </div>
          </section>
        </details>

        <div class="form-actions form-actions--main entry-form-actions">
          <button type="submit" class="btn btn-primary">
            💾 ${existingEntry ? 'Update entry' : 'Save entry'}
          </button>
          <a href="${backUrl}" class="btn btn-ghost">Cancel</a>
        </div>
      </form>
    </div>`;

  return {
    html: html + tagsPopover,
    title: existingEntry ? `Edit: ${type.name}` : `Entry: ${type.name}`,
    bind: () => bindEntryFormEvents(type, existingEntry, selectedTagIds),
  };
}

// ---- Rendu dynamique d'un champ selon son type ----

function renderFormField(field, value = null) {
  const req = field.required ? `<span class="required-star">*</span>` : '';
  const n = escapeHtml(field.name);
  const l = escapeHtml(field.label);

  switch (field.type) {
    case 'string':
      return `<div class="form-group entry-field-row">
        <label class="form-label entry-field-row__label">${l} ${req}</label>
        <input type="text" name="${n}" class="form-input entry-field entry-field-row__input"
          value="${escapeHtml(value ?? '')}" ${field.required ? 'required' : ''} />
      </div>`;

    case 'numeric':
      return `<div class="form-group entry-field-row">
        <label class="form-label entry-field-row__label">${l} ${req}</label>
        <input type="number" name="${n}" class="form-input entry-field entry-field-row__input"
          value="${value !== null && value !== undefined ? escapeHtml(String(value)) : ''}"
          step="any" ${field.required ? 'required' : ''} />
      </div>`;

    case 'boolean':
      return `<div class="form-group entry-field-row entry-field-row--checkbox">
        <span class="form-label entry-field-row__label">${l} ${req}</span>
        <label class="checkbox-label entry-field-row__input">
          <input type="checkbox" name="${n}" class="entry-field" ${value ? 'checked' : ''} />
          Enabled
        </label>
      </div>`;

    case 'rating': {
      const rv = parseInt(value) || 0;
      return `<div class="form-group entry-field-row entry-field-row--rating">
        <label class="form-label entry-field-row__label">${l} ${req}</label>
        <div class="rating-input entry-field-row__input" data-field="${n}">
          ${[1, 2, 3, 4, 5].map(i => `
            <button type="button" class="star-btn ${rv >= i ? 'star-active' : ''}" data-value="${i}">★</button>
          `).join('')}
          <input type="hidden" name="${n}" class="entry-field" value="${rv}" />
        </div>
      </div>`;
    }

    case 'duration':
      return `<div class="form-group entry-field-row">
        <label class="form-label entry-field-row__label">${l} ${req}</label>
        <input type="text" name="${n}" class="form-input entry-field entry-field-row__input"
          value="${escapeHtml(value ?? '')}" placeholder="2:30"
          ${field.required ? 'required' : ''} />
      </div>`;

    default:
      return `<div class="form-group entry-field-row">
        <label class="form-label entry-field-row__label">${l} ${req}</label>
        <input type="text" name="${n}" class="form-input entry-field entry-field-row__input"
          value="${escapeHtml(value ?? '')}" ${field.required ? 'required' : ''} />
      </div>`;
  }
}

// ---- Binding du formulaire ----

function bindEntryFormEvents(type, existingEntry, selectedTagIds) {
  const openTagsButton = document.getElementById('entry-tags-open');
  const closeTagsButton = document.getElementById('entry-tags-close');
  const clearTagsButton = document.getElementById('entry-tags-clear');
  const doneTagsButton = document.getElementById('entry-tags-done');
  const tagsPopover = document.getElementById('entry-tags-popover');

  const openTagsPopover = () => {
    if (!tagsPopover) return;
    tagsPopover.classList.remove('hidden');
    tagsPopover.setAttribute('aria-hidden', 'false');
  };

  const closeTagsPopover = () => {
    if (!tagsPopover) return;
    tagsPopover.classList.add('hidden');
    tagsPopover.setAttribute('aria-hidden', 'true');
  };

  openTagsButton?.addEventListener('click', () => {
    openTagsPopover();
  });

  closeTagsButton?.addEventListener('click', closeTagsPopover);

  clearTagsButton?.addEventListener('click', () => {
    selectedTagIds.clear();
    document.querySelectorAll('#entry-tags-chips .chip').forEach(chip => chip.classList.remove('chip--selected'));
    if (openTagsButton) {
      openTagsButton.textContent = 'Tags';
    }
  });

  doneTagsButton?.addEventListener('click', closeTagsPopover);

  document.addEventListener('click', (event) => {
    if (!tagsPopover || tagsPopover.classList.contains('hidden')) return;
    if (tagsPopover.contains(event.target) || openTagsButton?.contains(event.target)) return;
    closeTagsPopover();
  });

  // Étoiles de notation
  document.querySelectorAll('.rating-input').forEach(ratingInput => {
    const stars = ratingInput.querySelectorAll('.star-btn');
    const hidden = ratingInput.querySelector('input[type="hidden"]');
    const update = (val) => stars.forEach((s, i) => s.classList.toggle('star-active', i < val));
    stars.forEach(star => {
      star.addEventListener('mouseenter', () => update(parseInt(star.dataset.value)));
      star.addEventListener('mouseleave', () => update(parseInt(hidden.value) || 0));
      star.addEventListener('click', () => {
        hidden.value = star.dataset.value;
        update(parseInt(star.dataset.value));
      });
    });
  });

  // Tag chips in dialog
  document.querySelectorAll('#entry-tags-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (selectedTagIds.has(id)) {
        selectedTagIds.delete(id);
        chip.classList.remove('chip--selected');
      } else {
        selectedTagIds.add(id);
        chip.classList.add('chip--selected');
      }

      if (openTagsButton) {
        openTagsButton.textContent = `Tags${selectedTagIds.size > 0 ? ` (${selectedTagIds.size})` : ''}`;
      }
    });
  });

  updateStickyActions();

  window.addEventListener('resize', updateStickyActions);

  // Soumission
  document.getElementById('entry-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const timestamp = new Date(document.getElementById('entry-timestamp').value).toISOString();
    const note = document.getElementById('entry-note')?.value.trim() || '';

    const data = {};
    (type.fields || []).forEach(field => {
      const el = document.querySelector(`.entry-field[name="${field.name}"]`);
      if (!el) return;
      if (field.type === 'boolean') data[field.name] = el.checked;
      else if (field.type === 'numeric') data[field.name] = el.value !== '' ? parseFloat(el.value) : null;
      else data[field.name] = el.value.trim() || null;
    });

    // Validation champs requis
    for (const field of (type.fields || [])) {
      if (!field.required) continue;
      if (field.type === 'boolean') continue;
      const val = data[field.name];
      if (field.type === 'rating' && (!val || val < 1)) {
        showToast(`Field "${field.label}" is required (select a rating).`, 'error'); return;
      }
      if (field.type !== 'rating' && (val === null || val === undefined || val === '')) {
        showToast(`Field "${field.label}" is required.`, 'error'); return;
      }
    }

    try {
      if (existingEntry) {
        await TrackingEntryModel.update(existingEntry.id, { timestamp, data, note, tags: [...selectedTagIds] });
        showToast('Entry updated.', 'success');
        router.navigate('dashboard');
      } else {
        await TrackingEntryModel.create({ trackingTypeId: type.id, timestamp, data, note, tags: [...selectedTagIds] });
        showToast(`"${type.name}" entry saved.`, 'success');
        router.navigate('dashboard');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

function updateStickyActions() {
  const actions = document.querySelector('.entry-form-actions');
  if (!actions) return;
  actions.classList.toggle('entry-form-actions--sticky', window.matchMedia('(max-width: 640px)').matches);
}
