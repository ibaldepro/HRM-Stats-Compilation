// ── Saisie Mensuelle ──────────────────────────────────────────────────────────
let saisieData    = {};  // { service: { indicateur: value } } for service-based
let saisieGlobal  = {};  // { indicateur: value } for __GLOBAL__ medico-technique
let saisieChanged = false;

async function renderSaisie() {
  const content = document.getElementById('page-content');
  const yearSel = await buildYearSelect(AppState.currentYear);

  content.innerHTML = `
    <div class="page-header">
      <div class="page-title">✏️ Saisie mensuelle</div>
      <div class="page-desc">Renseignez les statistiques de chaque service pour le mois sélectionné</div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <div class="form-row items-center">
          <div class="form-group">
            <label class="form-label">Année</label>${yearSel}
          </div>
          <div class="form-group">
            <label class="form-label">Mois</label>
            <select class="form-control" id="month-select">
              ${MOIS.map(m=>`<option value="${m.id}" ${m.id==AppState.currentMonth?'selected':''}>${m.label}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="btn-load-period">📂 Charger / Nouveau</button>
          <span id="period-status"></span>
        </div>
      </div>
    </div>

    <!-- Main service table -->
    <div class="card mb-4">
      <div class="card-header flex justify-between items-center">
        <div>
          <div class="card-title">📝 Grille de saisie — Services</div>
          <div class="card-subtitle" id="saisie-period-label">Sélectionnez une période et cliquez sur Charger</div>
        </div>
        <div class="flex gap-2" id="saisie-action-btns" style="display:none"></div>
      </div>
      <div class="card-body" style="padding:0">
        <div id="saisie-table-container">
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <div class="empty-title">Aucune période sélectionnée</div>
            <div class="empty-msg">Choisissez une année et un mois puis cliquez sur "Charger / Nouveau".</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Global medico-technique section -->
    <div class="card" id="global-section" style="display:none">
      <div class="card-header">
        <div class="card-title">🔬 Activités Médico-techniques</div>
        <div class="card-subtitle">Données globales — non réparties par service</div>
      </div>
      <div class="card-body" id="global-section-body"></div>
    </div>`;

  document.getElementById('year-select').addEventListener('change', e => AppState.currentYear = parseInt(e.target.value));
  document.getElementById('month-select').addEventListener('change', e => AppState.currentMonth = parseInt(e.target.value));
  document.getElementById('btn-load-period').addEventListener('click', loadSaisiePeriod);
}

async function loadSaisiePeriod() {
  if (saisieChanged) {
    const choice = await showModal({
      icon: '⚠️', title: 'Données non enregistrées',
      body: 'Des données ont été modifiées mais pas sauvegardées. Que souhaitez-vous faire ?',
      buttons: [
        { label: 'Sauvegarder d\'abord', style: 'success' },
        { label: 'Ignorer les changements', style: 'danger' },
        { label: 'Annuler', style: 'secondary' }
      ]
    });
    if (choice === 0) await saveSaisieData();
    else if (choice === 2) return;
  }

  const annee = parseInt(document.getElementById('year-select').value);
  const mois  = parseInt(document.getElementById('month-select').value);
  AppState.currentYear  = annee;
  AppState.currentMonth = mois;

  // Load existing data
  const raw = await window.hrm.loadMonthData({ annee, mois });

  // Separate global from service-based
  saisieData   = {};
  saisieGlobal = raw['__GLOBAL__'] || {};
  for (const srv of getServices()) {
    saisieData[srv.id] = raw[srv.id] || {};
  }

  // Auto-fill nbre_lit if this is a new month
  const hasData = Object.values(raw).some(s => Object.keys(s).length > 0);
  if (!hasData) {
    const defaults = await window.hrm.getNbreLitDefaults({ annee, mois });
    for (const srv of getServices()) {
      if (defaults[srv.id] && !saisieData[srv.id]['nbre_lit']) {
        saisieData[srv.id]['nbre_lit'] = defaults[srv.id];
      }
    }
  }

  saisieChanged = false;

  // Injecter le nombre de jours exact du mois dans chaque service pour le calcul du TOM
  const nbJours = getDaysInMonth(annee, mois);
  for (const srv of getServices()) {
    if (!saisieData[srv.id]) saisieData[srv.id] = {};
    saisieData[srv.id]['_nb_jours'] = nbJours;
  }

  const moisLabel = MOIS.find(m => m.id === mois)?.label || '';
  document.getElementById('saisie-period-label').textContent = `${moisLabel} ${annee}`;
  document.getElementById('period-status').innerHTML = hasData
    ? `<span class="badge badge-green">✅ Données existantes</span>`
    : `<span class="badge badge-amber">🆕 Nouvelle saisie</span>`;

  renderSaisieTable();
  renderGlobalSection();

  const actionsEl = document.getElementById('saisie-action-btns');
  actionsEl.style.display = 'flex';
  actionsEl.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-reset-saisie">🔄 Réinitialiser</button>
    <button class="btn btn-danger btn-sm" id="btn-delete-month" ${!hasData?'disabled':''}>🗑️ Supprimer</button>
    <button class="btn btn-success" id="btn-save-saisie">💾 Enregistrer</button>`;

  document.getElementById('btn-save-saisie').addEventListener('click', saveSaisieData);
  document.getElementById('btn-reset-saisie').addEventListener('click', () => {
    saisieData = {}; for (const s of getServices()) saisieData[s.id] = {};
    saisieGlobal = {}; saisieChanged = false;
    renderSaisieTable(); renderGlobalSection();
  });
  document.getElementById('btn-delete-month').addEventListener('click', deleteMonthData);
}

