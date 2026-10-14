const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const money = n => new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));

function numberToWordsLT(n) {
  n = Math.floor(n);
  if (n === 0) return 'nulis';
  const ones = ['', 'vienas', 'du', 'trys', 'keturi', 'penki', 'šeši', 'septyni', 'aštuoni', 'devyni'];
  const teens = ['dešimt', 'vienuolika', 'dvylika', 'trylika', 'keturiolika', 'penkiolika', 'šešiolika', 'septyniolika', 'aštuoniolika', 'devyniolika'];
  const tens = ['', '', 'dvidešimt', 'trisdešimt', 'keturiasdešimt', 'penkiasdešimt', 'šešiasdešimt', 'septyniasdešimt', 'aštuoniasdešimt', 'devyniasdešimt'];

  function under100(x) {
    if (x === 0) return '';
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10), o = x % 10;
    return tens[t] + (o ? ' ' + ones[o] : '');
  }
  function under1000(x) {
    if (x === 0) return '';
    const h = Math.floor(x / 100), rest = x % 100;
    let out = '';
    if (h > 0) out += (h === 1 ? 'šimtas' : ones[h] + ' šimtai');
    if (rest > 0) out += (out ? ' ' : '') + under100(rest);
    return out;
  }
  // noun agreement based on last two digits of the given group value
  function nounForm(groupVal, singular, pluralNom, pluralGen) {
    const last2 = groupVal % 100;
    const last1 = groupVal % 10;
    if (last2 >= 11 && last2 <= 19) return pluralGen;
    if (last1 === 1) return singular;
    if (last1 >= 2 && last1 <= 9) return pluralNom;
    return pluralGen; // ends in 0
  }

  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;

  const parts = [];
  if (millions > 0) {
    if (millions !== 1) parts.push(under1000(millions));
    parts.push(nounForm(millions, 'milijonas', 'milijonai', 'milijonų'));
  }
  if (thousands > 0) {
    if (thousands !== 1) parts.push(under1000(thousands));
    parts.push(nounForm(thousands, 'tūkstantis', 'tūkstančiai', 'tūkstančių'));
  }
  if (rest > 0 || parts.length === 0) {
    const r = under1000(rest);
    if (r) parts.push(r);
  }
  return parts.filter(Boolean).join(' ');
}

function amountToWordsLT(amount) {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);
  function eurNoun(n) {
    const last2 = n % 100, last1 = n % 10;
    if (last2 >= 11 && last2 <= 19) return 'eurų';
    if (last1 === 1) return 'euras';
    if (last1 >= 2 && last1 <= 9) return 'eurai';
    return 'eurų';
  }
  const eurWords = numberToWordsLT(euros);
  const eurNounWord = eurNoun(euros);
  const centsStr = String(cents).padStart(2, '0');
  return `${eurWords} ${eurNounWord} ${centsStr} ct.`;
}

const DOOR_TYPE_NAME = { REBATED: 'Užlaidinė', FLUSH: 'Lygiabriaunė', REVERSIBLE: 'Reversinė', SLIDING: 'Stumdoma' };
const DECOR_SWATCH = {
  GREKO_WALNUT:'#77533e', GREKO_DARKOAK:'#6b4c34', GREKO_GOLDOAK:'#b58b54', GREKO_OAK:'#a9835a',
  GREKO_GREYOAK:'#a8a49b', GREKO_SONOMA:'#c8b193', GREKO_ACACIA:'#cbb08a', GREKO_WHITE:'#efefeb', GREKO_SNOW:'#f6f6f3',
  PREMIUM_OAKNAT:'#b49a73', PREMIUM_OAK:'#a88a61', PREMIUM_ASH:'#706d68', PREMIUM_MAPLE:'#b6b5ae',
  PREMIUM_WHITETEX:'#ecece8', PREMIUM_WHITE:'#f2f1ed', PREMIUM_WALNUTCL:'#8c6545',
  CPL_WENGE:'#4f372a', CPL_OAK:'#9c7b56', CPL_GREYOAK:'#9f9487', CPL_ANTHRACITE:'#4f5254', CPL_BLACK:'#181818',
  CPL_DARKGREEN:'#2c4f42', CPL_CAPPUCCINO:'#c7bdad', CPL_WHITE:'#efefec', CPL_LIGHTGREY:'#aaa9a5',
  CPL_GREY:'#b9b7b0', CPL_SAGE:'#87988d', CPL_STONEGREY:'#aaa096',
  /* CPL 0,2 ir CPL 0,7 — tos pačios spalvos, skiriasi tik danga (patvirtino
     Valdas Vėdaras, 2026-09-18): kiekviena CPL07_* spalva naudoja tą patį
     atspalvį kaip jos CPL02_* atitikmuo. */
  CPL02_GREY:'#b0aca3', CPL02_OAKRETRO:'#c9a06e', CPL02_OAKCLASSIC:'#a9835a',
  CPL02_ANTHSATIN:'#54585a', CPL02_WALNUTCL:'#8c6545', CPL02_WHITE:'#efefec',
  CPL07_GREY:'#b0aca3', CPL07_OAKRETRO:'#c9a06e', CPL07_OAKCLASSIC:'#a9835a',
  CPL07_WALNUTCL:'#8c6545', CPL07_WHITE:'#efefec',
};

const state = { familyKey: 'WERBENA', modelNo: 1, selections: {}, cfg: null, price: null, cart: [], railTouched: false };

