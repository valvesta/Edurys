/* ==========================================================================
   Pilnas scenarijus prieš tikrą SQL Server (CI — Docker konteineris).
   Viskas daroma TIK per procedūras, kaip tai darys programa.

   Paleidimas (po migracijų ir katalogo importo su --publish):
     node --test db/tests/*.test.js
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { connect, sql } = require('../tools/lib/connect');

const ISS_STAFF = 'https://login.microsoftonline.com/00000000-0000-0000-0000-000000000001/v2.0';
const ISS_EXT = 'https://00000000-0000-0000-0000-000000000002.ciamlogin.com/00000000-0000-0000-0000-000000000002/v2.0';
const RUN = crypto.randomBytes(3).toString('hex');   // kad testą būtų galima kartoti toje pačioje DB

let pool;
const tokenHash = t => crypto.createHash('sha256').update(t, 'utf8').digest();
const inDays = d => new Date(Date.now() + d * 86400000);

async function exec(proc, params = {}) {
  const r = pool.request();
  for (const [k, v] of Object.entries(params)) {
    if (Buffer.isBuffer(v)) r.input(k, sql.Binary(32), v);
    else if (v instanceof Date) r.input(k, sql.DateTime2(3), v);
    else if (typeof v === 'string' && v.length > 4000) r.input(k, sql.NVarChar(sql.MAX), v);
    else r.input(k, v);
  }
  return r.execute(proc);
}
async function expectSqlError(promise, number) {
  try { await promise; } catch (e) {
    assert.equal(e.number, number, `tikėtasi klaidos ${number}, gauta ${e.number}: ${e.message}`);
    return e;
  }
  assert.fail(`tikėtasi klaidos ${number}, bet procedūra pavyko`);
}

const S = {};   // būsena tarp žingsnių

test.before(async () => { pool = await connect(); });
test.after(async () => { await pool.close(); });

test('1. pirmasis globalus administratorius (arba esamas)', async () => {
  const existing = await pool.request().query(
    "SELECT TOP 1 l.Issuer, l.Subject FROM iam.UserLogin l JOIN iam.[User] u ON u.UserId=l.UserId WHERE u.RoleCode='GLOBAL_ADMIN' AND u.Status='ACTIVE'");
  if (existing.recordset.length) {
    S.ga = existing.recordset[0];
  } else {
    S.ga = { Issuer: ISS_STAFF, Subject: 'ga-' + RUN };
    await exec('admin.Bootstrap_GlobalAdmin', { Email: `ga-${RUN}@jupoja.lt`, DisplayName: 'Globalus Admin', Issuer: S.ga.Issuer, Subject: S.ga.Subject });
  }
  await expectSqlError(exec('admin.Bootstrap_GlobalAdmin', { Email: `x-${RUN}@jupoja.lt`, DisplayName: 'X', Issuer: ISS_STAFF, Subject: 'x' + RUN }), 51003);
  const r = await exec('api.User_ResolveLogin', { Issuer: S.ga.Issuer, Subject: S.ga.Subject });
  assert.equal(r.recordset[0].LoginResult, 'OK');
  assert.equal(r.recordset[0].RoleCode, 'GLOBAL_ADMIN');
  S.gaId = r.recordset[0].UserId;
  const nl = await exec('api.User_ResolveLogin', { Issuer: ISS_EXT, Subject: 'nobody-' + RUN });
  assert.equal(nl.recordset[0].LoginResult, 'NOT_LINKED');
});

test('2. įmonės užklausa, dublikatas, patvirtinimas', async () => {
  S.companyCode = '30' + parseInt(RUN, 16).toString().padStart(7, '0');
  const r = await exec('api.AccessRequest_Submit', {
    CompanyName: 'UAB Testas ' + RUN, CompanyCode: S.companyCode, ContactName: 'Jonas Jonaitis',
    ContactEmail: `Jonas.${RUN}@Testas.lt`, SubmittedFromIp: '10.0.0.1' });
  S.reqId = r.recordset[0].AccessRequestId;
  await expectSqlError(exec('api.AccessRequest_Submit', {
    CompanyName: 'UAB Testas', CompanyCode: S.companyCode, ContactName: 'Kitas', ContactEmail: `k-${RUN}@t.lt` }), 51006);
  await expectSqlError(exec('api.AccessRequest_Submit', {
    CompanyName: 'UAB', CompanyCode: '1', ContactName: 'A', ContactEmail: 'blogas-adresas' }), 51004);

  S.repToken = 'tok-rep-' + RUN;
  const a = await exec('api.AccessRequest_Approve', {
    ActorUserId: S.gaId, AccessRequestId: S.reqId, TokenHash: tokenHash(S.repToken), ExpiresAt: inDays(7),
    InviteUrl: 'https://durys.example/kvietimas?t=' + S.repToken });
  S.companyId = a.recordset[0].CompanyId;
  S.repId = a.recordset[0].UserId;
  await expectSqlError(exec('api.AccessRequest_Approve', {
    ActorUserId: S.gaId, AccessRequestId: S.reqId, TokenHash: tokenHash('kitas' + RUN), ExpiresAt: inDays(7),
    InviteUrl: 'https://durys.example/k' }), 51003);
});

test('3. kvietimo priėmimas: kitas el. paštas atmetamas, teisingas priimamas, antrą kartą — ne', async () => {
  await expectSqlError(exec('api.Invitation_Accept', {
    TokenHash: tokenHash(S.repToken), Issuer: ISS_EXT, Subject: 'rep-' + RUN, Email: 'kitas@pastas.lt' }), 51001);
  const r = await exec('api.Invitation_Accept', {
    TokenHash: tokenHash(S.repToken), Issuer: ISS_EXT, Subject: 'rep-' + RUN, Email: `jonas.${RUN}@testas.lt`, DisplayName: 'Jonas' });
  assert.equal(r.recordset[0].LoginResult, 'OK');
  assert.equal(r.recordset[0].RoleCode, 'COMPANY_REP');
  await expectSqlError(exec('api.Invitation_Accept', {
    TokenHash: tokenHash(S.repToken), Issuer: ISS_EXT, Subject: 'rep2-' + RUN, Email: `jonas.${RUN}@testas.lt` }), 51004);
});

test('4. atstovas kviečia naudotoją; atstovas negali kviesti administratoriaus', async () => {
  await expectSqlError(exec('api.Invitation_Create', {
    ActorUserId: S.repId, Email: `adm-${RUN}@t.lt`, DisplayName: 'X', RoleCode: 'ADMIN',
    TokenHash: tokenHash('a' + RUN), ExpiresAt: inDays(7), InviteUrl: 'https://durys.example/k' }), 51001);
  const t = 'tok-user-' + RUN;
  const r = await exec('api.Invitation_Create', {
    ActorUserId: S.repId, Email: `petras.${RUN}@testas.lt`, DisplayName: 'Petras', RoleCode: 'USER',
    CompanyId: 999999 /* ignoruojama — atstovas kviečia tik į savo įmonę */,
    TokenHash: tokenHash(t), ExpiresAt: inDays(7), InviteUrl: 'https://durys.example/k?t=' + t });
  S.userId = r.recordset[0].UserId;
  await exec('api.Invitation_Accept', { TokenHash: tokenHash(t), Issuer: ISS_EXT, Subject: 'user-' + RUN, Email: `petras.${RUN}@testas.lt` });
  const u = await pool.request().input('id', sql.Int, S.userId).query('SELECT CompanyId, Status FROM iam.[User] WHERE UserId=@id');
  assert.equal(u.recordset[0].CompanyId, S.companyId);
  assert.equal(u.recordset[0].Status, 'ACTIVE');
  await expectSqlError(exec('api.User_List', { ActorUserId: S.userId }), 51001);
});

