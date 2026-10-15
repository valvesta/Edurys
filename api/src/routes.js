'use strict';
/* ==========================================================================
   API maršrutai. Kiekvienas maršrutas:
     - patikrina įvestį (tipai, ilgiai);
     - kviečia VIENĄ api.* procedūrą su @ActorUserId iš patikrinto žetono;
     - teises galutinai tikrina pati duomenų bazė.
   ========================================================================== */
const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { sql, callProcedure } = require('./db');
const { requireIdentity, requireUser, requireLevel } = require('./auth');
const pricing = require('./pricing');
const media = require('./media');
const registry = require('./registry');

const router = express.Router();
const ADMIN = 30, REP = 20;

// ---------------------------------------------------------------- pagalbinės
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function str(v, max, required) {
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest('Trūksta privalomo lauko.');
    return null;
  }
  if (typeof v !== 'string') throw badRequest('Laukas turi būti tekstas.');
  if (v.length > max) throw badRequest(`Laukas per ilgas (daugiausia ${max} simb.).`);
  return v;
}
function int(v, required) {
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest('Trūksta privalomo skaičiaus.');
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 2147483647) throw badRequest('Neteisingas skaičius.');
  return n;
}
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }

/* Kvietimo žetonas: 32 atsitiktiniai baitai. Į DB keliauja tik SHA-256. */
function newInvitation() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    hash: crypto.createHash('sha256').update(token, 'utf8').digest(),
    url: `${config.appBaseUrl}/kvietimas#${token}`,      // # — žetonas nepatenka į serverių žurnalus
    expiresAt: new Date(Date.now() + config.invitationDays * 86400000),
  };
}
/* Kol paštas neprijungtas (MAIL_SENDER nenustatytas), kvietimo nuoroda grąžinama
   TIK ją sukūrusiam asmeniui, kad galėtų perduoti pats. Prijungus paštą — nebegrąžinama. */
const withLink = (row, inv) => (config.mail.senderMailbox ? row : { ...row, inviteUrl: inv.url });

const inviteParams = inv => ({
  TokenHash: [sql.Binary(32), inv.hash],
  ExpiresAt: [sql.DateTime2(3), inv.expiresAt],
  InviteUrl: [sql.NVarChar(1000), inv.url],
});

// ---------------------------------------------------------------- vieša dalis
const publicLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

router.post('/public/access-requests', publicLimiter, wrap(async (req, res) => {
  const b = req.body || {};
  const r = await callProcedure('api.AccessRequest_Submit', {
    CompanyName: [sql.NVarChar(200), str(b.companyName, 200, true)],
    CompanyCode: [sql.NVarChar(50), str(b.companyCode, 50, true)],
    VatCode: [sql.NVarChar(50), str(b.vatCode, 50)],
    Address: [sql.NVarChar(400), str(b.address, 400)],
    ContactName: [sql.NVarChar(200), str(b.contactName, 200, true)],
    ContactEmail: [sql.NVarChar(320), str(b.contactEmail, 320, true)],
    ContactPhone: [sql.NVarChar(50), str(b.contactPhone, 50)],
    Message: [sql.NVarChar(2000), str(b.message, 2000)],
    SubmittedFromIp: [sql.VarChar(45), (req.ip || '').slice(0, 45) || null],
  });
  res.status(201).json({ accessRequestId: r.recordset[0].AccessRequestId });
}));

/* Naršyklės prisijungimo nustatymai (ne paslaptys). */
router.get('/public/config', (req, res) => {
  res.json({ ...config.webAuth, appBaseUrl: config.appBaseUrl });
});

// ---------------------------------------------------------------- prisijungimas
router.get('/me', requireUser, (req, res) => {
  const u = req.user;
  res.json({ userId: u.UserId, email: u.Email, displayName: u.DisplayName, role: u.RoleCode, roleName: u.RoleName,
    roleLevel: u.RoleLevel, companyId: u.CompanyId, companyName: u.CompanyName });
});

/* Kvietimo priėmimas: naudotojas jau prisijungęs per Microsoft, siunčia žetoną iš nuorodos. */
router.post('/invitations/accept', requireIdentity, wrap(async (req, res) => {
  const token = str((req.body || {}).token, 100, true);
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw badRequest('Neteisingas kvietimo žetonas.');
  if (!req.identity.email) throw badRequest('Microsoft paskyra nepateikė el. pašto adreso.');
  const r = await callProcedure('api.Invitation_Accept', {
    TokenHash: [sql.Binary(32), crypto.createHash('sha256').update(token, 'utf8').digest()],
    Issuer: [sql.NVarChar(400), req.identity.issuer],
    Subject: [sql.NVarChar(200), req.identity.subject],
    Email: [sql.NVarChar(320), req.identity.email],
    DisplayName: [sql.NVarChar(200), req.identity.name],
  });
  res.json({ ok: true, role: r.recordset[0].RoleCode });
}));

