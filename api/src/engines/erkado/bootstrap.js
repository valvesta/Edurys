/* ==========================================================================
   ERKADO katalogo atkūrimas iš duomenų bazės paketo.

   Vykdoma izoliuotame VM kontekste PRIEŠ engine.js. Sukuria tuos pačius
   globalius objektus, kuriuos naršyklėje sukuria data.js ir glass.js
   (FAMILIES, LINES, DECOR, HANDLE_FAMILIES, glassOptionsFor, staktų lentelės
   ir kt.), bet duomenis ima iš paketo (__BUNDLE_JSON), o ne iš failų.

   Kad atkūrimas tikslus, tikrina api/test/pricing-parity.test.js:
   tūkstančiai atsitiktinių konfigūracijų lyginami su originaliu data.js.
   ========================================================================== */
(function () {
  'use strict';
  const B = JSON.parse(globalThis.__BUNDLE_JSON);
  delete globalThis.__BUNDLE_JSON;
  const bySort = (a, b) => a.sortOrder - b.sortOrder;
  const fail = m => { throw new Error('Katalogo paketas neteisingas: ' + m); };

  // ---- taisyklių rinkiniai (staktos, priedai, spynos ...) — tiesiai globaliai.
  // NO_2112_FAMILIES, STANDARD_NAME, DOOR_TYPE_NAME_ENGINE apibrėžia pats engine.js.
  const DEFINED_BY_ENGINE = new Set(['NO_2112_FAMILIES', 'STANDARD_NAME', 'DOOR_TYPE_NAME_ENGINE']);
  B.datasets.slice().sort(bySort).forEach(d => {
    if (DEFINED_BY_ENGINE.has(d.code)) return;
    globalThis[d.code] = JSON.parse(d.json);
  });

  // ---- linijos
  const LINES = {};
  B.lines.slice().sort(bySort).forEach(l => {
    LINES[l.code] = { key: l.code, label: l.name, short: l.shortName, pages: l.catalogPages,
      eyebrow: l.eyebrow, reversibleBlocks2112: !!l.reversibleBlocks2112 };
  });

  // ---- dekorai
  const DECOR = {};
  const decorGroupOf = {};
  const decorName = {};
  B.decorGroups.slice().sort(bySort).forEach(g => { DECOR[g.code] = []; });
  B.decors.slice().sort(bySort).forEach(d => {
    if (!DECOR[d.groupCode]) fail('dekoro grupė ' + d.groupCode);
    DECOR[d.groupCode].push([d.code, d.name]);
    decorGroupOf[d.code] = d.groupCode;
    decorName[d.code] = d.name;
  });

  // ---- pagalbinės grupavimo funkcijos
  const groupBy = (rows, key) => {
    const m = {};
    rows.slice().sort(bySort).forEach(r => { (m[r[key]] = m[r[key]] || []).push(r); });
    return m;
  };
  const doorTypesBy = groupBy(B.familyDoorTypes, 'familyCode');
  const widthsBy = groupBy(B.familyWidths, 'familyCode');
  const decorsBy = groupBy(B.familyDecors, 'familyCode');
  const modelsBy = groupBy(B.models, 'familyCode');

  const price = {};          // šeima|modelis|grupė -> kaina
  B.basePrices.forEach(p => { price[p.familyCode + '|' + p.modelNo + '|' + p.decorGroupCode] = p.price; });

  // ---- stiklas: raktas (glassKey) -> modelis -> variantai
  const GLASS = {};
  const famGlassKey = {};
  B.families.forEach(f => { famGlassKey[f.code] = f.glassKey; });
  const glassBy = {};
  B.glassOptions.forEach(o => {
    const k = o.familyCode + '|' + o.modelNo;
    (glassBy[k] = glassBy[k] || []).push(o);
  });
  Object.keys(glassBy).forEach(k => {
    const [fam, n] = k.split('|');
    const list = glassBy[k].sort(bySort).map(o => ({ code: o.code, name: o.name, price: o.price }));
    const gk = famGlassKey[fam];
    GLASS[gk] = GLASS[gk] || {};
    const prev = GLASS[gk][n];
    if (prev && JSON.stringify(prev) !== JSON.stringify(list)) fail('skirtingi stiklo rinkiniai tam pačiam raktui ' + gk + ' ' + n);
    GLASS[gk][n] = list;
  });
  function glassOptionsFor(familyLabel, modelNo) {
    const fam = GLASS[familyLabel];
    if (!fam) return [];
    const s = fam[modelNo];
    if (!s) return [];
    return s.map(o => ({ code: o.code, name: o.name, price: o.price }));
  }

  // ---- šeimos
  const FAMILIES = {};
  B.families.slice().sort(bySort).forEach(f => {
    const rules = JSON.parse(f.rulesJson);
    delete rules.legacyUnused;
    const models = (modelsBy[f.code] || []).map(m => m.modelNo);
    const notes = {};
    (modelsBy[f.code] || []).forEach(m => { notes[m.modelNo] = m.note == null ? null : m.note; });
    const code = f.code;
    const fam = Object.assign({
      label: f.label,
      baseLabel: f.baseLabel,
      line: f.lineCode,
      pages: f.catalogPages,
      doorTypes: (doorTypesBy[code] || []).map(x => x.doorTypeCode),
      models,
      widths: (widthsBy[code] || []).map(x => x.widthCode),
      decorOptions: (decorsBy[code] || []).map(x => [x.decorCode, decorName[x.decorCode], decorGroupOf[x.decorCode]]),
      // Bazinė kaina — iš lentelės pagal dekoro grupę (kaip originalas: pagal kodo prefiksą)
      basePrice: (n, decorCode) => {
        const g = decorGroupOf[decorCode];
        const p = price[code + '|' + n + '|' + g];
        return p === undefined ? undefined : p;
      },
      note: n => notes[n],
      extrasKey: f.extrasKey,
      glassKey: f.glassKey,
      slidingSingle: !!f.slidingSingle,
      slidingDouble: !!f.slidingDouble,
    }, rules);
    if (f.tier != null) fam.tier = f.tier;
    if (f.isPanel) fam.isPanel = true;
    FAMILIES[code] = fam;
  });

  // ---- rankenos
  const HANDLE_FAMILIES = [];
  const finishesBy = groupBy(B.handleFinishes, 'handleCode');
  B.handles.slice().sort(bySort).forEach(h => {
    HANDLE_FAMILIES.push({
      key: h.code, name: h.name, hasLR: !!h.hasLeftRight, plateSystem: h.plateSystem,
      finishes: (finishesBy[h.code] || []).map(x => {
        const row = [x.code, x.name, x.price];
        if (h.plateSystem === 'triple') row.push({ key: x.plateKeyPrice, cyl: x.plateCylPrice, wc: x.plateWcPrice });
        else if (h.plateSystem === 'dual') row.push({ keyOrCyl: x.plateKeyOrCylPrice, wc: x.plateWcPrice });
        return row;
      }),
    });
  });

  Object.assign(globalThis, { LINES, DECOR, FAMILIES, HANDLE_FAMILIES, glassOptionsFor });
  globalThis.__CATALOG_INFO = { manufacturer: B.manufacturer, catalogVersion: B.catalogVersion };
})();
