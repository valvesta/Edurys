'use strict';
/* ==========================================================================
   Tikras API serveris (api/src/server.js) su duomenų bazės IMITACIJA —
   naršyklės testams be SQL Server. Kainos skaičiuojamos tikru serverio
   varikliu (pricing.js); imituojamos tik api.* procedūros, ir tik tiek,
   kiek reikia konfigūratoriui: užsakymo kūrimas, eilučių išsaugojimas
   (sumos skaičiuojamos dešimtainiais centais kaip SQL ROUND), antraštė,
   pateikimas. Tikrąsias procedūras tikrina db/tests (CI su SQL Server).

   Paleidimas: PORT=18091 ROLE=COMPANY_REP node tools/ui-test/mock-server.js
   ========================================================================== */
const Module = require('module');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const API = path.join(ROOT, 'api', 'src');
const PORT = process.env.PORT || '18091';
process.env.APP_BASE_URL = `http://localhost:${PORT}`;
process.env.EMAIL_WORKER = 'off';
process.env.DB_SERVER = 'imitacija'; process.env.DB_NAME = 'imitacija';
process.env.WEB_CLIENT_ID = '00000000-0000-0000-0000-000000000001';
process.env.AUTH_PROVIDERS = JSON.stringify([
  { name: 'staff', issuer: 'https://login.microsoftonline.com/93fb58f1-13db-4382-b5fa-2bb86e1406f1/v2.0', jwksUri: 'https://login.microsoftonline.com/x/keys', audience: '00000000-0000-0000-0000-000000000002' },
  { name: 'clients', issuer: 'https://00000000-0000-0000-0000-000000000003.ciamlogin.com/00000000-0000-0000-0000-000000000003/v2.0', jwksUri: 'https://00000000-0000-0000-0000-000000000003.ciamlogin.com/x/keys',
    audience: '00000000-0000-0000-0000-000000000004', clientId: '00000000-0000-0000-0000-000000000004', authority: 'https://testasklientai.ciamlogin.com/' },
]);

const ROLE = process.env.ROLE || 'COMPANY_REP';
const LEVEL = { GLOBAL_ADMIN: 40, ADMIN: 30, COMPANY_REP: 20, USER: 10 }[ROLE];
const BUNDLE = fs.readFileSync(path.join(ROOT, 'db', 'catalog', 'erkado-2026-I.bundle.json'), 'utf8');
const now = () => new Date().toISOString();

const sql = require(path.join(ROOT, 'api', 'node_modules', 'mssql'));
const dbErr = (number, message) => Object.assign(new Error(message), { number });

/* Dešimtainis tekstas "123.45" -> centai (BigInt), kaip CONVERT(decimal(14,2), ...) */
function toCents(txt) {
  if (!/^\d+(\.\d{1,2})?$/.test(txt)) throw dbErr(51004, 'kainos išskaidymas neteisingas: ' + txt);
  const [a, b = ''] = txt.split('.');
  return BigInt(a) * 100n + BigInt((b + '00').slice(0, 2));
}
const fromCents = c => Number(c) / 100;

const companies = process.env.NO_ACTIVE_COMPANIES ? [
  { CompanyId: 2, Name: 'UAB Uždaryta', CompanyCode: '300000000', Status: 'SUSPENDED' },
] : [
  { CompanyId: 1, Name: 'UAB Statybų meistrai', CompanyCode: '304111222', Status: 'ACTIVE' },
  { CompanyId: 2, Name: 'UAB Uždaryta', CompanyCode: '300000000', Status: 'SUSPENDED' },
];
const orders = new Map();
let seq = 0;
const log = [];   // testams: kokios procedūros kviestos

