'use strict';
/* ==========================================================================
   Konfigūratoriaus atitikties testas: NAUJAS (web/konfiguratorius, katalogas
   iš DB paketo) prieš ORIGINALĄ (catalog-sources/erkado/2026-I/ui + data.js).

   Abu puslapiai atidaromi naršyklėje ir vienodai „spaudinėjami“ atsitiktinai
   (tas pats atsitiktinių skaičių generatorius). Po kiekvieno žingsnio
   palyginamas visas matomas turinys: šeimų sąrašas, modeliai, visi
   pasirinkimai, kainos išskaidymas, užsakymo pozicijos, sąskaita ir gamybos
   lapas. Bet koks skirtumas — testas krenta.

   Sąmoningi pakeitimai (originalui pritaikomi prieš lyginant, kad testas
   tikrintų, jog KITKAS nepasikeitė):
     1. PVM skaičiuojamas sveikais centais (kaip duomenų bazėje), ne round2(net*0,21).
     2. Pozicijos suma su PVM rodoma ta pati, kuri bus duomenų bazėje
        (iš sąskaitos eilučių), ne unitGross × kiekis.
     3. Kol nepasirinktas dekoras: „Varčia nuo“ — mažiausia kaina, o vietoj
        išskaidymo — užuomina pasirinkti dekorą (katalogo DB kainos saugomos
        pagal dekoro grupę, todėl „be dekoro“ kainos nėra).
        Šios funkcijos paimamos iš naujojo app.js / templates.js.
   Nelyginama: sąskaitos poraštės tekstas (nurodo katalogą sistemoje).

   Paleidimas:  node tools/ui-test/equivalence.js [scenarijų sk.] [sėkla]
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ORIG = path.join(ROOT, 'catalog-sources', 'erkado', '2026-I');
const NEW = path.join(ROOT, 'web', 'konfiguratorius');
const ENGINE = path.join(ROOT, 'api', 'src', 'engines', 'erkado');
const BUNDLE = path.join(ROOT, 'db', 'catalog', 'erkado-2026-I.bundle.json');

const SCENARIOS = Number(process.argv[2] || process.env.UI_SCENARIOS || 150);
const SEED = Number(process.argv[3] || process.env.UI_SEED || 20261014);
const STEPS = 14;

const read = f => fs.readFileSync(f, 'utf8');

/* ---- Sąmoningi pakeitimai, pritaikomi originalui ---- */
const VAT_HELPER = `
function __vatOf(net) { const c = Math.round(net * 100); return Math.round(c * 2100 / 10000) / 100; }
`;
const ORIGINAL_PATCHES = [
  ['round2(sub * SHARED_EXTRAS.vatRate + sub)', 'round2(sub + __vatOf(sub))'],
  ['const vat = round2(grandNet * SHARED_EXTRAS.vatRate);', 'const vat = __vatOf(grandNet);'],
  ['const vat = round2(net * 0.21);', 'const vat = __vatOf(net);'],
  ["mini.innerHTML = state.cart.map(i => `<div class=\"cart-mini-row\"><span>${esc(i.familyLabel)} ${i.modelNo} × ${i.qty}</span><strong>${money(round2(i.unitGross * i.qty))}</strong></div>`).join('');",
   "mini.innerHTML = state.cart.map((i, idx) => `<div class=\"cart-mini-row\"><span>${esc(i.familyLabel)} ${i.modelNo} × ${i.qty}</span><strong>${money(invoiceLines()[idx].gross)}</strong></div>`).join('');"],
  ['<div class="cr-price">${money(round2(item.unitGross * item.qty))}</div>', '<div class="cr-price">${money(invoiceLines()[idx].gross)}</div>'],
];
const fnSource = (file, name) => {
  const src = read(file);
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`Nerasta funkcija ${name} faile ${file}`);
  let depth = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
  return src.slice(i, j + 1) + '\n';
};
ORIGINAL_PATCHES.push(
  ['const price = f.basePrice(n, f.decorOptions[0] ? f.decorOptions[0][0] : null);',
   'const price = pickedBasePrice(f, n, f.decorOptions[0] ? f.decorOptions[0][0] : null);'],
  ["$('#pickedPrice').textContent = `Varčia nuo ${money(f.basePrice(n, state.selections.DECOR))} be PVM`;",
   "$('#pickedPrice').textContent = `Varčia nuo ${money(pickedBasePrice(f, n, state.selections.DECOR))} be PVM`;"],
  ["$('#thisUnitBreakdown').innerHTML = html;",
   // originale kaina be dekoro egzistuoja, todėl atitikmuo — „dekoras pasirinktas“
   "$('#thisUnitBreakdown').innerHTML = s.DECOR && isPriced(p) ? html : tplBreakdownPending(FAMILIES[state.familyKey].line === 'PAINTED' ? 'spalvą' : 'dekorą');"],
);
function patchedOriginalApp() {
  let s = read(path.join(ORIG, 'ui', 'app.js'));
  s += '\n' + fnSource(path.join(NEW, 'app.js'), 'pickedBasePrice') + fnSource(path.join(NEW, 'app.js'), 'isPriced') +
    fnSource(path.join(NEW, 'templates.js'), 'tplBreakdownPending');
  for (const [a, b] of ORIGINAL_PATCHES) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(`Originalo pataisa rasta ${n} kartų (turi būti 1): ${a.slice(0, 60)}`);
    s = s.replace(a, b);
  }
  // Paleidimą valdo testas (užsakymo numerio langas nereikalingas)
  return VAT_HELPER + s;
}

