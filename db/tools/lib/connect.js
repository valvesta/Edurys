'use strict';
/* Prisijungimas prie SQL Server / Azure SQL diegimo įrankiams.

   Aplinkos kintamieji:
     DB_SERVER    — pvz. durys-sql-dev.database.windows.net arba localhost
     DB_NAME      — duomenų bazės pavadinimas
     DB_AUTH      — "entra" (numatyta; Azure: Managed Identity / az login / GitHub OIDC)
                    arba "sql" (TIK vietiniam/CI SQL Server konteineriui)
     DB_USER, DB_PASSWORD — tik kai DB_AUTH=sql
     DB_TRUST_CERT — "1" tik vietiniam konteineriui su savo pasirašytu sertifikatu
*/
const sql = require('mssql');

function configFromEnv() {
  const server = required('DB_SERVER');
  const database = required('DB_NAME');
  const auth = (process.env.DB_AUTH || 'entra').toLowerCase();
  const base = {
    server,
    database,
    options: {
      encrypt: true,
      trustServerCertificate: process.env.DB_TRUST_CERT === '1',
      enableArithAbort: true,
    },
    pool: { max: 4, min: 0 },
    requestTimeout: 300000,
  };
  if (auth === 'sql') {
    if (/database\.windows\.net$/i.test(server)) {
      throw new Error('SQL slaptažodžių prisijungimas prie Azure SQL nenaudojamas — naudokite DB_AUTH=entra.');
    }
    return { ...base, user: required('DB_USER'), password: required('DB_PASSWORD') };
  }
  if (auth === 'entra') {
    return { ...base, authentication: { type: 'azure-active-directory-default', options: {} } };
  }
  throw new Error(`Nežinomas DB_AUTH: ${auth}`);
}

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Nenurodytas aplinkos kintamasis ${name}`);
  return v;
}

async function connect() {
  const pool = new sql.ConnectionPool(configFromEnv());
  await pool.connect();
  return pool;
}

module.exports = { connect, sql };
