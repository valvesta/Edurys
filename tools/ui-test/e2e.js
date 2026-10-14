'use strict';
/* ==========================================================================
   Konfigūratoriaus testas „nuo galo iki galo“: naršyklė -> tikras API
   serveris (kainos — tikru varikliu) -> duomenų bazės imitacija.

   Tikrinama: prisijungimas, katalogo įkėlimas iš API, nuotraukos per
   /api/media/config, pozicijų įtraukimas / redagavimas / šalinimas ir
   išsaugojimas, serverio ir naršyklės sumų sutapimas, antraštė, juodraščio
   atkūrimas perkrovus puslapį, pateikimas, administratoriaus įmonės
   pasirinkimas, saugumo politika (CSP) — jokių naršyklės klaidų.

   Paleidimas: node tools/ui-test/e2e.js
   ========================================================================== */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { chromium } = require('playwright');

const FAKE_MSAL = `window.msal = { InteractionRequiredAuthError: class extends Error {}, PublicClientApplication: class {
  constructor(c) { this.c = c; } async initialize() {} async handleRedirectPromise() { return null; }
  getActiveAccount() { return sessionStorage.getItem('fake') ? { username: 'jonas@meistrai.lt' } : null; }
  getAllAccounts() { const a = this.getActiveAccount(); return a ? [a] : []; } setActiveAccount() {}
  loginRedirect(r) { sessionStorage.setItem('fake', '1'); location.href = r.state || '/'; }
  logoutRedirect() { sessionStorage.removeItem('fake'); location.href = '/'; }
  async acquireTokenSilent() { return { accessToken: 'test.token.ok' }; } } };`;

function png(w, h) {   // mažas teisingas PNG
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x99); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function startServer(role, port) {
  const media = fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
  fs.mkdirSync(path.join(media, 'erkado'));
  fs.writeFileSync(path.join(media, 'erkado', 'werbena-hero.jpg'), png(40, 20));   // turinys PNG — naršyklei nesvarbu
  fs.writeFileSync(path.join(media, 'erkado', 'werbena-1.png'), png(20, 40));
  const p = spawn(process.execPath, [path.join(__dirname, 'mock-server.js')], {
    env: { ...process.env, PORT: String(port), ROLE: role, MEDIA_DEV_DIR: media, NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; process.stderr.write(d); });
  return new Promise((resolve, reject) => {
    const t = setInterval(() => { if (out.includes('klausosi')) { clearInterval(t); resolve(p); } }, 50);
    setTimeout(() => { clearInterval(t); reject(new Error('Serveris nepasileido: ' + out)); }, 15000);
  });
}
const state = async port => (await fetch(`http://localhost:${port + 1}/`)).json();
const assert = (c, m) => { if (!c) throw new Error('NEPAVYKO: ' + m); console.log('  ✓ ' + m); };

async function newPage(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route('**/vendor/msal-browser-4.30.0.min.js', r => r.fulfill({ contentType: 'application/javascript', body: FAKE_MSAL }));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) page.errors.push('console: ' + m.text()); });
  await page.goto(base + '/');
  await page.evaluate(() => sessionStorage.setItem('fake', '1'));
  return page;
}

/* Užpildo privalomus laukus, kol pozicija tampa galima, ir įtraukia ją. */
async function configureAndAdd(page, familyKey, model, qty, extraClicks = 0) {
  await page.evaluate(k => document.querySelector(`.family-item[data-key="${k}"]`).click(), familyKey);
  await page.evaluate(i => document.querySelectorAll('.model-card')[i].click(), model);
  for (let k = 0; k < extraClicks; k++) {
    await page.evaluate(k2 => { const b = Array.from(document.querySelectorAll('#groups .pill:not([disabled]):not(.selected)')); if (b.length) b[(k2 * 7) % b.length].click(); }, k);
  }
  for (let k = 0; k < 15; k++) {
    const done = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#groups .req-empty [data-attr][data-value]:not([disabled])'));
      if (!b.length) return true;
      b[0].click(); return false;
    });
    if (done) break;
  }
  const enabled = await page.evaluate(() => !document.querySelector('#addToOrder').disabled);
  if (!enabled) throw new Error('Pozicijos įtraukti nepavyko: ' + await page.evaluate(() => document.querySelector('#missingHint').textContent));
  await page.evaluate(q => { document.querySelector('#qty').value = String(q); document.querySelector('#addToOrder').click(); }, qty);
}
const waitSaved = page => page.waitForFunction(() => {
  const s = document.querySelector('#orderStatus').dataset.state;
  return s === 'saved' || s === 'error' || s === 'mismatch';
}, null, { timeout: 15000 }).then(() => page.evaluate(() => ({ state: document.querySelector('#orderStatus').dataset.state, text: document.querySelector('#orderStatus').textContent })));