function newIndexHtml() {
  let s = read(path.join(NEW, 'index.html'));
  s = s.replace(/<script[^>]*msal[^>]*><\/script>/, '').replace(/<script type="module"[^>]*><\/script>/, '');
  const scripts = ['bundle.js', 'engine/bootstrap.js', 'engine/helpers.js', 'katalogas.js', 'engine/engine.js',
    'prodsheet.js', 'templates.js', 'app.js', 'start.js'];
  return s.replace('</body>', scripts.map(f => `<script src="/new/${f}"></script>`).join('\n') + '\n</body>')
    .replace('/konfiguratorius/styles.css', '/new/styles.css');
}

const FILES = {
  '/orig/index.html': () => read(path.join(ORIG, 'ui', 'index.html')),
  '/orig/styles.css': () => read(path.join(ORIG, 'ui', 'styles.css')),
  '/orig/data.js': () => read(path.join(ORIG, 'data.js')),
  '/orig/glass.js': () => read(path.join(ORIG, 'glass.js')),
  '/orig/engine.js': () => read(path.join(ORIG, 'engine.js')),
  '/orig/prodsheet.js': () => read(path.join(ORIG, 'ui', 'prodsheet.js')),
  '/orig/app.js': patchedOriginalApp,
  '/new/index.html': newIndexHtml,
  '/new/styles.css': () => read(path.join(NEW, 'styles.css')),
  '/new/bundle.js': () => `window.__BUNDLE_JSON = ${JSON.stringify(read(BUNDLE))};`,
  '/new/engine/bootstrap.js': () => read(path.join(ENGINE, 'bootstrap.js')),
  '/new/engine/helpers.js': () => read(path.join(ENGINE, 'helpers.js')),
  '/new/engine/engine.js': () => read(path.join(ENGINE, 'engine.js')),
  '/new/katalogas.js': () => read(path.join(NEW, 'katalogas.js')),
  '/new/prodsheet.js': () => read(path.join(NEW, 'prodsheet.js')),
  '/new/templates.js': () => read(path.join(NEW, 'templates.js')),
  '/new/app.js': () => read(path.join(NEW, 'app.js')),
  '/new/start.js': () => `startConfigurator({ media: f => 'assets/' + f, vatRate: 0.21, order: null,
    catalogName: '', userName: '', companyName: null, initialLines: [] });
    document.getElementById('bootOverlay').hidden = true;`,
};

/* ---- Deterministinis atsitiktinumas ---- */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---- Puslapio būsenos nuotrauka ---- */
const SNAPSHOT = () => {
  const norm = h => h
    .replace(/ onerror="[^"]*"/g, '')
    .replace(/ data-fallback(-done)?="[^"]*"/g, '')
    .replace(/<div class="inv-footnote">[\s\S]*?<\/div>/, '<div class="inv-footnote"></div>');
  const html = sel => { const e = document.querySelector(sel); return e ? norm(e.innerHTML) : null; };
  const vis = sel => { const e = document.querySelector(sel); return e ? !e.hidden : null; };
  return {
    familyGroups: html('#familyGroups'), railSummary: html('#railSummary'), pending: html('#pendingList'),
    hero: [html('#heroTitle'), html('#heroEyebrow'), html('#heroPages'), html('#modelCount')].join('|'),
    modelGrid: html('#modelGrid'),
    picked: [html('.picked-copy'), document.querySelector('#pickedImage').getAttribute('src')].join('|'),
    messages: html('#messages'), groups: html('#groups'),
    breakdown: html('#thisUnitBreakdown'), validDot: document.querySelector('#validDot').className,
    missing: vis('#missingHint') ? html('#missingHint') : '',
    addDisabled: document.querySelector('#addToOrder').disabled, postAdd: vis('#postAddActions'),
    cartMini: html('#cartMini'), cartMiniTotal: html('#cartMiniTotal'), cartCount: html('#tabCartCount'),
    cartView: vis('#cartView'),
    cartList: vis('#cartView') ? html('#cartList') : '', invoice: vis('#cartView') ? html('#invoiceSheet') : '',
    prod: vis('#cartView') ? html('#prodScale') : '',
  };
};