test('5. užsakymas: tikslūs PVM skaičiavimai ir konkurencinė apsauga', async () => {
  const pub = await exec('api.Catalog_ListPublished', { ActorUserId: S.userId });
  const erk = pub.recordset.find(x => x.ManufacturerCode === 'ERKADO');
  assert.ok(erk, 'ERKADO katalogas turi būti paskelbtas (import-catalog.js --publish)');
  S.versionId = erk.CatalogVersionId;

  const c = await exec('api.Order_CreateDraft', { ActorUserId: S.userId, CatalogVersionId: S.versionId, CustomerReference: 'Obj. Vilnius' });
  S.orderId = c.recordset[0].OrderId;
  assert.match(c.recordset[0].OrderNumber, /^\d{4}-\d{6,}$/);

  const lines = [
    { familyCode: 'WERBENA', modelNo: 4, description: 'WERBENA 4, 80, kairė', quantity: 2, engineVersion: 'test',
      configuration: { WIDTH: '80', DECOR: 'CPL_WHITE' },
      priceBreakdown: [{ no: '1.1', desc: 'Varčia', qty: 2, unit: 'vnt.', unitPrice: 415.5, sum: 831 },
                       { no: '1.2', desc: 'Stakta', qty: 2, unit: 'vnt.', unitPrice: 146.7, sum: 293.4 }] },
    // 21,50 × 21 % = 4,515 -> teisingai 4,52 (naršyklės skaičiavimas duotų 4,51)
    { familyCode: 'JASMIN', modelNo: 1, description: 'Testinis priedas', quantity: 1, engineVersion: 'test',
      configuration: {}, priceBreakdown: [{ desc: 'Priedas', sum: 21.5 }] },
  ];
  const s = await exec('api.Order_SaveLines', { ActorUserId: S.userId, OrderId: S.orderId, ExpectedRevision: 1, LinesJson: JSON.stringify(lines) });
  const o = s.recordset[0];
  // 1124,40 -> PVM 236,124 -> 236,12 ; 21,50 -> 4,515 -> 4,52
  assert.equal(Number(o.NetTotal), 1145.90);
  assert.equal(Number(o.VatTotal), 240.64);
  assert.equal(Number(o.GrossTotal), 1386.54);
  S.rev = o.Revision;

  await expectSqlError(exec('api.Order_SaveLines', { ActorUserId: S.userId, OrderId: S.orderId, ExpectedRevision: 1, LinesJson: '[]' }), 51005);
  const bad = [{ ...lines[1], priceBreakdown: [{ desc: 'x', sum: 1.234 }] }];
  await expectSqlError(exec('api.Order_SaveLines', { ActorUserId: S.userId, OrderId: S.orderId, ExpectedRevision: S.rev, LinesJson: JSON.stringify(bad) }), 51004);
  const badModel = [{ ...lines[1], familyCode: 'NERA', modelNo: 1 }];
  await expectSqlError(exec('api.Order_SaveLines', { ActorUserId: S.userId, OrderId: S.orderId, ExpectedRevision: S.rev, LinesJson: JSON.stringify(badModel) }), 51004);
});

