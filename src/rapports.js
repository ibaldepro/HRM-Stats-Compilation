// ── Rapport Annuel ────────────────────────────────────────────────────────────
async function renderRapportAnnuel() {
  const content = document.getElementById('page-content');
  const yearSel = await buildYearSelect(AppState.currentYear);

  content.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <div class="page-title">📋 Rapport annuel consolidé</div>
      <div class="flex gap-2 items-center">
        ${yearSel}
        <button class="btn btn-primary" id="btn-load-rapport">📂 Charger</button>
        <button class="btn btn-secondary" id="btn-export-csv">⬇️ Export CSV</button>
        <button class="btn btn-secondary" id="btn-print-rapport">🖨️ Imprimer PDF</button>
      </div>
    </div>

    <div id="rapport-tabs-wrap"></div>
    <div id="rapport-content">
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Aucun rapport chargé</div>
        <div class="empty-msg">Sélectionnez une année et cliquez sur Charger pour afficher le rapport consolidé.</div>
      </div>
    </div>`;

  document.getElementById('year-select').addEventListener('change', e => AppState.currentYear = parseInt(e.target.value));
  document.getElementById('btn-load-rapport').addEventListener('click', loadRapportAnnuel);
  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
  document.getElementById('btn-print-rapport').addEventListener('click', () => window.print());

  await loadRapportAnnuel();
}

async function loadRapportAnnuel() {
  const annee = parseInt(document.getElementById('year-select').value);
  AppState.currentYear = annee;

  const rows = await window.hrm.loadAnnualData({ annee });
  if (rows.length === 0) {
    document.getElementById('rapport-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">Aucune donnée pour ${annee}</div>
        <div class="empty-msg">Aucun mois n'a encore été saisi pour cette année.</div>
      </div>`;
    document.getElementById('rapport-tabs-wrap').innerHTML = '';
    return;
  }

  // Build mois available
  const moisPresents = [...new Set(rows.map(r => r.mois))].sort((a,b) => a - b);

  // Agrégation annuelle : nbre_lit = MAX, TOM avec jours exacts de la période
  const computed = buildAnnualComputedData(rows, annee);

  // Monthly breakdown: { mois: { service: { ind: val } } }
  const parMois = {};
  for (const row of rows) {
    if (!parMois[row.mois]) parMois[row.mois] = {};
    if (!parMois[row.mois][row.service]) parMois[row.mois][row.service] = {};
    parMois[row.mois][row.service][row.indicateur] = row.valeur;
  }

  // Build tabs
  const tabsWrap = document.getElementById('rapport-tabs-wrap');
  tabsWrap.innerHTML = `
    <div class="tabs" id="rapport-tabs">
      <button class="tab-btn active" data-tab="annuel">📊 Annuel (${annee})</button>
      ${moisPresents.map(m => `<button class="tab-btn" data-tab="mois-${m}">${MOIS.find(x=>x.id===m)?.short}</button>`).join('')}
    </div>`;

  tabsWrap.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsWrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'annuel') {
        renderRapportTable(computed, `Rapport annuel ${annee}`, document.getElementById('rapport-content'));
      } else {
        const moisId   = parseInt(tab.replace('mois-', ''));
        const rawMois  = parMois[moisId] || {};
        // Injecter _nb_jours exact pour le TOM mensuel
        const nbJours  = getDaysInMonth(annee, moisId);
        for (const srv of Object.values(rawMois)) srv['_nb_jours'] = nbJours;
        const moisData  = buildComputedData(rawMois);
        const moisLabel = MOIS.find(m => m.id === moisId)?.label;
        renderRapportTable(moisData, `${moisLabel} ${annee}`, document.getElementById('rapport-content'));
      }
    });
  });

  renderRapportTable(computed, `Rapport annuel ${annee}`, document.getElementById('rapport-content'));
}

function renderRapportTable(computedData, title, container) {
  const hasAnyData = Object.keys(computedData).length > 0;
  if (!hasAnyData) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Aucune donnée</div></div>`;
    return;
  }

  let html = `
    <div class="card">
      <div class="card-header flex justify-between items-center">
        <div class="card-title">📊 ${title}</div>
        <span class="badge badge-blue">${SERVICES.length} services</span>
      </div>
      <div class="card-body" style="padding:0">
        <div class="report-table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th style="text-align:left">Indicateurs</th>
                ${SERVICES.map(s => `<th title="${s.label}">${s.label.substring(0,8)}</th>`).join('')}
                <th style="background:#1e3a8a">TOTAL</th>
              </tr>
            </thead>
            <tbody>`;

  for (const groupe of INDICATEURS_GROUPES) {
    html += `<tr class="group-row"><td colspan="${SERVICES.length + 2}">${groupe.icon} ${groupe.label}</td></tr>`;

    if (groupe.global) {
      // Section globale (médico-techniques) : données sous __GLOBAL__, pas par service
      const gData = computedData['__GLOBAL__'] || {};
      for (const item of groupe.items) {
        const isCalc = !item.editable;
        const val = isCalc && item.calc ? item.calc(gData) : (gData[item.id] ?? 0);
        html += `<tr class="${item.bold ? 'total-row' : ''} ${isCalc ? 'calc-row' : ''}">
          <td>${item.label}</td>
          ${SERVICES.map(() => `<td class="cell-na">—</td>`).join('')}
          <td style="font-weight:${item.bold ? '700' : '400'};background:#dbeafe;color:#1e40af">${formatValue(val, item.type)}</td>
        </tr>`;
      }
    } else {
      for (const item of groupe.items) {
        const isCalc = !item.editable;
        let rowTotal = 0;
        const cells = SERVICES.map(srv => {
          const val = computedData[srv.id]?.[item.id] ?? 0;
          rowTotal += parseFloat(val) || 0;
          return `<td>${formatValue(val, item.type)}</td>`;
        }).join('');

        html += `<tr class="${item.bold ? 'total-row' : ''} ${isCalc ? 'calc-row' : ''}">
          <td>${item.label}</td>
          ${cells}
          <td style="font-weight:700;background:#dbeafe;color:#1e40af">${formatValue(rowTotal, item.type)}</td>
        </tr>`;
      }
    }
  }

  html += '</tbody></table></div></div></div>';
  container.innerHTML = html;
}

async function exportCsv() {
  const annee = parseInt(document.getElementById('year-select')?.value) || AppState.currentYear;
  const result = await window.hrm.exportCsv({ annee });
  if (result.success) {
    showToast('Export réussi !', `Fichier enregistré : ${result.path}`, 'success');
  }
}