const P = {
  'api.User_ResolveLogin': () => [[{ LoginResult: 'OK', UserId: 7, Email: 'jonas@meistrai.lt', DisplayName: 'Jonas Jonaitis', RoleCode: ROLE, RoleName: ROLE, RoleLevel: LEVEL, CompanyId: LEVEL < 30 ? 1 : null, CompanyName: LEVEL < 30 ? 'UAB Statybų meistrai' : null }]],
  'api.Catalog_ListPublished': () => [[{ ManufacturerId: 1, ManufacturerCode: 'ERKADO', ManufacturerName: 'ERKADO', CatalogVersionId: 1, VersionCode: '2026-I', VersionName: 'ERKADO vidaus durys, katalogas I/2026/B', CurrencyCode: 'EUR', VatRate: 0.21, PublishedAt: now() }]],
  'api.Catalog_GetVersion': p => { if (p.CatalogVersionId !== 1) throw dbErr(51002, 'Katalogas nerastas.'); return [[{ BundleJson: BUNDLE }]]; },
  'api.Company_List': () => [companies],
  'api.User_List': () => [[]],
  'api.Invitation_Create': p => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.Email)) throw dbErr(51004, 'Neteisingas el. pašto adresas.');
    return [[{ UserId: 50, InvitationId: 1 }]];
  },
  'api.Company_Create': p => {
    if (LEVEL < 30) throw dbErr(51001, 'Neturite teisės.');
    if (companies.some(c => c.CompanyCode === p.CompanyCode.trim())) throw dbErr(51006, 'Įmonė su tokiu kodu jau yra.');
    const c = { CompanyId: companies.length + 10, Name: p.Name.trim(), CompanyCode: p.CompanyCode.trim(), Status: 'ACTIVE', Revision: 1, ActiveUsers: 0, OrderCount: 0, CreatedAt: now() };
    companies.push(c);
    return [[{ CompanyId: c.CompanyId }]];
  },
  'api.Order_CreateDraft': p => {
    let companyId = p.CompanyId;
    if (LEVEL >= 30) { if (companyId == null) throw dbErr(51004, 'Nurodykite, kuriai įmonei kuriamas užsakymas.'); } else companyId = 1;
    const c = companies.find(x => x.CompanyId === companyId && x.Status === 'ACTIVE');
    if (!c) throw dbErr(51002, 'Įmonė nerasta arba neaktyvi.');
    const id = ++seq + 100;
    const o = { OrderId: id, OrderNumber: '2026-' + String(id).padStart(6, '0'), StatusCode: 'DRAFT', StatusName: 'Juodraštis', IsEditable: true,
      CompanyId: c.CompanyId, CompanyName: c.Name, CompanyCode: c.CompanyCode, CreatedByUserId: 7, CreatedByName: 'Jonas Jonaitis', CreatedByEmail: 'jonas@meistrai.lt',
      CatalogVersionId: p.CatalogVersionId, CatalogVersionCode: '2026-I', CatalogVersionStatus: 'PUBLISHED', ManufacturerCode: 'ERKADO', ManufacturerName: 'ERKADO',
      CustomerReference: p.CustomerReference || null, Notes: p.Notes || null, CurrencyCode: 'EUR', VatRate: 0.21, NetTotal: 0, VatTotal: 0, GrossTotal: 0,
      CreatedAt: now(), UpdatedAt: now(), SubmittedAt: null, Revision: 1, lines: [], history: [{ FromStatus: null, ToStatus: 'DRAFT', ToStatusName: 'Juodraštis', ChangedAt: now(), ChangedBy: 'Jonas Jonaitis', Comment: null }] };
    orders.set(id, o);
    return [[{ OrderId: id, OrderNumber: o.OrderNumber, Revision: 1 }]];
  },
  'api.Order_List': () => [[...orders.values()].map(({ lines, history, ...h }) => ({ ...h, CreatedByName: 'Jonas Jonaitis', TotalCount: orders.size }))],
  'api.Order_Get': p => {
    const o = orders.get(p.OrderId);
    if (!o) throw dbErr(51002, 'Užsakymas nerastas.');
    const { lines, history, ...header } = o;
    return [[header], lines, history, o.IsEditable ? [{ ToStatus: 'SUBMITTED', ToStatusName: 'Pateiktas', RequiresComment: false }] : []];
  },
  'api.Order_SaveLines': p => {
    const o = orders.get(p.OrderId);
    if (!o) throw dbErr(51001, 'Neturite teisės arba užsakymas nerastas.');
    if (o.Revision !== p.ExpectedRevision) throw dbErr(51005, 'Užsakymą jau pakeitė kitas naudotojas. Atnaujinkite puslapį.');
    if (!o.IsEditable) throw dbErr(51003, 'Užsakymo keisti nebegalima — jis jau pateiktas.');
    // Tas pats JSON kelias kaip SQL: sumos imamos iš JSON TEKSTO
    const arr = JSON.parse(p.LinesJson);
    let net = 0n, vat = 0n;
    o.lines = arr.map((l, i) => {
      const rowsTxt = JSON.stringify(l.priceBreakdown);
      const sums = [...rowsTxt.matchAll(/"sum":(-?[0-9.eE+-]+)/g)].map(m => toCents(m[1]));
      if (sums.length !== l.priceBreakdown.length) throw dbErr(51004, `Eilutės Nr. ${i + 1} kainos išskaidymas neteisingas.`);
      const lineNet = sums.reduce((a, b) => a + b, 0n);
      const lineVat = (lineNet * 2100n + 5000n) / 10000n;       // ROUND(x * 0.21, 2), x >= 0
      net += lineNet; vat += lineVat;
      return { OrderLineId: i + 1, LineNumber: i + 1, FamilyCode: l.familyCode, FamilyLabel: l.familyCode, ModelNo: l.modelNo, Description: l.description,
        Quantity: l.quantity, LineNetTotal: fromCents(lineNet), LineVatTotal: fromCents(lineVat), LineGrossTotal: fromCents(lineNet + lineVat),
        ConfigurationJson: JSON.stringify(l.configuration), PriceBreakdownJson: rowsTxt, EngineVersion: l.engineVersion };
    });
    o.NetTotal = fromCents(net); o.VatTotal = fromCents(vat); o.GrossTotal = fromCents(net + vat);
    o.Revision++; o.UpdatedAt = now();
    return [[{ OrderId: o.OrderId, Revision: o.Revision, NetTotal: o.NetTotal, VatTotal: o.VatTotal, GrossTotal: o.GrossTotal }]];
  },
  'api.Order_UpdateHeader': p => {
    const o = orders.get(p.OrderId);
    if (!o) throw dbErr(51001, 'Neturite teisės arba užsakymas nerastas.');
    if (o.Revision !== p.ExpectedRevision) throw dbErr(51005, 'Užsakymą jau pakeitė kitas naudotojas. Atnaujinkite puslapį.');
    o.CustomerReference = (p.CustomerReference || '').trim() || null; o.Notes = (p.Notes || '').trim() || null; o.Revision++;
    return [[{ Revision: o.Revision }]];
  },
  'api.Order_ChangeStatus': p => {
    const o = orders.get(p.OrderId);
    if (!o) throw dbErr(51002, 'Užsakymas nerastas.');
    if (o.Revision !== p.ExpectedRevision) throw dbErr(51005, 'Užsakymą jau pakeitė kitas naudotojas. Atnaujinkite puslapį.');
    if (p.ToStatus !== 'SUBMITTED' || !o.lines.length) throw dbErr(51003, 'Neleistinas statuso pakeitimas.');
    o.StatusCode = 'SUBMITTED'; o.StatusName = 'Pateiktas'; o.IsEditable = false; o.SubmittedAt = now(); o.Revision++;
    o.history.push({ FromStatus: 'DRAFT', ToStatus: 'SUBMITTED', ToStatusName: 'Pateiktas', ChangedAt: now(), ChangedBy: 'Jonas Jonaitis', Comment: p.Comment });
    return [[{ OrderId: o.OrderId, StatusCode: o.StatusCode, Revision: o.Revision }]];
  },
};

