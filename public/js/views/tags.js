/**
 * tags.js — Vue Tags (CRUD complet)
 */
import TagModel from '../models/tag.js';
import { escapeHtml, showToast } from '../utils.js';

export default async function tagsView() {
  const html = `
    <div class="view-tags">
      <div class="view-header">
        <p class="view-subtitle">Tags help categorize your entries and tracking types.</p>
        <button id="btn-new-tag" class="btn btn-primary">➕ New tag</button>
      </div>

      <div id="tag-form-container" class="card card--form hidden">
        <h3 id="tag-form-title" class="card-title">New tag</h3>
        <form id="tag-form">
          <input type="hidden" id="tag-id" />
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label" for="tag-name">Name <span class="required-star">*</span></label>
              <input type="text" id="tag-name" class="form-input" placeholder="e.g. urgent, personal, work..." required />
            </div>
            <div class="form-group form-group--narrow">
              <label class="form-label" for="tag-color">Color</label>
              <input type="color" id="tag-color" class="form-color" value="#6366f1" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Save</button>
            <button type="button" id="btn-cancel-tag" class="btn btn-ghost">Cancel</button>
          </div>
        </form>
      </div>

      <div id="tags-list"></div>
    </div>`;

  return { html, title: 'Tags', bind: bindTagsEvents };
}

async function renderTagsList() {
  const container = document.getElementById('tags-list');
  if (!container) return;
  const tags = await TagModel.getAll();

  if (tags.length === 0) {
    container.innerHTML = `<p class="empty-state" style="margin-top:24px">No tags yet. Click "New tag" to get started.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="tags-grid">
      ${tags.map(t => `
        <div class="tag-row">
          <span class="tag-pill" style="background:${escapeHtml(t.color)}">${escapeHtml(t.name)}</span>
          <div class="tag-row-actions">
            <button class="btn btn-sm btn-secondary btn-edit-tag"
              data-id="${escapeHtml(t.id)}"
              data-name="${escapeHtml(t.name)}"
              data-color="${escapeHtml(t.color)}">✏️ Edit</button>
            <button class="btn btn-sm btn-danger btn-delete-tag"
              data-id="${escapeHtml(t.id)}"
              data-name="${escapeHtml(t.name)}">🗑️ Delete</button>
          </div>
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('.btn-edit-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('tag-id').value = btn.dataset.id;
      document.getElementById('tag-name').value = btn.dataset.name;
      document.getElementById('tag-color').value = btn.dataset.color;
      document.getElementById('tag-form-title').textContent = 'Edit tag';
      document.getElementById('tag-form-container').classList.remove('hidden');
      document.getElementById('tag-name').focus();
    });
  });

  container.querySelectorAll('.btn-delete-tag').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete tag "${btn.dataset.name}"?`)) return;
      await TagModel.delete(btn.dataset.id);
      showToast(`Tag "${btn.dataset.name}" deleted.`, 'success');
      await renderTagsList();
    });
  });
}

function resetTagForm() {
  document.getElementById('tag-id').value = '';
  document.getElementById('tag-name').value = '';
  document.getElementById('tag-color').value = '#6366f1';
  document.getElementById('tag-form-title').textContent = 'New tag';
  document.getElementById('tag-form-container').classList.add('hidden');
}

function bindTagsEvents() {
  renderTagsList();

  document.getElementById('btn-new-tag')?.addEventListener('click', () => {
    resetTagForm();
    document.getElementById('tag-form-container').classList.remove('hidden');
    document.getElementById('tag-name').focus();
  });

  document.getElementById('btn-cancel-tag')?.addEventListener('click', resetTagForm);

  document.getElementById('tag-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tag-id').value;
    const name = document.getElementById('tag-name').value.trim();
    const color = document.getElementById('tag-color').value;
    if (!name) return;

    if (id) {
      await TagModel.update(id, { name, color });
      showToast(`Tag "${name}" updated.`, 'success');
    } else {
      await TagModel.create({ name, color });
      showToast(`Tag "${name}" created.`, 'success');
    }
    resetTagForm();
    await renderTagsList();
  });
}
