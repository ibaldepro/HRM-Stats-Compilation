// ── Analyse & Filtres ─────────────────────────────────────────────────────────
let analyseCharts = {};

const PRESETS = [
  {
    id: 'activite_globale',
    label: '📊 Activité globale',
    desc: 'Consultations et hospitalisations de tous les services',
    indicateurs: ['1er_contacts','c_ulterieurs','total_consul','total_hosp','journees_hosp'],
    services: null // all
  },
  {
    id: 'maternite',
    label: '🤱 Maternité & Pédiatrie',
    desc: 'Accouchements, naissances, césariennes',
    indicateurs: ['accouchement','cesarienne','naissance_vivante','total_hosp'],
    services: ['MATERNITE','PEDIATRIE']
  },
  {
    id: 'mortalite',
    label: '📋 Mortalité & Références',
    desc: 'Décès, MEO, références entrantes et sortantes',
    indicateurs: ['deces','meo','ref_recues','contre_refe','ref_vers_chu'],
    services: null
  },
  {
    id: 'occupation',
    label: '🛏️ Occupation des lits',
    desc: 'TOM, DMS et journées d\'hospitalisation',
    indicateurs: ['nbre_lit','journees_hosp','dms','tom'],
    services: null
  },
];

async function renderAnalyse() {
  Object.values(analyseCharts).forEach(c => { try { c.destroy(); } catch(_) {} });
  analyseCharts = {};

  const content = document.getElementById('page-content');
  const yearSel = await buildYearSelect(AppState.currentYear);

  content.innerHTML = `
    <div class="page-title mb-4">📈 Analyse & Filtres croisés</div>

    <!-- Period selector (compact) -->
    <div class="filter-bar mb-4">
      ${yearSel}
      <select class="form-control" id="a-mois-debut">
        ${MOIS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}
      </select>
      <span style="color:var(--text-muted);align-self:center">→</span>
      <select class="form-control" id="a-mois-fin">
        ${MOIS.map(m=>`<option value="${m.id}" ${m.id==12?'selected':''}>${m.label}</option>`).join('')}
      </select>
      <button class="btn btn-primary" id="btn-analyser">🔍 Analyser</button>
    </div>

    <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start">

      <!-- LEFT: filter panel -->
      <div style="display:flex;flex-direction:column;gap:12px">

        <!-- Presets -->
        <div class="card">
          <div class="card-header"><div class="card-title" style="font-size:13px">⚡ Analyses rapides</div></div>
          <div class="card-body" style="padding:8px">
            ${PRESETS.map(p=>`
              <button class="btn btn-ghost w-full preset-btn" data-preset="${p.id}"
                style="justify-content:flex-start;text-align:left;padding:8px 10px;margin-bottom:4px;border-radius:6px">
                <div>
                  <div style="font-weight:600;font-size:13px">${p.label}</div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${p.desc}</div>
                </div>
              </button>`).join('')}
          </div>
        </div>

        <!-- Services -->
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <div class="card-title" style="font-size:13px">🏥 Services</div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm" id="btn-all-srv" style="font-size:11px">Tous</button>
              <button class="btn btn-ghost btn-sm" id="btn-none-srv" style="font-size:11px">Aucun</button>
            </div>
          </div>
          <div class="card-body" style="padding:8px;display:flex;flex-direction:column;gap:4px" id="service-checks">
            ${getServices().map(s=>`
              <label class="check-item checked" style="padding:5px 8px">
                <input type="checkbox" value="${s.id}" checked>
                <span class="service-dot" style="background:${s.color}"></span>
                <span style="font-size:12.5px">${getLabelForService(s)}</span>
              </label>`).join('')}
          </div>
        </div>

        <!-- Indicators -->
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <div class="card-title" style="font-size:13px">📋 Indicateurs</div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm" id="btn-all-ind" style="font-size:11px">Tous</button>
              <button class="btn btn-ghost btn-sm" id="btn-none-ind" style="font-size:11px">Aucun</button>
            </div>
          </div>
          <div class="card-body" style="padding:8px" id="ind-checks">
            ${INDICATEURS_GROUPES.map(g => `
              <div style="margin-bottom:8px">
                <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;padding:4px 8px">${g.label}</div>
                ${g.items.filter(i=>i.editable||i.bold).map(item=>`
                  <label class="check-item" style="padding:4px 8px;margin-bottom:2px">
                    <input type="checkbox" value="${item.id}">
                    <span style="font-size:12px">${getLabelForIndicateur(item)}</span>
                  </label>`).join('')}
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT: results -->
      <div id="analyse-results">
        <div class="empty-state" style="background:var(--bg-card);border-radius:var(--radius);border:1px solid var(--border);padding:60px 20px">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Prêt à analyser</div>
          <div class="empty-msg">Sélectionnez une analyse rapide ou choisissez manuellement services et indicateurs, puis cliquez sur Analyser.</div>
        </div>
      </div>
    </div>`;

  // Events
  document.getElementById('year-select').addEventListener('change', e => AppState.currentYear = parseInt(e.target.value));
  document.getElementById('btn-analyser').addEventListener('click', runAnalyse);

  document.getElementById('btn-all-srv').addEventListener('click', () => toggleAll('#service-checks input', true));
  document.getElementById('btn-none-srv').addEventListener('click', () => toggleAll('#service-checks input', false));
  document.getElementById('btn-all-ind').addEventListener('click', () => toggleAll('#ind-checks input', true));
  document.getElementById('btn-none-ind').addEventListener('click', () => toggleAll('#ind-checks input', false));

  document.getElementById('service-checks').addEventListener('change', e => {
    e.target.closest('.check-item')?.classList.toggle('checked', e.target.checked);
  });
  document.getElementById('ind-checks').addEventListener('change', e => {
    e.target.closest('.check-item')?.classList.toggle('checked', e.target.checked);
  });

  // Preset buttons
  content.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = PRESETS.find(p => p.id === btn.dataset.preset);
      if (!preset) return;
      applyPreset(preset);
      runAnalyse();
    });
  });
}

function toggleAll(selector, state) {
  document.querySelectorAll(selector).forEach(cb => {
    cb.checked = state;
    cb.closest('.check-item')?.classList.toggle('checked', state);
  });
}

function applyPreset(preset) {
  // Services
  document.querySelectorAll('#service-checks input').forEach(cb => {
    const checked = preset.services === null || preset.services.includes(cb.value);
    cb.checked = checked;
    cb.closest('.check-item')?.classList.toggle('checked', checked);
  });
  // Indicators
  document.querySelectorAll('#ind-checks input').forEach(cb => {
    const checked = preset.indicateurs.includes(cb.value);
    cb.checked = checked;
    cb.closest('.check-item')?.classList.toggle('checked', checked);
  });
}

async function runAnalyse() {
  const annee      = parseInt(document.getElementById('year-select').value);
  const moisDebut  = parseInt(document.getElementById('a-mois-debut').value) || 1;
  const moisFin    = parseInt(document.getElementById('a-mois-fin').value)   || 12;
  const services   = [...document.querySelectorAll('#service-checks input:checked')].map(cb => cb.value);
  const indicateurs= [...document.querySelectorAll('#ind-checks input:checked')].map(cb => cb.value);

  const results = document.getElementById('analyse-results');

  if (!services.length || !indicateurs.length) {
    showToast('Sélection incomplète', 'Choisissez au moins un service et un indicateur.', 'warning');
    return;
  }

  results.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><span>Analyse en cours…</span></div>';

  const rows = await window.hrm.queryStats({ annee, moisDebut, moisFin, services, indicateurs });

  if (!rows.length) {
    results.innerHTML = `
      <div class="empty-state" style="background:var(--bg-card);border-radius:var(--radius);border:1px solid var(--border);padding:60px">
        <div class="empty-icon">📭</div>
        <div class="empty-title">Aucune donnée trouvée</div>
        <div class="empty-msg">Aucune donnée ne correspond aux critères sélectionnés pour ${annee}.</div>
      </div>`;
    return;
  }

  const agg      = aggregateRows(rows);
  const computed = buildComputedData(agg);
  const selectedSrv = getServices().filter(s => services.includes(s.id));
  const selectedInd = indicateurs.map(id => ALL_INDICATEURS.find(i => i.id === id)).filter(Boolean);
  const moisLabel   = `${MOIS.find(m=>m.id===moisDebut)?.label} → ${MOIS.find(m=>m.id===moisFin)?.label} ${annee}`;

  // Destroy old charts
  Object.values(analyseCharts).forEach(c => { try { c.destroy(); } catch(_) {} });
  analyseCharts = {};

  // Build result HTML
  let html = `
    <!-- Summary banner -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div class="card" style="padding:10px 16px;flex:1;min-width:140px;border-left:4px solid var(--primary-light)">
        <div class="kpi-label">Période</div><div style="font-weight:700;font-size:15px">${moisLabel}</div>
      </div>
      <div class="card" style="padding:10px 16px;flex:1;min-width:100px;border-left:4px solid var(--accent)">
        <div class="kpi-label">Services</div><div style="font-weight:700;font-size:15px">${selectedSrv.length}</div>
      </div>
      <div class="card" style="padding:10px 16px;flex:1;min-width:120px;border-left:4px solid var(--warning)">
        <div class="kpi-label">Indicateurs</div><div style="font-weight:700;font-size:15px">${selectedInd.length}</div>
      </div>
    </div>

    <!-- Table -->
    <div class="card mb-4">
      <div class="card-body" style="padding:0">
        <div class="report-table-wrap">
          <table class="report-table">
            <thead><tr>
              <th style="text-align:left">Indicateur</th>
              ${selectedSrv.map(s=>`<th><span class="service-dot" style="background:${s.color}"></span>${getLabelForService(s).substring(0,9)}</th>`).join('')}
              <th style="background:#1e3a8a">Total</th>
            </tr></thead>
            <tbody>`;

  for (const item of selectedInd) {
    let rowTotal = 0;
    const cells = selectedSrv.map(s => {
      const val = computed[s.id]?.[item.id] ?? 0;
      rowTotal += parseFloat(val) || 0;
      return `<td>${formatValue(val, item.type)}</td>`;
    }).join('');
    html += `<tr>
      <td>${getLabelForIndicateur(item)} <span class="badge badge-blue" style="font-size:10px">${item.groupeLabel}</span></td>
      ${cells}
      <td style="font-weight:700;background:#dbeafe">${formatValue(rowTotal, item.type)}</td>
    </tr>`;
  }
  html += '</tbody></table></div></div></div>';

  // Charts (max 4)
  const chartsToShow = selectedInd.filter(i => !i.calc).slice(0, 4);
  if (window.Chart && chartsToShow.length) {
    html += `<div class="charts-grid">
      ${chartsToShow.map(item => `
        <div class="chart-card">
          <div class="chart-title">${getLabelForIndicateur(item)}</div>
          <div class="chart-wrap"><canvas id="ac-${item.id}"></canvas></div>
        </div>`).join('')}
    </div>`;
  }

  results.innerHTML = html;

  // Render charts
  if (window.Chart) {
    for (const item of chartsToShow) {
      const canvas = document.getElementById(`ac-${item.id}`);
      if (!canvas) continue;
      const data = selectedSrv.map(s => computed[s.id]?.[item.id] || 0);
      analyseCharts[item.id] = new window.Chart(canvas, {
        type: 'bar',
        data: {
          labels: selectedSrv.map(s => getLabelForService(s)),
          datasets: [{
            label: getLabelForIndicateur(item), data,
            backgroundColor: selectedSrv.map(s => s.color),
            borderRadius: 5, borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 40 } },
            y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString('fr-FR') } }
          }
        }
      });
    }
  }
}
