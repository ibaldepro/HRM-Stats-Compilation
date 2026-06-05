// ── Paramètres ────────────────────────────────────────────────────────────────
async function renderParametres() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-title mb-4">⚙️ Paramètres</div>
    <div class="tabs" id="params-tabs">
      <button class="tab-btn active" data-tab="general">🏠 Général</button>
      <button class="tab-btn" data-tab="services">🏥 Services</button>
      <button class="tab-btn" data-tab="indicateurs">📊 Indicateurs</button>
      <button class="tab-btn" data-tab="export">📤 Export</button>
    </div>
    <div id="params-content"></div>`;
  content.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderParamsTab(btn.dataset.tab);
    });
  });
  renderParamsTab('general');
}

async function renderParamsTab(tab) {
  const el = document.getElementById('params-content');
  if (tab === 'general')     await renderParamsGeneral(el);
  if (tab === 'services')    await renderParamsServices(el);
  if (tab === 'indicateurs') await renderParamsIndicateurs(el);
  if (tab === 'export')      await renderParamsExport(el);
}

// ── Général ───────────────────────────────────────────────────────────────────
async function renderParamsGeneral(el) {
  const dbInfo   = await window.hrm.getDbInfo();
  const years    = await window.hrm.getAvailableYears();
  const logoData = await window.hrm.getLogo();

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

      <!-- Logo card -->
      <div class="card">
        <div class="card-header"><div class="card-title">🖼️ Logo de l'hôpital</div></div>
        <div class="card-body" style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px 20px">
          <div id="logo-preview-wrap" style="width:120px;height:120px;border:2px dashed var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--bg);overflow:hidden">
            ${logoData
              ? `<img id="logo-preview" src="${logoData}" style="max-width:100%;max-height:100%;object-fit:contain">`
              : `<span id="logo-preview-empty" style="font-size:40px">🏥</span>`}
          </div>
          <div style="font-size:12px;color:var(--text-muted);text-align:center">
            PNG, JPG, GIF — recommandé : fond transparent ou blanc
          </div>
          <div class="flex gap-2 w-full">
            <button class="btn btn-primary flex-1" id="btn-pick-logo">📂 Choisir un logo</button>
            ${logoData ? `<button class="btn btn-danger btn-sm" id="btn-remove-logo" title="Supprimer le logo">🗑️</button>` : ''}
          </div>
        </div>
      </div>

      <!-- DB Info -->
      <div class="card">
        <div class="card-header"><div class="card-title">🗄️ Base de données</div></div>
        <div class="card-body">
          <div class="form-label mb-3">Emplacement</div>
          <div style="background:var(--bg);padding:10px 12px;border-radius:6px;font-size:11px;word-break:break-all;color:var(--text-muted);font-family:monospace;margin-bottom:16px">${dbInfo.path}</div>
          <div class="form-label mb-3">Années avec données</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
            ${years.length ? years.map(y=>`<span class="badge badge-blue">${y}</span>`).join('') : '<span style="color:var(--text-muted)">Aucune donnée</span>'}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary flex-1" id="btn-open-folder">📁 Ouvrir le dossier</button>
            <button class="btn btn-primary flex-1" id="btn-backup-db">💾 Sauvegarder</button>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
            ⚠️ Les données sont automatiquement préservées lors des mises à jour. La sauvegarde manuelle est optionnelle.
          </div>
        </div>
      </div>

      <!-- À propos -->
      <div class="card" style="grid-column:1/-1">
        <div class="card-header"><div class="card-title">ℹ️ À propos</div></div>
        <div class="card-body" style="display:flex;align-items:center;gap:32px">
          <div style="text-align:center;min-width:100px">
            ${logoData
              ? `<img src="${logoData}" style="width:64px;height:64px;object-fit:contain">`
              : `<span style="font-size:52px">🏥</span>`}
          </div>
          <div>
            <div style="font-size:20px;font-weight:700;margin-bottom:4px">HRM Stats</div>
            <div style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Système de gestion statistique · Hôpital Régional de Mamou</div>
            <span class="badge badge-blue">Version 1.0.0</span>
            <div style="margin-top:12px;font-size:12px;color:var(--text-light);line-height:2">
              Application hors ligne · Windows 10/11 · Données SQLite locales<br>
              <strong style="color:var(--text-muted)">Développé par Dr IBALDE</strong> ·
              <a href="mailto:ibaldepro@gmail.com" style="color:var(--primary-light)">ibaldepro@gmail.com</a>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  el.querySelector('#btn-open-folder').addEventListener('click', () => window.hrm.openDataFolder());

  el.querySelector('#btn-backup-db').addEventListener('click', async () => {
    const result = await window.hrm.backupDatabase();
    if (result?.success) showToast('Sauvegarde réussie !', result.path, 'success');
    else if (result?.cancelled) return;
    else showToast('Erreur de sauvegarde', result?.error || '', 'error');
  });

  el.querySelector('#btn-pick-logo').addEventListener('click', async () => {
    const dataUrl = await window.hrm.selectLogo();
    if (dataUrl) {
      applyLogo(dataUrl);
      showToast('Logo mis à jour !', 'Le logo apparaît maintenant dans la barre latérale.', 'success');
      renderParamsTab('general'); // refresh preview
    }
  });

  el.querySelector('#btn-remove-logo')?.addEventListener('click', async () => {
    await window.hrm.removeLogo();
    applyLogo(null);
    showToast('Logo supprimé', '', 'info');
    renderParamsTab('general');
  });
}

// ── Services ──────────────────────────────────────────────────────────────────
async function renderParamsServices(el) {
  const services = getServices();
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start">

      <!-- List -->
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <div>
            <div class="card-title">🏥 Services configurés</div>
            <div class="card-subtitle">Triple-clic sur un nom dans la saisie pour le renommer rapidement</div>
          </div>
          <div class="flex gap-2">
            ${window.appSettings.customServices ? `<button class="btn btn-secondary btn-sm" id="btn-reset-services">↩️ Réinitialiser</button>` : ''}
            <button class="btn btn-primary btn-sm" id="btn-add-service">＋ Ajouter</button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <table class="report-table">
            <thead><tr>
              <th style="text-align:left;width:40px">#</th>
              <th style="text-align:left">Service</th>
              <th style="width:60px">Couleur</th>
              <th style="width:60px">Icône</th>
              <th style="width:100px">Actions</th>
            </tr></thead>
            <tbody>
              ${services.map((s, i) => `
                <tr>
                  <td style="color:var(--text-muted)">${i+1}</td>
                  <td>
                    <span class="service-dot" style="background:${s.color}"></span>
                    <strong data-label-ref="service:${s.id}">${getLabelForService(s)}</strong>
                    <span style="font-size:10px;color:var(--text-light);margin-left:4px">${s.id}</span>
                  </td>
                  <td>
                    <input type="color" value="${s.color}" class="srv-color-live"
                      data-idx="${i}" style="width:36px;height:28px;border:none;cursor:pointer;border-radius:4px">
                  </td>
                  <td style="text-align:center;font-size:18px">${s.icon||'🏥'}</td>
                  <td style="padding:5px">
                    <div class="flex gap-1">
                      <button class="btn btn-secondary btn-sm btn-edit-srv" data-idx="${i}">✏️</button>
                      <button class="btn btn-danger btn-sm btn-del-srv" data-idx="${i}">🗑️</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Help card -->
      <div class="card">
        <div class="card-header"><div class="card-title">💡 Guide</div></div>
        <div class="card-body" style="font-size:13px;line-height:1.8;color:var(--text-muted)">
          <p><strong>Ajouter</strong> — Cliquez sur <em>＋ Ajouter</em>. L'identifiant et l'icône sont générés automatiquement depuis le nom.</p>
          <br>
          <p><strong>Modifier</strong> — Cliquez sur ✏️ pour changer le nom, la couleur ou l'icône.</p>
          <br>
          <p><strong>Couleur rapide</strong> — Le sélecteur de couleur dans la liste modifie la couleur instantanément.</p>
          <br>
          <p><strong>Triple-clic</strong> — Sur n'importe quel en-tête de colonne dans la saisie pour renommer directement.</p>
          <br>
          <p style="color:var(--warning)">⚠️ Supprimer un service ne supprime pas ses données existantes.</p>
        </div>
      </div>
    </div>`;

  // Live color update
  el.querySelectorAll('.srv-color-live').forEach(inp => {
    inp.addEventListener('input', async e => {
      const idx = parseInt(e.target.dataset.idx);
      const svcs = JSON.parse(JSON.stringify(getServices()));
      svcs[idx].color = e.target.value;
      await _saveCustomServices(svcs);
      // Update dot in this table without full re-render
      const dot = e.target.closest('tr').querySelector('.service-dot');
      if (dot) dot.style.background = e.target.value;
    });
  });

  el.querySelectorAll('.btn-edit-srv').forEach(btn => {
    btn.addEventListener('click', () => _editServiceModal(parseInt(btn.dataset.idx)));
  });
  el.querySelectorAll('.btn-del-srv').forEach(btn => {
    btn.addEventListener('click', () => _deleteService(parseInt(btn.dataset.idx)));
  });
  el.querySelector('#btn-add-service')?.addEventListener('click', () => _editServiceModal(-1));
  el.querySelector('#btn-reset-services')?.addEventListener('click', async () => {
    await window.hrm.setSetting({ key: 'custom_services', value: null });
    window.appSettings.customServices = null;
    showToast('Services réinitialisés', '', 'info');
    renderParamsTab('services');
  });
}

async function _editServiceModal(idx) {
  const isNew = idx === -1;
  const srv   = isNew ? { id:'', label:'', color:'#3b82f6', icon:'🏥' } : { ...getServices()[idx] };

  const vals = await showFormModal({
    icon:         isNew ? '➕' : '✏️',
    title:        isNew ? 'Ajouter un service' : `Modifier — ${getLabelForService(srv)}`,
    confirmLabel: isNew ? 'Ajouter' : 'Enregistrer',
    fields: [
      { key: 'label', label: 'Nom du service', required: true, value: srv.label, placeholder: 'ex: Radiologie' },
      { key: 'color', label: 'Couleur',  type: 'color',  value: srv.color },
      { key: 'icon',  label: 'Icône (emoji)', value: srv.icon, placeholder: '🏥',
        hint: 'Laissez vide pour une icône automatique selon le nom' },
    ]
  });

  if (!vals) return;

  const newLabel = vals.label.trim();
  if (!newLabel) { showToast('Nom requis', 'Veuillez saisir un nom pour le service.', 'warning'); return; }

  const newIcon  = vals.icon.trim()  || guessIcon(newLabel);
  const newColor = vals.color || '#3b82f6';
  const svcs     = JSON.parse(JSON.stringify(getServices()));

  if (isNew) {
    const newId = labelToId(newLabel);
    if (!newId) { showToast('Nom invalide', '', 'warning'); return; }
    if (svcs.find(s => s.id === newId)) {
      showToast('Service existant', `Un service avec l'identifiant "${newId}" existe déjà.`, 'warning');
      return;
    }
    svcs.push({ id: newId, label: newLabel, color: newColor, icon: newIcon });
  } else {
    svcs[idx].label = newLabel;
    svcs[idx].color = newColor;
    svcs[idx].icon  = newIcon;
    setCustomLabel('service', svcs[idx].id, newLabel); // propagate
  }

  await _saveCustomServices(svcs);
  renderParamsTab('services');
}