function familyThumb(key) {
  return `assets/${key.toLowerCase()}-hero.jpg`;
}
function modelImg(key, n) {
  return `assets/${key.toLowerCase()}-${n}.png`;
}
function doorPlaceholderSvg(label) {
  return `data:image/svg+xml;utf8,` + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="216" viewBox="0 0 100 216">
      <rect x="4" y="4" width="92" height="208" rx="2" fill="#e3ddcf" stroke="#b9ac8e"/>
      <line x1="4" y1="72" x2="96" y2="72" stroke="#b9ac8e"/>
      <line x1="4" y1="144" x2="96" y2="144" stroke="#b9ac8e"/>
      <circle cx="88" cy="108" r="2.4" fill="#8c8271"/>
      <text x="50" y="196" font-family="Georgia,serif" font-size="11" fill="#4a433a" text-anchor="middle">${esc(label)}</text>
    </svg>`);
}

/* Automatiškai sugeneruotas užsakymo numerio pasiūlymas: E + mėnuo + diena +
   valanda + minutė (pagal LIETUVOS laiko juostą, ne to kompiuterio, kuriame
   veikia naršyklė — užsakovo patikslinimas 2026-09-24). `hourCycle:'h23'`
   nurodytas aiškiai, nes kai kurie naršyklių/Node varikliai su `hour12:false`
   vidurnaktį grąžina „24", ne „00" — h23 tai visada garantuoja 00–23 ruože. */
function generateOrderNumber() {
  const parts = new Intl.DateTimeFormat('lt-LT', {
    timeZone: 'Europe/Vilnius', hourCycle: 'h23',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date());
  const get = t => (parts.find(p => p.type === t) || {}).value || '00';
  return `E${get('month')}${get('day')}${get('hour')}${get('minute')}`;
}

/* Užsakymo numerio patvirtinimo langas — pirmas žingsnis (žr. index.html
   #orderNumberModal). Uždaromas tik paspaudus „Patvirtinti" su nebtuščiu
   lauku; tada reikšmė nukeliauja į #orderNumber, kur ją bet kada vėliau
   galima pasikeisti per „Kliento duomenys" skydelį. */
function initOrderNumberModal() {
  const modal = $('#orderNumberModal');
  const input = $('#orderNumberModalInput');
  input.value = generateOrderNumber();
  $('#orderNumberModalConfirm').onclick = () => {
    const val = input.value.trim();
    if (!val) { input.classList.add('req-empty'); input.focus(); return; }
    $('#orderNumber').value = val;
    modal.hidden = true;
  };
  input.oninput = () => input.classList.remove('req-empty');
}

function init() {
  initOrderNumberModal();
  $('#orderDate').value = new Date().toISOString().slice(0, 10);
  $('#clientToggle').onclick = () => { $('#clientPanel').hidden = !$('#clientPanel').hidden; $('#sellerPanel').hidden = true; };
  $('#sellerToggle').onclick = () => { $('#sellerPanel').hidden = !$('#sellerPanel').hidden; $('#clientPanel').hidden = true; };
  $$('.tab').forEach(t => t.onclick = () => switchView(t.dataset.view));
  $('#goToCart').onclick = () => switchView('cart');
  $('#backToConfigurator').onclick = () => switchView('configurator');
  $('#familySearch').oninput = renderFamilyList;
  $('#qtyMinus').onclick = () => { $('#qty').value = Math.max(1, Math.round(Number($('#qty').value || 1)) - 1); };
  $('#qtyPlus').onclick = () => { $('#qty').value = Math.max(1, Math.round(Number($('#qty').value || 1)) + 1); };
  $('#addToOrder').onclick = addToCart;
  $('#startNew').onclick = startNewEntry;
  $('#copyEntry').onclick = copyEntry;
  $('#printInvoice').onclick = () => printDoc('invoice');
  $('#printInvoice2').onclick = () => printDoc('invoice');
  $('#printProd').onclick = () => printDoc('prod');
  $('#printProd2').onclick = () => printDoc('prod');
  $('#printBoth').onclick = () => printDoc('both');
  $('#printBoth2').onclick = () => printDoc('both');
  $('#openMail').onclick = openMail;
  $('#downloadEml').onclick = downloadEml;
  $('#copyText').onclick = copyOrderText;

  $('#pendingList').textContent = PENDING_FAMILIES.join(' · ');

  renderFamilyList();
  chooseFamily('WERBENA');
}

/* Spausdina vieną iš dokumentų arba abu iškart. Orientacija perjungiama prieš
   spausdinimą, nes sąskaita yra vertikali, o gamybos lapas – horizontalus.
   which: 'invoice' | 'prod' | 'both'.
   „both" (2026-09-17, patogumui) — vienas „Save as PDF" išsaugo abu
   dokumentus VIENAME faile: sąskaitą portretu ir gamybos lapą peizažu per
   pavadintą @page (CSS Paged Media). Chrome/Edge tai atvaizduoja tiksliai;
   senesnėje Firefox versijoje abu lapai gali spausdintis ta pačia
   orientacija — turinys išliks teisingas, tik gamybos lapas siauresnis. */
let pageStyleEl = null;
function printDoc(which) {
  if (!pageStyleEl) { pageStyleEl = document.createElement('style'); document.head.appendChild(pageStyleEl); }
  document.body.classList.remove('print-invoice', 'print-prod', 'print-both');
  if (which === 'both') {
    pageStyleEl.textContent = '@page { size: A4 portrait; margin: 12mm 10mm; } @page prodPage { size: A4 landscape; margin: 8mm 7mm; } .prod-sheet { page: prodPage; }';
    document.body.classList.add('print-both');
  } else {
    const landscape = which === 'prod';
    pageStyleEl.textContent = landscape
      ? '@page { size: A4 landscape; margin: 8mm 7mm; }'
      : '@page { size: A4 portrait; margin: 12mm 10mm; }';
    document.body.classList.add(landscape ? 'print-prod' : 'print-invoice');
  }
  const cleanup = () => {
    document.body.classList.remove('print-invoice', 'print-prod', 'print-both');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 60);
}

function switchView(view) {
  $('#configuratorView').hidden = view !== 'configurator';
  $('#cartView').hidden = view !== 'cart';
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  $('#printInvoice').hidden = view !== 'cart';
  $('#printProd').hidden = view !== 'cart';
  $('#printBoth').hidden = view !== 'cart';
  if (view === 'cart') renderCartView();
}

/* Šeimų sąrašas grupuojamas pagal produktų liniją ir sutraukiamas (2026-09-11):
   su 39 šeimomis vientisas sąrašas per ilgas. Atidaryta lieka tik ta grupė,
   kurioje yra pasirinkta šeima; ieškant — laikinai išskleidžiamos visos
   grupės, kuriose yra atitikmenų. */
const RAIL_GROUPS = [
  { line: 'STILE',   title: 'STILE rėminės durys', keys: () => FAMILY_ORDER.concat(FAMILY_ORDER_TIER2) },
  { line: 'PAINTED', title: 'Dažytos durys',       keys: () => FAMILY_ORDER_PAINTED.concat(FAMILY_ORDER_PAINTED_PANEL) },
  { line: 'PANEL',   title: 'Skydinės durys',      keys: () => FAMILY_ORDER_PANEL },
];

function renderFamilyList() {
  const q = ($('#familySearch').value || '').toLowerCase().trim();
  const renderItem = k => {
    const f = FAMILIES[k];
    const active = k === state.familyKey;
    const thumb = familyThumb(k);
    const img = thumb ? `<img src="${thumb}" alt="" onerror="this.style.visibility='hidden'" />` : `<img src="${doorPlaceholderSvg(f.label)}" alt="" />`;
    return `<button class="family-item ${active ? 'active' : ''}" data-key="${k}" type="button">
      ${img}
      <span><span class="fi-name">${esc(f.label)}</span><span class="fi-meta">${f.models.length} modeliai · psl. ${f.pages}</span></span>
    </button>`;
  };
  const matches = k => (FAMILIES[k].baseLabel || FAMILIES[k].label).toLowerCase().includes(q);

  $('#familyGroups').innerHTML = RAIL_GROUPS.map(g => {
    const all = g.keys();
    const hits = all.filter(matches);
    const hasActive = all.includes(state.familyKey);
    // Ieškant atidarome kiekvieną grupę, kurioje yra atitikmenų.
    // Pradedant naują užsakymą meniu turi būti sutrauktas (2026-09-11), nors
    // šeima techniškai jau parinkta — todėl grupę atidarome tik tada, kai
    // operatorė pati ką nors paspaudė šoninėje juostoje.
    const open = q ? hits.length > 0 : (state.railTouched && hasActive);
    return `<section class="rail-group ${open ? 'open' : ''}" data-line="${g.line}">
      <button class="rail-group-head" type="button" data-line="${g.line}">
        <span class="rg-caret" aria-hidden="true">▸</span>
        <span class="rg-title">${esc(g.title)}</span>
        <span class="rg-count">${q ? hits.length + '/' + all.length : all.length}</span>
      </button>
      <div class="family-list">${hits.map(renderItem).join('') || '<p class="rg-empty">Nėra atitikmenų</p>'}</div>
    </section>`;
  }).join('');

  $$('.rail-group-head').forEach(b => b.onclick = () => {
    state.railTouched = true;
    const sec = b.closest('.rail-group');
    sec.classList.toggle('open');
    // Atidarant grupę rankiniu būdu, kitų neuždarome — operatorė gali lyginti linijas
  });
  $$('.family-item').forEach(b => b.onclick = () => { state.railTouched = true; chooseFamily(b.dataset.key); });

  const total = RAIL_GROUPS.reduce((a, g) => a + g.keys().length, 0);
  $('#railSummary').textContent = `${total} modelių linijos dviejose katalogo grupėse.`;
}

function chooseFamily(key) {
  state.familyKey = key;
  state.modelNo = FAMILIES[key].models[0];
  state.selections = {};
  renderFamilyList();
  const f = FAMILIES[key];
  const thumb = familyThumb(key);
  $('#heroMedia').style.backgroundImage = thumb ? `url('${thumb}')` : 'none';
  $('#heroMedia').style.background = thumb ? '' : 'linear-gradient(135deg, #3a352c, #211d18)';
  $('#heroTitle').textContent = f.label;
  $('#heroEyebrow').textContent = (LINES[f.line] || LINES.STILE).eyebrow;
  $('#heroPages').textContent = `ERKADO katalogas 2026 · psl. ${f.pages} · ${f.doorTypes.length} varčios tipai${f.tier === 2 ? ' · duomenys iš teksto sluoksnio' : ''}`;
  $('#modelCount').textContent = `${f.models.length} modeliai`;
  renderModelGrid();
  chooseModel(state.modelNo);
}

function renderModelGrid() {
  const f = FAMILIES[state.familyKey];
  $('#modelGrid').innerHTML = f.models.map(n => {
    const price = f.basePrice(n, f.decorOptions[0] ? f.decorOptions[0][0] : null);
    const img = modelImg(state.familyKey, n) || doorPlaceholderSvg(`${f.label} ${n}`);
    return `<button class="model-card hinge-mark ${n === state.modelNo ? 'is-selected selected' : ''}" data-n="${n}" type="button">
      <img src="${img}" alt="${f.label} ${n}" onerror="this.src='${doorPlaceholderSvg(f.label+' '+n)}'" />
      <span class="mc-name">${esc(f.label)} ${n}</span>
      <span class="mc-price">${money(price)}</span>
    </button>`;
  }).join('');
  $$('.model-card').forEach(b => b.onclick = () => chooseModel(Number(b.dataset.n)));
}

function chooseModel(n) {
  /* Iki 2026-09-11 keičiant modelį buvo išvalomi VISI pasirinkimai, todėl
     „Kopijuoti įrašą" + kito modelio pasirinkimas reikšdavo viską rinkti iš
     naujo. Dabar pasirinkimai paliekami — configureDoor() vis tiek patikrina
     kiekvieną lauką ir netinkamą grąžina į galimą reikšmę su pranešimu. */
  state.modelNo = n;
  state.justAdded = false;
  if ($('#postAddActions')) $('#postAddActions').hidden = true;
  renderModelGrid();
  refresh();
}

function refresh() {
  const active = document.activeElement;
  const focusedId = active && active.id;
  const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  const selEnd = active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;

  const cfg = configureDoor(state.familyKey, state.modelNo, state.selections);
  state.selections = cfg.selections;
  state.cfg = cfg;
  state.price = priceDoor(cfg);
  renderPicked();
  renderMessages();
  renderGroups();
  renderBreakdown();
  renderCartMini();

  if (focusedId) {
    const el = document.getElementById(focusedId);
    if (el) {
      el.focus();
      if (selStart != null && el.setSelectionRange) { try { el.setSelectionRange(selStart, selEnd); } catch (e) { /* not a text input, ignore */ } }
    }
  }
}

function renderPicked() {
  const f = FAMILIES[state.familyKey], n = state.modelNo, s = state.selections;
  const pickedImg = $('#pickedImage');
  pickedImg.onerror = () => { pickedImg.onerror = null; pickedImg.src = doorPlaceholderSvg(`${f.label} ${n}`); };
  pickedImg.src = modelImg(state.familyKey, n) || doorPlaceholderSvg(`${f.label} ${n}`);
  // Trupmena anksčiau visada rodė „STILE", nepriklausomai nuo tikros linijos —
  // dažytoms ir skydinėms durims tai buvo klaidinga (pataisyta 2026-09-18).
  const lineTitle = (RAIL_GROUPS.find(g => g.line === f.line) || {}).title || 'STILE';
  $('#crumbFamily').textContent = `ERKADO VIDAUS › ${lineTitle} › ${f.label}`;
  $('#pickedTitle').textContent = `${f.label} ${n}`;
  $('#pickedNote').textContent = f.note(n);
  $('#pickedPrice').textContent = `Varčia nuo ${money(f.basePrice(n, state.selections.DECOR))} be PVM`;

  /* Intarsijos pasirinkimas iškeltas prie modelio ir vizualiai paryškintas
     (užsakovo patikslinimas 2026-09-18) — ALTAMURA 1 ir UNO PREMIUM anksčiau
     turėjo šį lauką tik apačioje, „Konstrukcija ir matmenys" skiltyje, kur jį
     buvo lengva praleisti. */
  const cfg = state.cfg;
  const intarsiaOpts = cfg && cfg.panel && cfg.panel.intarsiaOpts;
  const pickedIntarsia = $('#pickedIntarsia');
  if (pickedIntarsia) {
    if (intarsiaOpts && intarsiaOpts.length) {
      const groups = [];
      intarsiaOpts.forEach(o => {
        let g = groups.find(x => x.name === o[2]);
        if (!g) { g = { name: o[2], items: [] }; groups.push(g); }
        g.items.push(o);
      });
      pickedIntarsia.hidden = false;
      pickedIntarsia.innerHTML = `<span class="pi-badge">✓ Galimos LUX intarsijos</span>
        <span class="pi-price">+${money(PANEL_EXTRAS.intarsia)}, iš abiejų pusių</span>
        <select class="stakta-select" data-select="INTARSIA">
          <option value="NONE" ${s.INTARSIA==='NONE'?'selected':''}>Nereikia</option>
          ${groups.map(g => `<optgroup label="${esc(g.name)}">${g.items.map(o => `<option value="${o[0]}" ${s.INTARSIA===o[0]?'selected':''}>${esc(o[1])}</option>`).join('')}</optgroup>`).join('')}
        </select>`;
    } else {
      pickedIntarsia.hidden = true;
      pickedIntarsia.innerHTML = '';
    }
  }
}

function renderMessages() {
  const cfg = state.cfg;
  const msgs = [...(cfg.messages || []).map(m => ['info', m]), ...(cfg.errors || []).map(m => ['error', m])];
  $('#messages').innerHTML = msgs.map(([t, m]) => `<div class="message ${t}">${esc(m)}</div>`).join('');
}

function renderGroups() {
  const cfg = state.cfg, s = state.selections, f = cfg.family;
  const out = [];

  // ===== MODULIS 1: VARČIOS UŽSAKYMAS =====
  const m1 = [];
  m1.push(groupCard('Gaminio standartas', [
    pillBlock('', cfg.standards.map(o => ({ code: o.code, name: STANDARD_NAME[o.code], available: o.available })), 'STANDARD'),
  ]));

  const konstrukcija = [
    pillBlock('Varčios tipas', cfg.doorTypes.map(t => ({ code: t.code, name: DOOR_TYPE_NAME[t.code], available: t.available })), 'DOOR_TYPE'),
    pillBlock('Plotis', cfg.widths.map(w => ({ code: w.code, name: w.code, available: w.available })), 'WIDTH', 'width'),
    pillBlock('Atidarymo kryptis', [{ code: 'LEFT', name: 'Kairė', available: true }, { code: 'RIGHT', name: 'Dešinė', available: true }], 'DIRECTION'),
  ];
  // Klijuotos medienos rėmai — tik STILE technologijos varčioms; skydinių vietoje
  // čia rodomi jų konstrukcijos parametrai (užpildas ir apdailos juosta)
  if (cfg.gluedFrameAllowed && s.DOOR_TYPE !== 'SLIDING') {
    konstrukcija.push(toggleBlock(`Vertikalūs rėmai iš klijuotos medienos (+${money(VERTICAL_FRAME_PRICE)})`, 'FRAME_CORE', s.FRAME_CORE === 'GLUED_WOOD', 'GLUED_WOOD', 'STANDARD'));
  }
  if (cfg.panel) konstrukcija.push(panelConstructionBlocks(cfg, s));
  m1.push(groupCard('Konstrukcija ir matmenys', konstrukcija));
  if (s.DOOR_TYPE === 'SLIDING') m1.push(slidingGroupCard(cfg, s));

  const decorStiklinimas = [decorBlock(cfg.decorOpts)];
  if (cfg.glassOpts.length) {
    decorStiklinimas.push(glassBlock(cfg.glassOpts));
    decorStiklinimas.push(pillBlock('Stiklinimo pusė', [
      { code: 'AVERSAS', name: 'Aversas (standartas)', available: true },
      { code: 'REVERSAS', name: 'Reversas', available: true },
    ], 'GLAZING_SIDE'));
  }
  m1.push(groupCard('Dekoras ir stiklinimas', decorStiklinimas));
  m1.push(furnitureGroupCard(cfg, s));

  // Nuleidžiama tarpinė ir ventiliacija stumdomai sistemai netaikoma.
  if (s.DOOR_TYPE !== 'SLIDING') {
    const extras = [];
    extras.push(toggleBlock('Nuleidžiama tarpinė', 'DROP_SEAL', s.DROP_SEAL === 'YES'));
    extras.push(selectBlock('Ventiliacija / rekuperacinis išpjovimas', 'VENTILATION',
      cfg.ventOpts.map(o => [o.code, o.name + (o.price ? ` (+${money(o.price)})` : '') + (!o.available ? ' — negalima' : '')]),
      s.VENTILATION, cfg.ventOpts));
    m1.push(groupCard('Papildomos opcijos', extras));
  }

  out.push(moduleBlock('1', 'Varčios užsakymas', 'Modelis, standartas, konstrukcija, dekoras ir furnitūra', 'mod-door', m1));

  // ===== MODULIS 2: STAKTA =====
  out.push(moduleBlock('2', 'Stakta', 'Durų anga / rėmas — atskiras produktas nuo varčios', 'mod-frame', [staktaGroupCard(cfg, s, f)]));

  // ===== MODULIS 3: RANKENA =====
  out.push(moduleBlock('3', 'Rankena', 'Rankena, apyraktis ir gręžimas', 'mod-handle', [handleGroupCard(cfg, s)]));

  // ===== MODULIS 4: APVADAI IR APDAILA (su grindjuoste) =====
  out.push(moduleBlock('4', 'Apvadai ir apdaila', 'Apvadų komplektas, kampukas ir grindjuostė', 'mod-trim',
    [bottomTrimGroupCard(cfg, s), floorTrimGroupCard(cfg, s)]));

  $('#groups').innerHTML = out.join('');
  bindGroupEvents();
}

function moduleBlock(num, title, subtitle, cssClass, cards) {
  const body = cards.filter(Boolean).join('');
  if (!body) return '';
  return `<section class="module ${cssClass}">
    <header class="module-head">
      <span class="module-num">${esc(num)}</span>
      <div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>
    </header>
    <div class="module-body">${body}</div>
  </section>`;
}

function furnitureGroupCard(cfg, s) {
  // Stumdomai sistemai spyna/furnitūra visiškai kitokia — žr. slidingGroupCard().
  if (s.DOOR_TYPE === 'SLIDING') return '';
  const parts = [];
  parts.push(`<div class="attr-block"><div class="attr-label"><span>Spyna</span><span>be priemokos</span></div><div class="pill-row">
    ${(cfg.lockOpts || []).map(o => `<button type="button" class="pill ${s.LOCK===o.code?'selected':''}" data-attr="LOCK" data-value="${o.code}" ${!o.available?'disabled':''}>${esc(o.name)}</button>`).join('')}
  </div></div>`);
  // Spynos spalva — atskiras laukas nuo 2026-09-10; užlaidinei nerodomas
  // (ten spyna įeina į furnitūros spalvą), todėl lockColorOpts tada yra null.
  if (cfg.lockColorOpts) {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Spynos spalva</span><span>magnetinė spyna</span></div><div class="pill-row">
      ${cfg.lockColorOpts.map(o => `<button type="button" class="pill ${s.LOCK_COLOR===o[0]?'selected':''}" data-attr="LOCK_COLOR" data-value="${o[0]}">${esc(o[1])}${o[2]?' (+'+money(o[2])+')':''}</button>`).join('')}
    </div></div>`);
  }
  const hwSub = cfg.lockColorOpts ? 'vyriai + užrakinimo plokštelė' : 'spyna + vyriai + užrakinimo plokštelė';
  parts.push(`<div class="attr-block"><div class="attr-label"><span>Furnitūros spalva</span><span>${esc(hwSub)}</span></div><div class="pill-row">
    ${(cfg.hwColorOpts || []).map(o => `<button type="button" class="pill ${s.HARDWARE_COLOR===o[0]?'selected':''}" data-attr="HARDWARE_COLOR" data-value="${o[0]}">${esc(o[1])}${o[2]?' (+'+money(o[2])+')':''}</button>`).join('')}
  </div></div>`);
  if (hardwareColorMismatch(s)) {
    parts.push(`<div class="hw-mismatch">Spynos ir furnitūros spalvos nesutampa — užsakyti galima, gamybos lape bus pažymėta.</div>`);
  }
  /* Vyrių skaičius (2026-09-11). Pasirinkimas yra prie furnitūros, bet priemoka
     eina į staktos kainą — taip, kaip vyriai ir tiekiami (psl. 59, 75). */
  if (cfg.thirdHingeAllowed) {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Vyrių skaičius</span><span>priemoka dedama prie staktos</span></div><div class="pill-row">
      <button type="button" class="pill ${s.HINGE_COUNT!=='3'?'selected':''}" data-attr="HINGE_COUNT" data-value="2">2 paslėpti vyriai (standartas)</button>
      <button type="button" class="pill ${s.HINGE_COUNT==='3'?'selected':''}" data-attr="HINGE_COUNT" data-value="3">3 paslėpti vyriai (+${money(THIRD_HINGE_PRICE)})</button>
    </div></div>`);
  } else if (s.DOOR_TYPE === 'REBATED') {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Vyrių skaičius</span></div><div class="pill-row">
      <button type="button" class="pill selected" disabled>3 vyriai (standartas užlaidinei)</button>
    </div></div>`);
  }
  if (hingeCapApplicable(s.DOOR_TYPE, s.HARDWARE_COLOR)) {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Metaliniai vyrių dangteliai</span><span>3 vnt. komplektas, +${money(HINGE_CAP_UNIT_PRICE*HINGE_CAP_HINGES_COUNT)}</span></div>
      <select class="ui-select" id="hingeCap" style="width:100%;">
        ${HINGE_CAP_OPTIONS.map(([code,name]) => `<option value="${code}" ${s.HINGE_CAP===code?'selected':''}>${esc(name)}</option>`).join('')}
      </select>
    </div>`);
  }
  return groupCard('Furnitūra', parts);
}

const HANDLE_SWATCH = {
  INOX: '#c7cdd1', BLACK_MATTE: '#2b2b2b', BRASS_MATTE: '#a9863f', GUNMETAL: '#4a4d4f',
  CHROME_GLOSS: '#d7dade', CHROME_MATTE: '#b9bdc2', NICKEL_MATTE: '#c3c0b8',
  COPPER_GLOSS: '#c98a63', WHITE_MATTE: '#f2f0ec', BRASS_GLOSS: '#c9a54a',
  // Psl. 140-147 rankenos (2026-09-23)
  BRASS_SATIN: '#b8963f', GRAPHITE_CHROME: '#7a7d80', NICKEL_SATIN: '#c3c0b8',
  NICKEL_VELVET: '#bdb9ae', BLACK_GOLD: '#332b1c', BLACK_COPPER: '#332a26',
  DECO_DARKOAK: '#5c4632', DECO_BLACK: '#222222', DECO_WHITE: '#efefec',
  DECO_SONOMA: '#c9a876', DECO_WALNUT: '#6b4a34', DECO_OAK: '#b98d5e',
};

function handleGroupCard(cfg, s) {
  // Stumdomai sistemai rankenėlė renkama slidingGroupCard() bloke.
  if (s.DOOR_TYPE === 'SLIDING') return '';
  const fam = HANDLE_FAMILIES.find(h => h.key === s.HANDLE_FAMILY) || HANDLE_FAMILIES[0];
  const parts = [];
  parts.push(`<p class="stakta-sub">Katalogas psl. 138–147 (ilgo skydelio rankenos psl. 147-148 šiam įrankiui neaktualios).</p>`);
  parts.push(`<div class="attr-block"><div class="attr-label"><span>Modelis</span></div>
    <select class="ui-select" id="handleFamily" style="width:100%;">
      ${HANDLE_FAMILIES.map(h => `<option value="${h.key}" ${s.HANDLE_FAMILY===h.key?'selected':''}>${esc(h.name)}</option>`).join('')}
    </select>
  </div>`);
  if (fam.key !== 'NONE') {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Spalva</span></div><div class="decor-grid">
      ${fam.finishes.map(f => `<button type="button" class="decor-card ${s.HANDLE_FINISH===f[0]?'selected':''}" data-attr="HANDLE_FINISH" data-value="${f[0]}">
        <span class="decor-swatch" style="background:${HANDLE_SWATCH[f[0]]||'#aaa'}"></span>
        <span>${esc(f[1])}<small>${money(f[2])}</small></span>
      </button>`).join('')}
    </div></div>`);

    if (fam.hasLR) {
      parts.push(`<div class="attr-block"><div class="attr-label"><span>Versija</span><span>${s.HANDLE_SIDE_CUSTOM==='YES'?'pasirinkta rankomis':'pagal durų kryptį'}</span></div><div class="pill-row">
        <button type="button" class="pill ${s.HANDLE_SIDE==='LEFT'?'selected':''}" data-attr="HANDLE_SIDE" data-value="LEFT">Kairė</button>
        <button type="button" class="pill ${s.HANDLE_SIDE==='RIGHT'?'selected':''}" data-attr="HANDLE_SIDE" data-value="RIGHT">Dešinė</button>
      </div></div>`);
    }

    if (fam.plateSystem !== 'none') {
      const order = handlePlateChoiceOrder(s.LOCK);
      parts.push(`<div class="attr-block"><div class="attr-label"><span>Apyraktis</span><span>${s.HANDLE_PLATE_CUSTOM==='YES'?'pasirinkta rankomis':'pagal spyną'}</span></div><div class="pill-row">
        ${order.map(code => {
          const price = code === 'NONE' ? 0 : handlePlatePrice(fam.key, s.HANDLE_FINISH, code);
          return `<button type="button" class="pill ${s.HANDLE_PLATE===code?'selected':''}" data-attr="HANDLE_PLATE" data-value="${code}">${esc(HANDLE_PLATE_LABELS[code])}${price?' (+'+money(price)+')':''}</button>`;
        }).join('')}
      </div></div>`);
    }

    parts.push(toggleBlock('Skylių gręžimas rankenai (nemokamai)', 'HANDLE_DRILL', s.HANDLE_DRILL === 'YES'));
  }
  return groupCard('Rankena', parts);
}