test('6. statusų eiga ir teisės', async () => {
  const sub = await exec('api.Order_ChangeStatus', { ActorUserId: S.userId, OrderId: S.orderId, ToStatus: 'SUBMITTED', ExpectedRevision: S.rev });
  S.rev = sub.recordset[0].Revision;
  await expectSqlError(exec('api.Order_ChangeStatus', { ActorUserId: S.userId, OrderId: S.orderId, ToStatus: 'CONFIRMED', ExpectedRevision: S.rev }), 51001);
  await expectSqlError(exec('api.Order_SaveLines', { ActorUserId: S.userId, OrderId: S.orderId, ExpectedRevision: S.rev, LinesJson: '[]' }), 51003);
  await expectSqlError(exec('api.Order_ChangeStatus', { ActorUserId: S.gaId, OrderId: S.orderId, ToStatus: 'DELIVERED', ExpectedRevision: S.rev }), 51003);
  await expectSqlError(exec('api.Order_ChangeStatus', { ActorUserId: S.gaId, OrderId: S.orderId, ToStatus: 'CANCELLED', ExpectedRevision: S.rev }), 51004);

  const conf = await exec('api.Order_ChangeStatus', { ActorUserId: S.gaId, OrderId: S.orderId, ToStatus: 'CONFIRMED', ExpectedRevision: S.rev });
  S.rev = conf.recordset[0].Revision;

  const m = await pool.request().input('v', sql.Int, S.versionId)
    .query('SELECT m.ManufacturerId, m.OrderEmail FROM catalog.CatalogVersion cv JOIN catalog.Manufacturer m ON m.ManufacturerId=cv.ManufacturerId WHERE cv.CatalogVersionId=@v');
  if (!m.recordset[0].OrderEmail) {
    await expectSqlError(exec('api.Order_ChangeStatus', { ActorUserId: S.gaId, OrderId: S.orderId, ToStatus: 'SENT_TO_MANUFACTURER', ExpectedRevision: S.rev }), 51003);
    await exec('api.Manufacturer_SetOrderEmail', { ActorUserId: S.gaId, ManufacturerId: m.recordset[0].ManufacturerId, OrderEmail: 'uzsakymai@gamintojas.example' });
  }
  const sent = await exec('api.Order_ChangeStatus', { ActorUserId: S.gaId, OrderId: S.orderId, ToStatus: 'SENT_TO_MANUFACTURER', ExpectedRevision: S.rev });
  S.rev = sent.recordset[0].Revision;

  const g = await exec('api.Order_Get', { ActorUserId: S.repId, OrderId: S.orderId });
  assert.equal(g.recordsets[0][0].StatusCode, 'SENT_TO_MANUFACTURER');
  assert.equal(g.recordsets[1].length, 2);
  assert.deepEqual(g.recordsets[2].map(h => h.ToStatus), ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'SENT_TO_MANUFACTURER']);

  const mail = await pool.request().input('id', sql.Int, S.orderId)
    .query("SELECT PayloadJson FROM notify.EmailOutbox WHERE RelatedEntity='Order' AND RelatedId=@id AND TemplateCode='ORDER_TO_MANUFACTURER'");
  assert.equal(mail.recordset.length, 1);
  assert.equal(JSON.parse(mail.recordset[0].PayloadJson).lines.length, 2);
});

