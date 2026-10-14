/* ==========================================================================
   Konfigūratoriaus paleidimas sistemoje.

   1. Prisijungimas (tas pats Microsoft prisijungimas kaip /uzsakymai).
   2. Katalogas iš duomenų bazės: naujam užsakymui — galiojanti (paskelbta)
      versija, esamam juodraščiui — TA versija, pagal kurią jis kurtas.
   3. Kainų variklis — tie patys failai, kurie skaičiuoja kainas serveryje.
   4. Užsakymo saugojimas: pozicijos (tik pasirinkimai) siunčiamos serveriui,
      jis apskaičiuoja kainas ir įrašo į DB. Visi įrašymai vyksta paeiliui,
      su versijos (Revision) patikra — du langai vienas kito neperrašys.

   Adresai:  /konfiguratorius/                 — naujas užsakymas
             /konfiguratorius/?uzsakymas=123   — tęsti juodraštį Nr. 123
   ========================================================================== */
import { initAuth, login } from '/js/auth.js';
import { api } from '/js/api.js';

const ENGINES = { ERKADO: 'erkado' };            // gamintojo kodas -> /engine/<aplankas>/
const $ = s => document.querySelector(s);

/* ---------- kraunama / klaida ---------- */
function bootMessage(text, isError) {
  const p = $('#bootMessage');
  p.textContent = text;
  p.className = isError ? 'boot-error' : '';
  $('#bootOverlay').hidden = false;
}
function bootActions(buttons) {
  const box = $('#bootActions');
  box.replaceChildren(...buttons.map(b => {
    const el = document.createElement(b.href ? 'a' : 'button');
    el.className = b.primary ? 'btn-primary' : 'btn-secondary';
    el.textContent = b.label;
    if (b.href) el.href = b.href; else { el.type = 'button'; el.onclick = b.onClick; }
    return el;
  }));
  box.hidden = !buttons.length;
}
function fail(text, buttons) {
  bootMessage(text, true);
  bootActions(buttons || [{ label: '← Į užsakymus', href: '/uzsakymai', primary: true }]);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Nepavyko įkelti ' + src));
    document.body.append(s);
  });
}

/* ---------- nuotraukos ---------- */
function createMedia(makerFolder) {
  const st = { baseUrl: null, query: '', timer: null };
  async function refresh() {
    try {
      const c = await api.get('/media/config');
      st.baseUrl = c.baseUrl; st.query = c.query || '';
      clearTimeout(st.timer);
      // Leidimas galioja ribotai — atnaujiname 10 min. prieš pabaigą
      if (c.expiresOn) st.timer = setTimeout(refresh, Math.max(60e3, new Date(c.expiresOn) - Date.now() - 10 * 60e3));
    } catch (e) {
      console.warn('Nuotraukų nustatymai negauti — rodomos schemos.', e);
    }
  }
  const url = file => (st.baseUrl
    ? `${st.baseUrl}/${makerFolder}/${encodeURIComponent(file)}${st.query ? '?' + st.query : ''}`
    : null);
  return { refresh, url };
}

/* ---------- įmonės pasirinkimas (administratoriui) ---------- */
let companiesCache = null;
async function chooseCompany() {
  if (!companiesCache) companiesCache = (await api.get('/admin/companies')).filter(c => c.Status === 'ACTIVE');
  if (!companiesCache.length) throw new Error('Nėra aktyvių įmonių — užsakymo išsaugoti negalima.');
  const sel = $('#companySelect');
  sel.replaceChildren(...companiesCache.map(c => {
    const o = document.createElement('option');
    o.value = String(c.CompanyId);
    o.textContent = `${c.Name} (${c.CompanyCode})`;
    return o;
  }));
  $('#companyModal').hidden = false;
  sel.focus();
  return new Promise(resolve => {
    $('#companyConfirm').onclick = () => {
      $('#companyModal').hidden = true;
      resolve(companiesCache.find(c => String(c.CompanyId) === sel.value));
    };
    $('#companyCancel').onclick = () => { $('#companyModal').hidden = true; resolve(null); };
  });
}

/* ---------- užsakymo saugojimas ---------- */
function createOrderStore({ me, catalogVersionId, existing }) {
  const o = {
    id: existing ? existing.OrderId : null,
    number: existing ? existing.OrderNumber : null,
    revision: existing ? existing.Revision : null,
    companyId: existing ? existing.CompanyId : null,
    header: {
      customerReference: existing ? existing.CustomerReference || '' : '',
      notes: existing ? existing.Notes || '' : '',
    },
  };
  let chain = Promise.resolve();
  let linesSeq = 0;
  // Visi įrašymai — griežtai paeiliui (kiekvienas naudoja ankstesnio grąžintą Revision)
  const enqueue = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };

  let creating = null;
  async function ensureCreated() {
    if (o.id) return;
    if (!creating) {
      creating = (async () => {
        let companyId = null;
        if (me.roleLevel >= 30) {
          const c = await chooseCompany();
          if (!c) throw new Error('Nepasirinkta įmonė — užsakymas neišsaugotas.');
          companyId = c.CompanyId;
          const buyer = $('#customerName');            // spausdinamam dokumentui
          if (buyer && !buyer.value) buyer.value = c.Name;
        }
        const r = await api.post('/orders', {
          catalogVersionId, companyId,
          customerReference: o.header.customerReference || null,
          notes: o.header.notes || null,
        });
        o.id = r.OrderId; o.number = r.OrderNumber; o.revision = r.Revision;
        history.replaceState(null, '', '/konfiguratorius/?uzsakymas=' + encodeURIComponent(o.id));
      })().finally(() => { creating = null; });
    }
    await creating;
  }

  return {
    number: () => o.number,
    header: () => ({ ...o.header }),
    /* Grąžina serverio sumas arba null, jei eilėje jau laukia naujesnis išsaugojimas. */
    saveLines(lines) {
      const my = ++linesSeq;
      return enqueue(async () => {
        if (my !== linesSeq) return null;
        await ensureCreated();
        const r = await api.put(`/orders/${o.id}/lines`, { revision: o.revision, lines });
        o.revision = r.Revision;
        return my === linesSeq ? r : null;
      });
    },
    saveHeader(h) {
      o.header = { customerReference: h.customerReference || '', notes: h.notes || '' };
      return enqueue(async () => {
        if (!o.id) return;                   // bus išsaugota kuriant užsakymą
        const r = await api.put(`/orders/${o.id}/header`, {
          revision: o.revision,
          customerReference: o.header.customerReference || null,
          notes: o.header.notes || null,
        });
        o.revision = r.Revision;
      });
    },
    submit() {
      return enqueue(async () => {
        if (!o.id) throw new Error('Užsakymas dar neišsaugotas.');
        await api.post(`/orders/${o.id}/status`, { status: 'SUBMITTED', revision: o.revision, comment: null });
        location.assign('/uzsakymai/' + encodeURIComponent(o.id));
      });
    },
  };
}