// ── Render main service table ─────────────────────────────────────────────────
function renderSaisieTable() {
  const container = document.getElementById('saisie-table-container');
  const services  = getServices();

  let thead = `<tr>
    <th style="min-width:190px;position:sticky;left:0;z-index:20">Indicateurs</th>
    ${services.map(s => `<th data-srv="${s.id}" data-label-ref="service:${s.id}">${getLabelForService(s)}</th>`).join('')}
    <th class="total-col">TOTAL</th>
  </tr>`;

  let tbody = '';
  for (const groupe of getServiceGroupes()) {
    tbody += `<tr class="group-header"><td colspan="${services.length + 2}">${groupe.icon} ${groupe.label}</td></tr>`;
    for (const item of groupe.items) {
      const isCalc = !item.editable;
      const rowClass = (item.bold ? 'row-bold' : '') + (isCalc ? ' row-calc' : '');
      let rowTotal = 0;

      const cells = services.map(srv => {
        const sData = saisieData[srv.id] || {};
        const applicable = isIndicatorApplicable(item.id, srv.id);

        if (!applicable) return `<td class="cell-na" title="Non applicable">—</td>`;

        let val;
        if (isCalc && item.calc) {
          val = item.calc(sData);
        } else {
          val = sData[item.id] !== undefined ? sData[item.id] : '';
        }
        rowTotal += parseFloat(val) || 0;

        if (isCalc) {
          return `<td class="calc-cell" data-service="${srv.id}" data-ind="${item.id}">${formatValue(val, item.type)}</td>`;
        }
        return `<td><input class="entry-input" type="number" min="0"
          step="${item.type==='decimal'?'0.01':'1'}"
          value="${val!==''&&val!==undefined?val:''}"
          placeholder="0"
          data-service="${srv.id}" data-ind="${item.id}" data-type="${item.type}"
        ></td>`;
      }).join('');

      tbody += `<tr class="${rowClass}">
        <td data-ind-label="${item.id}" data-label-ref="ind:${item.id}">${getLabelForIndicateur(item)}</td>
        ${cells}
        <td class="total-cell" id="total-${item.id}">${formatValue(rowTotal, item.type)}</td>
      </tr>`;
    }
  }

  container.innerHTML = `
    <div class="entry-table-wrap">
      <table class="entry-table">
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;

  // Triple-click on column headers
  container.querySelectorAll('th[data-srv]').forEach(th => {
    const srv = getServices().find(s => s.id === th.dataset.srv);
    if (srv) setupTripleClick(th, 'service', srv.id);
  });

  // Triple-click on row labels
  container.querySelectorAll('td[data-ind-label]').forEach(td => {
    const indId = td.dataset.indLabel;
    setupTripleClick(td, 'ind', indId);
  });

  // Input events
  container.querySelectorAll('.entry-input').forEach(input => {
    input.addEventListener('input', handleInputChange);
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', handleInputKeyNav);
  });
}

// ── Render global médico-technique section ────────────────────────────────────
function renderGlobalSection() {
  const section = document.getElementById('global-section');
  const body    = document.getElementById('global-section-body');
  section.style.display = '';

  const groupe = getGlobalGroupes()[0]; // medico_technique
  if (!groupe) { section.style.display = 'none'; return; }

  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:8px">`;

  for (const item of groupe.items) {
    const isCalc = !item.editable;
    const val    = isCalc && item.calc ? item.calc(saisieGlobal) : (saisieGlobal[item.id] ?? '');
    const bold   = item.bold ? 'font-weight:700;' : '';

    html += `
      <div class="global-row" style="${bold}">
        <label class="global-row-label" data-ind-label="${item.id}">${getLabelForIndicateur(item)}</label>
        ${isCalc
          ? `<span class="global-calc-val" id="gcalc-${item.id}">${formatValue(val, item.type)}</span>`
          : `<input class="entry-input global-input" type="number" min="0"
              step="${item.type==='decimal'?'0.01':'1'}"
              value="${val!==''&&val!==undefined?val:''}"
              placeholder="0"
              data-ind="${item.id}" data-type="${item.type}">`
        }
      </div>`;
  }
  html += '</div>';
  body.innerHTML = html;

  // Triple-click on global row labels
  body.querySelectorAll('label[data-ind-label]').forEach(lbl => {
    setupTripleClick(lbl, 'ind', lbl.dataset.indLabel);
  });

  body.querySelectorAll('.global-input').forEach(input => {
    input.addEventListener('input', handleGlobalInputChange);
    input.addEventListener('focus', () => input.select());
  });
}