async function _deleteService(idx) {
  const srv = getServices()[idx];
  const choice = await showModal({
    icon: '🗑️', title: 'Supprimer le service',
    body: `Supprimer <strong>${getLabelForService(srv)}</strong> ?<br>
           <span style="color:var(--text-muted);font-size:12px">Les données existantes ne sont pas effacées mais ce service n'apparaîtra plus dans la saisie.</span>`,
    buttons: [{ label: 'Supprimer', style: 'danger' }, { label: 'Annuler', style: 'secondary' }]
  });
  if (choice !== 0) return;
  const svcs = JSON.parse(JSON.stringify(getServices()));
  svcs.splice(idx, 1);
  await _saveCustomServices(svcs);
  renderParamsTab('services');
}

async function _saveCustomServices(svcs) {
  await window.hrm.setSetting({ key: 'custom_services', value: svcs });
  window.appSettings.customServices = svcs;
  showToast('Services mis à jour', '', 'success', 1800);
}

// ── Indicateurs ───────────────────────────────────────────────────────────────
async function renderParamsIndicateurs(el) {
  const cfg      = window.appSettings.indicatorServiceConfig || {};
  const services = getServices();
  const groupes  = getEffectiveGroupes();

  // ── Table: edit labels + service assignment
  let groupHtml = '';
  for (const groupe of groupes) {
    groupHtml += `
      <div class="card mb-4">
        <div class="card-header flex justify-between items-center">
          <div class="card-title">${groupe.icon} ${groupe.label}</div>
          <button class="btn btn-primary btn-sm btn-add-ind" data-groupe="${groupe.id}">＋ Indicateur</button>
        </div>
        <div class="card-body" style="padding:0">
          <table class="report-table">
            <thead><tr>
              <th style="text-align:left;min-width:180px">Label affiché</th>
              <th style="text-align:left;min-width:120px;color:#94a3b8">ID interne</th>
              ${groupe.global ? '' : services.map(s => `<th title="${getLabelForService(s)}" style="min-width:36px">${getLabelForService(s).substring(0,5)}</th>`).join('')}
              <th style="width:60px"></th>
            </tr></thead>
            <tbody>`;
    for (const item of groupe.items) {
      const allowedSrvs = cfg[item.id] || null;
      const isCustom    = !!(window.appSettings.customIndicators||[]).find(c => c.id === item.id);
      groupHtml += `
        <tr data-ind-row="${item.id}">
          <td>
            <input type="text" class="form-control ind-label-inp" data-ind="${item.id}"
              value="${getLabelForIndicateur(item)}" style="height:28px;font-size:12.5px">
          </td>
          <td style="color:var(--text-muted);font-size:11px;font-family:monospace">${item.id}</td>
          ${groupe.global ? '' : services.map(s => {
              const checked = allowedSrvs === null || allowedSrvs.includes(s.id);
              return `<td><input type="checkbox" class="ind-srv-check" data-ind="${item.id}" data-srv="${s.id}"
                ${checked?'checked':''} style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer"></td>`;
          }).join('')}
          <td>${isCustom ? `<button class="btn btn-danger btn-sm btn-del-ind" data-ind="${item.id}" title="Supprimer" style="width:28px;padding:0">🗑️</button>` : ''}</td>
        </tr>`;
    }
    groupHtml += '</tbody></table></div></div>';
  }

  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <div style="font-size:13px;color:var(--text-muted)">
        Modifiez les labels et l'assignation des indicateurs aux services. Les changements de labels se propagent immédiatement dans l'app.
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary btn-sm" id="btn-check-all-inds">✅ Tout cocher</button>
        <button class="btn btn-success" id="btn-save-inds">💾 Enregistrer tout</button>
      </div>
    </div>
    ${groupHtml}`;

  // Add indicator
  el.querySelectorAll('.btn-add-ind').forEach(btn => {
    btn.addEventListener('click', () => _addIndicateurModal(btn.dataset.groupe));
  });

  // Delete custom indicator
  el.querySelectorAll('.btn-del-ind').forEach(btn => {
    btn.addEventListener('click', async () => {
      const indId = btn.dataset.ind;
      const choice = await showModal({
        icon:'🗑️', title:'Supprimer l\'indicateur',
        body: `Supprimer <strong>${indId}</strong> de la configuration ? Les données existantes ne sont pas effacées.`,
        buttons:[{label:'Supprimer',style:'danger'},{label:'Annuler',style:'secondary'}]
      });
      if (choice !== 0) return;
      const customs = (window.appSettings.customIndicators || []).filter(c => c.id !== indId);
      await window.hrm.setSetting({ key:'custom_indicators', value: customs });
      window.appSettings.customIndicators = customs;
      showToast('Indicateur supprimé', '', 'warning');
      renderParamsTab('indicateurs');
    });
  });

  el.querySelector('#btn-check-all-inds').addEventListener('click', () => {
    el.querySelectorAll('.ind-srv-check').forEach(cb => cb.checked = true);
  });

  el.querySelector('#btn-save-inds').addEventListener('click', async () => {
    // 1. Save label changes
    el.querySelectorAll('.ind-label-inp').forEach(inp => {
      const v = inp.value.trim();
      if (v) window._setCustomLabel('ind', inp.dataset.ind, v); // propagates to DOM
    });

    // 2. Save service config
    const newCfg = {};
    el.querySelectorAll('.ind-srv-check').forEach(cb => {
      if (!newCfg[cb.dataset.ind]) newCfg[cb.dataset.ind] = [];
      if (cb.checked) newCfg[cb.dataset.ind].push(cb.dataset.srv);
    });
    for (const [ind, svcs] of Object.entries(newCfg)) {
      if (svcs.length === services.length) newCfg[ind] = null;
    }
    await window.hrm.setSetting({ key: 'indicator_service_config', value: newCfg });
    window.appSettings.indicatorServiceConfig = newCfg;

    showToast('Indicateurs mis à jour', 'Labels et assignations sauvegardés.', 'success');
  });
}

