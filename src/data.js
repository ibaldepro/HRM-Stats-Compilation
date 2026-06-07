// ── Constants ──────────────────────────────────────────────────────────────────

const SERVICES_DEFAULT = [
  { id: 'MEDECINE',      label: 'Médecine',        color: '#3b82f6', icon: '🏥' },
  { id: 'PEDIATRIE',     label: 'Pédiatrie',        color: '#10b981', icon: '👶' },
  { id: 'CHIRURGIE',     label: 'Chirurgie',        color: '#f59e0b', icon: '🔧' },
  { id: 'MATERNITE',     label: 'Maternité',        color: '#ec4899', icon: '🤱' },
  { id: 'URGENCES',      label: 'Urgences',         color: '#ef4444', icon: '🚨' },
  { id: 'ORL',           label: 'ORL',              color: '#8b5cf6', icon: '👂' },
  { id: 'OPHTALMOLOGIE', label: 'Ophtalmologie',    color: '#06b6d4', icon: '👁️' },
  { id: 'CTeEPI',        label: 'CTeEPI',           color: '#84cc16', icon: '💊' },
  { id: 'C_DENTAIRE',    label: 'C. Dentaire',      color: '#f97316', icon: '🦷' },
  { id: 'CARDIOLOGIE',   label: 'Cardiologie',      color: '#dc2626', icon: '❤️' },
  { id: 'UROLOGIE',      label: 'Urologie',         color: '#7c3aed', icon: '🩺' },
  { id: 'DIABETOLOGIE',  label: 'Diabétologie',     color: '#0891b2', icon: '🩸' },
];

// Effective services list — may be overridden by app settings at runtime
function getServices() {
  return (window.appSettings && window.appSettings.customServices) || SERVICES_DEFAULT;
}
// Keep SERVICES as a live getter alias
Object.defineProperty(window, 'SERVICES', { get: getServices, configurable: true });

const MOIS = [
  { id: 1,  label: 'Janvier',   short: 'Jan' },
  { id: 2,  label: 'Février',   short: 'Fév' },
  { id: 3,  label: 'Mars',      short: 'Mar' },
  { id: 4,  label: 'Avril',     short: 'Avr' },
  { id: 5,  label: 'Mai',       short: 'Mai' },
  { id: 6,  label: 'Juin',      short: 'Jun' },
  { id: 7,  label: 'Juillet',   short: 'Jul' },
  { id: 8,  label: 'Août',      short: 'Aoû' },
  { id: 9,  label: 'Septembre', short: 'Sep' },
  { id: 10, label: 'Octobre',   short: 'Oct' },
  { id: 11, label: 'Novembre',  short: 'Nov' },
  { id: 12, label: 'Décembre',  short: 'Déc' },
];

