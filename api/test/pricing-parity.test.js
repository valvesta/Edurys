'use strict';
/* ==========================================================================
   SVARBIAUSIAS KAINŲ TESTAS.

   Lygina du dalykus tūkstančiams atsitiktinių durų konfigūracijų:
     A — originalus konfigūratorius (data.js + glass.js + engine.js, kaip naršyklėje);
     B — serverio variklis, kurio katalogas atkurtas iš DB paketo.
   Turi sutapti VISKAS: pasirinkimų sutvarkymas, klaidos, pranešimai,
   galimi variantai, kaina, priedai ir sąskaitos eilutės — iki cento.

   Atsitiktinumas fiksuotas (sėkla), todėl rezultatas pakartojamas.
   Daugiau bandymų: PARITY_SCENARIOS=20000 npm test
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'catalog-sources', 'erkado', '2026-I');
// PARITY_BUNDLE — galima nurodyti iš duomenų bazės išeksportuotą paketą (CI tai daro)
const BUNDLE = process.env.PARITY_BUNDLE || path.join(ROOT, 'db', 'catalog', 'erkado-2026-I.bundle.json');
const ENGINE_DIR = path.join(__dirname, '..', 'src', 'engines', 'erkado');
const { createRuntime } = require('../src/engines/erkado/runtime');

const SCENARIOS = Number(process.env.PARITY_SCENARIOS || 3000);
const STEPS = 6;

function original() {
  const ctx = vm.createContext({});
  for (const f of ['data.js', 'glass.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

// Deterministinis atsitiktinių skaičių generatorius (mulberry32)
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('engine.js serveryje — identiškas originalui', () => {
  assert.equal(fs.readFileSync(path.join(ENGINE_DIR, 'engine.js'), 'utf8'), fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8'));
});

test('pagalbinės funkcijos — pažodžiui kaip data.js', () => {
  const A = original();
  const H = fs.readFileSync(path.join(ENGINE_DIR, 'helpers.js'), 'utf8');
  for (const name of ['intarsiaOptions', 'lineExtras', 'lockIsMagnetic', 'staktaAdjustableTier', 'lockKind',
    'handlePlateNeed', 'handlePlateChoiceOrder']) {
    const src = vm.runInContext(name, A).toString();
    assert.ok(H.includes(src), `${name} skiriasi nuo originalo`);
  }
});

test(`kainų sutapimas: ${SCENARIOS} scenarijų × ${STEPS} žingsnių`, () => {
  const A = original();
  const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));
  const B = createRuntime(bundle).context;
  const a = n => vm.runInContext(n, A);
  const b = n => vm.runInContext(n, B);

  const fams = Object.keys(a('FAMILIES'));
  assert.deepEqual(Object.keys(b('FAMILIES')).sort(), fams.slice().sort(), 'šeimų sąrašas');

  // Statinės reikšmių aibės kiekvienam pasirinkimo raktui (iš engine.js teksto ir katalogo)
  const engineSrc = fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8');
  const pools = {};
  const add = (k, v) => { (pools[k] = pools[k] || new Set()).add(v); };
  for (const m of engineSrc.matchAll(/s\.([A-Z][A-Z0-9_]+)\s*(?:===|!==)\s*'([^']+)'/g)) add(m[1], m[2]);
  for (const m of engineSrc.matchAll(/\bs\.([A-Z][A-Z0-9_]+)/g)) pools[m[1]] = pools[m[1]] || new Set();
  Object.keys(pools).forEach(k => { if ([...pools[k]].includes('YES')) add(k, 'NO'); });
  ['LEFT', 'RIGHT'].forEach(v => { add('DIRECTION', v); add('HANDLE_SIDE', v); });
  ['AVERSAS', 'REVERSAS'].forEach(v => add('GLAZING_SIDE', v));
  ['6', '8'].forEach(v => { add('STAKTA_TRIM', v); add('SLIDING_TUNNEL_TRIM', v); });
  ['QTY', 'FIXED_TRIM_QTY', 'KAMPUKAS_QTY', 'FLOOR_TRIM_QTY'].forEach(k => [1, 2, 3].forEach(v => add(k, v)));
  ['2', '3', 2, 3].forEach(v => add('HINGE_COUNT', v));
  a('HANDLE_FAMILIES').forEach(h => { add('HANDLE_FAMILY', h.key); h.finishes.forEach(f => add('HANDLE_FINISH', f[0])); });
  a('intarsiaOptions')().forEach(o => add('INTARSIA', o[0]));
  a('STEEL_PANEL_OPTIONS').forEach(o => add('STEEL_PANEL', o[0]));
  a('DOOR_CLOSER_COLORS').forEach(o => add('DOOR_CLOSER_COLOR', o[0]));
  a('VENT_SLEEVE_FINISHES').forEach(o => add('VENT_SLEEVE_FINISH', o[0]));
  a('HINGE_CAP_OPTIONS').forEach(o => add('HINGE_CAP', o[0]));
  Object.keys(a('STAKTA_FIXED').trimSet).forEach(k => add('FIXED_TRIM_SET', k));
  a('FLOOR_TRIM_PAINTED_COLORS').forEach(o => add('FLOOR_TRIM_COLOR', o[0]));
  a('SLIDING_HANDLE_COLORS').forEach(o => { add('SLIDING_HANDLE', o[0]); add('SLIDING_LOCK_COLOR', o[0]); });
  ['MATTE', 'CLEAR', 'CLEAR_GLASS', 'MATTE_GLASS'].forEach(v => add('ROUND_WINDOW_GLASS', v));
  ['STEEL', 'BLACK', 'NONE'].forEach(v => add('ROUND_WINDOW', v));
  const STAKTA_ADJ = a('STAKTA_ADJUSTABLE');
  Object.values(STAKTA_ADJ).forEach(t => t.rows.forEach(r => { add('STAKTA_RANGE', r[0]); add('SLIDING_TUNNEL_RANGE', r[0]); }));
  a('STAKTA_STEEL_MOUNT').rows.forEach(r => add('STAKTA_RANGE', r[0]));
  Object.values(a('RANGE_EXT_ALLOWED')).forEach(l => l.forEach(v => add('STAKTA_RANGE_EXT', v)));
  ['90', 'NONE'].forEach(v => { add('STAKTA_MITER', v); add('SLIDING_TUNNEL_MITER', v); });

  // Dinaminiai variantai iš esamos konfigūracijos
  // Dažniausiai renkamasi iš GALIMŲ variantų (kaip naršyklėje), kartais — ir iš negalimų,
  // kad būtų patikrintas ir klaidų / automatinio taisymo kelias.
  const avail = list => (r() < 0.85 ? list.filter(x => x.available !== false) : list).map(x => x.code);
  const fromCfg = cfg => ({
    DOOR_TYPE: avail(cfg.doorTypes),
    WIDTH: avail(cfg.widths),
    DIRECTION: ['LEFT', 'RIGHT'],
    DECOR: avail(cfg.decorOpts),
    STAKTA_DECOR: avail(cfg.decorOpts),
    FLOOR_TRIM_COLOR: avail(cfg.decorOpts),
    GLASS: cfg.glassOpts.map(x => x.code),
    STANDARD: avail(cfg.standards),
    VENTILATION: avail(cfg.ventOpts),
    LOCK: (cfg.lockOpts || []).map(x => x.code),
    HARDWARE_COLOR: (cfg.hwColorOpts || []).map(x => x[0]),
    LOCK_COLOR: (cfg.lockColorOpts || []).map(x => x[0]),
    STAKTA_CHOICE: (cfg.staktaModes || []).map(x => x.code),
  });

  const projectCfg = cfg => JSON.stringify(Object.fromEntries(Object.entries(cfg).filter(([k]) => k !== 'family')));
  const r = rng(20261014);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  let compared = 0, valid = 0, withRows = 0;
  const familiesSeenValid = new Set();
  const coverage = new Set();
  const keys = Object.keys(pools);

  for (let i = 0; i < SCENARIOS; i++) {
    const fam = fams[i % fams.length];                  // visos šeimos po lygiai
    const famA = a('FAMILIES')[fam];
    const model = pick(famA.models);
    let sel = {};
    for (let step = 0; step < STEPS; step++) {
      const cfgA0 = a('configureDoor')(fam, model, JSON.parse(JSON.stringify(sel)));
      const dyn = fromCfg(cfgA0);
      sel = JSON.parse(JSON.stringify(cfgA0.selections));
      // Pirmuose žingsniuose užpildomi būtini laukai, vėliau keičiama po kelis atsitiktinius
      const mutate = step === 0 ? Object.keys(dyn) : Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(keys.concat(Object.keys(dyn))));
      for (const k of mutate) {
        const choices = (dyn[k] && dyn[k].length ? dyn[k] : [...(pools[k] || [])]);
        if (!choices.length) continue;
        sel[k] = r() < 0.02 ? null : pick(choices);
      }
      const input = JSON.stringify(sel);
      const cfgA = a('configureDoor')(fam, model, JSON.parse(input));
      const cfgB = b('configureDoor')(fam, model, JSON.parse(input));
      const ctxMsg = `šeima ${fam}, modelis ${model}, žingsnis ${step}, pasirinkimai ${input}`;
      assert.equal(projectCfg(cfgB), projectCfg(cfgA), `konfigūracija nesutampa: ${ctxMsg}`);
      const pA = a('priceDoor')(cfgA), pB = b('priceDoor')(cfgB);
      if (pA.valid || pB.valid) {
        assert.equal(JSON.stringify(pB), JSON.stringify(pA), `kaina nesutampa: ${ctxMsg}`);
      }
      compared++;
      if (pA.valid) {
        valid++;
        familiesSeenValid.add(fam);
        const qty = 1 + Math.floor(r() * 3);
        const item = (ctx, cfg, p) => ({ familyLabel: cfg.family.label, modelNo: model, qty, selections: cfg.selections,
          baseNet: p.baseNet, priceAdjustments: p.adjustments,
          staktaDecorName: cfg.selections.STAKTA_DECOR ? vm.runInContext('decorOptName', ctx)(cfg, cfg.selections.STAKTA_DECOR) : null });
        const rowsA = a('invoiceRowsForItem')(item(A, cfgA, pA), 1);
        const rowsB = b('invoiceRowsForItem')(item(B, cfgB, pB), 1);
        assert.equal(JSON.stringify(rowsB), JSON.stringify(rowsA), `sąskaitos eilutės nesutampa: ${ctxMsg}`);
        withRows++;
        pA.adjustments.forEach(x => coverage.add(String(x.description).split(/[ (:,—]/)[0] + (x.spec ? "*" : "")));
      }
    }
  }
  console.log(`  palyginta konfigūracijų: ${compared}, galiojančių su kaina: ${valid}, sąskaitos eilučių rinkinių: ${withRows}, ` +
    `šeimų su galiojančia kaina: ${familiesSeenValid.size}/${fams.length}, skirtingų priedų rūšių: ${coverage.size}`);
  if (process.env.PARITY_VERBOSE) console.log([...coverage].sort().join(", "));
  assert.ok(valid > compared * 0.3, `per mažai galiojančių konfigūracijų (${valid}/${compared}) — testas būtų silpnas`);
  assert.equal(familiesSeenValid.size, fams.length, 'kiekviena šeima turi būti patikrinta su galiojančia kaina');
});

test('serverio priceLine: kaina tokia pati, kaip originalo sąskaitoje', () => {
  const A = original();
  const rt = createRuntime(JSON.parse(fs.readFileSync(BUNDLE, 'utf8')));
  const sel = { WIDTH: '80', DIRECTION: 'LEFT', DECOR: 'CPL_WHITE', LOCK: 'LATCH_BSR', HARDWARE_COLOR: 'STANDARD',
    STAKTA_CHOICE: 'ADJUSTABLE_STANDARD', STAKTA_RANGE: '100-120' };
  const line = rt.priceLine({ familyKey: 'WERBENA', modelNo: 4, quantity: 2, selections: sel }, 1);
  let cfg = vm.runInContext('configureDoor', A)('WERBENA', 4, { ...sel });
  for (let i = 0; i < 5; i++) cfg = vm.runInContext('configureDoor', A)('WERBENA', 4, cfg.selections);
  const p = vm.runInContext('priceDoor', A)(cfg);
  assert.ok(p.valid, 'originalas turi laikyti konfigūraciją galiojančia');
  const rowsA = vm.runInContext('invoiceRowsForItem', A)({ familyLabel: 'WERBENA', modelNo: 4, qty: 2, selections: cfg.selections,
    baseNet: p.baseNet, priceAdjustments: p.adjustments, staktaDecorName: vm.runInContext('decorOptName', A)(cfg, cfg.selections.STAKTA_DECOR) }, 1);
  assert.deepEqual(line.priceBreakdown, JSON.parse(JSON.stringify(rowsA)));
  const sum = Math.round(line.priceBreakdown.reduce((s, x) => s + x.sum, 0) * 100) / 100;
  assert.ok(sum > 800, `suma ${sum}`);
});

test('serverio priceLine atmeta negalimas konfigūracijas ir neteisingus duomenis', () => {
  const rt = createRuntime(JSON.parse(fs.readFileSync(BUNDLE, 'utf8')));
  assert.throws(() => rt.priceLine({ familyKey: 'NERA', modelNo: 1, quantity: 1, selections: {} }, 1), /Nežinoma šeima/);
  assert.throws(() => rt.priceLine({ familyKey: 'constructor', modelNo: 1, quantity: 1, selections: {} }, 1), /Nežinoma šeima/);
  assert.throws(() => rt.priceLine({ familyKey: 'WERBENA', modelNo: 4, quantity: 0, selections: {} }, 1), /Kiekis/);
  assert.throws(() => rt.priceLine({ familyKey: 'WERBENA', modelNo: 4, quantity: 1, selections: { DECOR: { x: 1 } } }, 1), /Neteisinga reikšmė/);
  assert.throws(() => rt.priceLine({ familyKey: 'WERBENA', modelNo: 4, quantity: 1, selections: { __proto__x: 1 } }, 1), /raktas/);
  assert.throws(() => rt.priceLine({ familyKey: 'WERBENA', modelNo: 4, quantity: 1, selections: {} }, 1), /negalima/);
});
