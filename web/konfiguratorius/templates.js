/* ==========================================================================
   KONFIGŪRATORIAUS VAIZDAS (HTML šablonai)

   Šiame faile — tik tai, KAIP atrodo konfigūratorius: HTML dalys, spalvų
   pavyzdžiai, pavadinimai. Logika (kas galima, kainos, užsakymo saugojimas)
   yra app.js ir kainų variklyje — čia jos nėra.

   Dizaineriui:
   - Išvaizdą (spalvas, šriftus, tarpus) keiskite styles.css.
   - Čia galima keisti HTML struktūrą, klases, tekstus.
   - NEKEISKITE šių atributų — pagal juos programa atpažįsta paspaudimus:
       data-attr, data-value, data-toggle, data-on, data-off, data-select,
       data-key, data-n, data-line, data-decor-group, data-idx, data-copy,
       data-edit, data-fallback, ir elementų id (pvz. id="staktaRange").
   - Visi tekstai įterpiami per esc() — taip naudotojų įvesti duomenys
     negali tapti HTML kodu. Naujus laukus įterpkite irgi per esc().
   ========================================================================== */

const money = n => new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
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
/* ---- Užsakymo būsena viršutinėje juostoje ---- */
function tplOrderStatus(orderNumber, label, message, canRetry) {
  return `<span class="os-number">${orderNumber ? 'Užsakymas ' + esc(orderNumber) : 'Naujas užsakymas'}</span>
    <span class="os-label">${esc(label)}</span>
    ${message ? `<span class="os-message">${esc(message)}</span>` : ''}
    ${canRetry ? '<button type="button" class="os-retry" data-retry>Bandyti dar kartą</button>' : ''}`;
}

/* ---- „Šis vienetas“: kol kainos dar negalima apskaičiuoti ---- */
function tplBreakdownPending(what) {
  return `<div class="bd-pending">Kaina bus apskaičiuota, kai pasirinksite ${esc(what)}.</div>`;
}

/* ---- Išsaugojimo klaida prie „Įtraukti į užsakymą“ ---- */
function tplSaveError(message, canRetry) {
  return `<strong>Užsakymas neišsaugotas.</strong> ${esc(message)}
    ${canRetry ? '<button type="button" class="btn-secondary" data-retry>Bandyti dar kartą</button>' : ''}`;
}