// ── Indicator groups ────────────────────────────────────────────────────────────
// global: true  → stored under service '__GLOBAL__', shown as a simple list (no service columns)
// calc          → auto-computed, not entered manually
// editable      → user enters a value
const INDICATEURS_GROUPES = [
  {
    id: 'consultations',
    label: 'Consultations',
    icon: '👥',
    color: '#3b82f6',
    global: false,
    items: [
      { id: '1er_contacts',  label: '1ers Contacts',   editable: true,  type: 'int' },
      { id: 'c_ulterieurs',  label: 'C. Ultérieurs',   editable: true,  type: 'int' },
      { id: 'total_consul',  label: 'TOTAL CONSUL',    editable: false, type: 'int', bold: true,
        calc: (s) => (s['1er_contacts'] || 0) + (s['c_ulterieurs'] || 0) },
    ]
  },
  {
    id: 'hospitalisations',
    label: 'Hospitalisations',
    icon: '🛏️',
    color: '#10b981',
    global: false,
    items: [
      { id: 'h_simple',          label: 'H. Simple',            editable: true,  type: 'int' },
      { id: 'h_avec_inter',      label: 'H. avec Intervention', editable: true,  type: 'int' },
      { id: 'accouchement',      label: 'Accouchements',        editable: true,  type: 'int' },
      { id: 'cesarienne',        label: 'Césariennes',          editable: true,  type: 'int' },
      { id: 'naissance_vivante', label: 'Naissances Vivantes',  editable: true,  type: 'int' },
      { id: 'total_hosp',        label: 'Total Hospitalisés',   editable: false, type: 'int', bold: true,
        // Accouchements exclus du total hospitalisés (saisie séparée)
        calc: (s) => (s['h_simple']||0) + (s['h_avec_inter']||0) + (s['cesarienne']||0) },
      { id: 'journees_hosp',     label: "Journées d'hosp.",     editable: true,  type: 'int' },
      { id: 'dms',               label: 'DMS',                  editable: false, type: 'decimal',
        calc: (s) => {
          const th = (s['h_simple']||0) + (s['h_avec_inter']||0) + (s['cesarienne']||0);
          return th > 0 ? (s['journees_hosp']||0) / th : 0;
        }
      },
      { id: 'tom',               label: 'TOM (%)',              editable: false, type: 'percent',
        // _nb_jours est injecté au moment de l'affichage (exact selon le mois/période)
        calc: (s) => {
          const nl    = s['nbre_lit'] || 0;
          const jours = s['_nb_jours'] || 30;
          return nl > 0 ? Math.min(((s['journees_hosp']||0) / (nl * jours)) * 100, 999) : 0;
        }
      },
      { id: 'nbre_lit',          label: 'Nbre Lits',            editable: true,  type: 'int' },
    ]
  },
  {
    id: 'references',
    label: 'Références & Évacuations',
    icon: '🚑',
    color: '#f59e0b',
    global: false,
    items: [
      { id: 'ref_recues',          label: 'Réf. reçues',          editable: true, type: 'int' },
      { id: 'contre_refe',         label: 'Contre-référés',       editable: true, type: 'int' },
      { id: 'ref_vers_chu',        label: 'Réf. vers CHU',        editable: true, type: 'int' },
      { id: 'deces',               label: 'Décès',                editable: true, type: 'int' },
      { id: 'meo',                 label: 'MEO',                  editable: true, type: 'int' },
      { id: 'extraction_dentaire', label: 'Extraction Dentaire',  editable: true, type: 'int' },
      { id: 'soins',               label: 'Soins',                editable: true, type: 'int' },
    ]
  },
  {
    id: 'medico_technique',
    label: 'Activités Médico-techniques',
    icon: '🔬',
    color: '#8b5cf6',
    global: true,   // ← single set of values, no service breakdown
    items: [
      { id: 'cu',                 label: 'C U — Consultations Urbaines',          editable: true,  type: 'int' },
      { id: 'csp',                label: 'CSP — Consultation Sous-Préfectures',   editable: true,  type: 'int' },
      { id: 'cap',                label: 'C AP — Consultation Autres Préfectures',editable: true,  type: 'int' },
      { id: 'total_c',            label: 'Total C',                               editable: false, type: 'int', bold: true,
        calc: (s) => (s['cu']||0) + (s['csp']||0) + (s['cap']||0) },
      { id: 'ordonnance_interne', label: 'Ordonnances Internes',  editable: true,  type: 'int' },
      { id: 'ordonnance_externe', label: 'Ordonnances Externes',  editable: true,  type: 'int' },
      { id: 'total_ordonnances',  label: 'Total Ordonnances',     editable: false, type: 'int', bold: true,
        calc: (s) => (s['ordonnance_interne']||0) + (s['ordonnance_externe']||0) },
      { id: 'examens_internes',   label: 'Examens Internes',      editable: true,  type: 'int' },
      { id: 'examens_externes',   label: 'Examens Externes',      editable: true,  type: 'int' },
      { id: 'total_examens',      label: 'Total Examens',         editable: false, type: 'int', bold: true,
        calc: (s) => (s['examens_internes']||0) + (s['examens_externes']||0) },
      { id: 'radio',              label: 'Radiographies',         editable: true,  type: 'int' },
      { id: 'echo',               label: 'Échographies',          editable: true,  type: 'int' },
      { id: 'ecg',                label: 'ECG',                   editable: true,  type: 'int' },
      { id: 'total_imagerie',     label: 'Total Imagerie',        editable: false, type: 'int', bold: true,
        calc: (s) => (s['radio']||0) + (s['echo']||0) + (s['ecg']||0) },
    ]
  }
];

// ── Dynamic indicator groups (merges custom indicators from settings) ─────────
function getEffectiveGroupes() {
  const custom = (window.appSettings && window.appSettings.customIndicators) || [];
  if (!custom.length) return INDICATEURS_GROUPES;
  // Deep-clone + merge custom indicators into their group
  const result = INDICATEURS_GROUPES.map(g => ({ ...g, items: [...g.items] }));
  for (const ind of custom) {
    const grp = result.find(g => g.id === ind.groupe);
    if (grp && !grp.items.find(i => i.id === ind.id)) {
      grp.items.push({ ...ind, editable: true });
    }
  }
  return result;
}