/* ---------- paleidimas ---------- */
async function start() {
  bootMessage('Kraunama…');
  let auth;
  try { auth = await initAuth(); } catch (e) { fail(e.message); return; }
  if (!auth.account) {
    bootMessage('Norėdami naudotis konfigūratoriumi, prisijunkite.');
    bootActions([{ label: 'Prisijungti su Microsoft', primary: true, onClick: () => login(location.pathname + location.search) }]);
    return;
  }

  let me;
  try { me = await api.get('/me'); } catch (e) {
    fail(e.status === 401 || e.status === 403 ? 'Prieiga uždrausta: ' + e.message : e.message);
    return;
  }

  const params = new URLSearchParams(location.search);
  const orderParam = params.get('uzsakymas');
  let existing = null, initialLines = [], catalogVersionId, vatRate;

  try {
    if (orderParam) {
      if (!/^\d{1,10}$/.test(orderParam)) { fail('Neteisingas užsakymo numeris adrese.'); return; }
      bootMessage('Kraunamas užsakymas…');
      const data = await api.get('/orders/' + orderParam);
      existing = data.order;
      if (!existing.IsEditable) {
        fail(`Užsakymas ${existing.OrderNumber} jau pateiktas (${existing.StatusName}) — jo keisti nebegalima.`, [
          { label: 'Peržiūrėti užsakymą', href: '/uzsakymai/' + existing.OrderId, primary: true },
          { label: 'Naujas užsakymas', href: '/konfiguratorius/' },
        ]);
        return;
      }
      catalogVersionId = existing.CatalogVersionId;
      vatRate = existing.VatRate;
      initialLines = data.lines
        .slice().sort((a, b) => a.LineNumber - b.LineNumber)
        .map(l => ({
          familyKey: l.configuration.familyKey, modelNo: l.configuration.modelNo,
          quantity: l.configuration.quantity, selections: l.configuration.selections,
        }));
    } else {
      const published = await api.get('/catalog/published');
      if (!published.length) { fail('Nėra galiojančio katalogo — kreipkitės į administratorių.'); return; }
      const wanted = params.get('gamintojas');
      let v = wanted ? published.find(x => x.ManufacturerCode === wanted) : published.length === 1 ? published[0] : null;
      if (!v) {
        bootMessage('Pasirinkite gamintoją:');
        bootActions(published.map(x => ({ label: `${x.ManufacturerName} — ${x.VersionName}`, href: '/konfiguratorius/?gamintojas=' + encodeURIComponent(x.ManufacturerCode) })));
        return;
      }
      catalogVersionId = v.CatalogVersionId;
      vatRate = v.VatRate;
    }

    bootMessage('Kraunamas katalogas…');
    const bundle = await api.get('/catalog/versions/' + catalogVersionId);
    const maker = ENGINES[bundle.manufacturer && bundle.manufacturer.code];
    if (!maker) { fail(`Gamintojo ${bundle.manufacturer && bundle.manufacturer.name} konfigūratorius dar neparuoštas.`); return; }

    const media = createMedia(maker);
    await media.refresh();

    window.__BUNDLE_JSON = JSON.stringify(bundle);
    for (const src of [`/engine/${maker}/bootstrap.js`, `/engine/${maker}/helpers.js`, '/konfiguratorius/katalogas.js',
      `/engine/${maker}/engine.js`, '/konfiguratorius/prodsheet.js', '/konfiguratorius/templates.js', '/konfiguratorius/app.js']) {
      await loadScript(src);
    }

    const order = createOrderStore({ me, catalogVersionId, existing });
    $('#versionBadge').textContent = `${bundle.manufacturer.name} · ${bundle.catalogVersion.code}`;
    window.startConfigurator({
      media: media.url,
      vatRate,
      order,
      catalogName: bundle.catalogVersion.name,
      userName: me.displayName || me.email,
      companyName: existing ? existing.CompanyName : me.companyName,
      initialLines,
      initialTotals: existing ? { NetTotal: existing.NetTotal, VatTotal: existing.VatTotal, GrossTotal: existing.GrossTotal } : null,
    });
    $('#bootOverlay').hidden = true;
  } catch (e) {
    console.error(e);
    fail(e.message || String(e));
  }
}

start();