/* Galimi veiksmai — tie patys abiejuose puslapiuose (pagal DOM) */
const CANDIDATES = () => {
  const out = [];
  document.querySelectorAll('#groups [data-attr][data-value]:not([disabled])').forEach((e, i) => out.push(['btn', i]));
  document.querySelectorAll('#groups [data-toggle]:not([disabled])').forEach((e, i) => out.push(['tog', i]));
  document.querySelectorAll('#groups select:not([disabled]), #pickedIntarsia select:not([disabled])').forEach((e, i) => {
    const n = Array.from(e.options).filter(o => !o.disabled).length;
    if (n) out.push(['sel', i, n]);
  });
  document.querySelectorAll('#groups input[type=number]').forEach((e, i) => out.push(['num', i]));
  return out;
};
const ACT = ([kind, i, j]) => {
  if (kind === 'btn') document.querySelectorAll('#groups [data-attr][data-value]:not([disabled])')[i].click();
  else if (kind === 'tog') document.querySelectorAll('#groups [data-toggle]:not([disabled])')[i].click();
  else if (kind === 'sel') {
    const el = document.querySelectorAll('#groups select:not([disabled]), #pickedIntarsia select:not([disabled])')[i];
    const opts = Array.from(el.options).filter(o => !o.disabled);
    el.value = opts[j].value; el.dispatchEvent(new Event('change'));
  } else if (kind === 'num') {
    const el = document.querySelectorAll('#groups input[type=number]')[i];
    el.value = String(j); el.dispatchEvent(new Event('input'));
  }
};

