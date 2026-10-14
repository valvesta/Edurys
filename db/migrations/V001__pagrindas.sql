/* ==========================================================================
   V001 — Pagrindas: schemos ir duomenų bazės rolės.

   Schemos:
     iam      — naudotojai, rolės, prisijungimai, kvietimai
     org      — įmonės ir jų prisijungimo užklausos
     catalog  — gamintojai, katalogų versijos, kainos
     sales    — užsakymai, eilutės, statusų istorija
     notify   — siunčiamų laiškų eilė (outbox)
     audit    — veiksmų žurnalas
     api      — procedūros, kurias kviečia programa (VIENINTELIS jos priėjimas)
     admin    — procedūros diegimui/priežiūrai (katalogų importas ir pan.)

   Saugumo principas:
     Programos tapatybė (Azure Managed Identity) įtraukiama TIK į rolę app_api,
     kuri turi vienintelę teisę — EXECUTE schemai api. Tiesioginių SELECT /
     INSERT / UPDATE / DELETE į lenteles ji neturi ir negali turėti.
     Procedūros pasiekia lenteles per „ownership chaining" (visų objektų
     savininkas dbo), todėl atskirų teisių lentelėms nereikia.
     SVARBU: procedūrose nenaudojamas dinaminis SQL — jis nutrauktų
     ownership chaining ir atvertų SQL injekcijos riziką.
   ========================================================================== */

CREATE SCHEMA iam AUTHORIZATION dbo;
GO
CREATE SCHEMA org AUTHORIZATION dbo;
GO
CREATE SCHEMA catalog AUTHORIZATION dbo;
GO
CREATE SCHEMA sales AUTHORIZATION dbo;
GO
CREATE SCHEMA notify AUTHORIZATION dbo;
GO
CREATE SCHEMA audit AUTHORIZATION dbo;
GO
CREATE SCHEMA api AUTHORIZATION dbo;
GO
CREATE SCHEMA admin AUTHORIZATION dbo;
GO

/* Programos rolė: tik procedūrų vykdymas api schemoje. */
CREATE ROLE app_api AUTHORIZATION dbo;
GO
GRANT EXECUTE ON SCHEMA::api TO app_api;
GO
/* Aiškus draudimas tiesiogiai liesti duomenis. DENY nepaveikia procedūrų
   (ownership chaining teisių netikrina), bet užtikrina, kad net per klaidą
   suteikus platesnes teises (pvz. db_datareader), lentelės liktų uždarytos. */
DENY SELECT, INSERT, UPDATE, DELETE, ALTER, CONTROL ON SCHEMA::iam     TO app_api;
DENY SELECT, INSERT, UPDATE, DELETE, ALTER, CONTROL ON SCHEMA::org     TO app_api;
DENY SELECT, INSERT, UPDATE, DELETE, ALTER, CONTROL ON SCHEMA::catalog TO app_api;
DENY SELECT, INSERT, UPDATE, DELETE, ALTER, CONTROL ON SCHEMA::sales   TO app_api;
DENY SELECT, INSERT, UPDATE, DELETE, ALTER, CONTROL ON SCHEMA::notify  TO app_api;
DENY SELECT, INSERT, UPDATE, DELETE, ALTER, CONTROL ON SCHEMA::audit   TO app_api;
DENY EXECUTE ON SCHEMA::admin TO app_api;
GO

/* Priežiūros rolė: katalogų importas, pirmojo administratoriaus sukūrimas.
   Į ją įtraukiama diegimo tapatybė (GitHub Actions per OIDC) arba DBA. */
CREATE ROLE app_admin_tools AUTHORIZATION dbo;
GO
GRANT EXECUTE ON SCHEMA::admin TO app_admin_tools;
GO

/* Ataskaitų rolė (ateičiai, pvz. Power BI): tik skaitymas per api procedūras
   arba atskiras peržiūras. Kol kas teisių nesuteikiama. */
CREATE ROLE app_reporting AUTHORIZATION dbo;
GO