function bottomTrimGroupCard(cfg, s) {
  if (s.STAKTA_MODE !== 'ADJUSTABLE' && s.STAKTA_MODE !== 'FIXED') return '';
  const tier = staktaAdjustableTier(s.STAKTA_DECOR);
  const parts = [];
  parts.push(`<div class="stakta-grid">
    <div class="text-field"><span>Apvadų komplektas vienai pusei</span>
      <select class="ui-select" id="fixedTrimSet" style="width:100%;">
        <option value="NONE" ${s.FIXED_TRIM_SET==='NONE'?'selected':''}>Nereikia</option>
        <option value="8x60mm" ${s.FIXED_TRIM_SET==='8x60mm'?'selected':''}>8×60mm (+${money(STAKTA_FIXED.trimSet['8x60mm'][tier])})</option>
        <option value="16x80mm" ${s.FIXED_TRIM_SET==='16x80mm'?'selected':''}>16×80mm (+${money(STAKTA_FIXED.trimSet['16x80mm'][tier])})</option>
      </select>
    </div>
    ${s.FIXED_TRIM_SET !== 'NONE' ? `<label class="text-field"><span>Kiekis, vnt.</span><input id="fixedTrimQty" type="number" min="1" value="${esc(s.FIXED_TRIM_QTY)}" /></label>` : '<div></div>'}
  </div>`);
  if (s.STAKTA_MODE === 'FIXED') {
    parts.push(`<div class="stakta-grid" style="margin-top:10px;">
      <div class="toggle-row">${toggleBlock('Kampukas 10×18 (+' + money(STAKTA_FIXED.kampukas[tier]) + '/vnt.)', 'KAMPUKAS', s.KAMPUKAS === 'YES')}</div>
      ${s.KAMPUKAS === 'YES' ? `<label class="text-field"><span>Kiekis, vnt.</span><input id="kampukasQty" type="number" min="1" value="${esc(s.KAMPUKAS_QTY)}" /></label>` : '<div></div>'}
    </div>`);
  }
  return groupCard('Apvadai ir apdaila', parts);
}

