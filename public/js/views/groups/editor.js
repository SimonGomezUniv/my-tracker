/**
 * groups/editor.js — Éditeur de groupe de tracking
 */
import TrackingGroupModel from '../../models/tracking-group.js';
import TrackingTypeModel from '../../models/tracking-type.js';
import TagModel from '../../models/tag.js';
import { escapeHtml, showToast } from '../../utils.js';
import router from '../../router.js';

export default async function groupsEditorView(params) {
  const groupId = params[0] || null;
  let existingGroup = null;

  if (groupId) {
    existingGroup = await TrackingGroupModel.get(groupId);
    if (!existingGroup) {
      return {
        html: `<div class="view-error"><h2>Groupe introuvable</h2><a href="#/groups" class="btn btn-ghost">← Retour</a></div>`,
        title: 'Erreur',
      };
    }
  }

  const [allTags, allTypes] = await Promise.all([
    TagModel.getAll(),
    TrackingTypeModel.getAll(),
  ]);

  const selectedTagIds = new Set(existingGroup?.tags || []);
  const selectedTypeIds = new Set(existingGroup?.trackingTypeIds || []);

  const tagsSection = allTags.length > 0
    ? `<div class="chips-selector" id="tags-chips">
        ${allTags.map(t => `
          <span class="chip ${selectedTagIds.has(t.id) ? 'chip--selected' : ''}"
                data-id="${escapeHtml(t.id)}"
                style="--chip-bg: ${escapeHtml(t.color)}">
            ${escapeHtml(t.name)}
          </span>`).join('')}
       </div>`
    : `<p class="text-muted">Aucun tag disponible. <a href="#/tags">Créer des tags</a>.</p>`;

  const typesSection = allTypes.length > 0
    ? `<div class="chips-selector chips-selector--types" id="types-selector">
        ${allTypes.map(t => `
          <span class="chip chip--type ${selectedTypeIds.has(t.id) ? 'chip--selected' : ''}"
                data-id="${escapeHtml(t.id)}"
                style="--chip-bg: ${escapeHtml(t.color || '#6366f1')}">
            ${escapeHtml(t.icon || '📍')} ${escapeHtml(t.name)}
          </span>`).join('')}
       </div>`
    : `<p class="text-muted">Aucun type disponible. <a href="#/types/new">Créer des types</a> d'abord.</p>`;

  const html = `
    <div class="view-editor">
      <a href="#/groups" class="btn btn-ghost btn-back">← Retour aux groupes</a>
      <form id="group-form" novalidate>

        <section class="editor-section">
          <h2 class="editor-section-title">Informations générales</h2>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="group-name">Nom <span class="required-star">*</span></label>
              <input type="text" id="group-name" class="form-input"
                value="${escapeHtml(existingGroup?.name || '')}"
                placeholder="ex : Santé, Famille, Travail…" required />
            </div>
            <div class="form-group form-group--narrow">
              <label class="form-label" for="group-icon">Icône</label>
              <input type="text" id="group-icon" class="form-input form-input--center"
                value="${escapeHtml(existingGroup?.icon || '📁')}"
                maxlength="2" placeholder="📁" />
            </div>
            <div class="form-group form-group--narrow">
              <label class="form-label" for="group-color">Couleur</label>
              <input type="color" id="group-color" class="form-color"
                value="${existingGroup?.color || '#6366f1'}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="group-description">Description</label>
            <input type="text" id="group-description" class="form-input"
              value="${escapeHtml(existingGroup?.description || '')}"
              placeholder="Description optionnelle…" />
          </div>
        </section>

        <section class="editor-section">
          <h2 class="editor-section-title">Tags</h2>
          ${tagsSection}
        </section>

        <section class="editor-section">
          <h2 class="editor-section-title">Types de tracking inclus</h2>
          <p class="text-muted" style="margin-bottom:12px">Sélectionnez les types à inclure dans ce groupe.</p>
          ${typesSection}
        </section>

        <div class="form-actions form-actions--main">
          <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
          <a href="#/groups" class="btn btn-ghost">Annuler</a>
        </div>
      </form>
    </div>`;

  return {
    html,
    title: existingGroup ? `Modifier : ${existingGroup.name}` : 'Nouveau groupe',
    bind: () => bindGroupsEditorEvents(existingGroup, selectedTagIds, selectedTypeIds),
  };
}

function bindGroupsEditorEvents(existingGroup, selectedTagIds, selectedTypeIds) {
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

  // Type chips toggle
  document.querySelectorAll('#types-selector .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (selectedTypeIds.has(id)) {
        selectedTypeIds.delete(id);
        chip.classList.remove('chip--selected');
      } else {
        selectedTypeIds.add(id);
        chip.classList.add('chip--selected');
      }
    });
  });

  // Soumission du formulaire
  document.getElementById('group-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name').value.trim();
    if (!name) { document.getElementById('group-name').focus(); return; }

    const data = {
      name,
      description: document.getElementById('group-description').value.trim(),
      icon: document.getElementById('group-icon').value.trim() || '📁',
      color: document.getElementById('group-color').value,
      trackingTypeIds: [...selectedTypeIds],
      tags: [...selectedTagIds],
    };

    try {
      if (existingGroup) {
        await TrackingGroupModel.update(existingGroup.id, data);
        showToast(`Groupe "${name}" mis à jour.`, 'success');
      } else {
        await TrackingGroupModel.create(data);
        showToast(`Groupe "${name}" créé.`, 'success');
      }
      router.navigate('groups');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  });
}
