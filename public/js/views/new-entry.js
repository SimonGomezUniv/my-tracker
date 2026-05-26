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
      html: `<div class="view-error"><h2>Type introuvable</h2><a href="#/new-entry" class="btn btn-ghost">← Retour</a></div>`,
      title: 'Erreur',
    };
  }
  return renderEntryForm(type, null, allTags);
}

// ---- Vue édition d'une entrée existante ----

export async function editEntryView(params) {
  const entryId = params[0] || null;
  if (!entryId) {
    return { html: `<div class="view-error"><h2>Identifiant manquant</h2><a href="#/history" class="btn btn-ghost">← Retour</a></div>`, title: 'Erreur' };
  }
  const entry = await TrackingEntryModel.get(entryId);
  if (!entry) {
    return { html: `<div class="view-error"><h2>Saisie introuvable</h2><a href="#/history" class="btn btn-ghost">← Retour</a></div>`, title: 'Erreur' };
  }
  const [type, allTags] = await Promise.all([
    TrackingTypeModel.get(entry.trackingTypeId),
    TagModel.getAll(),
  ]);
  if (!type) {
    return { html: `<div class="view-error"><h2>Type introuvable</h2><a href="#/history" class="btn btn-ghost">← Retour</a></div>`, title: 'Erreur' };
  }
  return renderEntryForm(type, entry, allTags);
}

// ---- Sélecteur de type (étape 1) ----

