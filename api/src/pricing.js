'use strict';
/* ==========================================================================
   Kainų skaičiavimas SERVERYJE.

   - Katalogas imamas iš DB (api.Catalog_GetVersion) ir pagal gamintoją
     parenkamas jo variklis (ERKADO -> engines/erkado).
   - Katalogo versijos po paskelbimo nekeičiamos, todėl atkurtą variklį
     saugu laikyti atmintyje (raktas — CatalogVersionId).
   - Naršyklė siunčia tik pasirinkimus; kainos, priedai ir sąskaitos
     eilutės apskaičiuojami čia. Duomenų bazė iš tų eilučių susumuoja
     eilutės sumą ir PVM.

   Tikslumą užtikrina api/test/pricing-parity.test.js: serverio rezultatas
   lyginamas su originaliu konfigūratoriumi dešimtims tūkstančių konfigūracijų.
   ========================================================================== */
const { sql, callProcedure } = require('./db');

const ENGINES = {
  ERKADO: require('./engines/erkado/runtime'),
};

const runtimes = new Map();   // CatalogVersionId -> Promise<runtime>
const MAX_CACHED = 20;

function getRuntime(actorUserId, catalogVersionId) {
  if (!runtimes.has(catalogVersionId)) {
    if (runtimes.size >= MAX_CACHED) runtimes.delete(runtimes.keys().next().value);
    const p = (async () => {
      const r = await callProcedure('api.Catalog_GetVersion', {
        ActorUserId: [sql.Int, actorUserId],
        CatalogVersionId: [sql.Int, catalogVersionId],
      });
      const bundle = JSON.parse(r.recordset[0].BundleJson);
      const engine = ENGINES[bundle.manufacturer && bundle.manufacturer.code];
      if (!engine) throw new Error(`Gamintojui ${bundle.manufacturer && bundle.manufacturer.code} kainų variklio nėra.`);
      return engine.createRuntime(bundle);
    })();
    p.catch(() => runtimes.delete(catalogVersionId));
    runtimes.set(catalogVersionId, p);
  }
  return runtimes.get(catalogVersionId);
}

function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }

/* lines: [{ familyKey, modelNo, quantity, selections }]
   Grąžina masyvą, tinkamą api.Order_SaveLines (@LinesJson). */
async function priceLines(actorUserId, catalogVersionId, lines) {
  if (!Array.isArray(lines)) throw badRequest('Eilutės turi būti masyvas.');
  if (lines.length > 200) throw badRequest('Užsakyme gali būti ne daugiau kaip 200 eilučių.');
  const rt = await getRuntime(actorUserId, catalogVersionId);
  return lines.map((l, i) => {
    if (!l || typeof l !== 'object') throw badRequest(`Eilutė ${i + 1}: neteisingi duomenys.`);
    return rt.priceLine({
      familyKey: l.familyKey,
      modelNo: Number(l.modelNo),
      quantity: Number(l.quantity),
      selections: l.selections,
    }, i + 1);
  });
}

module.exports = { priceLines, getRuntime };
