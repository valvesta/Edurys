/* ==========================================================================
   KONFIGŪRATORIAUS LOGIKA

   Kainas skaičiuoja tas pats variklis (engine.js), kuris veikia serveryje —
   naršyklė rodo kainą iškart, o išsaugant užsakymą serveris ją apskaičiuoja
   iš naujo ir įrašo į duomenų bazę. Rodomos sumos palyginamos su serverio
   sumomis (žr. syncCart).

   HTML šablonai — templates.js, išvaizda — styles.css.
   Ryšys su sistema (prisijungimas, katalogas, užsakymo saugojimas) — boot.js,
   kuris paleidžia startConfigurator(env).
   ========================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* Aplinka, kurią perduoda boot.js:
   env.media(file)  -> nuotraukos adresas arba null
   env.vatRate      -> PVM tarifas (iš užsakymo / katalogo versijos)
   env.order        -> užsakymo saugojimo funkcijos (null — be saugojimo)
   env.catalogName  -> katalogo pavadinimas dokumentams
   env.userName     -> prisijungusio naudotojo vardas
   env.companyName  -> įmonė (pirkėjas) */
let ENV = null;

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


const state = { familyKey: 'WERBENA', modelNo: 1, selections: {}, cfg: null, price: null, cart: [], railTouched: false };

/* Nuotraukos laikomos Azure saugykloje (privačiai); adresą su laikinu leidimu
   suformuoja env.media(). Failų pavadinimai tie patys kaip senajame assets/. */
function familyThumb(key) {
  return ENV.media(`${key.toLowerCase()}-hero.jpg`);
}
function modelImg(key, n) {
  return ENV.media(`${key.toLowerCase()}-${n}.png`);
}

/* Neužsikrovusi nuotrauka: data-fallback="hide" — paslepiama, kitu atveju
   pakeičiama durų schema su data-fallback tekstu. (Anksčiau tai darė
   onerror="..." atributai, bet saugumo politika (CSP) HTML viduje esančio
   kodo nevykdo.) */
function bindImageFallbacks() {
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback == null || img.dataset.fallbackDone) return;
    img.dataset.fallbackDone = '1';
    if (img.dataset.fallback === 'hide') img.style.visibility = 'hidden';
    else img.src = doorPlaceholderSvg(img.dataset.fallback);
  }, true);
}

function startConfigurator(env) {
  ENV = env;
  bindImageFallbacks();
  init();
}

function init() {
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
  $('#cancelEdit').onclick = startNewEntry;

  $('#pendingList').textContent = PENDING_FAMILIES.join(' · ');

  // Užsakymo pozicijos, jei atidarytas jau esantis juodraštis
  (ENV.initialLines || []).forEach(l => {
    state.cart.push(buildCartItem(l.familyKey, l.modelNo, l.selections, l.quantity));
  });
  initOrderPanel();

  renderFamilyList();
  chooseFamily(FAMILIES.WERBENA ? 'WERBENA' : Object.keys(FAMILIES)[0]);
  renderOrderStatus();
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
    const img = thumb ? `<img src="${esc(thumb)}" alt="" data-fallback="hide" />` : `<img src="${doorPlaceholderSvg(f.label)}" alt="" />`;
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
  setHeroImage(key);
  $('#heroTitle').textContent = f.label;
  $('#heroEyebrow').textContent = (LINES[f.line] || LINES.STILE).eyebrow;
  $('#heroPages').textContent = `ERKADO katalogas 2026 · psl. ${f.pages} · ${f.doorTypes.length} varčios tipai${f.tier === 2 ? ' · duomenys iš teksto sluoksnio' : ''}`;
  $('#modelCount').textContent = `${f.models.length} modeliai`;
  renderModelGrid();
  chooseModel(state.modelNo);
}

/* Šeimos nuotrauka antraštėje. (Anksčiau, pasirinkus šeimą, nuotrauka iškart
   būdavo išvaloma: po backgroundImage buvo nustatomas background = ''.
   Dabar fonas su gradientu dedamas tik tada, kai nuotraukos nėra.) */
function setHeroImage(key) {
  const thumb = familyThumb(key);
  const el = $('#heroMedia');
  el.style.background = thumb ? '' : 'linear-gradient(135deg, #3a352c, #211d18)';
  el.style.backgroundImage = thumb ? `url("${thumb}")` : el.style.backgroundImage;
}

