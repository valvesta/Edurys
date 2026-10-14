'use strict';
/* ==========================================================================
   Duomenų bazės sluoksnis.

   VIENINTELIS būdas programai pasiekti duomenis — callProcedure().
   - Leidžiamos tik api.* procedūros (tikrinama pavadinimo šablonu; be to,
     DB rolė app_api ir taip neturi jokių kitų teisių).
   - Visi parametrai perduodami kaip tipizuoti SQL parametrai — jokio
     SQL teksto sujungimo, todėl SQL injekcija neįmanoma.
   - Prisijungimas per Azure Managed Identity — slaptažodžio nėra.
   ========================================================================== */
const sql = require('mssql');
const config = require('./config');

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool({
      server: config.db.server,
      database: config.db.database,
      authentication: { type: 'azure-active-directory-default', options: {} },
      options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
      pool: { max: 20, min: 0, idleTimeoutMillis: 30000 },
      requestTimeout: 30000,
    });
    poolPromise = pool.connect().catch(e => { poolPromise = null; throw e; });
  }
  return poolPromise;
}

const PROC_NAME = /^api\.[A-Z][A-Za-z]+_[A-Z][A-Za-z]+$/;

/* Parametrai: { Pavadinimas: [sql.Tipas, reikšmė] }.
   Tipas privalomas — kad niekas nebūtų „atspėta" neteisingai (pvz. pinigai). */
async function callProcedure(name, params = {}) {
  if (!PROC_NAME.test(name)) throw new Error(`Neleistinas procedūros pavadinimas: ${name}`);
  const pool = await getPool();
  const request = pool.request();
  for (const [key, spec] of Object.entries(params)) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw new Error(`Neleistinas parametro pavadinimas: ${key}`);
    if (!Array.isArray(spec) || spec.length !== 2) throw new Error(`Parametrui ${key} būtina nurodyti [tipas, reikšmė]`);
    const [type, value] = spec;
    request.input(key, type, value === undefined ? null : value);
  }
  return request.execute(name);
}

/* SQL klaidų kodai (51001–51007) -> HTTP atsakymai. Kitos klaidos
   naudotojui rodomos kaip bendra „vidinė klaida" (be detalių). */
const SQL_TO_HTTP = { 51001: 403, 51002: 404, 51003: 409, 51004: 400, 51005: 409, 51006: 409, 51007: 429 };

function toHttpError(err) {
  const status = err && SQL_TO_HTTP[err.number];
  if (status) return { status, code: err.number, message: err.message };
  return null;
}

module.exports = { sql, callProcedure, toHttpError, getPool };
