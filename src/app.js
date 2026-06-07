// ── Global settings cache (loaded at startup) ─────────────────────────────────
window.appSettings = {
  customServices:        null,  // null = use SERVICES_DEFAULT
  indicatorServiceConfig: {},   // { indId: [srvId,...] } null entry = all
  customIndicators:      [],    // additional indicator definitions
};

async function loadAppSettings() {
  try {
    const [svcs, indCfg, customInds] = await Promise.all([
      window.hrm.getSetting('custom_services'),
      window.hrm.getSetting('indicator_service_config'),
      window.hrm.getSetting('custom_indicators'),
    ]);
    if (svcs)      window.appSettings.customServices         = svcs;
    if (indCfg)    window.appSettings.indicatorServiceConfig = indCfg;
    if (customInds)window.appSettings.customIndicators       = customInds;
  } catch (e) {
    console.warn('[loadAppSettings] Paramètres non chargés:', e.message);
  }
}

// ── App State ─────────────────────────────────────────────────────────────────
const AppState = {
  currentPage:  'dashboard',
  currentYear:  getCurrentYear(),
  currentMonth: getCurrentMonth(),
};

// ── Navigation ────────────────────────────────────────────────────────────────
const PAGE_META = {
  dashboard:        { title: 'Tableau de bord',      subtitle: 'Vue d\'ensemble des statistiques hospitalières',      render: () => renderDashboard() },
  saisie:           { title: 'Saisie mensuelle',      subtitle: 'Enregistrement des données statistiques du mois',    render: () => renderSaisie() },
  'rapport-annuel': { title: 'Rapport annuel',        subtitle: 'Consolidation annuelle de tous les services',         render: () => renderRapportAnnuel() },
  historique:       { title: 'Historique',            subtitle: 'Consulter les données saisies par période',           render: () => renderHistorique() },
  analyse:          { title: 'Analyse & Filtres',     subtitle: 'Analyse croisée par service, période et indicateur',  render: () => renderAnalyse() },
  parametres:       { title: 'Paramètres',            subtitle: 'Configuration de l\'application',                    render: () => renderParametres() },
};

function navigateTo(page) {
  AppState.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const meta = PAGE_META[page];
  if (!meta) return;
  document.getElementById('topbar-title').textContent    = meta.title;
  document.getElementById('topbar-subtitle').textContent = meta.subtitle;
  document.getElementById('topbar-actions').innerHTML    = '';
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><span>Chargement…</span></div>';
  requestAnimationFrame(() => meta.render());
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(title, msg = '', type = 'success', duration = 3500) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, duration);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function showModal({ icon='❓', title, body, buttons=[] }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><span style="font-size:24px">${icon}</span><span class="modal-title">${title}</span></div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          ${buttons.map((b,i)=>`<button class="btn btn-${b.style||'secondary'}" data-idx="${i}">${b.label}</button>`).join('')}
        </div>
      </div>`;
    overlay.querySelectorAll('[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => { overlay.remove(); resolve(parseInt(btn.dataset.idx)); });
    });
    overlay.addEventListener('click', e => { if(e.target===overlay){ overlay.remove(); resolve(-1); } });
    document.getElementById('modal-root').appendChild(overlay);
  });
}

// ── Year selector helper ───────────────────────────────────────────────────────
async function buildYearSelect(selectedYear) {
  const years = await window.hrm.getAvailableYears();
  const current = getCurrentYear();
  const range = [];
  for (let y = 2020; y <= 2030; y++) range.push(y);
  const allYears = [...new Set([...range, ...years])].sort((a,b) => b-a);
  return `<select class="form-control" id="year-select">
    ${allYears.map(y => `<option value="${y}" ${y==selectedYear?'selected':''}>${y}</option>`).join('')}
  </select>`;
}

// ── Label propagation ─────────────────────────────────────────────────────────
// Wrap setCustomLabel (defined in data.js) to also push changes to [data-label-ref] elements
const _origSetCustomLabel = setCustomLabel;
window._setCustomLabel = function(type, id, value) {
  _origSetCustomLabel(type, id, value);
  const key = `${type}:${id}`;
  document.querySelectorAll(`[data-label-ref="${key}"]`).forEach(el => {
    if (!el.querySelector('.label-edit-input')) el.textContent = value;
  });
};

// ── showFormModal — captures form values BEFORE overlay is removed ────────────
function showFormModal({ icon = '📝', title, fields = [], confirmLabel = 'Enregistrer' }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const fieldsHtml = fields.map(f => `
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">${f.label}${f.required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>
        ${f.type === 'color'
          ? `<input type="color" class="form-control" data-field="${f.key}" value="${f.value || '#3b82f6'}" style="height:38px;cursor:pointer;padding:3px">`
          : f.type === 'select'
          ? `<select class="form-control" data-field="${f.key}">
              ${(f.options||[]).map(o => `<option value="${o.value}" ${o.value===f.value?'selected':''}>${o.label}</option>`).join('')}
             </select>`
          : `<input type="${f.type||'text'}" class="form-control" data-field="${f.key}"
               value="${f.value||''}" placeholder="${f.placeholder||''}">`
        }
        ${f.hint ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">${f.hint}</div>` : ''}
      </div>`).join('');
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><span style="font-size:22px">${icon}</span><span class="modal-title">${title}</span></div>
        <div class="modal-body">${fieldsHtml}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="fm-cancel">Annuler</button>
          <button class="btn btn-primary"   id="fm-confirm">${confirmLabel}</button>
        </div>
      </div>`;
    overlay.querySelector('#fm-confirm').addEventListener('click', () => {
      const vals = {};
      overlay.querySelectorAll('[data-field]').forEach(inp => { vals[inp.dataset.field] = inp.value; });
      overlay.remove();
      resolve(vals);
    });
    overlay.querySelector('#fm-cancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
    overlay.addEventListener('click', e => { if (e.target===overlay) { overlay.remove(); resolve(null); } });
    document.getElementById('modal-root').appendChild(overlay);
    setTimeout(() => overlay.querySelector('[data-field]')?.focus(), 60);
  });
}

