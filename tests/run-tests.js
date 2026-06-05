// Unit Tests - run with: node tests/run-tests.js
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log('  OK ' + name); passed++; }
  catch(err) { console.log('  FAIL ' + name + '\n     ' + err.message); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function assertEqual(a, b, m) { if (a !== b) throw new Error((m||'') + ' Expected:' + JSON.stringify(b) + ' Got:' + JSON.stringify(a)); }
function assertClose(a, b, tol, m) { tol=tol||0.01; if (Math.abs(a-b)>tol) throw new Error((m||'') + ' Expected~'+b+' got '+a); }

// Provide browser globals expected by data.js
if (typeof window === "undefined") {
  global.window   = { appSettings: { customServices: null, indicatorServiceConfig: {} } };
  global.localStorage = { _d:{}, getItem(k){ return this._d[k]||null; }, setItem(k,v){ this._d[k]=v; } };
}

const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../src/data.js'), 'utf8');
const wrap = code + '\nreturn {SERVICES:getServices(),MOIS,INDICATEURS_GROUPES,ALL_INDICATEURS,KPI_INDICATEURS,calcIndicateurForService,buildComputedData,formatValue,aggregateRows,getCurrentYear,getCurrentMonth};';
const exp = (new Function('console','Math','parseFloat','parseInt','isNaN','Object','Array','JSON','Number','String',wrap))(console,Math,parseFloat,parseInt,isNaN,Object,Array,JSON,Number,String);
const {SERVICES,MOIS,INDICATEURS_GROUPES,ALL_INDICATEURS,calcIndicateurForService,buildComputedData,formatValue,aggregateRows,getCurrentYear,getCurrentMonth} = exp;

console.log('\n-- DATA CONSTANTS');
test('SERVICES has 12 entries', () => assertEqual(SERVICES.length, 12));
test('SERVICES have id,label,color', () => { for(const s of SERVICES) assert(s.id&&s.label&&s.color,'missing field:'+s.id); });
test('MOIS has 12 entries', () => assertEqual(MOIS.length, 12));
test('MOIS ids 1-12', () => MOIS.forEach((m,i)=>assertEqual(m.id,i+1)));
test('INDICATEURS_GROUPES has 4 groups', () => assertEqual(INDICATEURS_GROUPES.length, 4));
test('ALL_INDICATEURS flattened correctly', () => { const t=INDICATEURS_GROUPES.reduce((s,g)=>s+g.items.length,0); assertEqual(ALL_INDICATEURS.length,t); });
test('All indicators have id+label', () => { for(const i of ALL_INDICATEURS) assert(i.id&&i.label,'missing:'+JSON.stringify(i)); });
test('No duplicate indicator ids', () => { const ids=ALL_INDICATEURS.map(i=>i.id); assertEqual(new Set(ids).size,ids.length,'duplicates found'); });

console.log('\n-- CALCULATIONS');
test('total_consul = sum of contacts', () => assertEqual(calcIndicateurForService('total_consul',{'1er_contacts':100,'c_ulterieurs':50}),150));
test('total_consul zeros', () => assertEqual(calcIndicateurForService('total_consul',{}),0));
test('total_hosp = h_simple+h_avec_inter+cesarienne (pas accouchements)', () => assertEqual(calcIndicateurForService('total_hosp',{h_simple:10,h_avec_inter:5,accouchement:20,cesarienne:3}),18));
test('DMS = journees_hosp/total_hosp (calcule)', () => assertEqual(calcIndicateurForService('dms',{h_simple:10,h_avec_inter:5,cesarienne:0,journees_hosp:150}),10));
test('DMS = 0 si aucun hospitalise', () => assertEqual(calcIndicateurForService('dms',{h_simple:0,h_avec_inter:0,cesarienne:0,journees_hosp:100}),0));
test('TOM = journees/(lits*30)*100', () => assertClose(calcIndicateurForService('tom',{nbre_lit:10,journees_hosp:150}),50));
test('TOM = 0 with no beds', () => assertEqual(calcIndicateurForService('tom',{nbre_lit:0,journees_hosp:100}),0));
test('buildComputedData adds calculated fields', () => { const c=buildComputedData({MEDECINE:{'1er_contacts':200,'c_ulterieurs':100}}); assertEqual(c.MEDECINE.total_consul,300); });
test('buildComputedData preserves editable', () => { const c=buildComputedData({P:{h_simple:42}}); assertEqual(c.P.h_simple,42); });

console.log('\n-- FORMAT VALUE');
test('formatValue int (strips whitespace)', () => { const r=formatValue(1234,'int'); assertEqual(r.replace(/[\s  ]/g,''),'1234'); });
test('formatValue zero', () => assertEqual(formatValue(0,'int'),'0'));
test('formatValue null', () => assertEqual(formatValue(null,'int'),'-'));
test('formatValue percent', () => assertEqual(formatValue(45.678,'percent'),'45.7%'));
test('formatValue decimal', () => assertEqual(formatValue(3.5,'decimal'),'3.50'));

console.log('\n-- AGGREGATE ROWS');
test('aggregateRows sums correctly', () => {
  const r=[{service:'A',indicateur:'x',valeur:100},{service:'A',indicateur:'x',valeur:50},{service:'B',indicateur:'x',valeur:80}];
  const a=aggregateRows(r); assertEqual(a.A.x,150); assertEqual(a.B.x,80);
});
test('aggregateRows empty = {}', () => assertEqual(Object.keys(aggregateRows([])).length,0));

console.log('\n-- DATE HELPERS');
test('getCurrentYear 4-digit', () => { const y=getCurrentYear(); assert(y>=2024&&y<=2100,'year:'+y); });
test('getCurrentMonth 1-12', () => { const m=getCurrentMonth(); assert(m>=1&&m<=12,'month:'+m); });

console.log('\n'+'-'.repeat(50));
console.log('Tests: '+(passed+failed)+'  OK:'+passed+(failed>0?'  FAIL:'+failed:''));
if(failed===0) { console.log('\nTous les tests sont passes !\n'); }
else { process.exit(1); }
