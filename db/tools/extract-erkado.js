#!/usr/bin/env node
/* ==========================================================================
   ERKADO katalogo ištraukimas į „katalogo paketą" (bundle JSON).

   Ką daro:
     1. Įkelia dabartinio konfigūratoriaus data.js, glass.js ir engine.js
        į izoliuotą Node VM kontekstą (lygiai taip, kaip naršyklė).
     2. Apskaičiuoja viską, kas data.js aprašyta funkcijomis (bazinės kainos,
        modelių pastabos, stiklo rinkiniai) ir paverčia aiškiomis eilutėmis.
     3. Patikrina, kad niekas nepasimestų ir nebūtų dviprasmiška
        (žr. assert* funkcijas) — jei kas nors neaišku, skriptas SUSTOJA,
        o ne spėja.
     4. Įrašo deterministinį JSON paketą, kurį SQL pusėje importuoja
        procedūra admin.Catalog_ImportVersion.

   Naudojimas:
     node db/tools/extract-erkado.js <šaltinio_aplankas> <išvesties_failas>
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const SRC_DIR = path.resolve(process.argv[2] || path.join(__dirname, '../../catalog-sources/erkado/2026-I'));
const OUT_FILE = path.resolve(process.argv[3] || path.join(__dirname, '../catalog/erkado-2026-I.bundle.json'));
const SOURCE_FILES = ['data.js', 'glass.js', 'engine.js'];

// ---------------------------------------------------------------- pagalbinės
function fail(msg) {
  console.error('KLAIDA: ' + msg);
  process.exit(1);
}
function assert(cond, msg) { if (!cond) fail(msg); }

/* Pinigų suma turi būti baigtinis skaičius su ne daugiau kaip 2 skaitmenimis
   po kablelio. Grąžinama kaip skaičius, suapvalintas tiksliai iki centų. */
function money(v, where) {
  assert(typeof v === 'number' && Number.isFinite(v), `ne skaičius kainos lauke: ${where} = ${v}`);
  const cents = Math.round(v * 100);
  assert(Math.abs(v * 100 - cents) < 1e-6, `kaina turi daugiau nei 2 skaitmenis po kablelio: ${where} = ${v}`);
  assert(cents >= 0, `neigiama kaina: ${where} = ${v}`);
  return cents / 100;
}

/* Patikrina, kad struktūroje nėra funkcijų ar undefined — t. y. kad
   JSON.stringify nieko tyliai neišmes. */
function assertPlain(v, where) {
  if (v === null) return;
  const t = typeof v;
  if (t === 'function') fail(`funkcija ten, kur tikimasi duomenų: ${where}`);
  if (t === 'undefined') fail(`undefined reikšmė: ${where}`);
  if (t === 'number') { assert(Number.isFinite(v), `ne baigtinis skaičius: ${where}`); return; }
  if (t !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x, i) => assertPlain(x, `${where}[${i}]`)); return; }
  Object.entries(v).forEach(([k, x]) => assertPlain(x, `${where}.${k}`));
}

function plainCopy(v, where) {
  assertPlain(v, where);
  return JSON.parse(JSON.stringify(v));
}