async function renderTypeSelector() {
  const types = await TrackingTypeModel.getAll();
  if (types.length === 0) {
    return {
      html: `<div class="view-entry-select"><div class="empty-state-box"><p>Aucun type de tracking défini. Créez-en un d'abord.</p><a href="#/types/new" class="btn btn-primary">Créer un type</a></div></div>`,
      title: 'Nouvelle saisie',
    };
  }
  return {
    html: `
      <div class="view-entry-select">
        <p class="view-subtitle" style="margin-bottom:20px">Choisissez le type de tracking à saisir.</p>
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
    title: 'Nouvelle saisie',
  };
}

// ---- Formulaire de saisie ----

function renderEntryForm(type, existingEntry, allTags) {
  const selectedTagIds = new Set(existingEntry?.tags || []);

  // Timestamp local pour datetime-local input
  const toLocalISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const defaultTs = existingEntry ? toLocalISO(new Date(existingEntry.timestamp)) : toLocalISO(new Date());

  const fieldsHtml = (type.fields || []).map(f => renderFormField(f, existingEntry?.data?.[f.name])).join('');

  const tagsSection = allTags.length > 0 ? `
    <section class="editor-section">
      <h2 class="editor-section-title">Tags</h2>
      <div class="chips-selector" id="entry-tags-chips">
        ${allTags.map(t => `
          <span class="chip ${selectedTagIds.has(t.id) ? 'chip--selected' : ''}"
                data-id="${escapeHtml(t.id)}" style="--chip-bg: ${escapeHtml(t.color)}">
            ${escapeHtml(t.name)}
          </span>`).join('')}
      </div>
    </section>` : '';

  const backUrl = existingEntry ? '#/history' : '#/new-entry';

  const html = `
    <div class="view-entry-form">
      <a href="${backUrl}" class="btn btn-ghost btn-back">← Retour</a>
      <div class="entry-form-header" style="border-left-color: ${escapeHtml(type.color || '#6366f1')}">
        <span class="entry-form-icon">${escapeHtml(type.icon || '📍')}</span>
        <div>
          <h2 class="entry-form-type-name">${escapeHtml(type.name)}</h2>
          ${type.description ? `<p class="text-muted">${escapeHtml(type.description)}</p>` : ''}
        </div>
      </div>

      <form id="entry-form" novalidate>
        <section class="editor-section">
          <h2 class="editor-section-title">Date & heure</h2>
          <div class="form-group">
            <label class="form-label" for="entry-timestamp">Date et heure de la saisie</label>
            <input type="datetime-local" id="entry-timestamp" class="form-input" value="${defaultTs}" required />
          </div>
        </section>

        ${type.fields.length > 0 ? `
        <section class="editor-section">
          <h2 class="editor-section-title">Données</h2>
          ${fieldsHtml}
        </section>` : ''}

        ${tagsSection}

        <section class="editor-section">
          <h2 class="editor-section-title">Note libre</h2>
          <div class="form-group">
            <textarea id="entry-note" class="form-textarea" placeholder="Note optionnelle…" rows="2">${escapeHtml(existingEntry?.note || '')}</textarea>
          </div>
        </section>

        <div class="form-actions form-actions--main">
          <button type="submit" class="btn btn-primary">
            💾 ${existingEntry ? 'Modifier la saisie' : 'Enregistrer la saisie'}
          </button>
          <a href="${backUrl}" class="btn btn-ghost">Annuler</a>
        </div>
      </form>
    </div>`;

  return {
    html,
    title: existingEntry ? `Modifier : ${type.name}` : `Saisir : ${type.name}`,
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
      return `<div class="form-group">
        <label class="form-label">${l} ${req}</label>
        <input type="text" name="${n}" class="form-input entry-field"
          value="${escapeHtml(value ?? '')}" ${field.required ? 'required' : ''} />
      </div>`;

    case 'numeric':
      return `<div class="form-group">
        <label class="form-label">${l} ${req}</label>
        <input type="number" name="${n}" class="form-input entry-field"
          value="${value !== null && value !== undefined ? escapeHtml(String(value)) : ''}"
          step="any" ${field.required ? 'required' : ''} />
      </div>`;

    case 'boolean':
      return `<div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="${n}" class="entry-field" ${value ? 'checked' : ''} />
          ${l} ${req}
        </label>
      </div>`;

    case 'rating': {
      const rv = parseInt(value) || 0;
      return `<div class="form-group">
        <label class="form-label">${l} ${req}</label>
        <div class="rating-input" data-field="${n}">
          ${[1, 2, 3, 4, 5].map(i => `
            <button type="button" class="star-btn ${rv >= i ? 'star-active' : ''}" data-value="${i}">★</button>
          `).join('')}
          <input type="hidden" name="${n}" class="entry-field" value="${rv}" />
        </div>
      </div>`;
    }

    case 'duration':
      return `<div class="form-group">
        <label class="form-label">${l} ${req}</label>
        <input type="text" name="${n}" class="form-input entry-field"
          value="${escapeHtml(value ?? '')}" placeholder="ex : 2:30"
          ${field.required ? 'required' : ''} />
        <span class="form-hint">Format HH:MM — ex : 1:45 pour 1h45</span>
      </div>`;

    default:
      return `<div class="form-group">
        <label class="form-label">${l} ${req}</label>
        <input type="text" name="${n}" class="form-input entry-field"
          value="${escapeHtml(value ?? '')}" ${field.required ? 'required' : ''} />
      </div>`;
  }
}

// ---- Binding du formulaire ----

function bindEntryFormEvents(type, existingEntry, selectedTagIds) {
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

  // Tag chips
  document.querySelectorAll('#entry-tags-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (selectedTagIds.has(id)) { selectedTagIds.delete(id); chip.classList.remove('chip--selected'); }
      else { selectedTagIds.add(id); chip.classList.add('chip--selected'); }
    });
  });

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
        showToast(`Le champ "${field.label}" est obligatoire (sélectionnez une note).`, 'error'); return;
      }
      if (field.type !== 'rating' && (val === null || val === undefined || val === '')) {
        showToast(`Le champ "${field.label}" est obligatoire.`, 'error'); return;
      }
    }

    try {
      if (existingEntry) {
        await TrackingEntryModel.update(existingEntry.id, { timestamp, data, note, tags: [...selectedTagIds] });
        showToast('Saisie modifiée.', 'success');
        router.navigate('history');
      } else {
        await TrackingEntryModel.create({ trackingTypeId: type.id, timestamp, data, note, tags: [...selectedTagIds] });
        showToast(`Saisie "${type.name}" enregistrée.`, 'success');
        router.navigate('dashboard');
      }
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  });
}