// Convenience accessors
function getServiceGroupes() { return getEffectiveGroupes().filter(g => !g.global); }
function getGlobalGroupes()  { return getEffectiveGroupes().filter(g =>  g.global); }
function getAllIndicateurs()  {
  return getEffectiveGroupes().flatMap(g =>
    g.items.map(i => ({ ...i, groupe: g.id, groupeLabel: g.label, global: !!g.global }))
  );
}

// Legacy constants (built-in only — use the functions above for dynamic lists)
const ALL_INDICATEURS = INDICATEURS_GROUPES.flatMap(g => g.items.map(i => ({ ...i, groupe: g.id, groupeLabel: g.label, global: !!g.global })));
const SERVICE_GROUPES = INDICATEURS_GROUPES.filter(g => !g.global);
const GLOBAL_GROUPES  = INDICATEURS_GROUPES.filter(g =>  g.global);

// KPI indicators for dashboard — main cards
const KPI_INDICATEURS = [
  { id: 'total_consul',      label: 'Total Consultations',  icon: '👥', color: '#3b82f6', format: 'int' },
  { id: 'total_hosp',        label: 'Total Hospitalisés',   icon: '🛏️', color: '#10b981', format: 'int' },
  { id: 'journees_hosp',     label: "Journées d'hosp.",     icon: '📅', color: '#6366f1', format: 'int' },
  { id: 'deces',             label: 'Décès',                icon: '📋', color: '#ef4444', format: 'int' },
  { id: 'accouchement',      label: 'Accouchements',        icon: '🤱', color: '#ec4899', format: 'int' },
  { id: 'naissance_vivante', label: 'Naissances Vivantes',  icon: '👶', color: '#f59e0b', format: 'int' },
  { id: 'total_ordonnances', label: 'Total Ordonnances',    icon: '📋', color: '#8b5cf6', format: 'int' },
  { id: 'total_examens',     label: 'Total Examens',        icon: '🔬', color: '#06b6d4', format: 'int' },
  { id: 'total_imagerie',    label: 'Total Imagerie',       icon: '📡', color: '#f97316', format: 'int' },
];

// Badges de détail — ligne compacte sous les KPI principaux
// section: 'services'   → données cumulées des services par patient
// section: 'medico'     → données globales médico-techniques
const KPI_DETAIL_BADGES = [
  {
    section: 'services',
    groupe: 'Détail Consultations', icon: '👥', color: '#3b82f6',
    items: [
      { id: '1er_contacts', label: '1ers Contacts',   color: '#3b82f6' },
      { id: 'c_ulterieurs', label: 'C. Ultérieurs',   color: '#60a5fa' },
    ]
  },
  {
    section: 'services',
    groupe: 'Détail Hospitalisations', icon: '🛏️', color: '#10b981',
    items: [
      { id: 'h_simple',     label: 'H. Simple',            color: '#10b981' },
      { id: 'h_avec_inter', label: 'H. avec Intervention', color: '#34d399' },
      { id: 'cesarienne',   label: 'Césariennes',          color: '#ec4899' },
    ]
  },
  // ── Médico-techniques (données globales __GLOBAL__) ──────────────────────
  {
    section: 'medico',
    groupe: 'Consultations Médico', icon: '📊', color: '#6366f1',
    items: [
      { id: 'cu',  label: 'C.U.',   color: '#6366f1' },
      { id: 'csp', label: 'C.S.P.', color: '#818cf8' },
      { id: 'cap', label: 'C.A.P.', color: '#a5b4fc' },
    ]
  },
  {
    section: 'medico',
    groupe: 'Ordonnances', icon: '📋', color: '#8b5cf6',
    items: [
      { id: 'ordonnance_interne', label: 'Internes', color: '#8b5cf6' },
      { id: 'ordonnance_externe', label: 'Externes', color: '#a78bfa' },
    ]
  },
  {
    section: 'medico',
    groupe: 'Examens', icon: '🔬', color: '#0891b2',
    items: [
      { id: 'examens_internes', label: 'Internes', color: '#0891b2' },
      { id: 'examens_externes', label: 'Externes', color: '#22d3ee' },
    ]
  },
  {
    section: 'medico',
    groupe: 'Imagerie', icon: '📡', color: '#f97316',
    items: [
      { id: 'radio', label: 'Radiographies', color: '#f97316' },
      { id: 'echo',  label: 'Échographies',  color: '#fb923c' },
      { id: 'ecg',   label: 'ECG',           color: '#fbbf24' },
    ]
  },
];

