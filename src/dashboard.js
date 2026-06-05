// ── Dashboard ─────────────────────────────────────────────────────────────────
let dashCharts = {};

async function renderDashboard() {
  // Destroy previous charts
  Object.values(dashCharts).forEach(c => { try { c.destroy(); } catch(_) {} });
  dashCharts = {};

  const content = document.getElementById('page-content');
  const yearSel = await buildYearSelect(AppState.currentYear);

  content.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <div class="page-title">📊 Tableau de bord</div>
      <div class="flex gap-2 items-center">
        <label class="form-label" style="margin:0">Période :</label>
        ${yearSel}
        <select class="form-control" id="dash-mois-debut">
          <option value="">Tous les mois</option>
          ${MOIS.map(m => `<option value="${m.id}">${m.label}</option>`).join('')}
        </select>
        <span style="color:var(--text-muted);font-size:12px">à</span>
        <select class="form-control" id="dash-mois-fin">
          <option value="">—</option>
          ${MOIS.map(m => `<option value="${m.id}" ${m.id == 12 ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="btn-dash-refresh">🔄 Actualiser</button>
      </div>
    </div>

    <div id="dash-kpi-row" class="kpi-grid"></div>
    <div id="dash-detail-badges" style="margin-bottom:20px"></div>

    <div class="charts-grid" id="dash-charts-row"></div>

    <div id="dash-breakdown-row" style="margin-bottom:20px"></div>

    <div class="card" id="dash-services-table-card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title">🏥 Synthèse par service</div></div>
      <div class="card-body" style="padding:0">
        <div id="dash-services-table"></div>
      </div>
    </div>`;

  document.getElementById('year-select').addEventListener('change', e => {
    AppState.currentYear = parseInt(e.target.value);
    loadDashboardData();
  });
  document.getElementById('btn-dash-refresh').addEventListener('click', loadDashboardData);

  await loadDashboardData();
}

async function loadDashboardData() {
  const annee     = parseInt(document.getElementById('year-select').value);
  const moisDebut = parseInt(document.getElementById('dash-mois-debut').value) || null;
  const moisFin   = parseInt(document.getElementById('dash-mois-fin').value) || null;

  const summary = await window.hrm.getDashboardSummary({ annee, moisDebut, moisFin });

  // Aggregate: { service: { indicateur: total } }
  // nbre_lit est déjà MAX grâce au handler IPC mis à jour
  const agg = {};
  const moisLists = {}; // collecte les mois présents par service pour calculer _nb_jours
  for (const row of summary) {
    if (!agg[row.service]) { agg[row.service] = {}; moisLists[row.service] = new Set(); }
    agg[row.service][row.indicateur] = row.total;
    if (row.mois_list) row.mois_list.split(',').forEach(m => moisLists[row.service].add(parseInt(m)));
  }
  // Injecter _nb_jours pour chaque service (exact selon la période)
  for (const [srv, data] of Object.entries(agg)) {
    const moisDuSrv = [...(moisLists[srv] || [])].filter(Boolean);
    data['_nb_jours'] = getTotalDaysInPeriod(annee, moisDuSrv);
  }

  const computed = buildComputedData(agg);

  // ── KPI Cards ───────────────────────────────────────────────────────────────
  const kpiRow = document.getElementById('dash-kpi-row');
  if (Object.keys(computed).length === 0) {
    kpiRow.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px 0">
      <div class="empty-icon">📭</div>
      <div class="empty-title">Aucune donnée pour cette période</div>
      <div class="empty-msg">Commencez par saisir les données mensuelles.</div>
    </div>`;
    document.getElementById('dash-charts-row').innerHTML = '';
    document.getElementById('dash-services-table').innerHTML = '';
    return;
  }

  const totaux = {};
  for (const srv of Object.values(computed || {})) {
    for (const [ind, val] of Object.entries(srv)) {
      totaux[ind] = (totaux[ind] || 0) + (parseFloat(val) || 0);
    }
  }

  kpiRow.innerHTML = KPI_INDICATEURS.map(kpi => {
    const val = totaux[kpi.id] || 0;
    return `<div class="kpi-card" style="border-left-color:${kpi.color}">
      <span class="kpi-icon">${kpi.icon}</span>
      <div class="kpi-label">${kpi.label}</div>
      <div class="kpi-value" style="color:${kpi.color}">${val.toLocaleString('fr-FR')}</div>
      <div class="kpi-badge">${annee} · Cumul</div>
    </div>`;
  }).join('');

  // Badges de détail (1ers contacts, c. ultérieurs, h. simple, h. avec interv., césariennes)
  const detailEl = document.getElementById('dash-detail-badges');
  if (detailEl) {
    detailEl.innerHTML = KPI_DETAIL_BADGES.map(grp => `
      <div class="detail-badge-group">
        <span class="detail-badge-group-label" style="color:${grp.color}">${grp.icon} ${grp.groupe}</span>
        <div class="detail-badge-list">
          ${grp.items.map(item => {
            const val = totaux[item.id] || 0;
            return `<div class="detail-badge" style="border-color:${item.color}20;background:${item.color}08">
              <span class="detail-badge-label">${item.label}</span>
              <span class="detail-badge-val" style="color:${item.color}">${val.toLocaleString('fr-FR')}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  // ── Charts ──────────────────────────────────────────────────────────────────
  await renderDashCharts(computed, annee, moisDebut, moisFin);

  // ── Décomposition détaillée ──────────────────────────────────────────────────
  renderBreakdownSection(computed);

  // ── Services table ──────────────────────────────────────────────────────────
  renderServicesTable(computed);
}

async function renderDashCharts(computed, annee, moisDebut, moisFin) {
  // Destroy old
  Object.values(dashCharts).forEach(c => { try { c.destroy(); } catch(_) {} });
  dashCharts = {};

  const chartsRow = document.getElementById('dash-charts-row');

  // Build service labels and consultation/hosp data
  const services   = getServices();
  const servLabels = services.map(s => getLabelForService(s));
  const consData   = services.map(s => computed[s.id]?.['total_consul'] || 0);
  const hospData   = services.map(s => computed[s.id]?.['total_hosp']   || 0);
  const joursData  = services.map(s => computed[s.id]?.['journees_hosp']|| 0);

  // Monthly trend data
  const trendConsul = await window.hrm.getMonthlyTrend({ annee, indicateur: '1er_contacts' });
  const trendHosp   = await window.hrm.getMonthlyTrend({ annee, indicateur: 'total_hosp' });
  const trendLabels = MOIS.map(m => m.short);
  const consultTrend = MOIS.map(m => { const r = trendConsul.find(x => x.mois === m.id); return r ? r.total : 0; });
  const hospTrend    = MOIS.map(m => { const r = trendHosp.find(x => x.mois === m.id);   return r ? r.total : 0; });

  chartsRow.innerHTML = `
    <div class="chart-card"><div class="chart-title">👥 Consultations par service</div><div class="chart-wrap"><canvas id="chart-consul"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">🛏️ Hospitalisations par service</div><div class="chart-wrap"><canvas id="chart-hosp"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">📈 Évolution mensuelle — Consultations</div><div class="chart-wrap"><canvas id="chart-trend-consul"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">📈 Évolution mensuelle — Hospitalisations</div><div class="chart-wrap"><canvas id="chart-trend-hosp"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">📅 Journées d'hospitalisation par service</div><div class="chart-wrap"><canvas id="chart-jours"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">🥧 Répartition des hospitalisations</div><div class="chart-wrap"><canvas id="chart-pie-hosp"></canvas></div></div>`;

  const ChartJS = window.Chart;
  if (!ChartJS) {
    chartsRow.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⏳</div><div class="empty-title">Graphiques en cours de chargement…</div><div class="empty-msg">Relancez l\'application si ce message persiste.</div></div>';
    return;
  }

  const defaultFont = { family: 'Segoe UI, system-ui, sans-serif', size: 12 };
  ChartJS.defaults.font = defaultFont;

  const serviceColors = services.map(s => s.color);

  // Bar: Consultations par service
  dashCharts.consul = new ChartJS(document.getElementById('chart-consul'), {
    type: 'bar',
    data: {
      labels: servLabels,
      datasets: [{ label: 'Consultations', data: consData, backgroundColor: serviceColors, borderRadius: 5, borderSkipped: false }]
    },
    options: barOpts('Nombre de consultations')
  });

  // Bar: Hospitalisations par service
  dashCharts.hosp = new ChartJS(document.getElementById('chart-hosp'), {
    type: 'bar',
    data: {
      labels: servLabels,
      datasets: [{ label: 'Hospitalisés', data: hospData, backgroundColor: serviceColors, borderRadius: 5, borderSkipped: false }]
    },
    options: barOpts('Nombre d\'hospitalisés')
  });

  // Line: Trend consultations
  dashCharts.trendConsul = new ChartJS(document.getElementById('chart-trend-consul'), {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: '1ers Contacts', data: consultTrend,
        borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)',
        fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6
      }]
    },
    options: lineOpts()
  });

  // Line: Trend hosp
  dashCharts.trendHosp = new ChartJS(document.getElementById('chart-trend-hosp'), {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'Hospitalisés', data: hospTrend,
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)',
        fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6
      }]
    },
    options: lineOpts()
  });

  // Bar: Journées
  dashCharts.jours = new ChartJS(document.getElementById('chart-jours'), {
    type: 'bar',
    data: {
      labels: servLabels,
      datasets: [{ label: "Journées d'hosp.", data: joursData, backgroundColor: 'rgba(99,102,241,.75)', borderRadius: 5, borderSkipped: false }]
    },
    options: barOpts("Journées d'hospitalisation")
  });

  // Pie: Répartition hosp
  const pieData = services.map((s, i) => ({ label: getLabelForService(s), val: hospData[i], color: s.color })).filter(x => x.val > 0);
  dashCharts.pieHosp = new ChartJS(document.getElementById('chart-pie-hosp'), {
    type: 'doughnut',
    data: {
      labels: pieData.map(x => x.label),
      datasets: [{ data: pieData.map(x => x.val), backgroundColor: pieData.map(x => x.color), borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: defaultFont } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('fr-FR')} (${((ctx.parsed / ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)` } } }
    }
  });
}

function barOpts(label) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('fr-FR')}` } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 40 } },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { callback: v => v.toLocaleString('fr-FR') } }
    }
  };
}

function lineOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { callback: v => v.toLocaleString('fr-FR') } }
    }
  };
}

// ── Décomposition consultations & hospitalisations ────────────────────────────
function renderBreakdownSection(computed) {
  const wrap = document.getElementById('dash-breakdown-row');
  if (!wrap || !window.Chart) { if (wrap) wrap.innerHTML = ''; return; }

  // Destroy old breakdown charts
  ['bd-consul','bd-hosp'].forEach(id => {
    if (dashCharts[id]) { try { dashCharts[id].destroy(); } catch(_) {} delete dashCharts[id]; }
  });

  const services  = getServices();
  const labels    = services.map(s => getLabelForService(s));
  const colors    = services.map(s => s.color);

  const c1 = services.map(s => computed[s.id]?.['1er_contacts']   || 0);
  const c2 = services.map(s => computed[s.id]?.['c_ulterieurs']   || 0);
  const h1 = services.map(s => computed[s.id]?.['h_simple']       || 0);
  const h2 = services.map(s => computed[s.id]?.['h_avec_inter']   || 0);
  const h3 = services.map(s => computed[s.id]?.['cesarienne']     || 0);
  const h4 = services.map(s => computed[s.id]?.['accouchement']   || 0);

  const hasConsul = c1.some(v=>v>0) || c2.some(v=>v>0);
  const hasHosp   = h1.some(v=>v>0) || h2.some(v=>v>0) || h3.some(v=>v>0) || h4.some(v=>v>0);
  if (!hasConsul && !hasHosp) { wrap.innerHTML = ''; return; }

  const defaultFont = { family: 'Segoe UI, system-ui, sans-serif', size: 11 };
  const stackedOpts = (title) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, font: defaultFont } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${(ctx.parsed.y||0).toLocaleString('fr-FR')}` } }
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 40 } },
      y: { stacked: true, beginAtZero: true, ticks: { callback: v => v.toLocaleString('fr-FR') } }
    }
  });

  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:${hasConsul&&hasHosp?'1fr 1fr':'1fr'};gap:20px">
      ${hasConsul ? `<div class="chart-card">
        <div class="chart-title">👥 Décomposition des consultations par service</div>
        <div class="chart-wrap" style="height:280px"><canvas id="bd-consul-chart"></canvas></div>
      </div>` : ''}
      ${hasHosp ? `<div class="chart-card">
        <div class="chart-title">🛏️ Décomposition des hospitalisations par service</div>
        <div class="chart-wrap" style="height:280px"><canvas id="bd-hosp-chart"></canvas></div>
      </div>` : ''}
    </div>`;

  if (hasConsul) {
    dashCharts['bd-consul'] = new window.Chart(document.getElementById('bd-consul-chart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '1ers Contacts',  data: c1, backgroundColor: 'rgba(59,130,246,.8)',  stack: 'consul' },
          { label: 'C. Ultérieurs',  data: c2, backgroundColor: 'rgba(147,197,253,.9)', stack: 'consul' },
        ]
      },
      options: stackedOpts('Consultations')
    });
  }

  if (hasHosp) {
    dashCharts['bd-hosp'] = new window.Chart(document.getElementById('bd-hosp-chart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'H. Simple',       data: h1, backgroundColor: 'rgba(16,185,129,.8)',  stack: 'hosp' },
          { label: 'H. avec Interv.', data: h2, backgroundColor: 'rgba(52,211,153,.8)',  stack: 'hosp' },
          { label: 'Césariennes',     data: h3, backgroundColor: 'rgba(236,72,153,.8)',  stack: 'hosp' },
          { label: 'Accouchements',   data: h4, backgroundColor: 'rgba(251,191,36,.8)',  stack: 'hosp' },
        ]
      },
      options: stackedOpts('Hospitalisations')
    });
  }
}