// ---------------------------------------------------------------- įmonių užklausos (ADMIN+)
router.get('/admin/access-requests', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const r = await callProcedure('api.AccessRequest_List', {
    ActorUserId: [sql.Int, req.user.UserId],
    Status: [sql.VarChar(20), str(req.query.status, 20)],
  });
  res.json(r.recordset);
}));

router.post('/admin/access-requests/:id/approve', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const inv = newInvitation();
  const r = await callProcedure('api.AccessRequest_Approve', {
    ActorUserId: [sql.Int, req.user.UserId],
    AccessRequestId: [sql.Int, int(req.params.id, true)],
    ReviewNote: [sql.NVarChar(1000), str((req.body || {}).note, 1000)],
    ...inviteParams(inv),
  });
  res.json(withLink(r.recordset[0], inv));
}));

router.post('/admin/access-requests/:id/reject', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  await callProcedure('api.AccessRequest_Reject', {
    ActorUserId: [sql.Int, req.user.UserId],
    AccessRequestId: [sql.Int, int(req.params.id, true)],
    ReviewNote: [sql.NVarChar(1000), str((req.body || {}).note, 1000, true)],
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- naudotojai (REP+)
router.get('/users', requireUser, requireLevel(REP), wrap(async (req, res) => {
  const r = await callProcedure('api.User_List', {
    ActorUserId: [sql.Int, req.user.UserId],
    CompanyId: [sql.Int, int(req.query.companyId)],
  });
  res.json(r.recordset);
}));

router.post('/users/invite', requireUser, requireLevel(REP), wrap(async (req, res) => {
  const b = req.body || {};
  const inv = newInvitation();
  const r = await callProcedure('api.Invitation_Create', {
    ActorUserId: [sql.Int, req.user.UserId],
    Email: [sql.NVarChar(320), str(b.email, 320, true)],
    DisplayName: [sql.NVarChar(200), str(b.displayName, 200)],
    RoleCode: [sql.VarChar(20), str(b.role, 20, true)],
    CompanyId: [sql.Int, int(b.companyId)],
    ...inviteParams(inv),
  });
  res.status(201).json(withLink(r.recordset[0], inv));
}));

router.post('/users/:id/resend-invitation', requireUser, requireLevel(REP), wrap(async (req, res) => {
  const inv = newInvitation();
  const r = await callProcedure('api.Invitation_Resend', {
    ActorUserId: [sql.Int, req.user.UserId],
    UserId: [sql.Int, int(req.params.id, true)],
    ...inviteParams(inv),
  });
  res.json(withLink(r.recordset[0], inv));
}));

router.post('/users/:id/status', requireUser, requireLevel(REP), wrap(async (req, res) => {
  const b = req.body || {};
  await callProcedure('api.User_SetStatus', {
    ActorUserId: [sql.Int, req.user.UserId],
    UserId: [sql.Int, int(req.params.id, true)],
    Status: [sql.VarChar(20), str(b.status, 20, true)],
    ExpectedRevision: [sql.Int, int(b.revision, true)],
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- įmonės (ADMIN+)
router.get('/admin/companies', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const r = await callProcedure('api.Company_List', { ActorUserId: [sql.Int, req.user.UserId] });
  res.json(r.recordset);
}));

/* Pagalba pildant įmonės duomenis iš viešų registrų (žr. registry.js). */
const registryLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
router.get('/admin/registry/company/:code', registryLimiter, requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const found = await registry.lookupCompany(String(req.params.code).trim());
  if (!found) return res.status(404).json({ error: 'Įmonė su tokiu kodu registre nerasta.' });
  const vatCode = found.deregisteredOn ? null : await registry.suggestVat(found.companyCode, found.name);
  res.json({ ...found, vatCode });
}));
router.get('/admin/registry/vat/:vat', registryLimiter, requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  res.json(await registry.checkVat(String(req.params.vat)));
}));

/* Įmonės sukūrimas tiesiogiai (administratorius). */
router.post('/admin/companies', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const b = req.body || {};
  const r = await callProcedure('api.Company_Create', {
    ActorUserId: [sql.Int, req.user.UserId],
    Name: [sql.NVarChar(200), str(b.name, 200, true)],
    CompanyCode: [sql.NVarChar(50), str(b.companyCode, 50, true)],
    VatCode: [sql.NVarChar(50), str(b.vatCode, 50)],
    Address: [sql.NVarChar(400), str(b.address, 400)],
    Phone: [sql.NVarChar(50), str(b.phone, 50)],
    Email: [sql.NVarChar(320), str(b.email, 320)],
  });
  res.status(201).json({ companyId: r.recordset[0].CompanyId });
}));