async function companyRep(browser) {
  console.log('Įmonės atstovas:');
  const port = 18091, base = `http://localhost:${port}`;
  const srv = await startServer('COMPANY_REP', port);
  try {
    const page = await newPage(browser, base);
    await page.goto(base + '/uzsakymai');
    await page.waitForSelector('[data-role=new-order]');
    await page.click('[data-role=new-order]');
    await page.waitForFunction(() => document.querySelector('#bootOverlay').hidden);
    assert(page.url() === base + '/konfiguratorius/', 'mygtukas „+ Naujas užsakymas“ atidaro konfigūratorių');
    assert(await page.evaluate(() => document.querySelector('#orderStatus').dataset.state) === 'new', 'naujas užsakymas dar neišsaugotas');
    assert((await state(port)).orders.length === 0, 'kol nėra pozicijų, užsakymas DB nekuriamas');

    const heroSrc = await page.evaluate(() => document.querySelector('.family-item[data-key="WERBENA"] img').getAttribute('src'));
    assert(heroSrc === '/dev-media/erkado/werbena-hero.jpg', 'nuotraukų adresai iš /api/media/config');
    await page.waitForFunction(() => { const i = document.querySelector('.family-item[data-key="WERBENA"] img'); return i.complete && i.naturalWidth > 0; });
    assert(true, 'nuotrauka užsikrauna');
    assert(await page.evaluate(() => document.querySelector('#versionBadge').textContent) === 'ERKADO · 2026-I', 'rodoma katalogo versija');

    await configureAndAdd(page, 'WERBENA', 0, 1);
    let st = await waitSaved(page);
    assert(st.state === 'saved', 'pirma pozicija išsaugota (' + st.text.trim().replace(/\s+/g, ' ') + ')');
    assert(/\?uzsakymas=101$/.test(page.url()), 'adrese — užsakymo nr. (perkrovus tęsiama)');
    let db = (await state(port)).orders[0];
    assert(db.lines.length === 1 && db.CompanyId === 1, 'DB: 1 eilutė, savo įmonė');

    await page.evaluate(() => document.querySelector('#startNew').click());
    await configureAndAdd(page, 'PANEL_ALTAMURA', 1, 2, 3);
    st = await waitSaved(page);
    assert(st.state === 'saved', 'antra pozicija išsaugota');
    await page.evaluate(() => document.querySelector('#startNew').click());
    await configureAndAdd(page, 'PAINTED_JASMIN', 2, 3, 5);
    st = await waitSaved(page);
    db = (await state(port)).orders[0];
    const ui = await page.evaluate(() => cartTotals());
    assert(db.lines.length === 3, 'DB: 3 eilutės');
    assert(ui.net === db.NetTotal && ui.vat === db.VatTotal && ui.gross === db.GrossTotal, `naršyklės ir serverio sumos sutampa (${ui.gross} €)`);
    const pricedOnly = (await state(port)).log.filter(x => x.name === 'api.Order_SaveLines').every(x => JSON.parse(x.p.LinesJson).every(l => l.engineVersion && l.priceBreakdown.length));
    assert(pricedOnly, 'eilutes įkainojo serveris (variklio versija, išskaidymas)');

    // Redagavimas: pozicija atnaujinama toje pačioje vietoje
    await page.evaluate(() => document.querySelector('.tab[data-view="cart"]').click());
    await page.evaluate(() => document.querySelectorAll('#cartList [data-edit]')[0].click());
    assert(await page.evaluate(() => document.querySelector('#addToOrder').textContent) === 'Atnaujinti poziciją Nr. 1', 'redaguojant mygtukas „Atnaujinti poziciją Nr. 1“');
    assert((await state(port)).orders[0].lines.length === 3, 'pradėjus redaguoti pozicija iš DB nedingsta');
    await page.evaluate(() => { document.querySelector('#qty').value = '4'; document.querySelector('#addToOrder').click(); });
    await waitSaved(page);
    db = (await state(port)).orders[0];
    assert(db.lines.length === 3 && db.lines[0].Quantity === 4, 'atnaujinta 1 pozicija (kiekis 4), eilučių vis dar 3');

    // Šalinimas
    await page.evaluate(() => document.querySelector('.tab[data-view="cart"]').click());
    await page.evaluate(() => document.querySelectorAll('#cartList [data-idx]')[1].click());
    await waitSaved(page);
    db = (await state(port)).orders[0];
    assert(db.lines.length === 2 && db.lines[1].FamilyCode === 'PAINTED_JASMIN', 'pašalinta 2 pozicija');

    // Antraštė
    await page.fill('#customerRef', 'Vilnius, Žirmūnų g. 5');
    await page.fill('#orderNotes', 'Pristatyti iki lapkričio 10 d.');
    await page.click('#senderName');
    await page.waitForFunction(() => document.querySelector('#orderStatus').dataset.state === 'saved');
    db = (await state(port)).orders[0];
    assert(db.CustomerReference === 'Vilnius, Žirmūnų g. 5' && db.Notes === 'Pristatyti iki lapkričio 10 d.', 'objektas ir pastabos išsaugoti');
    const inv = await page.evaluate(() => document.querySelector('#invoiceSheet').textContent);
    assert(inv.includes('2026-000101') && inv.includes('Jonas Jonaitis'), 'sąskaitoje — sistemos užsakymo nr. ir pateikėjas');

    // Perkrovimas: juodraštis atkuriamas
    const before = await page.evaluate(() => ({ t: cartTotals(), n: state.cart.length, prod: document.querySelector('#prodScale').innerHTML }));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#bootOverlay').hidden);
    const after = await page.evaluate(() => { document.querySelector('.tab[data-view="cart"]').click(); return { t: cartTotals(), n: state.cart.length, st: document.querySelector('#orderStatus').dataset.state, ref: document.querySelector('#customerRef').value, prod: document.querySelector('#prodScale').innerHTML }; });
    assert(after.n === 2 && JSON.stringify(after.t) === JSON.stringify(before.t), 'perkrovus atkurtos tos pačios pozicijos ir sumos');
    assert(after.prod === before.prod, 'perkrovus gamybos lapas identiškas');
    assert(after.st === 'saved' && after.ref === 'Vilnius, Žirmūnų g. 5', 'perkrovus būsena „Išsaugota“, objektas atkurtas');

    // Pateikimas
    await page.click('#submitOrder');
    await page.waitForSelector('#submitModal:not([hidden])');
    await page.click('#submitConfirm');
    await page.waitForURL(base + '/uzsakymai/101');
    db = (await state(port)).orders[0];
    assert(db.StatusCode === 'SUBMITTED', 'užsakymas pateiktas, atidaryta užsakymo kortelė');
    await page.goto(base + '/konfiguratorius/?uzsakymas=101');
    await page.waitForFunction(() => document.querySelector('#bootMessage').textContent.includes('jau pateiktas'));
    assert(true, 'pateikto užsakymo konfigūratoriuje keisti neleidžiama');

    if (page.errors.length) throw new Error('Naršyklės klaidos:\n' + page.errors.join('\n'));
    assert(true, 'jokių naršyklės ar CSP klaidų');
  } finally { srv.kill(); }
}

