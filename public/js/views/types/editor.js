/**
 * types/editor.js — Éditeur de type de tracking avec constructeur de champs
 */
import TrackingTypeModel from '../../models/tracking-type.js';
import TagModel from '../../models/tag.js';
import { escapeHtml, showToast, uniqueFieldName } from '../../utils.js';
import router from '../../router.js';

export const FIELD_TYPES = [
  { value: 'string',   label: 'Texte libre' },
  { value: 'numeric',  label: 'Nombre' },
  { value: 'boolean',  label: 'Oui / Non' },
  { value: 'rating',   label: 'Note (1–5 étoiles)' },
  { value: 'duration', label: 'Durée (HH:MM)' },
];

const FIELD_TYPE_LABELS = Object.fromEntries(FIELD_TYPES.map(ft => [ft.value, ft.label]));

export default async function typesEditorView(params) {
  const typeId = params[0] || null;
  let existingType = null;

  if (typeId) {
    existingType = await TrackingTypeModel.get(typeId);
    if (!existingType) {
      return {
        html: `<div class="view-error"><h2>Type introuvable</h2><a href="#/types" class="btn btn-ghost">← Retour</a></div>`,
        title: 'Erreur',
      };
    }
  }

  const allTags = await TagModel.getAll();
  const selectedTagIds = new Set(existingType?.tags || []);

  const tagsSection = allTags.length > 0
    ? `<div class="chips-selector" id="tags-chips">
        ${allTags.map(t => `
          <span class="chip ${selectedTagIds.has(t.id) ? 'chip--selected' : ''}"
                data-id="${escapeHtml(t.id)}"
                style="--chip-bg: ${escapeHtml(t.color)}">
            ${escapeHtml(t.name)}
          </span>`).join('')}
       </div>`
    : `<p class="text-muted">Aucun tag disponible. <a href="#/tags">Créer des tags</a> pour les utiliser ici.</p>`;

  const html = `
    <div class="view-editor">
      <a href="#/types" class="btn btn-ghost btn-back">← Retour aux types</a>
      <form id="type-form" novalidate>

        <section class="editor-section">
          <h2 class="editor-section-title">Informations générales</h2>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="type-name">Nom <span class="required-star">*</span></label>
              <input type="text" id="type-name" class="form-input"
                value="${escapeHtml(existingType?.name || '')}"
                placeholder="ex : Humeur, Fringale, Baby-sitter…" required />
            </div>
            <div class="form-group form-group--narrow">
              <label class="form-label" for="type-icon">Icône</label>
              <input type="text" id="type-icon" class="form-input form-input--center"
                value="${escapeHtml(existingType?.icon || '📍')}"
                maxlength="2" placeholder="📍" />
            </div>
            <div class="form-group form-group--narrow">
              <label class="form-label" for="type-color">Couleur</label>
              <input type="color" id="type-color" class="form-color"
                value="${existingType?.color || '#6366f1'}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="type-description">Description</label>
            <input type="text" id="type-description" class="form-input"
              value="${escapeHtml(existingType?.description || '')}"
              placeholder="Description optionnelle…" />
          </div>
        </section>

        <section class="editor-section">
          <h2 class="editor-section-title">Tags</h2>
          ${tagsSection}
        </section>

        <section class="editor-section">
          <h2 class="editor-section-title">Champs de saisie</h2>
          <p class="text-muted" style="margin-bottom:12px">
            Définissez les données à saisir à chaque utilisation de ce type.
            Sans champ, seules la date et une note libre seront disponibles.
          </p>
          <div id="fields-list-container"></div>
          <button type="button" id="btn-add-field" class="btn btn-secondary" style="margin-top:8px">
            ➕ Ajouter un champ
          </button>
          <div id="field-inline-form" class="card card--inline hidden" style="margin-top:12px">
            <h4 id="field-inline-title" class="card-title" style="margin-bottom:12px">Nouveau champ</h4>
            <div class="form-row">
              <div class="form-group" style="flex:2">
                <label class="form-label" for="field-label">Libellé <span class="required-star">*</span></label>
                <input type="text" id="field-label" class="form-input" placeholder="ex : Score, Durée, Commentaire…" />
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label" for="field-type">Type de donnée</label>
                <select id="field-type" class="form-select">
                  ${FIELD_TYPES.map(ft => `<option value="${ft.value}">${ft.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group form-group--checkbox-align">
                <label class="form-label">&nbsp;</label>
                <label class="checkbox-label">
                  <input type="checkbox" id="field-required" />
                  Obligatoire
                </label>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" id="btn-confirm-field" class="btn btn-primary">✓ Valider</button>
              <button type="button" id="btn-cancel-field" class="btn btn-ghost">Annuler</button>
            </div>
          </div>
        </section>

        <div class="form-actions form-actions--main">
          <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
          <a href="#/types" class="btn btn-ghost">Annuler</a>
        </div>
      </form>
    </div>`;

  return {
    html,
    title: existingType ? `Modifier : ${existingType.name}` : 'Nouveau type',
    bind: () => bindTypesEditorEvents(existingType, selectedTagIds),
  };
}

// ---- Rendu de la liste des champs ----

function renderFieldsList(fields) {
  const container = document.getElementById('fields-list-container');
  if (!container) return;

  if (fields.length === 0) {
    container.innerHTML = `<p class="empty-state">Aucun champ défini.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="fields-list">
      <div class="fields-list-header">
        <span>Libellé</span><span>Nom technique</span><span>Type</span><span>Req.</span><span></span>
      </div>
      ${fields.map((f, i) => `
        <div class="field-row">
          <span>${escapeHtml(f.label)}</span>
          <code class="field-name-code">${escapeHtml(f.name)}</code>
          <span class="badge">${FIELD_TYPE_LABELS[f.type] || f.type}</span>
          <span class="field-req">${f.required ? '✓' : '—'}</span>
          <div class="field-row-actions">
            <button type="button" class="btn btn-sm btn-secondary btn-edit-field" data-index="${i}" title="Modifier">✏️</button>
            <button type="button" class="btn btn-sm btn-danger btn-delete-field" data-index="${i}" title="Supprimer">🗑️</button>
          </div>
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('.btn-delete-field').forEach(btn => {
    btn.addEventListener('click', () => {
      fields.splice(parseInt(btn.dataset.index), 1);
      renderFieldsList(fields);
    });
  });

  container.querySelectorAll('.btn-edit-field').forEach(btn => {
    btn.addEventListener('click', () => openFieldInlineForm(fields, parseInt(btn.dataset.index)));
  });
}

function openFieldInlineForm(fields, editIndex = -1) {
  const inlineForm = document.getElementById('field-inline-form');
  if (editIndex >= 0 && fields[editIndex]) {
    const f = fields[editIndex];
    document.getElementById('field-label').value = f.label;
    document.getElementById('field-type').value = f.type;
    document.getElementById('field-required').checked = !!f.required;
    document.getElementById('field-inline-title').textContent = 'Modifier le champ';
  } else {
    document.getElementById('field-label').value = '';
    document.getElementById('field-type').value = 'string';
    document.getElementById('field-required').checked = false;
    document.getElementById('field-inline-title').textContent = 'Nouveau champ';
  }
  inlineForm.dataset.editIndex = String(editIndex);
  inlineForm.classList.remove('hidden');
  document.getElementById('field-label').focus();
}

// ---- Binding principal ----

function bindTypesEditorEvents(existingType, selectedTagIds) {
  const fields = existingType?.fields ? existingType.fields.map(f => ({ ...f })) : [];
  renderFieldsList(fields);

  // Tag chips toggle
  document.querySelectorAll('#tags-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (selectedTagIds.has(id)) {
        selectedTagIds.delete(id);
        chip.classList.remove('chip--selected');
      } else {
        selectedTagIds.add(id);
        chip.classList.add('chip--selected');
      }
    });
  });

  // Bouton ajouter un champ
  document.getElementById('btn-add-field')?.addEventListener('click', () => openFieldInlineForm(fields, -1));

  // Annuler inline form
  document.getElementById('btn-cancel-field')?.addEventListener('click', () => {
    document.getElementById('field-inline-form').classList.add('hidden');
  });

  // Valider le champ inline
  document.getElementById('btn-confirm-field')?.addEventListener('click', () => {
    const label = document.getElementById('field-label').value.trim();
    if (!label) { document.getElementById('field-label').focus(); return; }

    const inlineForm = document.getElementById('field-inline-form');
    const editIndex = parseInt(inlineForm.dataset.editIndex ?? '-1');
    const field = {
      name: uniqueFieldName(label, fields, editIndex),
      label,
      type: document.getElementById('field-type').value,
      required: document.getElementById('field-required').checked,
    };

    if (editIndex >= 0) {
      fields[editIndex] = field;
    } else {
      fields.push(field);
    }
    inlineForm.classList.add('hidden');
    renderFieldsList(fields);
  });

  // Soumission du formulaire principal
  document.getElementById('type-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('type-name').value.trim();
    if (!name) { document.getElementById('type-name').focus(); return; }

    const data = {
      name,
      description: document.getElementById('type-description').value.trim(),
      icon: document.getElementById('type-icon').value.trim() || '📍',
      color: document.getElementById('type-color').value,
      fields: [...fields],
      tags: [...selectedTagIds],
    };

    try {
      if (existingType) {
        await TrackingTypeModel.update(existingType.id, data);
        showToast(`Type "${name}" mis à jour.`, 'success');
      } else {
        await TrackingTypeModel.create(data);
        showToast(`Type "${name}" créé.`, 'success');
      }
      router.navigate('types');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  });
}