function renderServicesTable(computed) {
  const keyIndicators = ['total_consul', 'total_hosp', 'journees_hosp', 'dms', 'nbre_lit', 'deces', 'accouchement'];
  const keyLabels    = ['Total Consult.', 'Total Hosp.', 'Journées hosp.', 'DMS', 'Lits', 'Décès', 'Accouchements'];

  let html = `<div class="report-table-wrap"><table class="report-table">
    <thead><tr>
      <th style="text-align:left;min-width:150px">Service</th>
      ${keyLabels.map(l => `<th>${l}</th>`).join('')}
    </tr></thead>
    <tbody>`;

  for (const srv of getServices()) {
    const d = computed[srv.id] || {};
    html += `<tr>
      <td><span class="service-dot" style="background:${srv.color}"></span>${getLabelForService(srv)}</td>
      ${keyIndicators.map((ind, i) => {
        const item = ALL_INDICATEURS.find(x => x.id === ind);
        return `<td>${formatValue(d[ind], item?.type)}</td>`;
      }).join('')}
    </tr>`;
  }

  // Totaux row
  html += `<tr class="total-row"><td><strong>TOTAL</strong></td>
    ${keyIndicators.map((ind, i) => {
      const total = SERVICES.reduce((sum, s) => sum + (parseFloat(computed[s.id]?.[ind]) || 0), 0);
      const item = ALL_INDICATEURS.find(x => x.id === ind);
      return `<td><strong>${formatValue(total, item?.type)}</strong></td>`;
    }).join('')}
  </tr>`;

  html += '</tbody></table></div>';
  document.getElementById('dash-services-table').innerHTML = html;
}
