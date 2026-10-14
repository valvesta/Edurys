#!/usr/bin/env node
/* ==========================================================================
   Katalogo patikra: ar paketas (failas ARBA iš SQL eksportuotas paketas)
   tiksliai atitinka originalų konfigūratorių (data.js + glass.js + engine.js).

   Patikra NEPRIKLAUSO nuo extract-erkado.js logikos — ji iš naujo kviečia
   originalias funkcijas (basePrice, glassOptionsFor, HANDLE_FAMILIES ...)
   ir lygina rezultatą su paketo eilutėmis. Tikrinama abiem kryptimis:
   kiekviena originali reikšmė turi būti pakete, ir pakete neturi būti
   nieko, ko nėra originale.

   Naudojimas:
     node db/tools/verify-catalog.js <paketas.json> [šaltinio_aplankas]
   Išėjimo kodas 0 = viskas sutampa, 1 = rasta neatitikimų.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSources(srcDir) {
  const ctx = vm.createContext({ console, Intl, Math, Number, JSON, Object, Array, String });
  ['data.js', 'glass.js', 'engine.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(srcDir, f), 'utf8'), ctx, { filename: f }));
  return name => vm.runInContext(name, ctx);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.join('\u0001') !== kb.join('\u0001')) return false;
  return ka.every(k => deepEqual(a[k], b[k]));
}

function verify(bundle, srcDir) {
  const get = loadSources(srcDir);
  const errors = [];
  const err = m => { if (errors.length < 200) errors.push(m); };
  const cents = v => Math.round(Number(v) * 100);

  const FAMILIES = get('FAMILIES');
  const WIDTHS = get('WIDTHS');
  const glassOptionsFor = get('glassOptionsFor');
  const HANDLE_FAMILIES = get('HANDLE_FAMILIES');
  const NO_2112 = get('NO_2112_FAMILIES');

  // ---- šeimos
  const famByCode = new Map(bundle.families.map(f => [f.code, f]));
  if (famByCode.size !== Object.keys(FAMILIES).length)
    err(`šeimų skaičius: pakete ${famByCode.size}, originale ${Object.keys(FAMILIES).length}`);

  const bp = new Map(bundle.basePrices.map(r => [`${r.familyCode}|${r.modelNo}|${r.decorGroupCode}`, r.price]));
  const usedBp = new Set();
  const glassBy = new Map();
  bundle.glassOptions.forEach(r => {
    const k = `${r.familyCode}|${r.modelNo}`;
    if (!glassBy.has(k)) glassBy.set(k, []);
    glassBy.get(k).push(r);
  });
  const listBy = (rows, keyField, valField) => {
    const m = new Map();
    rows.slice().sort((a, b) => a.sortOrder - b.sortOrder).forEach(r => {
      if (!m.has(r[keyField])) m.set(r[keyField], []);
      m.get(r[keyField]).push(r[valField]);
    });
    return m;
  };
  const doorTypesBy = listBy(bundle.familyDoorTypes, 'familyCode', 'doorTypeCode');
  const widthsBy = listBy(bundle.familyWidths, 'familyCode', 'widthCode');
  const decorsBy = listBy(bundle.familyDecors, 'familyCode', 'decorCode');
  const modelsBy = listBy(bundle.models, 'familyCode', 'modelNo');
  const noteBy = new Map(bundle.models.map(m => [`${m.familyCode}|${m.modelNo}`, m.note]));

  let checkedPrices = 0, checkedGlass = 0;
  Object.entries(FAMILIES).forEach(([key, f]) => {
    const bf = famByCode.get(key);
    if (!bf) { err(`šeimos nėra pakete: ${key}`); return; }
    if (bf.lineCode !== f.line) err(`${key}: linija ${bf.lineCode} != ${f.line}`);
    if (bf.label !== f.label) err(`${key}: pavadinimas „${bf.label}" != „${f.label}"`);
    if (bf.glassKey !== (f.glassKey || f.label)) err(`${key}: glassKey`);
    if (!!bf.isPanel !== !!f.isPanel) err(`${key}: isPanel`);
    if (bf.extrasKey !== (f.extrasKey || f.line)) err(`${key}: extrasKey`);
    if (!!bf.slidingSingle !== !!f.slidingSingle) err(`${key}: slidingSingle`);
    if (!!bf.slidingDouble !== !!f.slidingDouble) err(`${key}: slidingDouble`);
    if (!!bf.allows2112 !== !NO_2112.includes(f.baseLabel || f.label)) err(`${key}: allows2112`);

    const rules = JSON.parse(bf.rulesJson);
    ['widthRules', 'opts', 'reversibleExcludedGroups', 'reversibleDecorWhitelist', 'pl2112Fixed',
      'noFillModels', 'softModels', 'softDecors', 'modelDecorGroups', 'narrowWidthModels'].forEach(r => {
      const orig = f[r] === undefined || f[r] === null ? undefined : JSON.parse(JSON.stringify(f[r]));
      if (!deepEqual(rules[r], orig) && !(rules[r] === undefined && orig === undefined))
        err(`${key}: taisyklė ${r} nesutampa`);
    });

    if (!deepEqual(doorTypesBy.get(key) || [], f.doorTypes)) err(`${key}: varčių tipai nesutampa`);
    if (!deepEqual(widthsBy.get(key) || [], f.widths || WIDTHS)) err(`${key}: pločiai nesutampa`);
    if (!deepEqual(decorsBy.get(key) || [], f.decorOptions.map(d => d[0]))) err(`${key}: dekorai nesutampa`);
    if (!deepEqual(modelsBy.get(key) || [], f.models)) err(`${key}: modeliai nesutampa`);

    const groups = Array.from(new Set(f.decorOptions.map(d => d[2])));
    f.models.forEach(n => {
      const note = typeof f.note === 'function' ? f.note(n) : null;
      if ((noteBy.get(`${key}|${n}`) ?? null) !== note) err(`${key} ${n}: pastaba nesutampa`);
      const allowed = (f.modelDecorGroups && f.modelDecorGroups[n]) || groups;
      f.decorOptions.forEach(([code, , g]) => {
        if (!allowed.includes(g)) return;
        const k = `${key}|${n}|${g}`;
        const expected = f.basePrice(n, code);
        if (!bp.has(k)) { err(`nėra bazinės kainos: ${k}`); return; }
        usedBp.add(k);
        checkedPrices++;
        if (cents(bp.get(k)) !== cents(expected)) err(`bazinė kaina ${key} ${n} ${code}: pakete ${bp.get(k)}, originale ${expected}`);
      });
      const exp = glassOptionsFor(f.glassKey || f.label, n);
      const got = (glassBy.get(`${key}|${n}`) || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      if (exp.length !== got.length) err(`stiklas ${key} ${n}: variantų ${got.length}, originale ${exp.length}`);
      exp.forEach((o, i) => {
        const r = got[i];
        checkedGlass++;
        if (!r || r.code !== o.code || r.name !== o.name || cents(r.price) !== cents(o.price) || !!r.isDefault !== (i === 0))
          err(`stiklas ${key} ${n} #${i + 1}: ${JSON.stringify(r)} != ${JSON.stringify(o)}`);
      });
    });
  });
  bp.forEach((v, k) => { if (!usedBp.has(k)) err(`pakete yra perteklinė bazinė kaina: ${k}`); });

  // ---- rankenos
  const hfBy = new Map();
  bundle.handleFinishes.forEach(r => {
    if (!hfBy.has(r.handleCode)) hfBy.set(r.handleCode, []);
    hfBy.get(r.handleCode).push(r);
  });
  if (bundle.handles.length !== HANDLE_FAMILIES.length) err('rankenų skaičius nesutampa');
  HANDLE_FAMILIES.forEach(h => {
    const bh = bundle.handles.find(x => x.code === h.key);
    if (!bh) { err(`nėra rankenos ${h.key}`); return; }
    if (bh.name !== h.name || !!bh.hasLeftRight !== !!h.hasLR || bh.plateSystem !== h.plateSystem) err(`rankena ${h.key}: savybės`);
    const got = (hfBy.get(h.key) || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    if (got.length !== h.finishes.length) err(`rankena ${h.key}: apdailų skaičius`);
    h.finishes.forEach(([code, name, price, plates], i) => {
      const r = got[i] || {};
      if (r.code !== code || r.name !== name || cents(r.price) !== cents(price)) err(`rankena ${h.key} ${code}: kaina/pavadinimas`);
      if (h.plateSystem === 'triple' && (cents(r.plateKeyPrice) !== cents(plates.key) ||
          cents(r.plateCylPrice) !== cents(plates.cyl) || cents(r.plateWcPrice) !== cents(plates.wc)))
        err(`rankena ${h.key} ${code}: plokštelių kainos`);
      if (h.plateSystem === 'dual' && (cents(r.plateKeyOrCylPrice) !== cents(plates.keyOrCyl) ||
          cents(r.plateWcPrice) !== cents(plates.wc)))
        err(`rankena ${h.key} ${code}: plokštelių kainos`);
    });
  });

  // ---- taisyklių rinkiniai (tiksli kopija)
  bundle.datasets.forEach(d => {
    let orig;
    try { orig = get(d.code); } catch (e) { err(`rinkinys ${d.code}: originale nerastas`); return; }
    if (!deepEqual(JSON.parse(d.json), JSON.parse(JSON.stringify(orig)))) err(`rinkinys ${d.code}: turinys nesutampa`);
  });

  return { errors, checkedPrices, checkedGlass };
}

module.exports = { verify };

if (require.main === module) {
  const bundlePath = path.resolve(process.argv[2] || path.join(__dirname, '../catalog/erkado-2026-I.bundle.json'));
  const srcDir = path.resolve(process.argv[3] || path.join(__dirname, '../../catalog-sources/erkado/2026-I'));
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const { errors, checkedPrices, checkedGlass } = verify(bundle, srcDir);
  console.log(`Patikrinta bazinių kainų: ${checkedPrices}, stiklo variantų: ${checkedGlass}, rinkinių: ${bundle.datasets.length}`);
  if (errors.length) {
    console.error(`NEATITIKIMŲ: ${errors.length}`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('OK — paketas tiksliai atitinka originalų konfigūratorių.');
}
