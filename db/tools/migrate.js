#!/usr/bin/env node
/* ==========================================================================
   Migracijų paleidiklis.

   - Migracijos vykdomos pagal failo pavadinimo tvarką (V001, V002, ...).
   - Kiekviena migracija — atskira transakcija: jei bent viena dalis
     nepavyksta, NIEKAS iš tos migracijos neįrašoma.
   - Įvykdytos migracijos registruojamos dbo.SchemaMigrations su SHA-256.
     Jei jau įvykdytas failas buvo pakeistas — paleidiklis SUSTOJA.
     Įvykdytų migracijų niekada nekeičiame: pakeitimams rašoma nauja migracija.

   Naudojimas:  node db/tools/migrate.js [--dry-run]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { connect, sql } = require('./lib/connect');

const DIR = path.join(__dirname, '..', 'migrations');
const DRY = process.argv.includes('--dry-run');

function splitBatches(text) {
  return text.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(b => b.length > 0);
}

async function main() {
  const files = fs.readdirSync(DIR).filter(f => /^V\d{3}__.+\.sql$/.test(f)).sort();
  const versions = files.map(f => f.slice(0, 4));
  if (new Set(versions).size !== versions.length) throw new Error('Pasikartojantys migracijų numeriai.');

  const pool = await connect();
  try {
    await pool.request().batch(`
      IF OBJECT_ID('dbo.SchemaMigrations') IS NULL
      CREATE TABLE dbo.SchemaMigrations (
        Version   char(4)        NOT NULL PRIMARY KEY,
        FileName  nvarchar(200)  NOT NULL,
        Sha256    char(64)       NOT NULL,
        AppliedAt datetime2(3)   NOT NULL DEFAULT (SYSUTCDATETIME()),
        AppliedBy nvarchar(200)  NOT NULL DEFAULT (ORIGINAL_LOGIN())
      );`);

    const applied = new Map((await pool.request().query('SELECT Version, FileName, Sha256 FROM dbo.SchemaMigrations'))
      .recordset.map(r => [r.Version, r]));

    for (const file of files) {
      const text = fs.readFileSync(path.join(DIR, file), 'utf8');
      const sha = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
      const version = file.slice(0, 4);
      const prev = applied.get(version);
      if (prev) {
        if (prev.Sha256 !== sha) {
          throw new Error(`Migracija ${file} jau įvykdyta, bet failas pakeistas (SHA nesutampa). ` +
            'Įvykdytų migracijų keisti negalima — sukurkite naują migraciją.');
        }
        console.log(`  = ${file} (jau įvykdyta)`);
        continue;
      }
      if (DRY) { console.log(`  ? ${file} (būtų įvykdyta)`); continue; }

      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        const batches = splitBatches(text);
        for (let i = 0; i < batches.length; i++) {
          try {
            await new sql.Request(tx).batch(batches[i]);
          } catch (e) {
            const head = batches[i].split('\n').slice(0, 3).join(' ').slice(0, 200);
            throw new Error(`${file}, dalis ${i + 1}/${batches.length}: ${e.message}\n    ${head}`);
          }
        }
        await new sql.Request(tx)
          .input('v', sql.Char(4), version).input('f', sql.NVarChar(200), file).input('s', sql.Char(64), sha)
          .query('INSERT INTO dbo.SchemaMigrations (Version, FileName, Sha256) VALUES (@v, @f, @s)');
        await tx.commit();
        console.log(`  + ${file}`);
      } catch (e) {
        try { await tx.rollback(); } catch (_) { /* jau atšaukta */ }
        throw e;
      }
    }
    console.log('Migracijos baigtos.');
  } finally {
    await pool.close();
  }
}

main().catch(e => { console.error('KLAIDA: ' + e.message); process.exit(1); });