function floorTrimGroupCard(cfg, s) {
  const parts = [];
  parts.push(toggleBlock('Grindjuostė (2,40 m ilgio)', 'FLOOR_TRIM', s.FLOOR_TRIM === 'YES'));
  if (s.FLOOR_TRIM === 'YES') {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Tipas</span></div><div class="pill-row">
      <button type="button" class="pill ${s.FLOOR_TRIM_TYPE==='laminated'?'selected':''}" data-attr="FLOOR_TRIM_TYPE" data-value="laminated">Laminuota (${money(FLOOR_TRIM_PRICE.laminated)}/vnt.)</button>
      <button type="button" class="pill ${s.FLOOR_TRIM_TYPE==='painted'?'selected':''}" data-attr="FLOOR_TRIM_TYPE" data-value="painted">Dažyta (${money(FLOOR_TRIM_PRICE.painted)}/vnt.)</button>
    </div></div>`);

    if (s.FLOOR_TRIM_TYPE === 'laminated') {
      const opts = staktaColorOptions(cfg);
      parts.push(`<div class="attr-block"><div class="attr-label"><span>Spalva</span><span>${s.FLOOR_TRIM_COLOR_CUSTOM==='YES'?'pasirinkta rankomis':'pagal staktos spalvą'}${s.FLOOR_TRIM_COLOR_CUSTOM==='YES'?' · <a href="#" id="resetFloorColor">grąžinti</a>':''}</span></div><div class="decor-grid">
        ${opts.map(o => `<button type="button" class="decor-card ${s.FLOOR_TRIM_COLOR===o.code?'selected':''}" data-attr="FLOOR_TRIM_COLOR" data-value="${o.code}">
          <span class="decor-swatch" style="background:${DECOR_SWATCH[o.code]||'#aaa'}"></span>
          <span>${esc(o.name)}<small>${esc(o.group)}</small></span>
        </button>`).join('')}
      </div></div>`);
    } else {
      parts.push(`<div class="attr-block"><div class="attr-label"><span>Spalva</span></div><div class="pill-row">
        ${FLOOR_TRIM_PAINTED_COLORS.map(c => `<button type="button" class="pill ${s.FLOOR_TRIM_COLOR===c[0]?'selected':''}" data-attr="FLOOR_TRIM_COLOR" data-value="${c[0]}">${esc(c[1])}</button>`).join('')}
      </div></div>`);
    }
    parts.push(`<label class="text-field"><span>Kiekis, vnt.</span><input id="floorTrimQty" type="number" min="1" value="${esc(s.FLOOR_TRIM_QTY)}" /></label>`);
  }
  return groupCard('Grindjuostė', parts);
}

function groupCard(title, blocksHtml) {
  return `<div class="group-card"><h3>${esc(title)}</h3>${blocksHtml.join('')}</div>`;
}
function pillBlock(label, opts, attr, extraClass) {
  // Privalomi, dar nepasirinkti laukai paryškinami (2026-09-08)
  const REQUIRED = ['STANDARD', 'DOOR_TYPE', 'WIDTH', 'DIRECTION', 'GLASS', 'GLAZING_SIDE', 'LOCK', 'HARDWARE_COLOR', 'STAKTA_CHOICE'];
  const empty = REQUIRED.includes(attr) && !state.selections[attr];
  return `<div class="attr-block ${empty ? 'req-empty' : ''}"><div class="attr-label"><span>${esc(label)}${empty ? ' *' : ''}</span></div><div class="pill-row">
    ${opts.map(o => `<button type="button" class="pill ${extraClass||''} ${state.selections[attr]===o.code?'selected':''}" data-attr="${attr}" data-value="${o.code}" ${!o.available?'disabled':''}>${esc(o.name)}</button>`).join('')}
  </div></div>`;
}
/* Skydinių durų konstrukcijos parametrai (psl. 108–121). Nuo 2026-09-15 rodomi
   grupėje „Konstrukcija ir matmenys" — toje pačioje vietoje, kur STILE varčioms
   yra klijuotos medienos rėmai. Anksčiau buvo prie furnitūros, nors tai varčios
   sandara, ne apkaustai. */
function panelConstructionBlocks(cfg, s) {
  const P = PANEL_EXTRAS;
  const out = [];
  if (cfg.panel.fillOk) {
    out.push(`<div class="attr-block"><div class="attr-label"><span>Užpildas</span></div><div class="pill-row">
      <button type="button" class="pill ${s.FILL_TYPE==='HONEYCOMB'?'selected':''}" data-attr="FILL_TYPE" data-value="HONEYCOMB">„Korio" tipo (įskaičiuota)</button>
      <button type="button" class="pill ${s.FILL_TYPE==='FULL'?'selected':''}" data-attr="FILL_TYPE" data-value="FULL">Pilna plokštė (+${money(P.fullBoard)})</button>
      <button type="button" class="pill ${s.FILL_TYPE==='PERFORATED'?'selected':''}" data-attr="FILL_TYPE" data-value="PERFORATED">Perforuota drožlių plokštė (+${money(P.perforated)})</button>
    </div></div>`);
  }
  if (cfg.panel.softOk) {
    out.push(toggleBlock('SOFT briauna (be matomų sujungimų; reikalauja pilnos plokštės)', 'EDGE_SOFT', s.EDGE_SOFT === 'YES'));
  }
  out.push(toggleBlock('Vidinis medinis rėmas (+' + money(P.innerWoodFrame) + ')', 'INNER_FRAME_WOOD', s.INNER_FRAME_WOOD === 'YES'));
  out.push(toggleBlock('Varčios krašto apdaila juoda (+' + money(P.blackEdge) + ')', 'EDGE_BLACK', s.EDGE_BLACK === 'YES'));
  if (cfg.panel.guardOk) {
    out.push(toggleBlock('Apatinės dalies apsauga kraštu (+' + money(P.bottomGuard) + ')', 'BOTTOM_GUARD', s.BOTTOM_GUARD === 'YES'));
  }
  // Priedai, kuriuos turi ne visos skydinių šeimos (psl. 111)
  const O = cfg.panel.opts || {};
  if (cfg.panel.optOn(O.bottomRail)) out.push(toggleBlock('Papildoma apatinė sija (+' + money(P.bottomRail) + ')', 'BOTTOM_RAIL', s.BOTTOM_RAIL === 'YES'));
  if (cfg.panel.optOn(O.closer)) {
    out.push(toggleBlock('Sutvirtinimas durų pritraukikliui (+' + money(P.closerReinforce) + ')', 'CLOSER_REINFORCE', s.CLOSER_REINFORCE === 'YES'));
    out.push(toggleBlock('Svirtinis durų pritraukiklis (+' + money(P.doorCloser) + ')', 'DOOR_CLOSER', s.DOOR_CLOSER === 'YES'));
    if (s.DOOR_CLOSER === 'YES') {
      out.push(`<div class="attr-block"><div class="attr-label"><span>Pritraukiklio spalva</span></div><div class="pill-row">
        ${DOOR_CLOSER_COLORS.map(c => `<button type="button" class="pill ${s.DOOR_CLOSER_COLOR===c[0]?'selected':''}" data-attr="DOOR_CLOSER_COLOR" data-value="${c[0]}">${esc(c[1])}</button>`).join('')}
      </div></div>`);
    }
  }
  if (cfg.panel.optOn(O.vents)) {
    out.push(`<div class="attr-block"><div class="attr-label"><span>Įvorės (4 vnt.)</span></div><div class="pill-row">
      <button type="button" class="pill ${s.VENT_SLEEVES==='NONE'?'selected':''}" data-attr="VENT_SLEEVES" data-value="NONE">Nereikia</button>
      <button type="button" class="pill ${s.VENT_SLEEVES==='METAL'?'selected':''}" data-attr="VENT_SLEEVES" data-value="METAL">Metalinės (+${money(P.ventsMetal)})</button>
      <button type="button" class="pill ${s.VENT_SLEEVES==='PLASTIC'?'selected':''}" data-attr="VENT_SLEEVES" data-value="PLASTIC">Plastikinės, medienos imitacija (+${money(P.ventsPlastic)})</button>
    </div></div>`);
    if (s.VENT_SLEEVES === 'METAL') {
      out.push(`<div class="attr-block"><div class="attr-label"><span>Įvorių apdaila</span></div><div class="pill-row">
        ${VENT_SLEEVE_FINISHES.map(c => `<button type="button" class="pill ${s.VENT_SLEEVE_FINISH===c[0]?'selected':''}" data-attr="VENT_SLEEVE_FINISH" data-value="${c[0]}">${esc(c[1])}</button>`).join('')}
      </div></div>`);
    }
  }
  // Intarsijos pasirinkimas iškeltas prie modelio (žr. renderPicked() —
  // užsakovo patikslinimas 2026-09-18): čia, apačioje, jį buvo lengva praleisti.
  if (cfg.panel.steelOpts && cfg.panel.steelOpts.length) {
    out.push(`<div class="attr-block"><div class="attr-label"><span>Nerūdijančio plieno panelis</span><span>aukštis 300 mm, iš abiejų pusių</span></div><div class="pill-row">
      <button type="button" class="pill ${s.STEEL_PANEL==='NONE'?'selected':''}" data-attr="STEEL_PANEL" data-value="NONE">Nereikia</button>
      ${cfg.panel.steelOpts.map(o => `<button type="button" class="pill ${s.STEEL_PANEL===o[0]?'selected':''}" data-attr="STEEL_PANEL" data-value="${o[0]}">${esc(o[1])} (+${money(o[2])})</button>`).join('')}
    </div></div>`);
  }
  if (cfg.panel.optOn(O.roundWindow)) {
    // Pervadinta „Apvali anga" → „Iliuminatorius" ir išskaidyta į apdailą +
    // stiklą (užsakovo patikslinimas 2026-09-18): šeši deriniai — poliruotas
    // chromas / šlifuota satina / juodas matinis, kiekvienas su skaidriu arba
    // decormat pieno matinio stiklu. Kaina priklauso tik nuo apdailos.
    out.push(`<div class="attr-block"><div class="attr-label"><span>Iliuminatorius</span><span>skersmuo vid. 235 / išor. 350 mm</span></div><div class="pill-row">
      <button type="button" class="pill ${s.ROUND_WINDOW==='NONE'?'selected':''}" data-attr="ROUND_WINDOW" data-value="NONE">Nereikia</button>
      <button type="button" class="pill ${s.ROUND_WINDOW==='CHROME'?'selected':''}" data-attr="ROUND_WINDOW" data-value="CHROME">Poliruotas chromas (+${money(P.roundWindowSteel)})</button>
      <button type="button" class="pill ${s.ROUND_WINDOW==='SATIN'?'selected':''}" data-attr="ROUND_WINDOW" data-value="SATIN">Šlifuota satina (+${money(P.roundWindowSteel)})</button>
      <button type="button" class="pill ${s.ROUND_WINDOW==='BLACK'?'selected':''}" data-attr="ROUND_WINDOW" data-value="BLACK">Juodas matinis (+${money(P.roundWindowBlack)})</button>
    </div></div>`);
    if (s.ROUND_WINDOW !== 'NONE') {
      out.push(`<div class="attr-block"><div class="attr-label"><span>Iliuminatoriaus stiklas</span></div><div class="pill-row">
        <button type="button" class="pill ${s.ROUND_WINDOW_GLASS==='CLEAR'?'selected':''}" data-attr="ROUND_WINDOW_GLASS" data-value="CLEAR">Skaidrus stiklas</button>
        <button type="button" class="pill ${s.ROUND_WINDOW_GLASS==='MATTE'?'selected':''}" data-attr="ROUND_WINDOW_GLASS" data-value="MATTE">Decormat pieno matinis</button>
      </div></div>`);
    }
  }
  return out.join('');
}

/* Sieninė stumdomoji sistema, viengubė (psl. 158, v44; tunelis+karūna+spynos
   spalva pridėti v46). Rodoma tik pasirinkus „Stumdoma" varčios tipą.
   Dvipusė SP2N — kitas etapas (žr. README v46 ir data.js SLIDING_EXTRAS
   komentarą). */
function slidingGroupCard(cfg, s) {
  const P = SLIDING_EXTRAS;
  const parts = [];
  parts.push(`<div class="attr-block"><div class="attr-label"><span>Sistema</span><span>aliuminis bėgelis su maskuote ir atmušėju</span></div><div class="pill-row">
    <button type="button" class="pill ${s.SLIDING_VARIANT==='SP1Nz'?'selected':''}" data-attr="SLIDING_VARIANT" data-value="SP1Nz">SP1Nz (su užraktu)</button>
    <button type="button" class="pill ${s.SLIDING_VARIANT==='SP1Nb'?'selected':''}" data-attr="SLIDING_VARIANT" data-value="SP1Nb">SP1Nb (be užrakto)</button>
  </div></div>`);
  // Bėgelio apdaila — Dažytos durys linijai nerodoma (visada efektyviai
  // „Dažyta/CPL", nustatoma automatiškai engine.js, 2026-09-22).
  if (cfg.family.line !== 'PAINTED') {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Bėgelio apdaila</span><span>filtruoja Dekoro pasirinkimą žemiau</span></div><div class="pill-row">
      <button type="button" class="pill ${s.SLIDING_MATERIAL==='VENEER'?'selected':''}" data-attr="SLIDING_MATERIAL" data-value="VENEER">Greko/Premium (+${money(P.doorVeneer)})</button>
      <button type="button" class="pill ${s.SLIDING_MATERIAL==='PAINTED'?'selected':''}" data-attr="SLIDING_MATERIAL" data-value="PAINTED">Dažyta/CPL (+${money(P.doorPainted)})</button>
    </div></div>`);
  }
  if (s.SLIDING_VARIANT === 'SP1Nz') {
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Kablio tipo spyna</span></div><div class="pill-row">
      <button type="button" class="pill ${s.SLIDING_LOCK==='NONE'?'selected':''}" data-attr="SLIDING_LOCK" data-value="NONE">Nereikia</button>
      <button type="button" class="pill ${s.SLIDING_LOCK==='KEY'?'selected':''}" data-attr="SLIDING_LOCK" data-value="KEY">Raktas (+${money(P.lockKey)})</button>
      <button type="button" class="pill ${s.SLIDING_LOCK==='WC'?'selected':''}" data-attr="SLIDING_LOCK" data-value="WC">WC (+${money(P.lockWC)})</button>
    </div></div>`);
    if (s.SLIDING_LOCK === 'KEY' || s.SLIDING_LOCK === 'WC') {
      parts.push(`<div class="attr-block"><div class="attr-label"><span>Spynos spalva</span></div><div class="pill-row">
        ${SLIDING_LOCK_COLORS.map(c => `<button type="button" class="pill ${s.SLIDING_LOCK_COLOR===c[0]?'selected':''}" data-attr="SLIDING_LOCK_COLOR" data-value="${c[0]}">${esc(c[1])}</button>`).join('')}
      </div></div>`);
    }
  }
  parts.push(`<div class="attr-block"><div class="attr-label"><span>Rankenėlė</span><span>ovali, stačiakampė arba apvali; komplektas (+${money(P.handleSet)})</span></div><div class="pill-row">
    <button type="button" class="pill ${s.SLIDING_HANDLE==='NONE'?'selected':''}" data-attr="SLIDING_HANDLE" data-value="NONE">Nereikia</button>
    ${SLIDING_HANDLE_COLORS.map(c => `<button type="button" class="pill ${s.SLIDING_HANDLE===c[0]?'selected':''}" data-attr="SLIDING_HANDLE" data-value="${c[0]}">${esc(c[1])}</button>`).join('')}
  </div></div>`);
  const softClosePrice = ['90', '100'].includes(s.WIDTH) ? P.softCloseWide : P.softCloseStd;
  parts.push(toggleBlock(`Lėtintuvas (+${money(softClosePrice)})`, 'SLIDING_SOFTCLOSE', s.SLIDING_SOFTCLOSE === 'YES'));

  // Tunelio tipo stakta (2026-09-22) — spalva visada = varčios dekoras.
  parts.push(toggleBlock('Tunelio tipo stakta', 'SLIDING_TUNNEL', s.SLIDING_TUNNEL === 'YES'));
  if (s.SLIDING_TUNNEL === 'YES') {
    const table = STAKTA_ADJUSTABLE.REBATED;
    const tunnelPrice = staktaAdjustablePrice(table, s.SLIDING_TUNNEL_RANGE, s.STAKTA_DECOR || s.DECOR);
    parts.push(`<div class="stakta-grid">
      <div class="text-field"><span>Staktos reguliavimo diapazonas, mm</span>
        <select class="ui-select" data-select="SLIDING_TUNNEL_RANGE" style="width:100%;">
          ${table.rows.map(r => `<option value="${r[0]}" ${s.SLIDING_TUNNEL_RANGE===r[0]?'selected':''}>${r[0]} mm</option>`).join('')}
        </select>
      </div>
      <div class="attr-block"><div class="attr-label"><span>Apvado plotis</span></div><div class="pill-row">
        <button type="button" class="pill ${s.SLIDING_TUNNEL_TRIM==='6'?'selected':''}" data-attr="SLIDING_TUNNEL_TRIM" data-value="6">6 cm</button>
        <button type="button" class="pill ${s.SLIDING_TUNNEL_TRIM==='8'?'selected':''}" data-attr="SLIDING_TUNNEL_TRIM" data-value="8">8 cm</button>
      </div></div>
    </div>`);
    parts.push(tunnelPrice == null
      ? `<div class="stakta-price-row stakta-warn"><span>Tunelis (${s.SLIDING_TUNNEL_RANGE} mm)</span><strong>kaina pagal pareikalavimą ↑</strong></div>`
      : `<div class="stakta-price-row"><span>Tunelis (${s.SLIDING_TUNNEL_RANGE} mm, ${s.SLIDING_TUNNEL_TRIM}cm)</span><strong>${money(tunnelPrice)}</strong></div>`);
    const miterDisabled = s.SLIDING_TUNNEL_TRIM !== '8';
    parts.push(`<div class="attr-block"><div class="attr-label"><span>Tunelio apvado supjovimas</span></div><div class="pill-row">
      <button type="button" class="pill ${s.SLIDING_TUNNEL_MITER==='45'?'selected':''}" data-attr="SLIDING_TUNNEL_MITER" data-value="45">45°</button>
      <button type="button" class="pill ${s.SLIDING_TUNNEL_MITER==='90'?'selected':''}" data-attr="SLIDING_TUNNEL_MITER" data-value="90" ${miterDisabled?'disabled':''}>90°${miterDisabled?' (tik su 8 cm apvadu)':' (+'+money(table.miter90Extra)+')'}</button>
    </div></div>`);
    parts.push(toggleBlock('Karūna + apvadinės juostelės (kaina psl. 155)', 'SLIDING_KARUNA', s.SLIDING_KARUNA === 'YES'));
  }
  parts.push(`<p class="stakta-sub">Šioje versijoje: tik viengubė (SP1Nz/SP1Nb) sistema. Dvipusė (SP2N) — kitas etapas.</p>`);
  return groupCard('Stumdomos sistemos', parts);
}

function decorBlock(opts) {
  // Dekorai grupuojami vizualiai pagal kolekcijas: GREKO / PREMIUM / ST CPL (2026-09-08)
  const ORDER = ['GREKO', 'PREMIUM', 'CPL'];
  const LABEL = { GREKO: 'GREKO kolekcija', PREMIUM: 'PREMIUM kolekcija', CPL: 'ST CPL kolekcija', CPL02: 'CPL 0,2 kolekcija', CPL07: 'CPL 0,7 kolekcija', PAINTED: 'Dažymo spalvos' };
  const byGroup = {};
  opts.forEach(o => { (byGroup[o.group] = byGroup[o.group] || []).push(o); });
  const groups = ORDER.filter(g => byGroup[g]).concat(Object.keys(byGroup).filter(g => !ORDER.includes(g)));
  // Kolekcijos sutraukiamos (2026-09-11): 28 dekorų sąrašas per ilgas, kad
  // visas tilptų ekrane. Atidaryta lieka ta kolekcija, kurioje yra pasirinkta
  // spalva; jei dar nepasirinkta — pirmoji. Vienos kolekcijos (pvz. dažytų
  // durų) neuždarome, nes slėpti vienintelį sąrašą nėra prasmės.
  const selGroup = (opts.find(o => o.code === state.selections.DECOR) || {}).group;
  const single = groups.length === 1;
  const body = groups.map((g, i) => `
    <div class="decor-collection decor-col-${esc(g.toLowerCase())} ${single || g === (selGroup || groups[0]) ? 'open' : ''}">
      <button type="button" class="decor-col-head" data-decor-group="${esc(g)}">
        ${single ? '' : '<span class="dc-caret" aria-hidden="true">\u25B8</span>'}${esc(LABEL[g] || g)} <span>${byGroup[g].length}</span></button>
      <div class="decor-grid">
        ${byGroup[g].map(o => `<button type="button" class="decor-card ${state.selections.DECOR===o.code?'selected':''}" data-attr="DECOR" data-value="${o.code}" ${!o.available?'disabled':''}>
          <span class="decor-swatch" style="background:${DECOR_SWATCH[o.code]||'#aaa'}"></span>
          <span>${esc(o.name)}</span>
        </button>`).join('')}
      </div>
    </div>`).join('');
  // Dažytoms durims paletė nėra „dekoras" — kataloge tai varčios spalva
  const fam = FAMILIES[state.familyKey] || {};
  const fieldLabel = fam.line === 'PAINTED' ? 'Spalva' : 'Dekoras';
  return `<div class="attr-block ${state.selections.DECOR ? '' : 'req-empty'}"><div class="attr-label"><span>${fieldLabel}${state.selections.DECOR ? '' : ' *'}</span></div>${body}</div>`;
}
function glassBlock(opts) {
  // Dizainas kaip furnitūros pasirinkime — pill mygtukai (2026-09-09)
  return `<div class="attr-block"><div class="attr-label"><span>Stiklinimas</span><span>${opts.length > 1 ? 'pirmas — be priemokos' : 'įskaičiuota'}</span></div><div class="pill-row">
    ${opts.map(o => `<button type="button" class="pill ${state.selections.GLASS===o.code?'selected':''}" data-attr="GLASS" data-value="${o.code}">${esc(o.name)}${o.price ? ' (+' + money(o.price) + ')' : ''}</button>`).join('')}
  </div></div>`;
}
function toggleBlock(label, attr, checked, onVal, offVal) {
  onVal = onVal || 'YES'; offVal = offVal || 'NO';
  return `<div class="attr-block toggle-row"><label class="switch"><input type="checkbox" data-toggle="${attr}" data-on="${onVal}" data-off="${offVal}" ${checked?'checked':''}/><span></span></label><span class="attr-label" style="margin:0;">${esc(label)}</span></div>`;
}
function toggleDisabledAware(label, attr, checked, available) {
  return `<div class="attr-block toggle-row"><label class="switch"><input type="checkbox" data-toggle="${attr}" data-on="YES" data-off="NO" ${checked?'checked':''} ${!available?'disabled':''}/><span></span></label><span class="attr-label" style="margin:0; ${!available?'color:var(--muted);text-decoration:line-through;':''}">${esc(label)}</span></div>`;
}
function selectBlock(label, attr, options, value, availList) {
  return `<div class="attr-block"><div class="attr-label"><span>${esc(label)}</span></div>
    <select class="ui-select" data-select="${attr}">${options.map(([v,n]) => {
      const avail = !availList || (availList.find(o => o.code === v) || {}).available !== false;
      return `<option value="${v}" ${value===v?'selected':''} ${!avail?'disabled':''}>${esc(n)}</option>`;
    }).join('')}</select>
  </div>`;
}

function staktaGroupCard(cfg, s, f) {
  // Stumdomai sistemai stakta (jei bus) renkama slidingGroupCard() bloke —
  // šis modulis šiam varčios tipui visai nerodomas (v44: tunelio stakta
  // dar neįvesta, žr. README).
  if (s.DOOR_TYPE === 'SLIDING') return '';
  const mode = s.STAKTA_MODE;
  const surcharge = standardSurchargeApplies(s.STANDARD);

  // Staktos tipas + reguliuojamos staktos variantas sujungti į vieną mygtukų
  // eilutę (užsakovo patikslinimas 2026-09-22) — anksčiau „Uždedama plieninei
  // staktai" buvo atskiras tarpinis žingsnis, rodomas tik pasirinkus
  // „Reguliuojama stakta". Laukas dabar privalomas (žr. pillBlock REQUIRED).
  let html = `<div class="group-card"><h3>Stakta</h3>
    <p class="stakta-sub">Durų anga/rėmas — atskiras produktas nuo varčios (katalogas psl. 182–187).</p>
    ${pillBlock('Staktos tipas', cfg.staktaModes.map(o => ({ code: o.code, name: o.name, available: true })), 'STAKTA_CHOICE')}`;

  if (mode === 'ADJUSTABLE') {
    const table = cfg.staktaAdjustable;
    const price = staktaAdjustablePrice(table, s.STAKTA_RANGE, s.STAKTA_DECOR);
    html += `<div class="stakta-fields">
      <div class="stakta-grid">
        <div class="text-field"><span>Staktos reguliavimo diapazonas, mm</span>
          <select class="ui-select" id="staktaRange" style="width:100%;">
            ${table.rows.map(r => `<option value="${r[0]}" ${s.STAKTA_RANGE===r[0]?'selected':''}>${r[0]} mm</option>`).join('')}
          </select>
        </div>
        <div class="text-field"><span>Apvado plotis</span>
          <select class="ui-select" id="staktaTrim" style="width:100%;" ${table.trimOptions.length<2?'disabled':''}>
            ${table.trimOptions.map(t => `<option value="${t}" ${s.STAKTA_TRIM===t?'selected':''}>${t} cm</option>`).join('')}
          </select>
        </div>
      </div>`;
    if (price == null) {
      html += `<div class="stakta-price-row stakta-warn"><span>Stakta (${s.STAKTA_RANGE} mm)</span><strong>kaina pagal pareikalavimą ↑</strong></div>`;
    } else {
      html += `<div class="stakta-price-row"><span>Stakta (${s.STAKTA_RANGE} mm, ${s.STAKTA_TRIM}cm)</span><strong>${money(price)}</strong></div>`;
    }
    // Diapazono keitimas +20 mm (psl. 183/184) — galimas tik dalyje diapazonų,
    // ir lygiabriaunei riba aukštesnė nei reversinei (2026-09-11)
    if (cfg.rangeExtAllowed) {
      html += toggleBlock(`Diapazono keitimas +20 mm (+${money(RANGE_EXT_PRICE)})`, 'STAKTA_RANGE_EXT', s.STAKTA_RANGE_EXT === 'YES');
    }
    if (s.STAKTA_ADJ_TYPE !== 'STEEL_MOUNT') {
      const miterDisabled = table.miter90ExcludedRanges.includes(s.STAKTA_RANGE) || s.STAKTA_TRIM !== '8';
      html += `<div class="attr-block"><div class="attr-label"><span>Apvado supjovimas</span></div><div class="pill-row">
        <button type="button" class="pill ${s.STAKTA_MITER==='45'?'selected':''}" data-attr="STAKTA_MITER" data-value="45">45° (įskaičiuota)</button>
        <button type="button" class="pill ${s.STAKTA_MITER==='90'?'selected':''}" data-attr="STAKTA_MITER" data-value="90" ${miterDisabled?'disabled':''}>90° (+${money(table.miter90Extra)})</button>
      </div>${miterDisabled ? '<small class="stakta-note">90° galimas tik su 8cm apvadu' + (table.miter90ExcludedRanges.includes(s.STAKTA_RANGE) ? ' ir negalimas šiam diapazonui' : '') + '.</small>' : ''}</div>`;
    }
    html += staktaColorBlock(cfg, s);
    html += karunaBlock(s);
    html += toggleBlock('Elektromagnetinė sklendė (+' + money(STAKTA_FIXED.electromagnetic) + ')', 'ELECTROMAGNETIC', s.ELECTROMAGNETIC === 'YES');
    html += `</div>`;
  } else if (mode === 'FIXED') {
    const price = staktaFixedPrice(s.STAKTA_DECOR, null, null, s.KAMPUKAS, s.KAMPUKAS_QTY, s.ELECTROMAGNETIC);
    html += `<div class="stakta-fields">
      <div class="stakta-price-row"><span>Fiksuota stakta</span><strong>${money(price)}</strong></div>
      ${toggleBlock('Elektromagnetinė sklendė (+' + money(STAKTA_FIXED.electromagnetic) + ')', 'ELECTROMAGNETIC', s.ELECTROMAGNETIC === 'YES')}`;
    html += staktaColorBlock(cfg, s);
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function staktaColorBlock(cfg, s) {
  const opts = staktaColorOptions(cfg);
  const isCustom = s.STAKTA_DECOR_CUSTOM === 'YES';
  return `<div class="attr-block"><div class="attr-label"><span>Staktos spalva</span><span>${isCustom?'kita nei varčios':'kaip varčios'}${isCustom?' · <a href="#" id="resetStaktaDecor">grąžinti</a>':''}</span></div>
    <select class="ui-select" id="staktaDecor" style="width:100%;">
      ${opts.map(o => `<option value="${o.code}" ${s.STAKTA_DECOR===o.code?'selected':''}>${esc(o.name)} (${esc(o.group)})</option>`).join('')}
    </select>
  </div>`;
}

function karunaBlock(s) {
  return `<div class="attr-block">
      <div class="attr-label"><span>Karūna / apvadinės juostelės</span></div>
      <div class="pill-row">
        <button type="button" class="pill ${s.KARUNA==='NONE'?'selected':''}" data-attr="KARUNA" data-value="NONE">Nėra</button>
        <button type="button" class="pill ${s.KARUNA==='SET'?'selected':''}" data-attr="KARUNA" data-value="SET">Su karūna ir apvadais (${money(KARUNA_SET_PRICE[staktaAdjustableTier(s.STAKTA_DECOR)])})</button>
      </div>
    </div>`;
}

function bindGroupEvents() {
  // Jei komplektas ką tik įtrauktas, o vartotojas pradeda redaguoti nepaspaudęs
  // „Kurti naują" / „Kopijuoti įrašą" — visi pasirinkimai išsivalo (2026-09-08).
  const guard = () => {
    if (!state.justAdded) return false;
    state.justAdded = false;
    state.selections = {};
    $('#postAddActions').hidden = true;
    refresh();
    return true;
  };
  // Sutraukiamos dekorų kolekcijos — tik vizualus perjungimas, konfigūracijos
  // nekeičia, todėl refresh() nekviečiamas (kitaip būsena atsistatytų).
  $$('#groups [data-decor-group]').forEach(b => b.onclick = () => {
    b.closest('.decor-collection').classList.toggle('open');
  });
  $$('#groups [data-attr][data-value]').forEach(b => b.onclick = () => {
    if (guard()) return;
    state.selections[b.dataset.attr] = b.dataset.value;
    if (b.dataset.attr === 'HANDLE_SIDE') state.selections.HANDLE_SIDE_CUSTOM = 'YES';
    if (b.dataset.attr === 'HANDLE_PLATE') state.selections.HANDLE_PLATE_CUSTOM = 'YES';
    if (b.dataset.attr === 'FLOOR_TRIM_COLOR') state.selections.FLOOR_TRIM_COLOR_CUSTOM = 'YES';
    if (b.dataset.attr === 'LOCK') state.selections.LOCK_CUSTOM = 'YES';
    refresh();
  });
  $$('#groups [data-toggle]').forEach(el => el.onchange = () => {
    if (guard()) return;
    state.selections[el.dataset.toggle] = el.checked ? el.dataset.on : el.dataset.off; refresh();
  });
  $$('#groups [data-select], #pickedIntarsia [data-select]').forEach(el => el.onchange = () => {
    if (guard()) return;
    state.selections[el.dataset.select] = el.value; refresh();
  });
  bindSimpleSelect('staktaRange', 'STAKTA_RANGE');
  bindSimpleSelect('staktaTrim', 'STAKTA_TRIM');
  bindSimpleSelect('hingeCap', 'HINGE_CAP');
  bindSimpleSelect('fixedTrimSet', 'FIXED_TRIM_SET');
  const fixedTrimQty = document.getElementById('fixedTrimQty');
  if (fixedTrimQty) fixedTrimQty.oninput = () => { state.selections.FIXED_TRIM_QTY = Math.max(1, Math.round(Number(fixedTrimQty.value) || 1)); refresh(); };
  const kampukasQty = document.getElementById('kampukasQty');
  if (kampukasQty) kampukasQty.oninput = () => { state.selections.KAMPUKAS_QTY = Math.max(1, Math.round(Number(kampukasQty.value) || 1)); refresh(); };
  const staktaDecor = document.getElementById('staktaDecor');
  if (staktaDecor) staktaDecor.onchange = () => {
    state.selections.STAKTA_DECOR = staktaDecor.value;
    state.selections.STAKTA_DECOR_CUSTOM = 'YES';
    refresh();
  };
  const resetLink = document.getElementById('resetStaktaDecor');
  if (resetLink) resetLink.onclick = (e) => {
    e.preventDefault();
    state.selections.STAKTA_DECOR_CUSTOM = 'NO';
    refresh();
  };
  const floorQty = document.getElementById('floorTrimQty');
  if (floorQty) floorQty.oninput = () => { state.selections.FLOOR_TRIM_QTY = Math.max(1, Math.round(Number(floorQty.value) || 1)); refresh(); };
  const resetFloorColor = document.getElementById('resetFloorColor');
  if (resetFloorColor) resetFloorColor.onclick = (e) => {
    e.preventDefault();
    state.selections.FLOOR_TRIM_COLOR_CUSTOM = 'NO';
    refresh();
  };

  const handleFamily = document.getElementById('handleFamily');
  if (handleFamily) handleFamily.onchange = () => {
    state.selections.HANDLE_FAMILY = handleFamily.value;
    state.selections.HANDLE_FINISH = null;
    refresh();
  };
}
function bindSimpleSelect(id, key) {
  const el = document.getElementById(id);
  if (el) el.onchange = () => {
    if (state.justAdded) {
      state.justAdded = false; state.selections = {};
      $('#postAddActions').hidden = true;
      refresh(); return;
    }
    state.selections[key] = el.value; refresh();
  };
}

function renderBreakdown() {
  const p = state.price;
  const s = state.selections;
  const famLabel = state.cfg.family.label;

  const GROUPS = [
    { key: 'door',   title: `Varčia ${famLabel} ${state.modelNo}`, total: 'Viso už varčią be PVM', base: p.baseNet },
    { key: 'frame',  title: 'Stakta', total: 'Viso už staktą be PVM' },
    { key: 'handle', title: 'Rankena', total: 'Viso už rankeną be PVM' },
    { key: 'trim',   title: 'Apdaila', total: 'Viso už apdailą be PVM' },
  ];

  let html = '';
  let grandNet = 0;
  GROUPS.forEach(g => {
    const lines = p.adjustments.filter(a => a.group === g.key);
    if (!lines.length && g.base == null) return;
    // Apvaliname kiekvieną eilutę ir sumuojame apvalintas — taip ekrane rodomi
    // skaičiai visada sutampa su suma (ta pati logika kaip sąskaitoje).
    let sub = g.base != null ? round2(g.base) : 0;
    html += `<div class="bd-group">`;
    if (g.base != null) {
      html += `<div class="price-line bd-first"><span>${esc(g.title)}</span><strong>${money(round2(g.base))}</strong></div>`;
    } else {
      html += `<div class="bd-title">${esc(g.title)}</div>`;
    }
    lines.forEach(a => {
      if (a.spec) {
        html += `<div class="price-line bd-spec"><span>${esc(a.description)}</span><strong>—</strong></div>`;
      } else {
        const amt = round2(a.amountNet);
        sub = round2(sub + amt);
        html += `<div class="price-line"><span>${esc(a.description)}</span><strong>+ ${money(amt)}</strong></div>`;
      }
    });
    grandNet = round2(grandNet + sub);
    const subGross = round2(sub * SHARED_EXTRAS.vatRate + sub);
    html += `<div class="price-line bd-subtotal"><span>${esc(g.total)}</span><strong>${money(sub)}<br><span class="bd-gross-inline">su PVM ${money(subGross)}</span></strong></div>`;
    html += `</div>`;
  });

  const vat = round2(grandNet * SHARED_EXTRAS.vatRate);
  const grandGross = round2(grandNet + vat);
  html += `<div class="bd-grand">
    <div class="price-line total"><span>VISO UŽ KOMPLEKTĄ BE PVM</span><strong>${money(grandNet)}</strong></div>
    <div class="price-line"><span>PVM 21% suma</span><strong>${money(vat)}</strong></div>
    <div class="price-line gross"><span>VISO UŽ KOMPLEKTĄ SU PVM</span><strong>${money(grandGross)}</strong></div>
  </div>`;

  $('#thisUnitBreakdown').innerHTML = html;
  $('#validDot').className = `valid-dot ${p.valid ? 'valid' : 'invalid'}`;
  $('#addToOrder').disabled = !p.valid || state.justAdded;
  const miss = (p.missing || []);
  const hint = $('#missingHint');
  if (miss.length) {
    hint.hidden = false;
    hint.innerHTML = `Dar reikia pasirinkti: <strong>${miss.map(esc).join(', ')}</strong>`;
  } else {
    hint.hidden = true;
  }
}

function addToCart() {
  if (!state.price.valid) return;
  // Sveikas skaičius tikrinamas ČIA, įtraukimo metu — vien HTML `min="1"`
  // nepakanka, nes šis puslapis niekada nekviečia formos pateikimo/validacijos
  // (audito radinys 2026-09-23: rankomis įvestas "1.5" būdavo priimamas).
  const qty = Math.max(1, Math.round(Number($('#qty').value) || 1));
  const cfg = state.cfg;
  state.cart.push({
    familyKey: state.familyKey, familyLabel: cfg.family.label, modelNo: state.modelNo,
    line: cfg.family.line,   // reikalinga gamybos lapui atskirti linijas (2026-09-11)
    selections: { ...state.selections }, qty,
    unitNet: state.price.unitNet, unitGross: state.price.unitGross,
    rows: describeSelections(cfg),
    groups: describeGrouped(cfg, state.price),
    baseNet: state.price.baseNet,
    priceAdjustments: state.price.adjustments.map(a => ({ ...a })),
    staktaDecorName: state.selections.STAKTA_DECOR ? decorOptName(cfg, state.selections.STAKTA_DECOR) : null,
    image: modelImg(state.familyKey, state.modelNo) || doorPlaceholderSvg(`${cfg.family.label} ${state.modelNo}`),
    // Žmogui skaitomi pavadinimai gamybos lapui (2026-09-11)
    decorName: decorOptName(cfg, state.selections.DECOR),
    decorGroup: (cfg.decorOpts.find(o => o.code === state.selections.DECOR) || {}).group,
    lockName: (cfg.lockOpts.find(o => o.code === state.selections.LOCK) || {}).name,
    glassName: (cfg.glassOpts.find(o => o.code === state.selections.GLASS) || {}).name,
    // Pirmas pasirinkimo įrašas = standartas; gamybos lape jo nerodome (2026-09-11)
    glassIsStandard: !!(cfg.glassOpts.length && cfg.glassOpts[0].code === state.selections.GLASS),
    ventName: (VENTILATION_OPTIONS.find(v => v[0] === state.selections.VENTILATION) || [])[1],
    hwName: (cfg.hwColorOpts.find(o => o[0] === state.selections.HARDWARE_COLOR) || [])[1],
    lockColorName: ((cfg.lockColorOpts || []).find(o => o[0] === state.selections.LOCK_COLOR) || [])[1],
    hingeCapName: (HINGE_CAP_OPTIONS.find(h => h[0] === state.selections.HINGE_CAP) || [])[1],
    handleName: (HANDLE_FAMILIES.find(h => h.key === state.selections.HANDLE_FAMILY) || {}).name,
    handleFinishName: (() => {
      const f = HANDLE_FAMILIES.find(h => h.key === state.selections.HANDLE_FAMILY);
      if (!f) return null;
      const x = f.finishes.find(y => y[0] === state.selections.HANDLE_FINISH);
      return x ? x[1] : null;
    })(),
    // Grindjuostės spalva gamybos lapui (2026-09-23) — anksčiau lape likdavo
    // tik tipas ir kiekis, be spalvos, todėl komplektacijos nebuvo galima
    // tiksliai atkurti vien iš gamybos lapo (audito radinys).
    floorTrimColorName: state.selections.FLOOR_TRIM === 'YES'
      ? (state.selections.FLOOR_TRIM_TYPE === 'painted'
          ? (FLOOR_TRIM_PAINTED_COLORS.find(c => c[0] === state.selections.FLOOR_TRIM_COLOR) || [])[1]
          : decorOptName(cfg, state.selections.FLOOR_TRIM_COLOR))
      : null,
  });
  renderCartMini();
  $('#qty').value = 1;
  // Įtraukus komplektą, vietoj vieno mygtuko rodomi du pasirinkimai
  // („Kurti naują" / „Kopijuoti įrašą") — 2026-09-08 patikslinimas.
  state.justAdded = true;
  $('#addToOrder').disabled = true;   // lieka matomas, tik neaktyvus
  $('#postAddActions').hidden = false;
}

function startNewEntry() {
  state.justAdded = false;
  state.selections = {};
  $('#postAddActions').hidden = true;
  refresh();
}

function copyEntry() {
  // Pasirinkimai lieka, galima koreguoti ir įtraukti dar vieną
  state.justAdded = false;
  $('#postAddActions').hidden = true;
  refresh();
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function invoiceLines() {
  // Suma imama iš TŲ PAČIŲ eilučių, kurios spausdinamos sąskaitoje
  // (invoiceRowsForItem()), o ne perskaičiuojama iš item.unitNet*qty su kitokia
  // apvalinimo tvarka — anksčiau atskiri priedai apvalinami kiekvienu žingsniu
  // sąskaitos eilutėse, o bendra suma apvalinama tik kartą gale, todėl
  // dokumento apačia kartais nesutapdavo su jame pačiame rodomomis eilutėmis
  // per kelis centus (audito radinys 2026-09-23).
  return state.cart.map((item, i) => {
    const rows = invoiceRowsForItem(item, i + 1);
    const net = round2(rows.reduce((a, r) => a + r.sum, 0));
    const vat = round2(net * 0.21);
    const gross = round2(net + vat);
    return { item, net, vat, gross };
  });
}

function cartTotals() {
  const lines = invoiceLines();
  const net = round2(lines.reduce((a, l) => a + l.net, 0));
  const vat = round2(lines.reduce((a, l) => a + l.vat, 0));
  const gross = round2(net + vat);
  return { net, gross, vat };
}

function renderCartMini() {
  const count = state.cart.reduce((a, i) => a + i.qty, 0);
  $('#tabCartCount').textContent = count; $('#cartCountSmall').textContent = count;
  const mini = $('#cartMini');
  if (!state.cart.length) {
    mini.innerHTML = `<p class="cart-mini-empty">Kol kas tuščia.</p>`;
  } else {
    mini.innerHTML = state.cart.map(i => `<div class="cart-mini-row"><span>${esc(i.familyLabel)} ${i.modelNo} × ${i.qty}</span><strong>${money(round2(i.unitGross * i.qty))}</strong></div>`).join('');
  }
  $('#cartMiniTotal').textContent = money(cartTotals().gross);
}

function renderCartView() {
  const list = $('#cartList');
  if (!state.cart.length) {
    list.innerHTML = `<div class="cart-empty">Užsakymas tuščias — pridėkite duris konfigūratoriuje.</div>`;
  } else {
    list.innerHTML = state.cart.map((item, idx) => `
      <div class="cart-row">
        <img src="${item.image}" alt="" onerror="this.onerror=null;this.src='${doorPlaceholderSvg(item.familyLabel+' '+item.modelNo)}'" />
        <div><div class="cr-title">${esc(item.familyLabel)} ${item.modelNo}</div>
          <div class="cr-groups">${(item.groups || []).map(g => `
            <div class="cr-grp"><span class="cr-grp-t">${esc(g.title)}</span> ${esc(g.text)}
              <span class="cr-grp-sum">${esc(g.totalLabel)}: ${money(g.total)} / su PVM ${money(g.totalGross)}</span></div>`).join('')}
          </div></div>
        <div class="cr-qty">${item.qty} vnt.</div>
        <div class="cr-price">${money(round2(item.unitGross * item.qty))}</div>
        <div class="cr-actions">
          <button class="cr-btn" data-copy="${idx}" type="button">Kopijuoti įrašą ir kurti naują</button>
          <button class="cr-btn" data-edit="${idx}" type="button">Redaguoti</button>
          <button class="cr-btn cr-btn-del" data-idx="${idx}" type="button">Pašalinti</button>
        </div>
      </div>`).join('');
    $$('#cartList [data-idx]').forEach(b => b.onclick = () => { state.cart.splice(Number(b.dataset.idx), 1); renderCartView(); renderCartMini(); });
    // Kopijuoti įrašą ir kurti naują: grįžtame į konfigūratorių su tais pačiais pasirinkimais
    $$('#cartList [data-copy]').forEach(b => b.onclick = () => loadItemIntoConfigurator(Number(b.dataset.copy), false));
    // Redaguoti: tas pats, bet poziciją pašaliname — po redagavimo įtraukiama iš naujo
    $$('#cartList [data-edit]').forEach(b => b.onclick = () => loadItemIntoConfigurator(Number(b.dataset.edit), true));
  }
  renderInvoice();
}

function invoiceNumberFull() {
  // Anksčiau du atskiri laukai (Serija + Nr.) — sujungta į vieną „Užsakymo
  // numeris" lauką, nes klientams buvo neaišku, kodėl du (2026-09-17).
  return ($('#orderNumber').value || 'ERK 2026-001').trim();
}

function loadItemIntoConfigurator(idx, removeFromCart) {
  const item = state.cart[idx];
  if (!item) return;
  if (removeFromCart) { state.cart.splice(idx, 1); renderCartMini(); }
  state.familyKey = item.familyKey;
  state.modelNo = item.modelNo;
  state.selections = { ...item.selections };
  state.justAdded = false;
  $('#postAddActions').hidden = true;
  $('#qty').value = item.qty || 1;
  renderFamilyList();
  const f = FAMILIES[state.familyKey];
  const thumb = familyThumb(state.familyKey);
  $('#heroMedia').style.backgroundImage = thumb ? `url('${thumb}')` : 'none';
  $('#heroTitle').textContent = f.label;
  $('#heroPages').textContent = `ERKADO katalogas 2026 · psl. ${f.pages} · ${f.doorTypes.length} varčios tipai`;
  $('#modelCount').textContent = `${f.models.length} modeliai`;
  renderModelGrid();
  refresh();
  switchView('configurator');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderInvoice() {
  const t = cartTotals();
  const lines = invoiceLines();
  // Detalios eilutės su grupuota numeracija 1.1, 1.2, ... (2026-09-08)
  let rows = '';
  state.cart.forEach((item, i) => {
    const detail = invoiceRowsForItem(item, i + 1);
    detail.forEach((r, j) => {
      rows += `<tr>
        <td class="num">${esc(r.no)}</td>
        <td><span style="color:#333">${esc(r.desc)}</span></td>
        <td class="num">${r.qty}</td>
        <td class="num">${esc(r.unit)}</td>
        <td class="num">${money(r.unitPrice)}</td>
        <td class="num">${money(r.sum)}</td>
      </tr>`;
    });
  });
  if (!rows) rows = `<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">Nėra pozicijų</td></tr>`;

  const payDays = Number($('#paymentDays').value || 0);
  const issueDate = $('#orderDate').value || new Date().toISOString().slice(0, 10);
  const dueDate = new Date(issueDate); dueDate.setDate(dueDate.getDate() + payDays);

  const sellerVat = ($('#sellerVat').value || '').trim();
  const docTitle = sellerVat ? 'PVM SĄSKAITA FAKTŪRA' : 'SĄSKAITA FAKTŪRA';

  $('#invoiceSheet').innerHTML = `
    <div class="inv-head">
      <div><div class="inv-brand">${esc(($('#sellerName').value || 'ERKADO'))}<small>${esc(docTitle)}</small></div></div>
      <div class="inv-meta">Užsakymo numeris <strong>${esc(invoiceNumberFull())}</strong><br>Išrašymo data: ${esc(issueDate)}<br>Mokėti iki: ${dueDate.toISOString().slice(0,10)}${$('#senderName').value ? '<br>Pateikė: '+esc($('#senderName').value) : ''}</div>
    </div>
    <div class="inv-parties">
      <div><h4>Pardavėjas</h4>
        <strong>${esc($('#sellerName').value || 'ERKADO')}</strong><br>
        ${$('#sellerCode').value ? 'Įm. kodas: '+esc($('#sellerCode').value)+'<br>' : ''}
        ${sellerVat ? 'PVM kodas: '+esc(sellerVat)+'<br>' : ''}
        ${esc($('#sellerAddress').value || '')}<br>
        ${$('#sellerIban').value ? 'A.s. '+esc($('#sellerIban').value)+'<br>' : ''}
        ${esc($('#sellerBank').value || '')}
      </div>
      <div><h4>Pirkėjas</h4>
        <strong>${esc($('#customerName').value || '—')}</strong><br>
        ${$('#customerCode').value ? 'Įm. kodas: '+esc($('#customerCode').value)+'<br>' : ''}
        ${$('#customerVat').value ? 'PVM kodas: '+esc($('#customerVat').value)+'<br>' : ''}
        ${esc($('#customerAddress').value || '')}<br>
        ${esc($('#customerPhone').value || '')}
      </div>
    </div>
    <table class="inv-table"><thead><tr><th>Eil.<br>Nr.</th><th>Prekės pavadinimas</th><th>Kiekis</th><th>Mat.<br>vnt.</th><th>Kaina<br>be PVM</th><th>Suma be<br>PVM</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <div class="inv-totals">
      <div class="row"><span>Iš viso be PVM</span><strong>${money(t.net)}</strong></div>
      <div class="row"><span>PVM 21% suma</span><strong>${money(t.vat)}</strong></div>
      <div class="row grand"><span>Iš viso su PVM</span><strong>${money(t.gross)}</strong></div>
    </div>
    <div class="inv-words"><em>Suma žodžiais:</em> ${esc(amountToWordsLT(t.gross))}</div>
    <div class="inv-signrow">
      <div class="inv-sign"><span>Sąskaitą išrašė</span><div class="inv-signline"></div></div>
      <div class="inv-sign"><span>Prekes / paslaugas gavo</span><div class="inv-signline"></div></div>
    </div>
    <div class="inv-footnote">Ši pro forma sąskaita sugeneruota autonominiame ERKADO VIDAUS konfigūratoriuje pagal katalogą I/2026/B (galioja nuo 2026-04-20). Prieš galutinį apmokėjimą kainas ir pardavėjo rekvizitus reikia patvirtinti. SKU nenaudojamas — pozicija generuojama iš pasirinktų parametrų.</div>`;

  if (!$('#sendSubject').value) $('#sendSubject').value = mailSubject();
  $('#messageBody').value = orderText();

  // Gamybos lapas — antras dokumentas, generuojamas iš tų pačių krepšelio duomenų
  $('#prodScale').innerHTML = renderProductionSheet(state.cart, {
    nr: invoiceNumberFull(),
    date: $('#orderDate').value || new Date().toISOString().slice(0, 10),
    customer: $('#customerName').value,
    seller: $('#sellerName').value || 'ERKADO',
    // "Jūsų vardas / įmonė (nuo)" iš siuntimo skydelio — anksčiau naudota tik
    // laiško metaduomenyse, gamybos lape visai nerodyta (užsakovo pastaba
    // 2026-09-24). Rodoma tik kai užpildyta.
    sender: $('#senderName').value,
  });
  fitProdSheet();
}