const fakeDb = {
  sql,
  toHttpError: require(path.join(API, 'db.js')).toHttpError,
  callProcedure: async (name, params = {}) => {
    const p = Object.fromEntries(Object.entries(params).map(([k, [, v]]) => [k, v]));
    log.push({ name, p });
    const fn = P[name];
    if (!fn) throw new Error('Imitacijoje nėra procedūros ' + name);
    const sets = fn(p);
    return { recordset: sets[0], recordsets: sets };
  },
};
const fakeAuth = (() => {
  const real = { ...require(path.join(API, 'auth.js')) };
  const identity = { issuer: 'x', subject: 'y', email: 'jonas@meistrai.lt', name: 'Jonas Jonaitis' };
  const ok = req => /^Bearer test\.token\.ok$/.test(req.headers.authorization || '');
  return {
    requireIdentity: (req, res, next) => { if (!ok(req)) return res.status(401).json({ error: 'Reikia prisijungti.' }); req.identity = identity; next(); },
    requireUser: async (req, res, next) => {
      if (!ok(req)) return res.status(401).json({ error: 'Reikia prisijungti.' });
      req.identity = identity;
      req.user = (await fakeDb.callProcedure('api.User_ResolveLogin', {})).recordset[0];
      next();
    },
    requireLevel: real.requireLevel,
  };
})();

// Viešų registrų imitacija (tikrų atsakymų pavyzdžiai, 2026-10-15)
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const u = String(url);
  const json = body => ({ ok: true, status: 200, json: async () => body });
  if (u.startsWith('https://get.data.gov.lt/')) {
    return json(u.endsWith('ja_kodas=305555555')
      ? { _data: [{ ja_kodas: 305555555, ja_pavadinimas: 'UAB "Durų meistras"', pilnas_adresas: null, reg_data: '2020-01-02', isreg_data: null }] }
      : { _data: [] });
  }
  if (u.startsWith('https://ec.europa.eu/')) {
    return json(u.endsWith('/100055555511')
      ? { isValid: true, userError: 'VALID', name: 'UAB "Durų meistras"', address: 'N/A' }
      : { isValid: false, userError: 'INVALID', name: '---', address: '---' });
  }
  return realFetch(url, opts);
};

const orig = Module._load;
Module._load = function (request, parent) {
  if (parent && parent.filename.startsWith(API) && (request === './db' || request === '../db')) return fakeDb;
  if (parent && parent.filename.startsWith(API) && request === './auth') return fakeAuth;
  return orig.apply(this, arguments);
};
require(path.join(API, 'server.js'));

// Testams: būsenos peržiūra (tik šiame imitaciniame serveryje)
const http = require('http');
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ orders: [...orders.values()], log }));
}).listen(Number(PORT) + 1);