// Pašalina undefined laukus (kad neliktų dviprasmybės JSON'e)
function compact(obj) {
  const out = {};
  Object.keys(obj).forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

// ------------------------------------------------------------- įkėlimas
const ctx = vm.createContext({ console, Intl, Math, Number, JSON, Object, Array, String });
const sourceHashes = {};
SOURCE_FILES.forEach(f => {
  const full = path.join(SRC_DIR, f);
  const code = fs.readFileSync(full, 'utf8');
  sourceHashes[f] = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  vm.runInContext(code, ctx, { filename: f });
});
const get = name => vm.runInContext(name, ctx);

const FAMILIES = get('FAMILIES');
const LINES = get('LINES');
const DECOR = get('DECOR');
const WIDTHS = get('WIDTHS');
const NO_2112_FAMILIES = get('NO_2112_FAMILIES');
const HANDLE_FAMILIES = get('HANDLE_FAMILIES');
const glassOptionsFor = get('glassOptionsFor');

// ---------------------------------------------------------------- linijos
const lines = Object.values(LINES).map((l, i) => {
  assertPlain(l, `LINES.${l.key}`);
  return {
    code: l.key, name: l.label, shortName: l.short, eyebrow: l.eyebrow,
    catalogPages: l.pages, sortOrder: (i + 1) * 10,
    reversibleBlocks2112: !!l.reversibleBlocks2112,
  };
});
const lineCodes = new Set(lines.map(l => l.code));

// ---------------------------------------------------------------- varčių tipai
// Pavadinimai iš engine.js (DOOR_TYPE_NAME_ENGINE); SLIDING — iš prodsheet terminų.
const DOOR_TYPE_NAMES = Object.assign({}, get('DOOR_TYPE_NAME_ENGINE'), { SLIDING: 'Stumdoma' });
const doorTypes = ['REBATED', 'FLUSH', 'REVERSIBLE', 'SLIDING'].map((c, i) => {
  assert(DOOR_TYPE_NAMES[c], `nėra varčios tipo pavadinimo: ${c}`);
  return { code: c, name: DOOR_TYPE_NAMES[c], sortOrder: (i + 1) * 10 };
});
const doorTypeCodes = new Set(doorTypes.map(d => d.code));

// ---------------------------------------------------------------- dekorai
const DECOR_GROUP_NAMES = {
  GREKO: 'GREKO', PREMIUM: 'PREMIUM', CPL: 'ST CPL', CPL02: 'CPL 0,2', CPL07: 'CPL 0,7', PAINTED: 'Dažyta UV',
};
const decorGroups = [];
const decors = [];
const decorGroupOf = {};
Object.entries(DECOR).forEach(([g, list], gi) => {
  assert(DECOR_GROUP_NAMES[g], `nežinoma dekorų grupė: ${g}`);
  decorGroups.push({ code: g, name: DECOR_GROUP_NAMES[g], sortOrder: (gi + 1) * 10 });
  list.forEach(([code, name], i) => {
    assert(!decorGroupOf[code], `dekoro kodas kartojasi: ${code}`);
    // Kainos skaičiuojamos pagal kodo prefiksą (decorCode.split('_')[0]) —
    // todėl prefiksas PRIVALO sutapti su grupe, kitaip kaina būtų neteisinga.
    assert(code.split('_')[0] === g, `dekoro ${code} prefiksas nesutampa su grupe ${g}`);
    decorGroupOf[code] = g;
    decors.push({ code, name, groupCode: g, sortOrder: (i + 1) * 10 });
  });
});

// ---------------------------------------------------------------- pločiai
const allWidthCodes = new Set(WIDTHS);
Object.values(FAMILIES).forEach(f => (f.widths || []).forEach(w => allWidthCodes.add(w)));
['SLIDING_WIDTHS', 'PANEL_WIDTHS', 'GRILLE_ALLOWED_WIDTHS'].forEach(n => get(n).forEach(w => allWidthCodes.add(w)));
function widthSortKey(w) {
  const n = parseInt(w, 10);
  assert(/^\d+N?$/.test(w), `netikėtas pločio kodas: ${w}`);
  return n * 10 + (w.endsWith('N') ? 0 : 1); // 80N prieš 80
}
const widths = Array.from(allWidthCodes).sort((a, b) => widthSortKey(a) - widthSortKey(b))
  .map((w, i) => ({ code: w, nominalCm: parseInt(w, 10), isNarrow: w.endsWith('N'), sortOrder: (i + 1) * 10 }));

// ---------------------------------------------------------------- šeimos
const ORDER = [].concat(
  get('FAMILY_ORDER'), get('FAMILY_ORDER_TIER2'), get('FAMILY_ORDER_PAINTED'),
  get('FAMILY_ORDER_PAINTED_PANEL'), get('FAMILY_ORDER_PANEL'));
assert(new Set(ORDER).size === ORDER.length, 'šeimų tvarkos sąraše yra pasikartojimų');
assert(ORDER.length === Object.keys(FAMILIES).length,
  `šeimų tvarkos sąrašas (${ORDER.length}) nesutampa su FAMILIES (${Object.keys(FAMILIES).length})`);
ORDER.forEach(k => assert(FAMILIES[k], `tvarkos sąraše yra nežinoma šeima: ${k}`));

const RULE_FIELDS = ['widthRules', 'opts', 'reversibleExcludedGroups', 'reversibleDecorWhitelist',
  'pl2112Fixed', 'noFillModels', 'softModels', 'softDecors', 'modelDecorGroups', 'narrowWidthModels'];
// Laukai, kurių engine.js NENAUDOJA (stiklas imamas iš glass.js). Išsaugomi
// atskirai, kad nieko nepamestume, bet aiškiai pažymėti kaip nenaudojami.
const LEGACY_UNUSED_FIELDS = ['glazed', 'decorativeGlass', 'glass'];
const KNOWN_FIELDS = new Set(['label', 'baseLabel', 'line', 'pages', 'tier', 'doorTypes', 'models', 'widths',
  'basePrice', 'decorOptions', 'note', 'isPanel', 'extrasKey', 'glassKey', 'slidingSingle', 'slidingDouble']
  .concat(RULE_FIELDS, LEGACY_UNUSED_FIELDS));

const families = [];
const models = [];
const basePrices = [];
const glassOptions = [];
const familyDecors = [];
const familyWidths = [];
const familyDoorTypes = [];

ORDER.forEach((key, fi) => {
  const f = FAMILIES[key];
  Object.keys(f).forEach(k => assert(KNOWN_FIELDS.has(k), `šeima ${key}: nežinomas laukas „${k}" — reikia papildyti ištraukimą`));
  assert(lineCodes.has(f.line), `šeima ${key}: nežinoma linija ${f.line}`);

  const rules = {};
  RULE_FIELDS.forEach(r => { if (f[r] !== undefined && f[r] !== null) rules[r] = plainCopy(f[r], `${key}.${r}`); });
  const legacy = {};
  LEGACY_UNUSED_FIELDS.forEach(r => {
    if (f[r] === undefined) return;
    if (r === 'glass') {
      // glass.fixedNote gali būti funkcija — ją apskaičiuojame kiekvienam modeliui
      const g = Object.assign({}, f.glass);
      if (typeof g.fixedNote === 'function') {
        const fn = g.fixedNote; g.fixedNote = {};
        f.models.forEach(n => { g.fixedNote[n] = fn(n); });
      }
      legacy.glass = plainCopy(g, `${key}.glass`);
    } else legacy[r] = plainCopy(f[r], `${key}.${r}`);
  });
  if (Object.keys(legacy).length) rules.legacyUnused = legacy;

  const baseLabel = f.baseLabel || f.label;
  const glassKey = f.glassKey || f.label;
  families.push(compact({
    code: key,
    lineCode: f.line,
    label: f.label,
    baseLabel,
    catalogPages: f.pages,
    tier: f.tier,
    isPanel: !!f.isPanel,
    extrasKey: f.extrasKey || f.line,
    glassKey,
    slidingSingle: !!f.slidingSingle,
    slidingDouble: !!f.slidingDouble,
    allows2112: !NO_2112_FAMILIES.includes(baseLabel),
    sortOrder: (fi + 1) * 10,
    rulesJson: JSON.stringify(rules),
  }));

  // varčių tipai
  f.doorTypes.forEach((d, i) => {
    assert(doorTypeCodes.has(d), `šeima ${key}: nežinomas varčios tipas ${d}`);
    familyDoorTypes.push({ familyCode: key, doorTypeCode: d, sortOrder: (i + 1) * 10 });
  });

  // pločiai — jei šeima neturi savo sąrašo, galioja bendrasis WIDTHS (taip daro engine.js)
  (f.widths || WIDTHS).forEach((w, i) => {
    assert(allWidthCodes.has(w), `šeima ${key}: nežinomas plotis ${w}`);
    familyWidths.push({ familyCode: key, widthCode: w, sortOrder: (i + 1) * 10 });
  });

  // dekorai
  assert(Array.isArray(f.decorOptions) && f.decorOptions.length > 0, `šeima ${key}: nėra dekorų`);
  const seenDecor = new Set();
  f.decorOptions.forEach(([code, name, group], i) => {
    assert(decorGroupOf[code], `šeima ${key}: nežinomas dekoras ${code}`);
    assert(decorGroupOf[code] === group, `šeima ${key}: dekoro ${code} grupė ${group} != ${decorGroupOf[code]}`);
    assert(!seenDecor.has(code), `šeima ${key}: dekoras kartojasi ${code}`);
    seenDecor.add(code);
    familyDecors.push({ familyCode: key, decorCode: code, sortOrder: (i + 1) * 10 });
  });
  const familyGroups = Array.from(new Set(f.decorOptions.map(d => d[2])));

  // modeliai, bazinės kainos, stiklas
  assert(new Set(f.models).size === f.models.length, `šeima ${key}: modeliai kartojasi`);
  f.models.forEach((n, mi) => {
    assert(Number.isInteger(n) && n > 0, `šeima ${key}: netinkamas modelio nr. ${n}`);
    const note = typeof f.note === 'function' ? f.note(n) : null;
    assert(note === null || typeof note === 'string', `šeima ${key} ${n}: pastaba ne tekstas`);
    models.push({ familyCode: key, modelNo: n, note, sortOrder: (mi + 1) * 10 });

    // Kokios dekorų grupės galimos šiam modeliui (pvz. FREZJA 9 — tik PREMIUM/CPL)
    const allowed = (f.modelDecorGroups && f.modelDecorGroups[n]) || familyGroups;
    familyGroups.filter(g => allowed.includes(g)).forEach(g => {
      // Bazinė kaina apskaičiuojama KIEKVIENAM grupės dekorui atskirai.
      // Jei bent vienas dekoras grupėje duotų kitą kainą — sustojame,
      // nes tada „kaina pagal grupę" būtų neteisingas modelis.
      const prices = new Set(f.decorOptions.filter(d => d[2] === g)
        .map(([code]) => money(f.basePrice(n, code), `${key} ${n} ${code}`)));
      assert(prices.size === 1, `šeima ${key} ${n}: grupės ${g} dekorai duoda skirtingas kainas: ${[...prices]}`);
      basePrices.push({ familyCode: key, modelNo: n, decorGroupCode: g, price: [...prices][0] });
    });

    const g = glassOptionsFor(glassKey, n);
    const seenGlass = new Set();
    g.forEach((o, gi) => {
      assert(typeof o.code === 'string' && o.code.length > 0, `stiklas ${key} ${n}: nėra kodo`);
      assert(!seenGlass.has(o.code), `stiklas ${key} ${n}: kodas kartojasi ${o.code}`);
      seenGlass.add(o.code);
      glassOptions.push({
        familyCode: key, modelNo: n, code: o.code, name: o.name,
        price: money(o.price, `stiklas ${key} ${n} ${o.code}`),
        isDefault: gi === 0, sortOrder: (gi + 1) * 10,
      });
    });
    if (g.length) assert(g[0].price === 0, `stiklas ${key} ${n}: pirmas variantas turi būti nemokamas`);
  });
});

// ---------------------------------------------------------------- rankenos
const handles = [];
const handleFinishes = [];
HANDLE_FAMILIES.forEach((h, hi) => {
  assert(['none', 'triple', 'dual'].includes(h.plateSystem), `rankena ${h.key}: plateSystem ${h.plateSystem}`);
  handles.push({ code: h.key, name: h.name, hasLeftRight: !!h.hasLR, plateSystem: h.plateSystem, sortOrder: (hi + 1) * 10 });
  const seen = new Set();
  h.finishes.forEach(([code, name, price, plates], i) => {
    assert(!seen.has(code), `rankena ${h.key}: apdaila kartojasi ${code}`);
    seen.add(code);
    const row = { handleCode: h.key, code, name, price: money(price, `rankena ${h.key} ${code}`), sortOrder: (i + 1) * 10 };
    if (h.plateSystem === 'triple') {
      assert(plates && Object.keys(plates).sort().join() === 'cyl,key,wc', `rankena ${h.key} ${code}: triple plokštelės`);
      row.plateKeyPrice = money(plates.key, `${h.key} ${code} key`);
      row.plateCylPrice = money(plates.cyl, `${h.key} ${code} cyl`);
      row.plateWcPrice = money(plates.wc, `${h.key} ${code} wc`);
    } else if (h.plateSystem === 'dual') {
      assert(plates && Object.keys(plates).sort().join() === 'keyOrCyl,wc', `rankena ${h.key} ${code}: dual plokštelės`);
      row.plateKeyOrCylPrice = money(plates.keyOrCyl, `${h.key} ${code} keyOrCyl`);
      row.plateWcPrice = money(plates.wc, `${h.key} ${code} wc`);
    } else {
      assert(plates === undefined, `rankena ${h.key} ${code}: plokštelės be plateSystem`);
    }
    handleFinishes.push(row);
  });
});

// ---------------------------------------------------------------- taisyklių duomenys
/* Visos kitos konstantos, nuo kurių priklauso kainų skaičiavimas (staktos,
   priedai, spynos, ventiliacija, stumdomos sistemos ir kt.). Jos saugomos
   kaip tikslios JSON kopijos — kiekviena atskiru įrašu su kontroline suma.
   Variklis (engine.js) jas skaito taip pat, kaip dabar skaito data.js. */
const DATASET_NAMES = [
  'SHARED_EXTRAS', 'LINE_EXTRAS', 'PANEL_EXTRAS', 'INTARSIA_PATTERNS', 'INTARSIA_SERIES', 'STEEL_PANEL_OPTIONS',
  'DOOR_CLOSER_COLORS', 'VENT_SLEEVE_FINISHES', 'PANEL_WIDTHS', 'STAKTA_BASE', 'STAKTA_STANDARD_MAX_MM',
  'STAKTA_EXTEND_PANEL_RATE', 'THIRD_HINGE_PRICE', 'RANGE_EXT_PRICE', 'RANGE_EXT_ALLOWED', 'KARUNA_SET_PRICE',
  'STAKTA_ADJUSTABLE', 'STAKTA_FIXED', 'FLOOR_TRIM_PRICE', 'FLOOR_TRIM_PAINTED_COLORS', 'VENTILATION_OPTIONS',
  'GRILLE_ALLOWED_WIDTHS', 'LOCK_MAGNETIC', 'LOCK_LATCH', 'LOCK_OPTIONS', 'LOCK_COLOR_OPTIONS',
  'HARDWARE_COLOR_OPTIONS', 'HINGE_CAP_UNIT_PRICE', 'HINGE_CAP_HINGES_COUNT', 'HINGE_CAP_OPTIONS',
  'VERTICAL_FRAME_PRICE', 'VERTICAL_FRAME_ALLOWED_DECORS', 'STAKTA_STEEL_MOUNT', 'WIDTHS', 'HANDLE_PLATE_LABELS',
  'REVERSIBLE_DECOR_WHITELIST', 'PANEL_ONLY_DECORS', 'DECOR_COMBOS', 'FAMILY_DECOR_COMBO',
  'SLIDING_EXTRAS', 'SLIDING_RAIL_LENGTH', 'SLIDING_HANDLE_COLORS', 'SLIDING_LOCK_COLORS', 'SLIDING_WIDTHS',
  'SLIDING_MATERIAL_GROUPS', 'PENDING_FAMILIES',
  // iš engine.js
  'NO_2112_FAMILIES', 'STANDARD_NAME', 'DOOR_TYPE_NAME_ENGINE',
];
const datasets = DATASET_NAMES.map((name, i) => {
  const v = plainCopy(get(name), name);
  const json = JSON.stringify(v);
  return { code: name, json, sha256: crypto.createHash('sha256').update(json, 'utf8').digest('hex'), sortOrder: (i + 1) * 10 };
});

// ---------------------------------------------------------------- paketas
const bundle = {
  formatVersion: 1,
  manufacturer: { code: 'ERKADO', name: 'ERKADO' },
  catalogVersion: {
    code: '2026-I',
    name: 'ERKADO vidaus durys, katalogas I/2026/B',
    currencyCode: 'EUR',
    vatRate: money(get('SHARED_EXTRAS').vatRate, 'vatRate'),
    sourceDescription: 'Perkelta iš konfigūratoriaus newdemo (data.js, glass.js, engine.js)',
    sourceHashes,
  },
  lines, doorTypes, decorGroups, decors, widths,
  families, familyDoorTypes, familyWidths, familyDecors,
  models, basePrices, glassOptions,
  handles, handleFinishes,
  datasets,
};

// Deterministinis išvedimas (ta pati įvestis = tas pats failas, baitas į baitą)
const text = JSON.stringify(bundle, null, 1) + '\n';
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, text, 'utf8');

const summary = {
  linijos: lines.length, seimos: families.length, modeliai: models.length, dekorai: decors.length,
  bazinesKainos: basePrices.length, stikloVariantai: glassOptions.length,
  rankenos: handles.length, rankenuApdailos: handleFinishes.length, taisykliuRinkiniai: datasets.length,
  sha256: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
};
console.log(JSON.stringify(summary, null, 2));