router.post('/admin/companies/:id/status', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const b = req.body || {};
  await callProcedure('api.Company_SetStatus', {
    ActorUserId: [sql.Int, req.user.UserId],
    CompanyId: [sql.Int, int(req.params.id, true)],
    Status: [sql.VarChar(20), str(b.status, 20, true)],
    ExpectedRevision: [sql.Int, int(b.revision, true)],
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- nuotraukos
/* Laikinas tik skaitymo leidimas nuotraukų saugyklai (žr. media.js). */
router.get('/media/config', requireUser, wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await media.mediaConfig());
}));

// ---------------------------------------------------------------- katalogas
router.get('/catalog/published', requireUser, wrap(async (req, res) => {
  const r = await callProcedure('api.Catalog_ListPublished', { ActorUserId: [sql.Int, req.user.UserId] });
  res.json(r.recordset);
}));

router.get('/catalog/versions/:id', requireUser, wrap(async (req, res) => {
  const r = await callProcedure('api.Catalog_GetVersion', {
    ActorUserId: [sql.Int, req.user.UserId],
    CatalogVersionId: [sql.Int, int(req.params.id, true)],
  });
  res.type('application/json').send(r.recordset[0].BundleJson);
}));

// ---------------------------------------------------------------- užsakymai
router.get('/orders', requireUser, wrap(async (req, res) => {
  const r = await callProcedure('api.Order_List', {
    ActorUserId: [sql.Int, req.user.UserId],
    StatusCode: [sql.VarChar(30), str(req.query.status, 30)],
    CompanyId: [sql.Int, int(req.query.companyId)],
    Search: [sql.NVarChar(100), str(req.query.q, 100)],
    Page: [sql.Int, int(req.query.page) || 1],
    PageSize: [sql.Int, int(req.query.pageSize) || 50],
  });
  res.json({ total: r.recordset.length ? r.recordset[0].TotalCount : 0, items: r.recordset });
}));

router.post('/orders', requireUser, wrap(async (req, res) => {
  const b = req.body || {};
  const r = await callProcedure('api.Order_CreateDraft', {
    ActorUserId: [sql.Int, req.user.UserId],
    CatalogVersionId: [sql.Int, int(b.catalogVersionId, true)],
    CompanyId: [sql.Int, int(b.companyId)],
    CustomerReference: [sql.NVarChar(100), str(b.customerReference, 100)],
    Notes: [sql.NVarChar(2000), str(b.notes, 2000)],
  });
  res.status(201).json(r.recordset[0]);
}));

router.get('/orders/:id', requireUser, wrap(async (req, res) => {
  const r = await callProcedure('api.Order_Get', {
    ActorUserId: [sql.Int, req.user.UserId],
    OrderId: [sql.Int, int(req.params.id, true)],
  });
  const [header, lines, history, transitions] = r.recordsets;
  res.json({
    order: header[0],
    lines: lines.map(l => ({ ...l, ConfigurationJson: undefined, PriceBreakdownJson: undefined,
      configuration: JSON.parse(l.ConfigurationJson), priceBreakdown: JSON.parse(l.PriceBreakdownJson) })),
    history,
    allowedTransitions: transitions,
  });
}));

router.put('/orders/:id/header', requireUser, wrap(async (req, res) => {
  const b = req.body || {};
  const r = await callProcedure('api.Order_UpdateHeader', {
    ActorUserId: [sql.Int, req.user.UserId],
    OrderId: [sql.Int, int(req.params.id, true)],
    ExpectedRevision: [sql.Int, int(b.revision, true)],
    CustomerReference: [sql.NVarChar(100), str(b.customerReference, 100)],
    Notes: [sql.NVarChar(2000), str(b.notes, 2000)],
  });
  res.json(r.recordset[0]);
}));

/* Eilutės: naršyklė siunčia TIK pasirinkimus (šeima, modelis, pasirinkimai,
   kiekis). Kainas apskaičiuoja serveris (pricing.js) pagal UŽSAKYMO katalogo
   versiją (ne pagal naršyklės nurodytą) — naršyklės kainos ignoruojamos.
   Body: { revision, lines: [{ familyKey, modelNo, quantity, selections }] } */
