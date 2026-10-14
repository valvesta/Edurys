#!/usr/bin/env node
/* ==========================================================================
   Katalogo paketo importas į duomenų bazę (per admin.Catalog_ImportVersion),
   iškart po to — eksportas ir palyginimas su originaliu konfigūratoriumi.
   Jei bent viena reikšmė nesutampa, juodraštis IŠTRINAMAS ir skriptas
   baigiasi klaida. Paskelbiama tik su --publish ir tik jei patikra praėjo.

   Naudojimas:
     node db/tools/import-catalog.js <paketas.json> [--publish] [--if-missing] [--source <aplankas>]
     --if-missing: jei ta versija jau yra ir turinys sutampa — nieko nedaro
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { connect, sql } = require('./lib/connect');
const { verify } = require('./verify-catalog');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
}

async function main() {
  const bundlePath = path.resolve(process.argv[2] || path.join(__dirname, '../catalog/erkado-2026-I.bundle.json'));
  const srcDir = path.resolve(arg('--source', path.join(__dirname, '../../catalog-sources/erkado/2026-I')));
  const publish = process.argv.includes('--publish');
  const importedBy = process.env.IMPORTED_BY || process.env.GITHUB_ACTOR || require('os').userInfo().username;

  const text = fs.readFileSync(bundlePath, 'utf8');
  const sha = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  const bundle = JSON.parse(text);

  // 1) Paketas turi atitikti originalą dar PRIEŠ įkeliant
  const pre = verify(bundle, srcDir);
  if (pre.errors.length) {
    pre.errors.forEach(e => console.error('  - ' + e));
    throw new Error('Paketas neatitinka originalaus konfigūratoriaus — importas nutrauktas.');
  }
  console.log(`Paketas patikrintas: ${pre.checkedPrices} kainų, ${pre.checkedGlass} stiklo variantų.`);

  const pool = await connect();
  let versionId;
  try {
    if (process.argv.includes('--if-missing')) {
      const f = await pool.request()
        .input('ManufacturerCode', sql.VarChar(50), bundle.manufacturer.code)
        .input('VersionCode', sql.VarChar(50), bundle.catalogVersion.code)
        .execute('admin.Catalog_FindVersion');
      const ex = f.recordset[0];
      if (ex) {
        if (ex.BundleSha256 !== sha) {
          throw new Error(`Versija ${bundle.catalogVersion.code} jau importuota, bet su KITU turiniu (SHA nesutampa). ` +
            'Paskelbto katalogo keisti negalima — pakeistam katalogui suteikite naują versijos kodą.');
        }
        if (publish && ex.Status === 'DRAFT') throw new Error(`Versija ${bundle.catalogVersion.code} yra juodraštis — patikrinkite ir paskelbkite rankiniu būdu.`);
        console.log(`Versija ${bundle.catalogVersion.code} jau yra (${ex.Status}), turinys sutampa — nieko nekeista.`);
        return;
      }
    }
    const r = await pool.request()
      .input('BundleJson', sql.NVarChar(sql.MAX), text)
      .input('ImportedBy', sql.NVarChar(200), importedBy)
      .input('BundleSha256', sql.Char(64), sha)
      .execute('admin.Catalog_ImportVersion');
    versionId = r.recordset[0].CatalogVersionId;
    console.log(`Importuota kaip juodraštis, CatalogVersionId = ${versionId}.`);

    // 2) Kas įrašyta į DB, turi tiksliai atitikti originalą
    const ex = await pool.request().input('CatalogVersionId', sql.Int, versionId).execute('admin.Catalog_ExportVersion');
    const exported = JSON.parse(ex.recordset[0].BundleJson);
    const post = verify(exported, srcDir);
    if (post.errors.length) {
      post.errors.forEach(e => console.error('  - ' + e));
      await pool.request().input('CatalogVersionId', sql.Int, versionId).execute('admin.Catalog_DeleteDraft');
      throw new Error('Duomenų bazėje įrašyti duomenys neatitinka originalo — juodraštis ištrintas.');
    }
    console.log(`DB turinys patikrintas: ${post.checkedPrices} kainų, ${post.checkedGlass} stiklo variantų — sutampa.`);

    if (publish) {
      await pool.request().input('CatalogVersionId', sql.Int, versionId)
        .input('PublishedBy', sql.NVarChar(200), importedBy).execute('admin.Catalog_Publish');
      console.log('Versija paskelbta.');
    } else {
      console.log('Versija palikta juodraščiu. Paskelbimui paleiskite su --publish.');
    }
  } finally {
    await pool.close();
  }
}

main().catch(e => { console.error('KLAIDA: ' + e.message); process.exit(1); });
