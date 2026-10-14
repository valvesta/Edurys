'use strict';
/* ==========================================================================
   ERKADO kainų variklis serveryje.

   createRuntime(bundle) — sukuria izoliuotą VM kontekstą:
     1. bootstrap.js — katalogas iš DB paketo;
     2. helpers.js   — pagalbinės funkcijos (pažodžiui iš data.js);
     3. engine.js    — TAS PATS variklis, kuris veikia naršyklėje.
   priceLine() grąžina sąskaitos eilutes (invoiceRowsForItem) — būtent iš jų
   duomenų bazė apskaičiuoja eilutės sumą.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DIR = __dirname;
const SOURCES = ['bootstrap.js', 'helpers.js', 'engine.js'].map(f => ({
  file: f, code: fs.readFileSync(path.join(DIR, f), 'utf8'),
}));
const ENGINE_VERSION = 'erkado-' + crypto.createHash('sha256')
  .update(SOURCES.map(s => s.code).join('\n'), 'utf8').digest('hex').slice(0, 12);

function createRuntime(bundle) {
  const ctx = vm.createContext({ __BUNDLE_JSON: JSON.stringify(bundle) });
  SOURCES.forEach(s => vm.runInContext(s.code, ctx, { filename: s.file }));
  const run = name => vm.runInContext(name, ctx);
  const configureDoor = run('configureDoor');
  const priceDoor = run('priceDoor');
  const invoiceRowsForItem = run('invoiceRowsForItem');
  const describeSelections = run('describeSelections');
  const decorOptName = run('decorOptName');
  const FAMILIES = run('FAMILIES');

  /* Vienos eilutės kaina. Pasirinkimai perleidžiami per configureDoor tol,
     kol nusistovi (taip pat daro naršyklė po kiekvieno pakeitimo). */
  function priceLine({ familyKey, modelNo, selections, quantity }, lineIndex) {
    if (typeof familyKey !== 'string' || !Object.prototype.hasOwnProperty.call(FAMILIES, familyKey)) {
      throw userError(`Nežinoma šeima: ${familyKey}`);
    }
    if (!Number.isInteger(modelNo)) throw userError('Neteisingas modelio numeris.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw userError('Kiekis turi būti nuo 1 iki 1000.');
    if (!selections || typeof selections !== 'object' || Array.isArray(selections)) throw userError('Neteisingi pasirinkimai.');

    // Tik paprastos reikšmės (tekstas, skaičius, null) — jokių objektų ar funkcijų
    const clean = {};
    for (const [k, v] of Object.entries(selections)) {
      if (!/^[A-Z][A-Z0-9_]{0,40}$/.test(k)) throw userError(`Neteisingas pasirinkimo raktas: ${k}`);
      if (v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) {
        if (typeof v === 'string' && v.length > 100) throw userError(`Per ilga reikšmė: ${k}`);
        clean[k] = v;
      } else throw userError(`Neteisinga reikšmė: ${k}`);
    }

    let cfg = configureDoor(familyKey, modelNo, JSON.parse(JSON.stringify(clean)));
    for (let i = 0; i < 5; i++) {
      const next = configureDoor(familyKey, modelNo, cfg.selections);
      const stable = JSON.stringify(next.selections) === JSON.stringify(cfg.selections);
      cfg = next;
      if (stable) break;
    }
    const price = priceDoor(cfg);
    if (!price.valid) {
      const why = [].concat(price.errors || [], (price.missing || []).map(m => `Nepasirinkta: ${m}`));
      throw userError(`Eilutė ${lineIndex}: konfigūracija negalima — ${why.join('; ')}`);
    }
    const s = cfg.selections;
    const item = {
      familyKey, familyLabel: cfg.family.label, modelNo, line: cfg.family.line,
      selections: s, qty: quantity,
      baseNet: price.baseNet,
      priceAdjustments: price.adjustments.map(a => ({ ...a })),
      staktaDecorName: s.STAKTA_DECOR ? decorOptName(cfg, s.STAKTA_DECOR) : null,
    };
    const rows = invoiceRowsForItem(item, lineIndex);
    return {
      familyCode: familyKey,
      modelNo,
      quantity,
      description: `${cfg.family.label} ${modelNo}` +
        (s.WIDTH ? `, plotis ${s.WIDTH}` : '') +
        (s.DECOR ? `, ${decorOptName(cfg, s.DECOR)}` : ''),
      engineVersion: ENGINE_VERSION,
      configuration: {
        familyKey, modelNo, quantity,
        selections: JSON.parse(JSON.stringify(s)),
        messages: cfg.messages,
        summary: JSON.parse(JSON.stringify(describeSelections(cfg))),
        unitNet: price.unitNet,
      },
      priceBreakdown: JSON.parse(JSON.stringify(rows)),
    };
  }

  return { priceLine, engineVersion: ENGINE_VERSION, context: ctx };
}

function userError(msg) { const e = new Error(msg); e.status = 400; return e; }

module.exports = { createRuntime, ENGINE_VERSION };