router.put('/orders/:id/lines', requireUser, wrap(async (req, res) => {
  const b = req.body || {};
  const orderId = int(req.params.id, true);
  const revision = int(b.revision, true);
  if (!Array.isArray(b.lines) || b.lines.length > 200) throw badRequest('Eilutės turi būti masyvas (iki 200).');
  const o = await callProcedure('api.Order_Get', {
    ActorUserId: [sql.Int, req.user.UserId],
    OrderId: [sql.Int, orderId],
  });
  const header = o.recordsets[0][0];
  const priced = await pricing.priceLines(req.user.UserId, header.CatalogVersionId, b.lines);
  const r = await callProcedure('api.Order_SaveLines', {
    ActorUserId: [sql.Int, req.user.UserId],
    OrderId: [sql.Int, orderId],
    ExpectedRevision: [sql.Int, revision],
    LinesJson: [sql.NVarChar(sql.MAX), JSON.stringify(priced)],
  });
  res.json(r.recordset[0]);
}));

/* Kainos peržiūra (neįrašant): ta pati serverio kaina, kuri būtų įrašyta. */
router.post('/catalog/versions/:id/quote', requireUser, wrap(async (req, res) => {
  const b = req.body || {};
  const [line] = await pricing.priceLines(req.user.UserId, int(req.params.id, true), [b]);
  const net = Math.round(line.priceBreakdown.reduce((s, x) => s + Math.round(x.sum * 100), 0)) / 100;
  res.json({ ...line, netTotal: net });
}));

router.post('/orders/:id/status', requireUser, wrap(async (req, res) => {
  const b = req.body || {};
  const r = await callProcedure('api.Order_ChangeStatus', {
    ActorUserId: [sql.Int, req.user.UserId],
    OrderId: [sql.Int, int(req.params.id, true)],
    ToStatus: [sql.VarChar(30), str(b.status, 30, true)],
    ExpectedRevision: [sql.Int, int(b.revision, true)],
    Comment: [sql.NVarChar(1000), str(b.comment, 1000)],
  });
  res.json(r.recordset[0]);
}));

// ---------------------------------------------------------------- administravimas
router.get('/admin/settings', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const r = await callProcedure('api.Setting_List', { ActorUserId: [sql.Int, req.user.UserId] });
  res.json(r.recordset);
}));

router.put('/admin/settings/:key', requireUser, requireLevel(40), wrap(async (req, res) => {
  const key = str(req.params.key, 60, true);
  if (!/^[A-Z_]{2,60}$/.test(key)) throw badRequest('Neteisingas nustatymo pavadinimas.');
  await callProcedure('api.Setting_Set', {
    ActorUserId: [sql.Int, req.user.UserId],
    SettingKey: [sql.VarChar(60), key],
    SettingValue: [sql.NVarChar(1000), str((req.body || {}).value, 1000)],
  });
  res.json({ ok: true });
}));

router.get('/admin/catalog-versions', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const r = await callProcedure('api.Catalog_ListVersions', { ActorUserId: [sql.Int, req.user.UserId] });
  res.json(r.recordset);
}));

router.put('/admin/manufacturers/:id/order-email', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  await callProcedure('api.Manufacturer_SetOrderEmail', {
    ActorUserId: [sql.Int, req.user.UserId],
    ManufacturerId: [sql.Int, int(req.params.id, true)],
    OrderEmail: [sql.NVarChar(320), str((req.body || {}).email, 320)],
  });
  res.json({ ok: true });
}));

router.get('/admin/emails', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  const r = await callProcedure('api.Email_ListRecent', {
    ActorUserId: [sql.Int, req.user.UserId],
    Status: [sql.VarChar(20), str(req.query.status, 20)],
    Top: [sql.Int, 200],
  });
  res.json(r.recordset);
}));

router.post('/admin/emails/:id/retry', requireUser, requireLevel(ADMIN), wrap(async (req, res) => {
  await callProcedure('api.Email_Retry', {
    ActorUserId: [sql.Int, req.user.UserId],
    EmailId: [sql.BigInt, int(req.params.id, true)],
  });
  res.json({ ok: true });
}));

router.get('/admin/audit', requireUser, requireLevel(40), wrap(async (req, res) => {
  const r = await callProcedure('api.Audit_List', {
    ActorUserId: [sql.Int, req.user.UserId],
    EntityType: [sql.VarChar(40), str(req.query.entityType, 40)],
    EntityId: [sql.NVarChar(60), str(req.query.entityId, 60)],
    Top: [sql.Int, 300],
  });
  res.json(r.recordset);
}));

module.exports = router;