async function _addIndicateurModal(groupeId) {
  const groupes  = getEffectiveGroupes();
  const groupe   = groupes.find(g => g.id === groupeId);
  const vals = await showFormModal({
    icon: '➕', title: `Ajouter un indicateur — ${groupe?.label || groupeId}`,
    confirmLabel: 'Ajouter',
    fields: [
      { key: 'label', label: 'Nom / Label', required: true, placeholder: 'ex: Consultations VIH' },
      { key: 'type',  label: 'Type de valeur', type: 'select',
        options: [
          {value:'int',    label:'Nombre entier'},
          {value:'decimal',label:'Nombre décimal'},
          {value:'percent',label:'Pourcentage'},
        ]
      },
    ]
  });
  if (!vals || !vals.label.trim()) return;

  const newLabel = vals.label.trim();
  const newId    = labelToId(newLabel);

  // Check duplicate
  const all = getEffectiveGroupes().flatMap(g => g.items);
  if (all.find(i => i.id === newId)) {
    showToast('Indicateur existant', `Un indicateur avec l'identifiant "${newId}" existe déjà.`, 'warning');
    return;
  }

  const customs = [...(window.appSettings.customIndicators || []),
    { id: newId, label: newLabel, groupe: groupeId, type: vals.type || 'int', editable: true }
  ];
  await window.hrm.setSetting({ key: 'custom_indicators', value: customs });
  window.appSettings.customIndicators = customs;
  showToast('Indicateur ajouté', newLabel, 'success');
  renderParamsTab('indicateurs');
}

