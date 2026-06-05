// ── Historique ────────────────────────────────────────────────────────────────
async function renderHistorique() {
  const content = document.getElementById('page-content');
  const yearSel = await buildYearSelect(AppState.currentYear);

  content.innerHTML = `
    <div class="page-title mb-4">🗂️ Historique des saisies</div>

    <div class="filter-bar">
      <div class="form-group">
        <label class="form-label">Année</label>
        ${yearSel}
      </div>
      <button class="btn btn-primary" id="btn-load-hist">📂 Charger</button>
    </div>

    <div id="hist-content">
      <div class="empty-state">
        <div class="empty-icon">🗂️</div>
        <div class="empty-title">Sélectionnez une année</div>
        <div class="empty-msg">Choisissez une année pour voir l'historique des saisies mensuelles.</div>
      </div>
    </div>`;

  document.getElementById('year-select').addEventListener('change', e => AppState.currentYear = parseInt(e.target.value));
  document.getElementById('btn-load-hist').addEventListener('click', loadHistorique);
  await loadHistorique();
}

async function loadHistorique() {
  const annee = parseInt(document.getElementById('year-select').value);
  AppState.currentYear = annee;

  const moisDispo = await window.hrm.getAvailableMonths({ annee });
  const container = document.getElementById('hist-content');

  if (moisDispo.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">Aucune donnée en ${annee}</div>
        <div class="empty-msg">Commencez par saisir les données pour cette année.</div>
      </div>`;
    return;
  }

  // Summary cards per month
  let cardsHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-bottom:24px">`;

  for (const moisId of MOIS.map(m => m.id)) {
    const hasDat = moisDispo.includes(moisId);
    const moisObj = MOIS.find(m => m.id === moisId);
    cardsHtml += `
      <div class="card" style="border-left:4px solid ${hasDat ? 'var(--accent)' : 'var(--border)'}">
        <div class="card-body" style="padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;font-size:15px">${moisObj.label}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
              ${hasDat ? '<span class="badge badge-green">✅ Données saisies</span>' : '<span class="badge" style="background:#f1f5f9;color:#94a3b8">⬜ Non saisi</span>'}
            </div>
          </div>
          ${hasDat ? `<div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="viewMonthData(${annee}, ${moisId})">👁️</button>
            <button class="btn btn-ghost btn-sm" onclick="editMonthData(${annee}, ${moisId})">✏️</button>
          </div>` : `<button class="btn btn-primary btn-sm" onclick="editMonthData(${annee}, ${moisId})">+ Saisir</button>`}
        </div>
      </div>`;
  }
  cardsHtml += '</div>';

  // Completion progress
  const pct = Math.round((moisDispo.length / 12) * 100);
  const progressHtml = `
    <div class="card mb-4">
      <div class="card-body">
        <div class="flex justify-between items-center mb-3">
          <span style="font-weight:600">Avancement de l'année ${annee}</span>
          <span class="badge badge-blue">${moisDispo.length} / 12 mois saisis</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct<50?'var(--warning)':pct<100?'var(--primary-light)':'var(--accent)'}"></div></div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${pct}% de l'année renseigné</div>
      </div>
    </div>`;

  container.innerHTML = progressHtml + cardsHtml;
}

function viewMonthData(annee, mois) {
  AppState.currentYear  = annee;
  AppState.currentMonth = mois;
  navigateTo('rapport-annuel');
}

function editMonthData(annee, mois) {
  AppState.currentYear  = annee;
  AppState.currentMonth = mois;
  navigateTo('saisie');
  // After navigation, auto-load the period
  setTimeout(() => { document.getElementById('btn-load-period')?.click(); }, 200);
}
