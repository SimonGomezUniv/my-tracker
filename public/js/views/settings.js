/**
 * settings.js — Vue Paramètres (Export / Import / Reset)
 * La logique export/import sera complétée en Phase 5.
 */

export default async function settingsView() {
  const env = window.__ENV__?.NODE_ENV || 'dev';

  const html = `
    <div class="view-settings">

      <section class="settings-section">
        <h2>Export des données</h2>
        <p>Télécharge toutes vos données au format JSON pour en faire une sauvegarde.</p>
        <button id="btn-export" class="btn btn-primary">⬇️ Exporter les données</button>
      </section>

      <section class="settings-section">
        <h2>Import des données</h2>
        <p>Restaure vos données depuis un fichier JSON exporté précédemment.</p>
        <div class="import-zone">
          <label for="import-file" class="btn btn-secondary">📂 Choisir un fichier JSON</label>
          <input type="file" id="import-file" accept=".json" style="display:none" />
          <span id="import-filename" class="import-filename">Aucun fichier sélectionné</span>
        </div>
        <div class="import-options">
          <label class="checkbox-label">
            <input type="checkbox" id="import-replace" checked />
            Remplacer toutes les données existantes
          </label>
        </div>
        <button id="btn-import" class="btn btn-secondary" disabled>⬆️ Importer</button>
      </section>

      <section class="settings-section settings-section--danger">
        <h2>Réinitialisation</h2>
        <p>Supprime <strong>toutes</strong> les données (types, groupes, saisies, tags). Cette action est irréversible.</p>
        <button id="btn-reset" class="btn btn-danger">🗑️ Tout supprimer</button>
      </section>

      <section class="settings-section settings-section--info">
        <h2>Informations</h2>
        <ul class="info-list">
          <li><strong>Version :</strong> 1.0.0</li>
          <li><strong>Mode :</strong> <code>${env}</code></li>
          <li><strong>Stockage :</strong> IndexedDB (navigateur)</li>
        </ul>
      </section>

    </div>`;

  return { html, title: 'Paramètres', bind: bindSettingsEvents };
}

function bindSettingsEvents() {
  // Sera implémenté en Phase 5 avec export.service.js
  const exportBtn = document.getElementById('btn-export');
  const importFile = document.getElementById('import-file');
  const importFilename = document.getElementById('import-filename');
  const importBtn = document.getElementById('btn-import');
  const resetBtn = document.getElementById('btn-reset');

  let selectedFile = null;

  exportBtn?.addEventListener('click', async () => {
    const { exportData } = await import('../services/export.service.js');
    await exportData();
  });

  importFile?.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    importFilename.textContent = selectedFile ? selectedFile.name : 'Aucun fichier sélectionné';
    importBtn.disabled = !selectedFile;
  });

  importBtn?.addEventListener('click', async () => {
    if (!selectedFile) return;
    const replace = document.getElementById('import-replace')?.checked ?? true;
    const { importData } = await import('../services/export.service.js');
    await importData(selectedFile, replace);
  });

  resetBtn?.addEventListener('click', async () => {
    if (!confirm('Supprimer TOUTES les données ? Cette action est irréversible.')) return;
    const { resetData } = await import('../services/export.service.js');
    await resetData();
  });
}
