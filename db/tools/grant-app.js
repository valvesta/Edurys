#!/usr/bin/env node
/* ==========================================================================
   Programos tapatybės (App Service Managed Identity) įtraukimas į rolę app_api.
   DB naudotojas turi būti jau sukurtas (CREATE USER ... FROM EXTERNAL PROVIDER —
   tai daro infra/azure-dev.sh). Kartojant — nieko nekeičia.

   Naudojimas: node db/tools/grant-app.js <app-service-pavadinimas>
   ========================================================================== */
'use strict';
const { connect, sql } = require('./lib/connect');

async function main() {
  const name = process.argv[2];
  if (!name || !/^[A-Za-z0-9-]{2,60}$/.test(name)) throw new Error('Nurodykite App Service pavadinimą (raidės, skaitmenys, brūkšneliai).');
  const pool = await connect();
  try {
    const u = await pool.request().input('n', sql.NVarChar(128), name)
      .query("SELECT principal_id FROM sys.database_principals WHERE name = @n AND type IN ('E','X')");
    if (!u.recordset.length) throw new Error(`DB naudotojo [${name}] nėra. Paleiskite infra/azure-dev.sh (jis jį sukuria).`);
    // Pavadinimas patikrintas reguliariąja išraiška aukščiau, todėl saugu įterpti į identifikatorių
    await pool.request().batch(`
      IF NOT EXISTS (SELECT 1 FROM sys.database_role_members rm
                     JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id
                     JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id
                     WHERE r.name = 'app_api' AND m.name = N'${name}')
        ALTER ROLE app_api ADD MEMBER [${name}];`);
    // Saugiklis: programos tapatybė neturi būti jokioje kitoje rolėje
    const roles = await pool.request().input('n', sql.NVarChar(128), name).query(`
      SELECT r.name FROM sys.database_role_members rm
      JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id
      JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id
      WHERE m.name = @n`);
    const list = roles.recordset.map(r => r.name);
    if (list.length !== 1 || list[0] !== 'app_api') {
      throw new Error(`Programos tapatybė turi per daug teisių: ${list.join(', ')}. Turi būti tik app_api.`);
    }
    console.log(`[${name}] — rolė app_api (vienintelė).`);
  } finally { await pool.close(); }
}
main().catch(e => { console.error('KLAIDA: ' + e.message); process.exit(1); });