// ── Custom labels (localStorage) ──────────────────────────────────────────────
// Keys: 'service:ID' or 'ind:ID'
function _loadCustomLabels() {
  try { return JSON.parse(localStorage.getItem('hrm_custom_labels') || '{}'); }
  catch(_) { return {}; }
}
function getCustomLabel(type, id) {
  const labels = _loadCustomLabels();
  return labels[type + ':' + id] || null;
}
function setCustomLabel(type, id, label) {
  const labels = _loadCustomLabels();
  labels[type + ':' + id] = label;
  localStorage.setItem('hrm_custom_labels', JSON.stringify(labels));
}
function getLabelForService(srv) {
  return getCustomLabel('service', srv.id) || srv.label;
}
function getLabelForIndicateur(ind) {
  return getCustomLabel('ind', ind.id) || ind.label;
}

// ── Indicator-service config ──────────────────────────────────────────────────
// Returns the set of service IDs applicable for an indicator. null = all services.
function getIndicatorServices(indicId) {
  const cfg = window.appSettings && window.appSettings.indicatorServiceConfig;
  if (!cfg || !cfg[indicId]) return null; // null = all
  return cfg[indicId]; // array of service IDs
}

// Returns true if this indicator applies to this service
function isIndicatorApplicable(indicId, serviceId) {
  const svcs = getIndicatorServices(indicId);
  if (svcs === null) return true;
  return svcs.includes(serviceId);
}

// ── Calculation helpers ────────────────────────────────────────────────────────
function calcIndicateurForService(indicId, serviceData) {
  const item = getAllIndicateurs().find(i => i.id === indicId);
  if (!item || !item.calc) return serviceData[indicId] || 0;
  return item.calc(serviceData);
}

// Build computed data object: adds all calculated fields to each service
function buildComputedData(rawData) {
  const result = {};
  for (const [service, sData] of Object.entries(rawData)) {
    result[service] = { ...sData };
    for (const item of getAllIndicateurs()) {
      if (item.calc) {
        result[service][item.id] = item.calc(sData);
      }
    }
  }
  return result;
}

function formatValue(val, type) {
  if (val === null || val === undefined || val === '') return '-';
  const n = parseFloat(val);
  if (isNaN(n)) return '-';
  if (n === 0) return '0';
  if (type === 'percent') return n.toFixed(1) + '%';
  if (type === 'decimal') return n.toFixed(2);
  return Math.round(n).toLocaleString('fr-FR');
}

function getCurrentYear()  { return new Date().getFullYear(); }
function getCurrentMonth() { return new Date().getMonth() + 1; }

// Nombre de jours exacts dans un mois donné
function getDaysInMonth(year, month) {
  if (!year || !month) return 30;
  return new Date(year, month, 0).getDate();
}

// Total de jours pour une liste de mois (pour TOM multi-mois)
function getTotalDaysInPeriod(annee, moisList) {
  if (!moisList || !moisList.length) return 365;
  return moisList.reduce((sum, m) => sum + getDaysInMonth(annee, m), 0);
}

// Agrégation annuelle correcte :
//  - nbre_lit : MAX (pas somme — les lits ne s'accumulent pas)
//  - _nb_jours : somme exacte des jours des mois présents
//  - DMS et TOM : recalculés automatiquement par buildComputedData
function buildAnnualComputedData(rawRows, annee) {
  const moisPresents = [...new Set(rawRows.filter(r => r.service !== '__GLOBAL__').map(r => r.mois))];
  const totalDays    = getTotalDaysInPeriod(annee, moisPresents);

  const agg = aggregateRows(rawRows);

  for (const [srv, data] of Object.entries(agg)) {
    // Remplacer la somme de nbre_lit par le MAX
    const litValues = rawRows
      .filter(r => r.service === srv && r.indicateur === 'nbre_lit' && r.valeur > 0)
      .map(r => r.valeur);
    if (litValues.length) data['nbre_lit'] = Math.max(...litValues);

    // Injecter le nb de jours de la période pour le calcul du TOM
    data['_nb_jours'] = totalDays;
  }

  return buildComputedData(agg);
}

// Aggregate rows from DB into { service: { indicateur: total } }
function aggregateRows(rows) {
  const result = {};
  for (const row of rows) {
    if (!result[row.service]) result[row.service] = {};
    result[row.service][row.indicateur] = (result[row.service][row.indicateur] || 0) + row.valeur;
  }
  return result;
}