/* Gamybos lapas piešiamas natūraliu gulsčio A4 pločiu (1040 px) ir sumažinamas,
   kad tilptų į peržiūros stulpelį. Be to stulpeliai užlipdavo vienas ant kito
   (2026-09-11 pastaba). Spausdinant mastelis atšaukiamas per @media print. */
function fitProdSheet() {
  const box = $('#prodSheet'), inner = $('#prodScale');
  if (!box || !inner) return;
  const avail = box.clientWidth - 40;           // 20 px padding iš abiejų pusių
  const k = Math.min(1, avail / 1040);
  inner.style.transform = k < 1 ? `scale(${k})` : '';
  // Konteinerio aukštį reikia sumažinti tiek pat, kitaip lieka tuščia vieta
  box.style.height = k < 1 ? (inner.offsetHeight * k + 40) + 'px' : '';
}
window.addEventListener('resize', fitProdSheet);

function orderText() {
  const t = cartTotals();
  const lines = [];
  const sellerVat = ($('#sellerVat').value || '').trim();
  lines.push(sellerVat ? 'PVM SĄSKAITA FAKTŪRA' : 'SĄSKAITA FAKTŪRA');
  lines.push(`Užsakymo numeris: ${invoiceNumberFull()}`);
  lines.push('');
  if ($('#senderName').value) lines.push(`Nuo: ${$('#senderName').value}`);
  lines.push(`Išrašymo data: ${$('#orderDate').value || '-'}`);
  const payDays = Number($('#paymentDays').value || 0);
  if (payDays) lines.push(`Mokėjimo terminas: ${payDays} d.d.`);
  lines.push('');
  lines.push('PARDAVĖJAS:');
  lines.push(`  ${$('#sellerName').value || 'ERKADO'}`);
  if ($('#sellerCode').value) lines.push(`  Įm. kodas: ${$('#sellerCode').value}`);
  if (sellerVat) lines.push(`  PVM kodas: ${sellerVat}`);
  if ($('#sellerAddress').value) lines.push(`  ${$('#sellerAddress').value}`);
  if ($('#sellerIban').value) lines.push(`  A.s. ${$('#sellerIban').value}${$('#sellerBank').value ? ', ' + $('#sellerBank').value : ''}`);
  lines.push('');
  lines.push('PIRKĖJAS:');
  lines.push(`  Užsakovas: ${$('#customerName').value || '-'}`);
  lines.push(`  Įmonės kodas: ${$('#customerCode').value || '-'}`);
  if ($('#customerVat').value) lines.push(`  PVM kodas: ${$('#customerVat').value}`);
  lines.push(`  Adresas: ${$('#customerAddress').value || '-'}`);
  lines.push(`  Telefonas: ${$('#customerPhone').value || '-'}`);
  lines.push('');
  // Laiško tekste — tas pats numeruotas pozicijų sąrašas kaip PDF (2026-09-08)
  lines.push('EIL. NR. | PREKĖS PAVADINIMAS | KIEKIS | MAT. VNT. | KAINA BE PVM | SUMA BE PVM');
  lines.push('');
  state.cart.forEach((item, i) => {
    invoiceRowsForItem(item, i + 1).forEach(r => {
      lines.push(`${r.no}  ${r.desc}`);
      lines.push(`      ${r.qty} ${r.unit} × ${money(r.unitPrice)} = ${money(r.sum)}`);
    });
    lines.push('');
  });
  lines.push('');
  lines.push(`Iš viso be PVM: ${money(t.net)}`);
  lines.push(`PVM 21% suma: ${money(t.vat)}`);
  lines.push(`Iš viso su PVM: ${money(t.gross)}`);
  lines.push(`Suma žodžiais: ${amountToWordsLT(t.gross)}`);
  lines.push('');
  lines.push('Prisegti dokumentai: 1) Sąskaita faktūra, 2) Gamybos lapas (duomenų suvedimui, be kainų).');
  lines.push('');
  lines.push('Pastaba: sugeneruota autonominiame demonstraciniame kataloge pagal ERKADO 2026 katalogą; prieš realų užsakymą duomenis reikia patvirtinti pagal galiojantį gamintojo katalogą ir komercines sąlygas.');
  return lines.join('\r\n');
}
function currentMessageText() { return $('#messageBody').value || orderText(); }
function mailSubject() { return `${invoiceNumberFull()} — ERKADO užsakymas (${state.cart.length} poz.)`; }
function currentSubject() { return $('#sendSubject').value || mailSubject(); }
function openMail() {
  const to = ($('#sendTo').value || '').trim();
  if (!to) { $('#sendTo').focus(); return; }
  // mailto: negali prisegti failo, todėl pirma atidaromas spausdinimo/PDF dialogas,
  // kad PDF būtų paruoštas prisegti prie ką tik atidaryto laiško (2026-09-08).
  // Nuo 2026-09-17 čia spausdinami abu dokumentai VIENAME PDF (printDoc('both')),
  // kad reikėtų išsaugoti ir prisegti tik vieną failą, ne du.
  const openIt = () => {
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(currentSubject())}&body=${encodeURIComponent(currentMessageText())}`;
  };
  const note = $('#mailNote');
  if (note) { note.hidden = false; note.textContent = 'Atsidarys spausdinimo dialogas — išsaugokite VIENĄ PDF failą (jame bus ir sąskaita, ir gamybos lapas). Uždarius jį, atsidarys laiškas — prisekite išsaugotą failą.'; }
  // Laiškas atidaromas TIK uždarius spausdinimo langą (2026-09-08)
  let opened = false;
  const onAfterPrint = () => {
    if (opened) return;
    opened = true;
    window.removeEventListener('afterprint', onAfterPrint);
    setTimeout(openIt, 250);
  };
  window.addEventListener('afterprint', onAfterPrint);
  printDoc('both');
}
function downloadEml() {
  const to = ($('#sendTo').value || '').trim();
  const from = ($('#senderName').value || '').trim();
  // Antraštės ir laiško turinys sujungiami ATSKIRAI, tuščia eilute tarp jų —
  // anksčiau tuščia eilutė buvo įdėta į tą patį masyvą kaip antraštės, o
  // `.filter(Boolean)` ją pašalindavo (nes Boolean('')===false), todėl EML
  // failui trūko privalomo \r\n\r\n skirtuko tarp antraščių ir teksto
  // (audito radinys 2026-09-23).
  const headers = [`To: ${to}`, from ? `From: ${from}` : null, `Subject: ${currentSubject()}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit'].filter(Boolean).join('\r\n');
  const eml = headers + '\r\n\r\n' + currentMessageText();
  const blob = new Blob([eml], { type: 'message/rfc822;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${($('#orderNumber').value || 'ERKADO').replace(/[^a-z0-9_-]+/gi, '_')}.eml`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyOrderText() {
  try { await navigator.clipboard.writeText(currentMessageText()); }
  catch { const ta = document.createElement('textarea'); ta.value = currentMessageText(); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  const old = document.querySelector('.copy-ok'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'copy-ok'; el.textContent = 'Nukopijuota ✓';
  $('.send-actions').insertAdjacentElement('afterend', el); setTimeout(() => el.remove(), 2200);
}

init();