async function main() {
  const browser = await chromium.launch({
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: ['--disable-features=AutofillServerCommunication,Translate,OptimizationHints'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route('http://ui.test/**', route => {
    const p = new URL(route.request().url()).pathname;
    if (p.includes('/assets/')) return route.fulfill({ status: 404, body: '' });
    const f = FILES[p];
    if (!f) return route.fulfill({ status: 404, body: 'nėra: ' + p });
    const type = p.endsWith('.html') ? 'text/html' : p.endsWith('.css') ? 'text/css' : 'application/javascript';
    return route.fulfill({ status: 200, contentType: type + '; charset=utf-8', body: f() });
  });
  const errors = [];
  const open = async (url) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(url + ': ' + e.message));
    page.on('dialog', d => d.dismiss());
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#modelGrid .model-card'));
    return page;
  };
  const A = await open('http://ui.test/orig/index.html');
  const B = await open('http://ui.test/new/index.html');
  // originale užsakymo numerio langas — uždarome taip pat, kaip naudotojas
  await A.evaluate(() => { document.querySelector('#orderNumber').value = 'juodraštis'; document.querySelector('#orderNumberModal').hidden = true; });

  let compared = 0;
  const check = async (where) => {
    // palaukiame, kol nuotraukos užsikraus arba bus pakeistos schema
    const settled = () => Array.from(document.images).every(i => i.complete);
    await Promise.all([A.waitForFunction(settled), B.waitForFunction(settled)]);
    await Promise.all([A.waitForTimeout(0), B.waitForTimeout(0)]);
    await Promise.all([A.waitForFunction(settled), B.waitForFunction(settled)]);
    const [a, b] = await Promise.all([A.evaluate(SNAPSHOT), B.evaluate(SNAPSHOT)]);
    compared++;
    for (const k of Object.keys(a)) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        const sa = String(a[k]), sb = String(b[k]);
        let i = 0; while (i < sa.length && sa[i] === sb[i]) i++;
        throw new Error(`Skirtumas (${where}) laukelyje „${k}“ ties ${i} simboliu:\n  originalas: …${sa.slice(Math.max(0, i - 120), i + 200)}\n  naujas:     …${sb.slice(Math.max(0, i - 120), i + 200)}`);
      }
    }
    if (errors.length) throw new Error('Naršyklės klaidos: ' + errors.join('\n'));
  };
  const both = async (fn, arg) => { await A.evaluate(fn, arg); await B.evaluate(fn, arg); };

  await check('pradžia');
  const families = await A.evaluate(() => Object.keys(FAMILIES));
  const order = await A.evaluate(() => [].concat(FAMILY_ORDER, FAMILY_ORDER_TIER2, FAMILY_ORDER_PAINTED, FAMILY_ORDER_PAINTED_PANEL, FAMILY_ORDER_PANEL));
  const orderNew = await B.evaluate(() => [].concat(FAMILY_ORDER, FAMILY_ORDER_TIER2, FAMILY_ORDER_PAINTED, FAMILY_ORDER_PAINTED_PANEL, FAMILY_ORDER_PANEL));
  if (JSON.stringify(order) !== JSON.stringify(orderNew)) throw new Error('Šeimų tvarka skiriasi');

  const R = rng(SEED);
  const pick = n => Math.floor(R() * n);
  let added = 0;
  const t0 = Date.now();
  for (let s = 0; s < SCENARIOS; s++) {
    if (s && s % 25 === 0) console.log(`  … ${s}/${SCENARIOS} scenarijų, ${compared} palyginimų, ${Math.round((Date.now() - t0) / 1000)} s`);
    // kas antrą scenarijų pradedame nuo švaraus lapo
    if (s > 0 && R() < 0.5) await both(() => document.querySelector('#startNew') && !document.querySelector('#postAddActions').hidden && document.querySelector('#startNew').click());
    const fam = families[(s * 7 + pick(families.length)) % families.length];
    await both(k => document.querySelector(`.family-item[data-key="${CSS.escape(k)}"]`).click(), fam);
    const nModels = await A.evaluate(() => document.querySelectorAll('.model-card').length);
    await both(i => document.querySelectorAll('.model-card')[i].click(), pick(nModels));
    await check(`${fam} modelis`);
    for (let step = 0; step < STEPS; step++) {
      const cands = await A.evaluate(CANDIDATES);
      if (!cands.length) break;
      const c = cands[pick(cands.length)];
      const action = c[0] === 'sel' ? ['sel', c[1], pick(c[2])] : c[0] === 'num' ? ['num', c[1], 1 + pick(4)] : c;
      await both(ACT, action);
      await check(`${fam}, žingsnis ${step} ${JSON.stringify(action)}`);
    }
    // Privalomi laukai: renkamės iš paryškintų (req-empty) blokų, kol konfigūracija tampa galima
    for (let k = 0; k < 12; k++) {
      const req = await A.evaluate(() => {
        const all = Array.from(document.querySelectorAll('#groups [data-attr][data-value]:not([disabled])'));
        return all.map((e, i) => (e.closest('.req-empty') ? i : -1)).filter(i => i >= 0);
      });
      if (!req.length) break;
      const action = ['btn', req[pick(req.length)]];
      await both(ACT, action);
      await check(`${fam}, privalomas ${JSON.stringify(action)}`);
    }
    const canAdd = await A.evaluate(() => !document.querySelector('#addToOrder').disabled);
    if (canAdd) {
      const qty = 1 + pick(3);
      await both(q => { document.querySelector('#qty').value = String(q); document.querySelector('#addToOrder').click(); }, qty);
      added++;
      await check(`${fam} įtraukta į užsakymą`);
      if (R() < 0.3) { await both(() => document.querySelector('#copyEntry').click()); await check('kopijuoti įrašą'); }
    }
    if (s % 10 === 9) {
      await both(() => document.querySelector('.tab[data-view="cart"]').click());
      await check('užsakymo vaizdas');
      const n = await A.evaluate(() => document.querySelectorAll('#cartList [data-idx]').length);
      if (n > 3) { await both(i => document.querySelectorAll('#cartList [data-idx]')[i].click(), pick(n)); await check('pozicija pašalinta'); }
      await both(() => document.querySelector('.tab[data-view="configurator"]').click());
    }
    // Užsakymas neauga be galo (tikri užsakymai — iki kelių dešimčių pozicijų)
    if (s % 40 === 39) { await both(() => { state.cart.length = 0; renderCartMini(); }); await check('užsakymas išvalytas'); }
  }
  await both(() => document.querySelector('.tab[data-view="cart"]').click());
  await check('galutinis užsakymas');
  const totals = await B.evaluate(() => cartTotals());
  console.log(`OK: ${SCENARIOS} scenarijų, ${compared} palyginimų, į užsakymą įtraukta ${added} poz., galutinė suma ${totals.gross} € (sėkla ${SEED}).`);
  await browser.close();
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