test('7. kitos įmonės naudotojas užsakymo nemato', async () => {
  const code = '31' + parseInt(RUN, 16).toString().padStart(7, '0');
  const r = await exec('api.AccessRequest_Submit', { CompanyName: 'UAB Kita ' + RUN, CompanyCode: code, ContactName: 'Ona', ContactEmail: `ona.${RUN}@kita.lt` });
  const t = 'tok-other-' + RUN;
  const a = await exec('api.AccessRequest_Approve', { ActorUserId: S.gaId, AccessRequestId: r.recordset[0].AccessRequestId,
    TokenHash: tokenHash(t), ExpiresAt: inDays(1), InviteUrl: 'https://durys.example/k?t=' + t });
  await exec('api.Invitation_Accept', { TokenHash: tokenHash(t), Issuer: ISS_EXT, Subject: 'other-' + RUN, Email: `ona.${RUN}@kita.lt` });
  await expectSqlError(exec('api.Order_Get', { ActorUserId: a.recordset[0].UserId, OrderId: S.orderId }), 51002);
  const list = await exec('api.Order_List', { ActorUserId: a.recordset[0].UserId });
  assert.equal(list.recordset.length, 0);
});

test('8. istorijos, audito ir paskelbto katalogo pakeisti neįmanoma', async () => {
  await assert.rejects(pool.request().input('id', sql.Int, S.orderId)
    .query("UPDATE sales.OrderStatusHistory SET Comment = N'x' WHERE OrderId = @id"), /istorijos/);
  await assert.rejects(pool.request().query("DELETE FROM audit.AuditLog WHERE AuditId = 1"), /Audito/);
  await assert.rejects(pool.request().input('v', sql.Int, S.versionId)
    .query("UPDATE catalog.ModelBasePrice SET Price = Price + 1 WHERE CatalogVersionId = @v AND FamilyCode = 'WERBENA'"), /Paskelbtos/);
  await assert.rejects(pool.request().input('id', sql.Int, S.orderId)
    .query('DELETE FROM sales.[Order] WHERE OrderId = @id'), /trinti negalima|REFERENCE/);
  // užsakymo istorija (temporal) išsaugota
  const h = await pool.request().input('id', sql.Int, S.orderId)
    .query('SELECT COUNT(*) AS n FROM sales.[Order] FOR SYSTEM_TIME ALL WHERE OrderId = @id');
  assert.ok(h.recordset[0].n >= 5);
});

