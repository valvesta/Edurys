#!/usr/bin/env node
/* Paskelbto gamintojo katalogo eksportas iš DB į failą (admin.Catalog_ExportVersion).
   Naudojimas: node db/tools/export-catalog.js <GAMINTOJO_KODAS> <failas.json> */
'use strict';
const fs = require('fs');
const { connect, sql } = require('./lib/connect');

async function main() {
  const [code, out] = process.argv.slice(2);
  if (!code || !out) throw new Error('Naudojimas: export-catalog.js <GAMINTOJO_KODAS> <failas.json>');
  const pool = await connect();
  try {
    const v = await pool.request().input('c', sql.VarChar(50), code).query(
      "SELECT cv.CatalogVersionId FROM catalog.CatalogVersion cv JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId WHERE m.Code = @c AND cv.Status = 'PUBLISHED'");
    if (!v.recordset.length) throw new Error(`Gamintojas ${code} neturi paskelbtos versijos.`);
    const r = await pool.request().input('CatalogVersionId', sql.Int, v.recordset[0].CatalogVersionId).execute('admin.Catalog_ExportVersion');
    fs.writeFileSync(out, r.recordset[0].BundleJson, 'utf8');
    console.log(`Išeksportuota: ${out} (${r.recordset[0].BundleJson.length} simb.)`);
  } finally { await pool.close(); }
}
main().catch(e => { console.error('KLAIDA: ' + e.message); process.exit(1); });
