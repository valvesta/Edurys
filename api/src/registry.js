'use strict';
/* ==========================================================================
   Pagalba pildant įmonės duomenis iš viešų registrų (tik skaitymas).

   - Juridinių asmenų registras (Registrų centras, data.gov.lt atviri
     duomenys): pagal įmonės kodą — tikslus pavadinimas, registracijos ir
     išregistravimo datos. Atsako per < 1 s.
   - VIES (Europos Komisija): ar PVM mokėtojo kodas galioja ir kam jis
     išduotas. Lietuva VIES adreso neteikia.

   Patikrinta 2026-10-15 (tools/registras-patikra.js): paieška pagal
   pavadinimo dalį, VMI ir buveinių duomenys pagal kodą per atvirų duomenų
   sąsają neatsako per 30–90 s, todėl jie nenaudojami.

   Duomenys tik pasiūlomi — administratorius juos mato ir patvirtina.
   ========================================================================== */
const JAR_URL = 'https://get.data.gov.lt/datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo';
const VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/LT/vat/';
const TIMEOUT_MS = 10000;
const CACHE_MS = 60 * 60 * 1000;

const cache = new Map();   // raktas -> { at, value }
function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.value);
  return fn().then(value => {
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), value });
    return value;
  });
}

function unavailable(what, e) {
  const err = new Error(`${what} šiuo metu nepasiekiamas — duomenis įveskite rankomis.`);
  err.status = 502;
  err.cause = e;
  return err;
}

async function getJson(url, what, fetchImpl) {
  let r;
  try {
    r = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'durys-uzsakymai/1.0' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) { throw unavailable(what, e); }
  if (!r.ok) throw unavailable(what, new Error('HTTP ' + r.status));
  try { return await r.json(); } catch (e) { throw unavailable(what, e); }
}

/* Įmonė pagal kodą (9 skaitmenys). Grąžina null, jei registre nerasta. */
function lookupCompany(code, fetchImpl = fetch) {
  if (!/^\d{9}$/.test(code)) { const e = new Error('Įmonės kodas — 9 skaitmenys.'); e.status = 400; throw e; }
  return cached('jar:' + code, async () => {
    const data = await getJson(`${JAR_URL}?ja_kodas=${code}`, 'Juridinių asmenų registras', fetchImpl);
    const rows = Array.isArray(data && data._data) ? data._data : [];
    const row = rows.find(x => String(x.ja_kodas) === code);
    if (!row) return null;
    return {
      companyCode: code,
      name: typeof row.ja_pavadinimas === 'string' ? row.ja_pavadinimas.trim() : null,
      address: typeof row.pilnas_adresas === 'string' ? row.pilnas_adresas.trim() : null,
      registeredOn: row.reg_data || null,
      deregisteredOn: row.isreg_data || null,
      source: 'Juridinių asmenų registras (data.gov.lt)',
    };
  });
}

/* PVM kodas: „LT123456789“ arba „123456789“ (9 arba 12 skaitmenų). */
function checkVat(input, fetchImpl = fetch) {
  const v = String(input || '').toUpperCase().replace(/\s+/g, '').replace(/^LT/, '');
  if (!/^(\d{9}|\d{12})$/.test(v)) { const e = new Error('PVM kodas — LT ir 9 arba 12 skaitmenų.'); e.status = 400; throw e; }
  return cached('vies:' + v, async () => {
    const data = await getJson(VIES_URL + v, 'VIES (ES PVM kodų sistema)', fetchImpl);
    if (data.userError && !['VALID', 'INVALID'].includes(data.userError)) {
      throw unavailable('VIES (ES PVM kodų sistema)', new Error(data.userError));
    }
    const clean = s => (typeof s === 'string' && s.trim() && !/^(---|N\/A)$/.test(s.trim()) ? s.trim() : null);
    return { vatCode: 'LT' + v, valid: data.isValid === true, name: clean(data.name), address: clean(data.address), source: 'VIES' };
  });
}

module.exports = { lookupCompany, checkVat };