async function admin(browser) {
  console.log('Administratorius:');
  const port = 18093, base = `http://localhost:${port}`;
  const srv = await startServer('GLOBAL_ADMIN', port);
  try {
    const page = await newPage(browser, base);
    await page.goto(base + '/konfiguratorius/');
    await page.waitForFunction(() => document.querySelector('#bootOverlay').hidden);
    await configureAndAdd(page, 'WERBENA', 3, 1);
    await page.waitForSelector('#companyModal:not([hidden])');
    const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#companySelect option')).map(o => o.textContent));
    assert(opts.length === 1 && opts[0].startsWith('UAB Statybų meistrai'), 'siūlomos tik aktyvios įmonės');
    await page.click('#companyConfirm');
    const st = await waitSaved(page);
    assert(st.state === 'saved', 'pasirinkus įmonę užsakymas išsaugotas');
    const db = (await state(port)).orders[0];
    assert(db.CompanyId === 1, 'užsakymas sukurtas pasirinktai įmonei');
    if (page.errors.length) throw new Error('Naršyklės klaidos:\n' + page.errors.join('\n'));
  } finally { srv.kill(); }
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  try {
    await companyRep(browser);
    await admin(browser);
    console.log('OK: konfigūratoriaus e2e testas praėjo.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message || e); process.exit(1); });