// ── Auto-helpers ──────────────────────────────────────────────────────────────
function labelToId(label) {
  return (label || '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function guessIcon(label) {
  const l = (label || '').toLowerCase();
  if (/p[eé]diat/.test(l))               return '👶';
  if (/matern|accouche/.test(l))          return '🤱';
  if (/urgent/.test(l))                   return '🚨';
  if (/chirur/.test(l))                   return '🔧';
  if (/cardio/.test(l))                   return '❤️';
  if (/dent|bucco/.test(l))               return '🦷';
  if (/^orl$|oreill/.test(l))             return '👂';
  if (/ophtalmol|visuel/.test(l))         return '👁️';
  if (/diab/.test(l))                     return '🩸';
  if (/urol/.test(l))                     return '🩺';
  if (/radio|imagerie/.test(l))           return '📡';
  if (/labo|biolog/.test(l))              return '🔬';
  return '🏥';
}

// ── Triple-click label editing ────────────────────────────────────────────────
function setupTripleClick(el, type, id) {
  let clicks = 0, timer;
  el.style.cursor = 'pointer';
  el.title = 'Triple-clic pour modifier le label';
  el.addEventListener('click', () => {
    clicks++;
    if (clicks === 1) timer = setTimeout(() => { clicks = 0; }, 500);
    if (clicks >= 3) {
      clearTimeout(timer);
      clicks = 0;
      _enterLabelEdit(el, type, id);
    }
  });
}

function _enterLabelEdit(el, type, id) {
  const original = el.dataset.origLabel || el.textContent.trim();
  el.dataset.origLabel = original;
  const inp = document.createElement('input');
  inp.value = getCustomLabel(type, id) || original;
  inp.className = 'label-edit-input';
  el.innerHTML = '';
  el.appendChild(inp);
  inp.focus(); inp.select();
  const commit = () => {
    const v = inp.value.trim() || original;
    window._setCustomLabel(type, id, v); // propagates to all [data-label-ref] on page
    el.innerHTML = '';
    el.textContent = v;
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { el.textContent = original; }
  });
}

// ── Logo helpers ──────────────────────────────────────────────────────────────
function applyLogo(dataUrl) {
  const img      = document.getElementById('logo-img');
  const fallback = document.getElementById('logo-fallback');
  if (!img || !fallback) return;
  if (dataUrl) {
    img.src = dataUrl;
    img.style.display = 'block';
    fallback.style.display = 'none';
  } else {
    img.style.display = 'none';
    fallback.style.display = 'block';
  }
}

async function loadLogo() {
  try {
    const dataUrl = await window.hrm.getLogo();
    applyLogo(dataUrl);
  } catch(_) {}
}

// ── Auto-update banner ────────────────────────────────────────────────────────
function showUpdateBanner(version) {
  // Le téléchargement est automatique — on affiche juste une info discrète
  if (document.getElementById('update-banner')) return;
  const b = document.createElement('div');
  b.id = 'update-banner';
  b.innerHTML = `
    <div>⬇️ <strong>Mise à jour v${version}</strong> — téléchargement en arrière-plan…</div>
    <div class="upd-btns">
      <div id="upd-prog" style="font-weight:700;color:#fff">0%</div>
      <button class="btn btn-sm" style="background:transparent;border:1px solid rgba(255,255,255,.4);color:#fff" id="btn-upd-dismiss">✕</button>
    </div>`;
  document.body.prepend(b);
  b.querySelector('#btn-upd-dismiss').addEventListener('click', () => b.remove());
}

function showUpdateReadyBanner() {
  const b = document.getElementById('update-banner') || (() => {
    const el = document.createElement('div'); el.id = 'update-banner'; document.body.prepend(el); return el;
  })();
  b.innerHTML = `
    <div>✅ <strong>Mise à jour prête</strong> — s'installera automatiquement à la prochaine fermeture</div>
    <div class="upd-btns">
      <button class="btn btn-sm" style="background:#fff;color:#065f46" id="btn-upd-restart">🔄 Redémarrer maintenant</button>
      <button class="btn btn-sm" style="background:transparent;border:1px solid rgba(255,255,255,.4);color:#fff" id="btn-upd-later">Plus tard</button>
    </div>`;
  b.querySelector('#btn-upd-restart').addEventListener('click', () => window.hrm.updateInstall());
  b.querySelector('#btn-upd-later').addEventListener('click', () => b.remove());
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAppSettings();
  await loadLogo();

  // Afficher la version dans le footer
  try {
    const v = await window.hrm.getAppVersion();
    const vEl = document.querySelector('.sidebar-footer');
    if (vEl) vEl.innerHTML = vEl.innerHTML.replace('v1.0.0', `v${v}`);
  } catch(_) {}

  // Écouter les événements de mise à jour
  try {
    window.hrm.onUpdateStatus(data => {
      if (data.type === 'available') showUpdateBanner(data.version);
      if (data.type === 'progress') {
        const el = document.getElementById('upd-prog');
        if (el) el.textContent = data.percent + '%';
      }
      if (data.type === 'ready') showUpdateReadyBanner();
    });
  } catch(_) {}

  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });
  navigateTo('dashboard');
});