function handleInputChange(e) {
  const input   = e.target;
  const service = input.dataset.service;
  const ind     = input.dataset.ind;
  if (!saisieData[service]) saisieData[service] = {};
  saisieData[service][ind] = parseFloat(input.value) || 0;
  // Maintenir _nb_jours dans le serviceData pour que TOM recalcule correctement
  if (!saisieData[service]['_nb_jours']) {
    saisieData[service]['_nb_jours'] = getDaysInMonth(AppState.currentYear, AppState.currentMonth);
  }
  saisieChanged = true;
  input.classList.add('changed');
  _recalcServiceRow(service);
  updateRowTotals();
}

function handleGlobalInputChange(e) {
  const input = e.target;
  const ind   = input.dataset.ind;
  saisieGlobal[ind] = parseFloat(input.value) || 0;
  saisieChanged = true;
  input.classList.add('changed');
  // Recalculate global calc fields
  const groupe = getGlobalGroupes()[0];
  if (!groupe) return;
  for (const item of groupe.items) {
    if (!item.editable && item.calc) {
      const calcEl = document.getElementById(`gcalc-${item.id}`);
      if (calcEl) calcEl.textContent = formatValue(item.calc(saisieGlobal), item.type);
    }
  }
}

function _recalcServiceRow(service) {
  const sData = saisieData[service] || {};
  for (const groupe of getServiceGroupes()) {
    for (const item of groupe.items) {
      if (!item.editable && item.calc) {
        const cell = document.querySelector(`td[data-service="${service}"][data-ind="${item.id}"]`);
        if (cell) cell.textContent = formatValue(item.calc(sData), item.type);
      }
    }
  }
}

function updateRowTotals() {
  for (const groupe of getServiceGroupes()) {
    for (const item of groupe.items) {
      let total = 0;
      for (const srv of getServices()) {
        if (!isIndicatorApplicable(item.id, srv.id)) continue;
        const sData = saisieData[srv.id] || {};
        total += item.calc ? item.calc(sData) : (parseFloat(sData[item.id]) || 0);
      }
      const cell = document.getElementById(`total-${item.id}`);
      if (cell) cell.textContent = formatValue(total, item.type);
    }
  }
}

function handleInputKeyNav(e) {
  if (e.key !== 'Tab' && e.key !== 'Enter') return;
  e.preventDefault();
  const inputs = [...document.querySelectorAll('.entry-input:not([disabled])')];
  const idx = inputs.indexOf(e.target);
  const next = e.shiftKey ? inputs[idx - 1] : inputs[idx + 1];
  if (next) { next.focus(); next.select(); }
}

async function saveSaisieData() {
  const annee = AppState.currentYear;
  const mois  = AppState.currentMonth;

  // Build service data + computed fields
  const dataToSave = {};
  for (const srv of getServices()) {
    const sData = saisieData[srv.id] || {};
    dataToSave[srv.id] = { ...sData };
    for (const groupe of getServiceGroupes()) {
      for (const item of groupe.items) {
        if (!item.editable && item.calc) {
          dataToSave[srv.id][item.id] = item.calc(sData);
        }
      }
    }
  }

  // Add global medico-technique
  const globalData = { ...saisieGlobal };
  const globalGroupe = GLOBAL_GROUPES[0];
  if (globalGroupe) {
    for (const item of globalGroupe.items) {
      if (!item.editable && item.calc) {
        globalData[item.id] = item.calc(saisieGlobal);
      }
    }
  }
  dataToSave['__GLOBAL__'] = globalData;

  try {
    await window.hrm.saveMonthData({ annee, mois, data: dataToSave });
    saisieChanged = false;
    document.querySelectorAll('.entry-input.changed').forEach(i => i.classList.remove('changed'));
    const moisLabel = MOIS.find(m => m.id === mois)?.label;
    showToast('Données enregistrées !', `${moisLabel} ${annee} — sauvegarde réussie.`, 'success');
    const delBtn = document.getElementById('btn-delete-month');
    if (delBtn) delBtn.disabled = false;
  } catch (err) {
    showToast('Erreur de sauvegarde', err.message, 'error');
  }
}

async function deleteMonthData() {
  const moisLabel = MOIS.find(m => m.id === AppState.currentMonth)?.label;
  const choice = await showModal({
    icon: '🗑️', title: 'Supprimer les données',
    body: `Êtes-vous sûr de vouloir supprimer toutes les données de <strong>${moisLabel} ${AppState.currentYear}</strong> ? Cette action est irréversible.`,
    buttons: [
      { label: 'Supprimer définitivement', style: 'danger' },
      { label: 'Annuler', style: 'secondary' }
    ]
  });
  if (choice !== 0) return;
  await window.hrm.deleteMonthData({ annee: AppState.currentYear, mois: AppState.currentMonth });
  showToast('Données supprimées', `${moisLabel} ${AppState.currentYear}`, 'warning');
  saisieData = {}; for (const s of getServices()) saisieData[s.id] = {};
  saisieGlobal = {}; saisieChanged = false;
  renderSaisieTable(); renderGlobalSection();
  document.getElementById('period-status').innerHTML = `<span class="badge badge-amber">🆕 Nouvelle saisie</span>`;
}
