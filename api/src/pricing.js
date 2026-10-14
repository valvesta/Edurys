'use strict';
/* ==========================================================================
   Kainų skaičiavimas SERVERYJE.

   Tikslas: tas pats engine.js, kuris dabar veikia naršyklėje, paleidžiamas
   serveryje izoliuotame kontekste, o katalogo duomenys (FAMILIES, GLASS_SETS,
   staktų lentelės ir kt.) atkuriami iš duomenų bazės (api.Catalog_GetVersion).
   Rezultatas — kainos išskaidymo eilutės (invoiceRowsForItem), kurias
   api.Order_SaveLines susumuoja ir įrašo.

   BŪSENA: dar neįgyvendinta (kitas etapas). Kol kas eilučių išsaugojimas
   per API grąžina 501 — kad niekas netyčia neįrašytų naršyklėje
   apskaičiuotų (nepatikrintų) kainų.

   Priėmimo kriterijus kitam etapui: automatinis testas, kuris tūkstančiams
   atsitiktinių konfigūracijų palygina serverio kainą (iš DB) su originalaus
   konfigūratoriaus kaina (iš data.js) — turi sutapti iki cento.
   ========================================================================== */

async function priceLines(/* catalogVersionId, lines */) {
  const e = new Error('Kainų skaičiavimas serveryje dar neįgyvendintas (kitas etapas).');
  e.status = 501;
  throw e;
}

module.exports = { priceLines };