test('9. programos rolė app_api: tik procedūros, jokio tiesioginio priėjimo prie lentelių', async () => {
  const u = 'test_app_' + RUN;
  await pool.request().batch(`CREATE USER [${u}] WITHOUT LOGIN; ALTER ROLE app_api ADD MEMBER [${u}];`);
  try {
    const r = await pool.request().input('a', sql.Int, S.repId).input('v', sql.Int, S.versionId).batch(`
      DECLARE @direct nvarchar(400) = N'OK', @admin nvarchar(400) = N'OK', @viaApi nvarchar(400) = N'OK';
      DECLARE @bundle TABLE (BundleJson nvarchar(max));
      EXECUTE AS USER = '${u}';
      BEGIN TRY SELECT TOP 1 1 AS x INTO #t FROM sales.[Order]; END TRY BEGIN CATCH SET @direct = ERROR_MESSAGE(); END CATCH;
      BEGIN TRY EXEC admin.Catalog_ExportVersion @CatalogVersionId = @v; END TRY BEGIN CATCH SET @admin = ERROR_MESSAGE(); END CATCH;
      -- api procedūra, kuri viduje kviečia admin procedūrą, turi veikti (ownership chaining)
      BEGIN TRY INSERT INTO @bundle EXEC api.Catalog_GetVersion @ActorUserId = @a, @CatalogVersionId = @v; END TRY
      BEGIN CATCH SET @viaApi = ERROR_MESSAGE(); END CATCH;
      EXEC api.Order_List @ActorUserId = @a;
      REVERT;
      SELECT @direct AS direct, @admin AS adminProc, @viaApi AS viaApi, (SELECT MAX(LEN(BundleJson)) FROM @bundle) AS bundleLen;`);
    const last = r.recordsets[r.recordsets.length - 1][0];
    assert.match(last.direct, /permission was denied|denied/i, 'tiesioginis SELECT turi būti uždraustas');
    assert.match(last.adminProc, /permission was denied|denied/i, 'admin procedūros turi būti uždraustos');
    assert.equal(last.viaApi, 'OK', 'api.Catalog_GetVersion turi veikti per app_api');
    assert.ok(last.bundleLen > 100000, 'katalogas turi būti grąžintas');
    assert.ok(r.recordsets[0].length >= 1, 'api.Order_List turi veikti');
  } finally {
    await pool.request().batch(`ALTER ROLE app_api DROP MEMBER [${u}]; DROP USER [${u}];`);
  }
});

test('10. laiškų eilė: paėmimas, išsiuntimas, jautrių duomenų išvalymas', async () => {
  const w = 'worker-' + RUN;
  const c = await exec('api.Email_ClaimBatch', { WorkerId: w, BatchSize: 100 });
  assert.ok(c.recordset.length > 0);
  const inv = c.recordset.find(x => x.TemplateCode === 'ACCESS_APPROVED_INVITATION');
  assert.ok(inv && JSON.parse(inv.PayloadJson).inviteUrl.startsWith('https://'));
  for (const e of c.recordset) await exec('api.Email_MarkSent', { EmailId: e.EmailId, WorkerId: w, ProviderMessageId: 'msg' });
  const after = await pool.request().input('id', sql.BigInt, inv.EmailId).query('SELECT Status, PayloadJson FROM notify.EmailOutbox WHERE EmailId=@id');
  assert.equal(after.recordset[0].Status, 'SENT');
  assert.equal(after.recordset[0].PayloadJson, null);
  await expectSqlError(exec('api.Email_MarkSent', { EmailId: inv.EmailId, WorkerId: w }), 51003);
});