// ── Export ────────────────────────────────────────────────────────────────────
async function renderParamsExport(el) {
  const years = await window.hrm.getAvailableYears();
  el.innerHTML = `
    <!-- Dump / Restore DB -->
    <div class="card mb-4" style="border-left:4px solid var(--primary)">
      <div class="card-header">
        <div>
          <div class="card-title">🔄 Transfert de base de données entre PCs</div>
          <div class="card-subtitle">Exportez toutes vos données pour les transférer sur un autre ordinateur</div>
        </div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

          <!-- Exporter -->
          <div>
            <div style="font-weight:600;font-size:13.5px;margin-bottom:8px">📤 Exporter (ce PC)</div>
            <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;line-height:1.6">
              Crée une copie complète de la base de données.<br>
              Transférez le fichier <code>.db</code> par clé USB ou réseau vers l'autre PC.
            </p>
            <button class="btn btn-primary w-full" id="btn-dump-db">💾 Exporter la base de données (.db)</button>
          </div>

          <!-- Importer -->
          <div>
            <div style="font-weight:600;font-size:13.5px;margin-bottom:8px">📥 Importer (PC cible)</div>
            <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;line-height:1.6">
              Charge un fichier <code>.db</code> exporté depuis un autre PC.<br>
              <strong style="color:var(--danger)">Remplace toutes les données actuelles.</strong>
            </p>
            <button class="btn btn-warning w-full" id="btn-restore-db">📂 Importer un fichier .db</button>
          </div>
        </div>
        <div style="margin-top:14px;padding:10px 14px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-muted)">
          💡 <strong>Sans risque lors des mises à jour :</strong> La base de données est stockée dans
          <code>AppData\Roaming\HRM Stats\</code>, séparément des fichiers de l'application.
          Une réinstallation ou mise à jour ne touche jamais vos données.
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px">
      <!-- Excel -->
      <div class="card">
        <div class="card-header"><div class="card-title">📊 Export Excel formaté</div></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            Génère un fichier <strong>.xlsx</strong> avec une feuille par mois + une feuille de rapport annuel consolidé. Formatage professionnel avec couleurs et bordures.
          </p>
          <div class="form-group mb-4">
            <label class="form-label">Année</label>
            <select class="form-control" id="xl-year" style="max-width:140px">
              ${years.length ? years.map(y=>`<option>${y}</option>`).join('') : `<option>${getCurrentYear()}</option>`}
            </select>
          </div>
          <button class="btn btn-success w-full" id="btn-export-excel">📊 Exporter en Excel (.xlsx)</button>
        </div>
      </div>
      <!-- CSV -->
      <div class="card">
        <div class="card-header"><div class="card-title">📄 Export CSV</div></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            Export simple au format CSV, compatible avec tous les tableurs.
          </p>
          <div class="form-group mb-4">
            <label class="form-label">Année</label>
            <select class="form-control" id="csv-year" style="max-width:140px">
              ${years.length ? years.map(y=>`<option>${y}</option>`).join('') : `<option>${getCurrentYear()}</option>`}
            </select>
          </div>
          <button class="btn btn-secondary w-full" id="btn-export-csv">⬇️ Exporter en CSV</button>
        </div>
      </div>
    </div>`;

  el.querySelector('#btn-export-excel').addEventListener('click', async () => {
    const annee = parseInt(el.querySelector('#xl-year').value);
    const btn   = el.querySelector('#btn-export-excel');
    btn.disabled = true;
    btn.textContent = '⏳ Génération…';
    const result = await window.hrm.exportExcel({
      annee,
      services:           getServices(),
      indicateursGroupes: getEffectiveGroupes(),
    });
    btn.disabled = false;
    btn.textContent = '📊 Exporter en Excel (.xlsx)';
    if (result.success) showToast('Export Excel réussi !', result.path, 'success');
    else showToast('Erreur export', result.error || '', 'error');
  });

  el.querySelector('#btn-export-csv').addEventListener('click', async () => {
    const annee = parseInt(el.querySelector('#csv-year').value);
    const result = await window.hrm.exportCsv({ annee });
    if (result.success) showToast('Export CSV réussi !', result.path, 'success');
  });

  // ── Dump / Restore ──────────────────────────────────────────────────────────
  el.querySelector('#btn-dump-db').addEventListener('click', async () => {
    const result = await window.hrm.backupDatabase();
    if (result?.success) {
      showToast('Base exportée !', `Fichier : ${result.path}`, 'success');
    } else if (!result?.cancelled) {
      showToast('Erreur export', result?.error || '', 'error');
    }
  });

  el.querySelector('#btn-restore-db').addEventListener('click', async () => {
    const choice = await showModal({
      icon: '⚠️',
      title: 'Importer une base de données',
      body: `<strong>Attention :</strong> cette opération remplacera <strong>toutes les données actuelles</strong> par celles du fichier importé.<br><br>
             L'application redémarrera automatiquement après l'import.<br><br>
             Assurez-vous d'avoir exporté vos données actuelles si vous souhaitez les conserver.`,
      buttons: [
        { label: '📂 Choisir le fichier et importer', style: 'warning' },
        { label: 'Annuler', style: 'secondary' }
      ]
    });
    if (choice !== 0) return;

    const result = await window.hrm.restoreDatabase();
    if (result?.cancelled) return;
    if (result?.success) {
      showToast('Import réussi !', 'L\'application va redémarrer…', 'success');
    } else {
      showToast('Erreur d\'import', result?.error || 'Fichier invalide', 'error');
    }
  });
}
