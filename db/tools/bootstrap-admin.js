#!/usr/bin/env node
/* ==========================================================================
   Pirmasis globalus administratorius. Jei jau yra — nieko nedaro.
   Aplinkos kintamieji: BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_OID, BOOTSTRAP_TENANT_ID
   (oid ir tenant — iš `az ad signed-in-user show` / `az account show`).
   ========================================================================== */
'use strict';
const { connect, sql } = require('./lib/connect');

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const oid = process.env.BOOTSTRAP_ADMIN_OID;
  const tenant = process.env.BOOTSTRAP_TENANT_ID;
  if (!email || !oid || !tenant) { console.log('Pirmojo administratoriaus duomenys nenurodyti — praleidžiama.'); return; }
  const pool = await connect();
  try {
    await pool.request()
      .input('Email', sql.NVarChar(320), email)
      .input('DisplayName', sql.NVarChar(200), email.split('@')[0])
      .input('Issuer', sql.NVarChar(400), `https://login.microsoftonline.com/${tenant}/v2.0`)
      .input('Subject', sql.NVarChar(200), oid)
      .execute('admin.Bootstrap_GlobalAdmin');
    console.log(`Sukurtas globalus administratorius: ${email}`);
  } catch (e) {
    if (e.number === 51003) { console.log('Globalus administratorius jau yra — nieko nekeista.'); return; }
    throw e;
  } finally { await pool.close(); }
}
main().catch(e => { console.error('KLAIDA: ' + e.message); process.exit(1); });