function renderModelGrid() {
  const f = FAMILIES[state.familyKey];
  $('#modelGrid').innerHTML = f.models.map(n => {
    const price = pickedBasePrice(f, n, f.decorOptions[0] ? f.decorOptions[0][0] : null);
    const img = modelImg(state.familyKey, n) || doorPlaceholderSvg(`${f.label} ${n}`);
    return `<button class="model-card hinge-mark ${n === state.modelNo ? 'is-selected selected' : ''}" data-n="${n}" type="button">
      <img src="${esc(img)}" alt="${f.label} ${n}" data-fallback="${esc(f.label + ' ' + n)}" />
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
  $('#pickedPrice').textContent = `Varčia nuo ${money(pickedBasePrice(f, n, state.selections.DECOR))} be PVM`;

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

/* Bazinė varčios kaina katalogo duomenų bazėje saugoma pagal dekoro grupę.
   Kol dekoras nepasirinktas, rodoma mažiausia galima kaina („nuo“).
   (Senajame konfigūratoriuje tokiu atveju būdavo rodoma vienos, iš anksto
   nežinomos grupės kaina — ne visada mažiausia.) */
function pickedBasePrice(f, n, decor) {
  const exact = decor ? f.basePrice(n, decor) : undefined;
  if (Number.isFinite(exact)) return exact;
  const all = f.decorOptions.map(d => f.basePrice(n, d[0])).filter(Number.isFinite);
  return all.length ? Math.min(...all) : 0;
}

/* Ar kainą jau galima apskaičiuoti (pasirinktas dekoras ir pan.). */
function isPriced(p) {
  return Number.isFinite(p.baseNet) && p.adjustments.every(a => a.spec || Number.isFinite(a.amountNet));
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
    const subGross = round2(sub + vatOf(sub));
    html += `<div class="price-line bd-subtotal"><span>${esc(g.total)}</span><strong>${money(sub)}<br><span class="bd-gross-inline">su PVM ${money(subGross)}</span></strong></div>`;
    html += `</div>`;
  });

  const vat = vatOf(grandNet);
  const grandGross = round2(grandNet + vat);
  html += `<div class="bd-grand">
    <div class="price-line total"><span>VISO UŽ KOMPLEKTĄ BE PVM</span><strong>${money(grandNet)}</strong></div>
    <div class="price-line"><span>PVM ${vatPercent()}% suma</span><strong>${money(vat)}</strong></div>
    <div class="price-line gross"><span>VISO UŽ KOMPLEKTĄ SU PVM</span><strong>${money(grandGross)}</strong></div>
  </div>`;

  $('#thisUnitBreakdown').innerHTML = isPriced(p) ? html : tplBreakdownPending(FAMILIES[state.familyKey].line === 'PAINTED' ? 'spalvą' : 'dekorą');
  $('#validDot').className = `valid-dot ${p.valid ? 'valid' : 'invalid'}`;
  $('#addToOrder').disabled = !p.valid || state.justAdded;
  renderEditState();
  const miss = (p.missing || []);
  const hint = $('#missingHint');
  if (miss.length) {
    hint.hidden = false;
    hint.innerHTML = `Dar reikia pasirinkti: <strong>${miss.map(esc).join(', ')}</strong>`;
  } else {
    hint.hidden = true;
  }
}

/* Redaguojant esamą poziciją mygtukas ją atnaujina, o ne prideda naują. */
function renderEditState() {
  const editing = state.editIndex != null;
  $('#addToOrder').textContent = editing ? `Atnaujinti poziciją Nr. ${state.editIndex + 1}` : 'Įtraukti į užsakymą';
  $('#editHint').hidden = !editing;
  $('#editNo').textContent = editing ? String(state.editIndex + 1) : '';
}

/* Užsakymo pozicija iš konfigūracijos. Ta pati funkcija naudojama ir
   įtraukiant naują poziciją, ir atkuriant išsaugotą užsakymą iš duomenų bazės. */
function cartItemFrom(familyKey, modelNo, cfg, price, qty) {
  const s = cfg.selections;
  return {
    familyKey: familyKey, familyLabel: cfg.family.label, modelNo: modelNo,
    line: cfg.family.line,   // reikalinga gamybos lapui atskirti linijas (2026-09-11)
    selections: { ...s }, qty,
    unitNet: price.unitNet, unitGross: price.unitGross,
    rows: describeSelections(cfg),
    groups: describeGrouped(cfg, price),
    baseNet: price.baseNet,
    priceAdjustments: price.adjustments.map(a => ({ ...a })),
    staktaDecorName: s.STAKTA_DECOR ? decorOptName(cfg, s.STAKTA_DECOR) : null,
    image: modelImg(familyKey, modelNo) || doorPlaceholderSvg(`${cfg.family.label} ${modelNo}`),
    // Žmogui skaitomi pavadinimai gamybos lapui (2026-09-11)
    decorName: decorOptName(cfg, s.DECOR),
    decorGroup: (cfg.decorOpts.find(o => o.code === s.DECOR) || {}).group,
    lockName: (cfg.lockOpts.find(o => o.code === s.LOCK) || {}).name,
    glassName: (cfg.glassOpts.find(o => o.code === s.GLASS) || {}).name,
    // Pirmas pasirinkimo įrašas = standartas; gamybos lape jo nerodome (2026-09-11)
    glassIsStandard: !!(cfg.glassOpts.length && cfg.glassOpts[0].code === s.GLASS),
    ventName: (VENTILATION_OPTIONS.find(v => v[0] === s.VENTILATION) || [])[1],
    hwName: (cfg.hwColorOpts.find(o => o[0] === s.HARDWARE_COLOR) || [])[1],
    lockColorName: ((cfg.lockColorOpts || []).find(o => o[0] === s.LOCK_COLOR) || [])[1],
    hingeCapName: (HINGE_CAP_OPTIONS.find(h => h[0] === s.HINGE_CAP) || [])[1],
    handleName: (HANDLE_FAMILIES.find(h => h.key === s.HANDLE_FAMILY) || {}).name,
    handleFinishName: (() => {
      const f = HANDLE_FAMILIES.find(h => h.key === s.HANDLE_FAMILY);
      if (!f) return null;
      const x = f.finishes.find(y => y[0] === s.HANDLE_FINISH);
      return x ? x[1] : null;
    })(),
    // Grindjuostės spalva gamybos lapui (2026-09-23) — anksčiau lape likdavo
    // tik tipas ir kiekis, be spalvos, todėl komplektacijos nebuvo galima
    // tiksliai atkurti vien iš gamybos lapo (audito radinys).
    floorTrimColorName: s.FLOOR_TRIM === 'YES'
      ? (s.FLOOR_TRIM_TYPE === 'painted'
          ? (FLOOR_TRIM_PAINTED_COLORS.find(c => c[0] === s.FLOOR_TRIM_COLOR) || [])[1]
          : decorOptName(cfg, s.FLOOR_TRIM_COLOR))
      : null,
  };
}

function buildCartItem(familyKey, modelNo, selections, qty) {
  const cfg = configureDoor(familyKey, modelNo, JSON.parse(JSON.stringify(selections || {})));
  const price = priceDoor(cfg);
  if (!price.valid) {
    const why = [].concat(price.errors || [], (price.missing || []).map(m => 'nepasirinkta: ' + m));
    throw new Error(`Išsaugotos pozicijos ${FAMILIES[familyKey] ? FAMILIES[familyKey].label : familyKey} ${modelNo} atkurti nepavyko (${why.join('; ')}).`);
  }
  return cartItemFrom(familyKey, modelNo, cfg, price, qty);
}

function addToCart() {
  if (!state.price.valid) return;
  // Sveikas skaičius tikrinamas ČIA, įtraukimo metu — vien HTML `min="1"`
  // nepakanka, nes šis puslapis niekada nekviečia formos pateikimo/validacijos
  // (audito radinys 2026-09-23: rankomis įvestas "1.5" būdavo priimamas).
  const qty = Math.max(1, Math.min(1000, Math.round(Number($('#qty').value) || 1)));
  const item = cartItemFrom(state.familyKey, state.modelNo, state.cfg, state.price, qty);
  // Redaguojama pozicija pakeičiama toje pačioje vietoje (anksčiau
  // „Redaguoti" ją iškart pašalindavo — nebaigus redaguoti, ji dingdavo).
  if (state.editIndex != null && state.cart[state.editIndex]) state.cart[state.editIndex] = item;
  else state.cart.push(item);
  state.editIndex = null;
  renderEditState();
  renderCartMini();
  syncCart();
  $('#qty').value = 1;
  // Įtraukus komplektą, vietoj vieno mygtuko rodomi du pasirinkimai
  // („Kurti naują" / „Kopijuoti įrašą") — 2026-09-08 patikslinimas.
  state.justAdded = true;
  $('#addToOrder').disabled = true;   // lieka matomas, tik neaktyvus
  $('#postAddActions').hidden = false;
}

function startNewEntry() {
  state.justAdded = false;
  state.editIndex = null;
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

/* PVM — taip pat, kaip duomenų bazėje: eilutės suma be PVM × tarifas,
   apvalinama iki cento (pusė — į didesnę pusę). Skaičiuojama sveikais
   centais, kad neliktų slankiojo kablelio paklaidų. (Anksčiau
   round2(net * 0.21) apie 0,2 % atvejų duodavo 1 ct mažiau nei
   buhalterinis apvalinimas.) */
function vatRate() { return ENV && ENV.vatRate != null ? Number(ENV.vatRate) : SHARED_EXTRAS.vatRate; }
function vatPercent() { return Math.round(vatRate() * 10000) / 100; }
function vatOf(net) {
  const cents = Math.round(net * 100);
  const bp = Math.round(vatRate() * 10000);       // 0,21 -> 2100
  return Math.round(cents * bp / 10000) / 100;
}

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
    const vat = vatOf(net);
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
    const lines = invoiceLines();
    mini.innerHTML = state.cart.map((i, idx) => `<div class="cart-mini-row"><span>${esc(i.familyLabel)} ${i.modelNo} × ${i.qty}</span><strong>${money(lines[idx].gross)}</strong></div>`).join('');
  }
  $('#cartMiniTotal').textContent = money(cartTotals().gross);
  renderOrderStatus();
}

function renderCartView() {
  const list = $('#cartList');
  if (!state.cart.length) {
    list.innerHTML = `<div class="cart-empty">Užsakymas tuščias — pridėkite duris konfigūratoriuje.</div>`;
  } else {
    const lines = invoiceLines();
    list.innerHTML = state.cart.map((item, idx) => `
      <div class="cart-row">
        <img src="${esc(item.image)}" alt="" data-fallback="${esc(item.familyLabel + ' ' + item.modelNo)}" />
        <div><div class="cr-title">${esc(item.familyLabel)} ${item.modelNo}</div>
          <div class="cr-groups">${(item.groups || []).map(g => `
            <div class="cr-grp"><span class="cr-grp-t">${esc(g.title)}</span> ${esc(g.text)}
              <span class="cr-grp-sum">${esc(g.totalLabel)}: ${money(g.total)} / su PVM ${money(g.totalGross)}</span></div>`).join('')}
          </div></div>
        <div class="cr-qty">${item.qty} vnt.</div>
        <div class="cr-price">${money(lines[idx].gross)}</div>
        <div class="cr-actions">
          <button class="cr-btn" data-copy="${idx}" type="button">Kopijuoti įrašą ir kurti naują</button>
          <button class="cr-btn" data-edit="${idx}" type="button">Redaguoti</button>
          <button class="cr-btn cr-btn-del" data-idx="${idx}" type="button">Pašalinti</button>
        </div>
      </div>`).join('');
    $$('#cartList [data-idx]').forEach(b => b.onclick = () => removeCartItem(Number(b.dataset.idx)));
    // Kopijuoti įrašą ir kurti naują: grįžtame į konfigūratorių su tais pačiais pasirinkimais
    $$('#cartList [data-copy]').forEach(b => b.onclick = () => loadItemIntoConfigurator(Number(b.dataset.copy), false));
    // Redaguoti: tas pats, bet pakeitimai išsaugomi toje pačioje pozicijoje
    $$('#cartList [data-edit]').forEach(b => b.onclick = () => loadItemIntoConfigurator(Number(b.dataset.edit), true));
  }
  renderInvoice();
}

/* Užsakymo numerį suteikia sistema (pvz. 2026-000012), kai išsaugoma
   pirmoji pozicija. Iki tol dokumente rašoma „juodraštis". */
function invoiceNumberFull() {
  return (ENV.order && ENV.order.number()) || 'juodraštis';
}

function removeCartItem(idx) {
  state.cart.splice(idx, 1);
  if (state.editIndex === idx) state.editIndex = null;
  else if (state.editIndex != null && state.editIndex > idx) state.editIndex--;
  renderCartView(); renderCartMini(); refresh();
  syncCart();
}

function loadItemIntoConfigurator(idx, removeFromCart) {
  const item = state.cart[idx];
  if (!item) return;
  state.editIndex = removeFromCart ? idx : null;
  state.familyKey = item.familyKey;
  state.modelNo = item.modelNo;
  state.selections = { ...item.selections };
  state.justAdded = false;
  $('#postAddActions').hidden = true;
  $('#qty').value = item.qty || 1;
  renderFamilyList();
  const f = FAMILIES[state.familyKey];
  setHeroImage(state.familyKey);
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
      <div class="row"><span>PVM ${vatPercent()}% suma</span><strong>${money(t.vat)}</strong></div>
      <div class="row grand"><span>Iš viso su PVM</span><strong>${money(t.gross)}</strong></div>
    </div>
    <div class="inv-words"><em>Suma žodžiais:</em> ${esc(amountToWordsLT(t.gross))}</div>
    <div class="inv-signrow">
      <div class="inv-sign"><span>Sąskaitą išrašė</span><div class="inv-signline"></div></div>
      <div class="inv-sign"><span>Prekes / paslaugas gavo</span><div class="inv-signline"></div></div>
    </div>
    <div class="inv-footnote">Ši pro forma sąskaita sugeneruota užsakymų sistemoje pagal katalogą ${esc(ENV.catalogName || '')}. Prieš galutinį apmokėjimą kainas ir pardavėjo rekvizitus reikia patvirtinti. SKU nenaudojamas — pozicija generuojama iš pasirinktų parametrų.</div>`;

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

/* ==========================================================================
   UŽSAKYMO SAUGOJIMAS SISTEMOJE

   Kiekvienas pozicijų pakeitimas (įtraukta, atnaujinta, pašalinta) iškart
   išsaugomas duomenų bazėje kaip užsakymo juodraštis. Serveriui siunčiami
   tik pasirinkimai — kainas jis apskaičiuoja pats. Gautos serverio sumos
   palyginamos su rodomomis; jei skiriasi bent centu, užsakymo pateikti
   neleidžiama (taip pastebėtume bet kokį kainų neatitikimą).
   ========================================================================== */
const orderUi = {
  pending: 0,             // kiek išsaugojimų dar vyksta
  lines: 'new',           // pozicijų būsena: new | saved | error | mismatch
  linesMessage: '',
  headerError: null,      // antraštės (objekto, pastabų) išsaugojimo klaida
};

function cartPayload() {
  return state.cart.map(i => ({ familyKey: i.familyKey, modelNo: i.modelNo, quantity: i.qty, selections: i.selections }));
}

function syncCart() {
  if (!ENV.order) return;
  orderUi.pending++;
  renderOrderStatus();
  ENV.order.saveLines(cartPayload()).then(res => {
    if (!res) return;                       // vėlesnis išsaugojimas jau eilėje — tikrins jis
    const t = cartTotals();
    const cents = n => Math.round(Number(n) * 100);
    if (cents(t.net) !== cents(res.NetTotal) || cents(t.vat) !== cents(res.VatTotal) || cents(t.gross) !== cents(res.GrossTotal)) {
      orderUi.lines = 'mismatch';
      orderUi.linesMessage = `Serverio apskaičiuota suma (${money(res.GrossTotal)}) skiriasi nuo rodomos (${money(t.gross)}). ` +
        'Užsakymo pateikti negalima — praneškite administratoriui.';
    } else {
      orderUi.lines = 'saved';
      orderUi.linesMessage = '';
    }
  }).catch(e => {
    orderUi.lines = 'error';
    orderUi.linesMessage = e.message;
  }).finally(() => {
    orderUi.pending--;
    renderOrderStatus();
  });
}

function saveHeader() {
  if (!ENV.order) return;
  orderUi.pending++;
  renderOrderStatus();
  ENV.order.saveHeader({ customerReference: $('#customerRef').value.trim(), notes: $('#orderNotes').value.trim() })
    .then(() => { orderUi.headerError = null; })
    .catch(e => { orderUi.headerError = e.message; })
    .finally(() => { orderUi.pending--; renderOrderStatus(); });
}

function currentOrderState() {
  if (orderUi.pending > 0) return { state: 'saving', message: '' };
  if (orderUi.lines === 'error' || orderUi.lines === 'mismatch') return { state: orderUi.lines, message: orderUi.linesMessage };
  if (orderUi.headerError) return { state: 'error', message: orderUi.headerError };
  if (ENV.order && ENV.order.number()) return { state: 'saved', message: '' };
  return { state: 'new', message: '' };
}

function renderOrderStatus() {
  const el = $('#orderStatus');
  if (!el || !ENV) return;
  const nr = ENV.order && ENV.order.number();
  const cur = currentOrderState();
  const label = {
    new: 'Naujas užsakymas — bus išsaugotas įtraukus pirmą poziciją',
    saving: 'Saugoma…',
    saved: 'Išsaugota',
    error: 'Neišsaugota',
    mismatch: 'Sumos nesutampa',
  }[cur.state];
  el.dataset.state = cur.state;
  el.innerHTML = tplOrderStatus(nr, label, cur.message, orderUi.lines === 'error');
  const retry = el.querySelector('[data-retry]');
  if (retry) retry.onclick = syncCart;
  const can = canSubmit();
  $('#submitOrder').disabled = !can.ok;
  $('#submitHint').textContent = can.ok ? '' : can.why;
}

function canSubmit() {
  if (!ENV.order) return { ok: false, why: 'Užsakymo saugojimas neprieinamas.' };
  if (!state.cart.length) return { ok: false, why: 'Užsakyme dar nėra pozicijų.' };
  const cur = currentOrderState();
  if (cur.state === 'saving') return { ok: false, why: 'Palaukite, kol užsakymas bus išsaugotas.' };
  if (cur.state === 'error') return { ok: false, why: 'Užsakymas neišsaugotas: ' + cur.message };
  if (cur.state === 'mismatch') return { ok: false, why: cur.message };
  if (orderUi.lines !== 'saved') return { ok: false, why: 'Užsakymo pozicijos dar neišsaugotos.' };
  if (state.editIndex != null) return { ok: false, why: `Baigite redaguoti poziciją Nr. ${state.editIndex + 1} arba atšaukite redagavimą.` };
  return { ok: true };
}

function initOrderPanel() {
  const h = ENV.order ? ENV.order.header() : {};
  $('#customerRef').value = h.customerReference || '';
  $('#orderNotes').value = h.notes || '';
  $('#senderName').value = ENV.userName || '';
  if (ENV.companyName && !$('#customerName').value) $('#customerName').value = ENV.companyName;
  $('#customerRef').onchange = saveHeader;
  $('#orderNotes').onchange = saveHeader;
  $('#submitOrder').onclick = submitOrder;
  $('#submitCancel').onclick = () => { $('#submitModal').hidden = true; };
  // Atidarius esamą juodraštį: jo pozicijos jau išsaugotos — patikriname,
  // ar duomenų bazės sumos sutampa su tuo, ką rodo konfigūratorius.
  if (ENV.initialTotals && state.cart.length) {
    const t = cartTotals(), d = ENV.initialTotals;
    const cents = n => Math.round(Number(n) * 100);
    if (cents(t.net) !== cents(d.NetTotal) || cents(t.vat) !== cents(d.VatTotal) || cents(t.gross) !== cents(d.GrossTotal)) {
      orderUi.lines = 'mismatch';
      orderUi.linesMessage = `Išsaugoto užsakymo suma (${money(d.GrossTotal)}) skiriasi nuo dabar apskaičiuotos (${money(t.gross)}). ` +
        'Užsakymo pateikti negalima — praneškite administratoriui.';
    } else {
      orderUi.lines = 'saved';
    }
  }
}

function submitOrder() {
  const can = canSubmit();
  if (!can.ok) { renderOrderStatus(); return; }
  const t = cartTotals();
  $('#submitModalText').textContent =
    `Užsakymas ${ENV.order.number()}: ${state.cart.length} poz., iš viso su PVM ${money(t.gross)}. ` +
    'Pateikto užsakymo keisti nebegalėsite — jei reikės pataisyti, administratorius galės jį grąžinti taisyti.';
  $('#submitModal').hidden = false;
  $('#submitConfirm').disabled = false;
  $('#submitConfirm').onclick = () => {
    $('#submitConfirm').disabled = true;
    ENV.order.submit()
      .catch(e => { $('#submitModal').hidden = true; orderUi.headerError = e.message; renderOrderStatus(); });
  };
}