test('11. pilnas kelias: serverio variklis (katalogas iš DB) -> api.Order_SaveLines', async () => {
  const { createRuntime } = require('../../api/src/engines/erkado/runtime');
  const g = await exec('api.Catalog_GetVersion', { ActorUserId: S.userId, CatalogVersionId: S.versionId });
  const rt = createRuntime(JSON.parse(g.recordset[0].BundleJson));
  const base = { DIRECTION: 'LEFT', LOCK: 'LATCH_BSR', HARDWARE_COLOR: 'STANDARD' };
  const lines = [
    rt.priceLine({ familyKey: 'WERBENA', modelNo: 4, quantity: 2,
      selections: { ...base, WIDTH: '80', DECOR: 'CPL_WHITE', STAKTA_CHOICE: 'ADJUSTABLE_STANDARD', STAKTA_RANGE: '100-120' } }, 1),
    rt.priceLine({ familyKey: 'PANEL_ALTAMURA', modelNo: 1, quantity: 1,
      selections: { ...base, WIDTH: '90', DECOR: 'GREKO_OAK', STAKTA_CHOICE: 'NONE', HANDLE_FAMILY: 'CUBE', HANDLE_FINISH: 'BLACK_MATTE' } }, 2),
  ];
  const c = await exec('api.Order_CreateDraft', { ActorUserId: S.userId, CatalogVersionId: S.versionId });
  const s = await exec('api.Order_SaveLines', { ActorUserId: S.userId, OrderId: c.recordset[0].OrderId, ExpectedRevision: 1,
    LinesJson: JSON.stringify(lines) });
  // Tikimasi suma: eilučių sumos centais, PVM kiekvienai eilutei atskirai (tiksliai)
  let net = 0, vat = 0;
  for (const l of lines) {
    const ln = l.priceBreakdown.reduce((a, x) => a + Math.round(x.sum * 100), 0);
    net += ln; vat += Math.floor((ln * 21 + 50) / 100);
  }
  assert.equal(Math.round(Number(s.recordset[0].NetTotal) * 100), net);
  assert.equal(Math.round(Number(s.recordset[0].VatTotal) * 100), vat);
  assert.ok(net > 0);
});

test('12. administratorius sukuria įmonę tiesiogiai; atstovas — ne; kodas unikalus', async () => {
  const code = '39' + parseInt(RUN, 16).toString().padStart(7, '0');
  await expectSqlError(exec('api.Company_Create', { ActorUserId: S.repId, Name: 'UAB X', CompanyCode: code }), 51001);
  await expectSqlError(exec('api.Company_Create', { ActorUserId: S.gaId, Name: '  ', CompanyCode: code }), 51004);
  await expectSqlError(exec('api.Company_Create', { ActorUserId: S.gaId, Name: 'UAB X', CompanyCode: code, Email: 'blogas' }), 51004);
  const r = await exec('api.Company_Create', { ActorUserId: S.gaId, Name: ' UAB Tiesioginė ' + RUN + ' ', CompanyCode: ' ' + code + ' ', VatCode: 'lt 100', Email: 'Info@Tiesiogine.LT' });
  const id = r.recordset[0].CompanyId;
  const c = await pool.request().input('id', sql.Int, id).query('SELECT Name, CompanyCode, VatCode, Email, Status, CreatedByUserId FROM org.Company WHERE CompanyId=@id');
  assert.deepEqual(c.recordset[0], { Name: 'UAB Tiesioginė ' + RUN, CompanyCode: code, VatCode: 'LT100', Email: 'info@tiesiogine.lt', Status: 'ACTIVE', CreatedByUserId: S.gaId });
  await expectSqlError(exec('api.Company_Create', { ActorUserId: S.gaId, Name: 'Kita', CompanyCode: code }), 51006);
  const a = await pool.request().input('id', sql.NVarChar(50), String(id)).query("SELECT COUNT(*) AS n FROM audit.AuditLog WHERE Action='COMPANY_CREATED' AND EntityId=@id");
  assert.equal(a.recordset[0].n, 1);
  // administratorius gali kurti užsakymą šiai įmonei
  const o = await exec('api.Order_CreateDraft', { ActorUserId: S.gaId, CatalogVersionId: S.versionId, CompanyId: id });
  assert.ok(o.recordset[0].OrderId > 0);
});
