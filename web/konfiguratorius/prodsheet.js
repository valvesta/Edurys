/* ==========================================================================
   GAMYBOS LAPAS — generuojamas iš konfigūratoriaus duomenų (cart)
   Skirtas operatorei, kuri duomenis perkelia į gamintojo sistemą.
   Ne sąskaita: kainų čia nėra, tik gamybos parametrai.
   ========================================================================== */

// „DURŲ TIPAS" stulpelis (užsakovo patikslinimas 2026-09-22): linija +
// varčios tipas, sutrumpinta ir sujungta brūkšniu — pvz. „STILE-UŽLAIDINĖ",
// „SKYDINĖ-LYGIABRIAUNĖ". Šeimos/modelio pavadinimas lieka antroje eilutėje
// (žr. `seima` prodRow() grąžinamame objekte) — nepakitęs.
const LINE_SHORT = { STILE: 'STILE', PAINTED: 'DAŽYTA', PANEL: 'SKYDINĖ' };
const DOORTYPE_SHORT = { REBATED: 'UŽLAIDINĖ', FLUSH: 'LYGIABRIAUNĖ', REVERSIBLE: 'REVERSINĖ', SLIDING: 'STUMDOMA' };
const STD_NAME = { PL: 'PL', PL2112: 'PL2112', CZ: 'CZ', CZ2112: 'CZ2112' };
// Danga: dažytoms durims dekoro grupės nėra — kataloge tai UV lakas (2026-09-11)
const DANGA_NAME = { CPL: 'ST CPL', CPL02: 'CPL 0,2', PAINTED: 'DAŽYTA UV', GREKO: 'GREKO', PREMIUM: 'PREMIUM' };
const PUSE_NAME = { LEFT: 'Kairė', RIGHT: 'Dešinė' };
const LOCK_SHORT = { BSR: 'BSR', WC: 'WC', WB: 'WB' };
const HW_NAME = { STANDARD: 'Sidabrinė', BLACK: 'Juoda', WHITE: 'Balta', GOLD: 'Auksinė' };
const PLATE_NAME = { NONE: '—', CYL: 'cilindrui WB', WC: 'WC' };

// (esc / nameOf nebereikalingi — pavadinimai ateina paruošti iš krepšelio įrašo)

/* Viena pozicija -> gamybos lapo eilutės duomenys */
function prodRow(item) {
  const s = item.selections;
  const flags = [];   // dalykai, į kuriuos operatorei reikia atkreipti dėmesį

  // --- stakta ---
  let stakta, kampas = '—', diap = '—', apvadas = '—';
  if (s.DOOR_TYPE === 'SLIDING') {
    if (s.SLIDING_TUNNEL === 'YES') {
      // Tunelis pridėtas 2026-09-22 — rodomas kaip normali reguliuojama
      // stakta, be raudonos „be staktos" žymos.
      stakta = 'Tunelis (reguliuojama)';
      apvadas = s.SLIDING_TUNNEL_TRIM + ' cm';
      kampas = s.SLIDING_TUNNEL_MITER + '°';
      diap = s.SLIDING_TUNNEL_RANGE;
      if (s.SLIDING_TUNNEL_MITER === '90') flags.push('90° kampas');
      if (s.SLIDING_TUNNEL_TRIM === '6') flags.push('apvadas 6 cm');
    } else {
      // Be tunelio — tai numatyta, ne praleista, todėl NEBŪTINA raudonos
      // „be staktos" žymos.
      stakta = 'STUMDOMA — be tunelio';
    }
  } else if (s.STAKTA_MODE === 'ADJUSTABLE') {
    stakta = s.STAKTA_ADJ_TYPE === 'STEEL_MOUNT' ? 'Uždedama plieninei' : 'Reguliuojama';
    apvadas = s.STAKTA_TRIM + ' cm';
    kampas = s.STAKTA_MITER + '°';
    // Diapazono keitimas +20 mm rodomas prie paties diapazono: „135-155+20"
    diap = s.STAKTA_RANGE + (s.STAKTA_RANGE_EXT === 'YES' ? '+20' : '');
    if (s.STAKTA_MITER === '90') flags.push('90° kampas');
    // Staktos apvado plotis 6 cm — retas pasirinkimas, paryškinamas, kad
    // operatorė atkreiptų dėmesį (užsakovo patikslinimas 2026-09-18)
    if (s.STAKTA_TRIM === '6') flags.push('apvadas 6 cm');
  } else if (s.STAKTA_MODE === 'FIXED') {
    stakta = 'Fiksuota';
    flags.push('fiksuota stakta');
  } else {
    stakta = 'BE STAKTOS';
    flags.push('be staktos');
  }

  // --- papildomi blokai (grupuota, kad operatorė rastų akimis) ---
  const extras = [];
  // Standartinis stiklas (pirmas pasirinkimo įrašas, be priemokos) gamybos lape
  // nerodomas — operatorei svarbu tik nukrypimai nuo standarto (2026-09-11).
  const glassName = item.glassIsStandard ? null : item.glassName;
  if (glassName) {
    let g = glassName;
    if (s.GLAZING_SIDE === 'REVERSAS') { g += ' · REVERSAS'; flags.push('REVERSAS'); }
    extras.push(['Stiklas', g]);
  } else if (s.GLAZING_SIDE === 'REVERSAS') {
    // Stiklinimo pusė gamybai svarbi net ir su standartiniu stiklu — anksčiau
    // rodoma tik kartu su nestandartinio stiklo pavadinimu, todėl standartinio
    // stiklo REVERSAS niekur nepasirodydavo (audito radinys 2026-09-23).
    extras.push(['Stiklas', 'standartinis · REVERSAS']);
    flags.push('REVERSAS');
  }
  // Furnitūra: nuo 2026-09-10 spynos spalva atskirta nuo vyrių/plokštelės.
  // Užlaidinei (LOCK_COLOR nėra) rodoma viena bendra spalva, kaip anksčiau.
  // Gamybos lape — trumpi pavadinimai („Sidabrinė", ne „Standartinė (sidabrinė)"),
  // nes eilutė siaura ir operatorė skaito akimis
  const hwName = HW_NAME[s.HARDWARE_COLOR] || item.hwName || s.HARDWARE_COLOR;
  const lockColorName = HW_NAME[s.LOCK_COLOR] || item.lockColorName;
  const mismatch = !!(s.LOCK_COLOR && s.HARDWARE_COLOR && s.LOCK_COLOR !== s.HARDWARE_COLOR);
  // Standartinė (sidabrinė) furnitūra nerodoma — tai numatytoji gamyklos
  // komplektacija, o lape vietos mažai (2026-09-11). Rodome tik nukrypimus.
  const hwStandard = s.HARDWARE_COLOR === 'STANDARD' && (!s.LOCK_COLOR || s.LOCK_COLOR === 'STANDARD');
  const hw = [];
  if (!hwStandard) {
    if (!s.LOCK_COLOR) {
      hw.push(hwName);                                  // užlaidinė — spyna + vyriai + plokštelė
    } else if (mismatch) {
      hw.push(`spyna: ${lockColorName} · vyriai/plokštelė: ${hwName}`);
      flags.push('spynos ir furnitūros spalvos skiriasi');
    } else {
      hw.push(`${hwName} (spyna + vyriai + plokštelė)`);  // sutampa — trumpiau
    }
  }
  // Trečias vyris — nukrypimas nuo standarto, todėl rodomas visada
  if (s.HINGE_COUNT === '3') { hw.push('3 paslėpti vyriai'); flags.push('trečias vyris'); }
  // Vyrių dangteliai rodomi visada — tai atskiras užsakomas priedas
  if (s.HINGE_CAP && s.HINGE_CAP !== 'NONE') hw.push('vyrių dangteliai: ' + (item.hingeCapName || s.HINGE_CAP));
  if (hw.length) extras.push(['Furnitūra', hw.join(', '), mismatch]);

  if (s.VENTILATION && s.VENTILATION !== 'NONE') {
    extras.push(['Įvorės / vent.', item.ventName || s.VENTILATION]);
  }
  if (s.HANDLE_FAMILY && s.HANDLE_FAMILY !== 'NONE') {
    let h = (item.handleName || s.HANDLE_FAMILY);
    if (item.handleFinishName) h += ' — ' + item.handleFinishName;
    if (s.HANDLE_SIDE) h += ' (' + PUSE_NAME[s.HANDLE_SIDE].toLowerCase() + ')';
    const bits = [h];
    bits.push('apyraktis: ' + (PLATE_NAME[s.HANDLE_PLATE] || '—'));
    bits.push('gręžimas: ' + (s.HANDLE_DRILL === 'YES' ? 'taip' : 'NE'));
    if (s.HANDLE_DRILL !== 'YES') flags.push('be gręžimo');
    extras.push(['Rankena', bits.join(' · ')]);
  }
  const apd = [];
  if (s.FIXED_TRIM_SET && s.FIXED_TRIM_SET !== 'NONE') apd.push(`apvadų kompl. ${s.FIXED_TRIM_SET} × ${s.FIXED_TRIM_QTY}`);
  if (s.KAMPUKAS === 'YES') apd.push(`kampukas 10×18 × ${s.KAMPUKAS_QTY}`);
  // Karūna + apvadinės juostelės (reguliuojamai staktai, ne stumdomai sistemai
  // — ta jau turi savo SLIDING_KARUNA eilutę žemiau) — anksčiau kainai
  // įskaičiuota (120 €), bet gamybos lape visai nerodoma (audito radinys
  // 2026-09-23).
  if (s.STAKTA_MODE === 'ADJUSTABLE' && s.KARUNA === 'SET') apd.push('karūna + apvadinės juostelės');
  if (s.FLOOR_TRIM === 'YES') {
    const colorLabel = item.floorTrimColorName ? `, ${item.floorTrimColorName}` : '';
    apd.push(`grindjuostė ${s.FLOOR_TRIM_TYPE === 'painted' ? 'dažyta' : 'laminuota'}${colorLabel} × ${s.FLOOR_TRIM_QTY}`);
  }
  if (apd.length) extras.push(['Apdaila', apd.join(' · ')]);

  const kita = [];
  // Skydinių durų parametrai — gamybai kritiniai, todėl rodomi visada,
  // išskyrus standartinį „korio" užpildą, kuris yra numatytasis (2026-09-11)
  if (s.FILL_TYPE === 'FULL') kita.push('užpildas: pilna plokštė');
  if (s.FILL_TYPE === 'PERFORATED') kita.push('užpildas: perforuota drožlių plokštė');
  if (s.EDGE_SOFT === 'YES') { kita.push('SOFT briauna'); flags.push('SOFT'); }
  if (s.INNER_FRAME_WOOD === 'YES') kita.push('vidinis medinis rėmas');
  if (s.EDGE_BLACK === 'YES') kita.push('krašto apdaila juoda');
  if (s.BOTTOM_GUARD === 'YES') kita.push('apatinės dalies apsauga kraštu');
  if (s.BOTTOM_RAIL === 'YES') kita.push('papildoma apatinė sija');
  if (s.CLOSER_REINFORCE === 'YES') kita.push('sutvirtinimas pritraukikliui');
  if (s.DOOR_CLOSER === 'YES') kita.push('svirtinis pritraukiklis' + (s.DOOR_CLOSER_COLOR ? ' (' + s.DOOR_CLOSER_COLOR.toLowerCase() + ')' : ''));
  if (s.VENT_SLEEVES === 'METAL') kita.push('metalinės įvorės 4 vnt.' + (s.VENT_SLEEVE_FINISH ? ' (' + s.VENT_SLEEVE_FINISH.toLowerCase() + ')' : ''));
  if (s.VENT_SLEEVES === 'PLASTIC') kita.push('plastikinės įvorės 4 vnt.');
  if (s.INTARSIA && s.INTARSIA !== 'NONE') {
    kita.push('intarsija ' + s.INTARSIA.replace('LUX', 'LUX '));
    flags.push('intarsija');
  }
  if (s.STEEL_PANEL && s.STEEL_PANEL !== 'NONE') {
    const SP = { BOTTOM: 'apatinis', MIDDLE: 'vidurinis', BOTTOM_VENT: 'apatinis su ventiliacija' };
    kita.push('plieno panelis: ' + (SP[s.STEEL_PANEL] || s.STEEL_PANEL));
    flags.push('plieno panelis');
  }
  if (s.ROUND_WINDOW && s.ROUND_WINDOW !== 'NONE') {
    const RW_FINISH = { CHROME: 'poliruotas chromas', SATIN: 'šlifuota satina', BLACK: 'juodas matinis' };
    const RW_GLASS = { CLEAR: 'skaidrus stiklas', MATTE: 'decormat pieno matinis' };
    kita.push('iliuminatorius: ' + (RW_FINISH[s.ROUND_WINDOW] || s.ROUND_WINDOW) + ', ' + (RW_GLASS[s.ROUND_WINDOW_GLASS] || RW_GLASS.CLEAR));
    flags.push('iliuminatorius');
  }
  if (s.DROP_SEAL === 'YES') kita.push('nuleidžiama tarpinė');
  if (s.FRAME_CORE === 'GLUED_WOOD') kita.push('vertikalūs rėmai (klijuota mediena)');
  if (s.ELECTROMAGNETIC === 'YES') kita.push('elektromagnetinė sklendė');
  if (s.DOOR_TYPE === 'SLIDING') {
    const railLen = SLIDING_RAIL_LENGTH[s.WIDTH];
    kita.push(`bėgelis ${s.SLIDING_MATERIAL === 'PAINTED' ? 'Dažyta/CPL' : 'Greko/Premium'}${railLen ? ', ilgis ' + railLen + ' cm' : ''}`);
    if (s.SLIDING_LOCK === 'KEY' || s.SLIDING_LOCK === 'WC') {
      const lc = SLIDING_LOCK_COLORS.find(c => c[0] === s.SLIDING_LOCK_COLOR);
      kita.push('kablio užraktas: ' + (s.SLIDING_LOCK === 'KEY' ? 'raktas' : 'WC') + (lc ? ' (' + lc[1].toLowerCase() + ')' : ''));
    }
    if (s.SLIDING_HANDLE && s.SLIDING_HANDLE !== 'NONE') {
      const hc = SLIDING_HANDLE_COLORS.find(c => c[0] === s.SLIDING_HANDLE);
      kita.push('rankenėlė: ' + (hc ? hc[1].toLowerCase() : s.SLIDING_HANDLE));
    }
    if (s.SLIDING_SOFTCLOSE === 'YES') kita.push('lėtintuvas');
    if (s.SLIDING_KARUNA === 'YES') kita.push('karūna + apvadinės juostelės');
    if (s.SLIDING_TUNNEL !== 'YES') flags.push('stumdoma — be tunelio');
  }
  if (kita.length) extras.push(['Kita', kita.join(' · ')]);

  // staktos spalva, jei kitokia nei varčios
  let staktaSpalva = null;
  if ((s.STAKTA_MODE === 'ADJUSTABLE' || s.STAKTA_MODE === 'FIXED') && s.STAKTA_DECOR && s.STAKTA_DECOR !== s.DECOR) {
    staktaSpalva = item.staktaDecorName;
    flags.push('stakta kitos spalvos');
  }

  if (s.STANDARD === 'PL2112' || s.STANDARD === 'CZ2112') flags.push(s.STANDARD);
  if (s.DOOR_TYPE === 'REVERSIBLE') flags.push('reversinė');

  // Jei modelis su intarsija, prie modelio numerio pridedamas kodas, pvz.
  // „1 LUX 204" (užsakovo patikslinimas 2026-09-18) — anksčiau kodas buvo
  // matomas tik „Kita" stulpelyje, o modelio langelis jį rodo iškart.
  const modelis = item.modelNo + (s.INTARSIA && s.INTARSIA !== 'NONE' ? ' ' + s.INTARSIA.replace('LUX', 'LUX ') : '');

  // Spynos stulpelis stumdomai sistemai rodo bėgelio variantą, ne normalią
  // spyną (s.LOCK šiam tipui neprasmingas — žr. engine.js).
  const spynaFullValue = s.DOOR_TYPE === 'SLIDING'
    ? s.SLIDING_VARIANT + (s.SLIDING_LOCK === 'KEY' || s.SLIDING_LOCK === 'WC' ? ' (' + (s.SLIDING_LOCK === 'KEY' ? 'raktas' : 'WC') + ')' : '')
    : item.lockName;

  return {
    kat: `${LINE_SHORT[item.line] || item.line}-${DOORTYPE_SHORT[s.DOOR_TYPE] || s.DOOR_TYPE}`,
    seima: item.familyLabel, modelis, modelNoRaw: item.modelNo, doorType: s.DOOR_TYPE,
    std: STD_NAME[s.STANDARD], danga: DANGA_NAME[item.decorGroup] || item.decorGroup || '', spalva: item.decorName,
    puse: PUSE_NAME[s.DIRECTION], plotis: s.WIDTH,
    stakta, apvadas, kampas, diap, staktaSpalva,
    spyna: s.DOOR_TYPE === 'SLIDING' ? s.SLIDING_VARIANT : (LOCK_SHORT[s.LOCK] || s.LOCK), spynaFull: spynaFullValue,
    kiekis: item.qty, extras, flags,
  };
}

/* Paryškina eilutes, kurios skiriasi nuo aiškios daugumos toje pačioje
   partijoje — pvz. devynios durys modelio 10, o viena modelio 1; arba viena
   reversinė tarp vien užlaidinių (užsakovo patikslinimas 2026-09-18). Veikia
   nuo trijų pozicijų ir tik tada, kai yra aiški dauguma (> pusė eilučių) —
   kitaip skirtumų per daug, kad būtų aišku, kas tikra klaida. Modelio
   numeris lyginamas TIK tos pačios šeimos viduje, nes tarp šeimų jis
   nepalyginamas; varčios tipas ir spyna — visoje partijoje. */
function flagOutliers(rows) {
  if (rows.length < 3) return rows;
  const flagMinority = (items, keyFn, label) => {
    if (items.length < 3) return;
    const counts = new Map();
    items.forEach(r => { const k = keyFn(r); if (k == null) return; counts.set(k, (counts.get(k) || 0) + 1); });
    let topKey = null, topCount = 0;
    counts.forEach((c, k) => { if (c > topCount) { topCount = c; topKey = k; } });
    if (topKey == null || topCount <= items.length / 2) return;
    items.forEach(r => { const k = keyFn(r); if (k != null && k !== topKey) r.flags.push(label); });
  };
  const byFamily = new Map();
  rows.forEach(r => { if (!byFamily.has(r.seima)) byFamily.set(r.seima, []); byFamily.get(r.seima).push(r); });
  byFamily.forEach(group => flagMinority(group, r => r.modelNoRaw, 'modelis skiriasi nuo daugumos'));
  flagMinority(rows, r => r.doorType, 'kitoks varčios tipas nei dauguma');
  flagMinority(rows, r => r.spynaFull || r.spyna, 'spyna skiriasi nuo daugumos');
  return rows;
}

function buildProductionSheet(cart) { return flagOutliers(cart.map(prodRow)); }

/* ==========================================================================
   Gamybos lapo HTML atvaizdavimas (naudoja krepšelio įrašus iš app.js)
   ========================================================================== */
function renderProductionSheet(cart, head) {
  const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const rows = flagOutliers(cart.map(prodRow));

  const body = rows.map((r, i) => {
    const z = (i % 2 === 1) ? ' zebra' : '';
    const flags = r.flags.map(f => `<span class="pflag">${e(f)}</span>`).join('');
    // trečias elementas (alt) = pažymėti geltonai, kaip „stakta kitos spalvos"
    const extras = r.extras.map(([l, v, alt]) =>
      `<div class="pex"><span class="pexl">${e(l)}</span>${alt ? `<span class="palt">${e(v)}</span>` : e(v)}</div>`).join('')
      || '<span class="pmuted">—</span>';
    // Diapazonas ir kitokia staktos spalva anksčiau varžėsi dėl tos pačios
    // ląstelės — spalva išstumdavo diapazoną. Dabar telpa abu, vienas po kitu.
    const c2 = [];
    if (r.diap !== '—') c2.push(`<strong>${e(r.diap)}</strong>`);
    if (r.staktaSpalva) c2.push(`<span class="palt">${e(r.staktaSpalva)}</span>`);
    const col2 = c2.length ? c2.join('<br>') : '<span class="pmuted">—</span>';
    const nf = r.stakta === 'BE STAKTOS' ? ' pnoframe' : '';
    return `
    <tr class="pr1${z}">
      <td class="pc pnr" rowspan="2">${i + 1}</td>
      <td>${e(r.kat)}</td>
      <td class="pc" rowspan="2"><strong>${e(r.modelis)}</strong></td>
      <td class="pc" rowspan="2">${e(r.std)}</td>
      <td>${e(r.danga)}</td>
      <td class="pc">${e(r.puse)}</td>
      <td class="pc${nf}">${e(r.stakta)}</td>
      <td class="pc">${e(r.kampas)}</td>
      <td rowspan="2">${e(r.spynaFull || r.spyna)}</td>
      <td class="pc pnr" rowspan="2">${e(r.kiekis)}</td>
      <td class="pext" rowspan="2">${extras}${flags ? '<div class="pflags">' + flags + '</div>' : ''}</td>
    </tr>
    <tr class="pr2${z}">
      <td class="pfam">${e(r.seima)}</td>
      <td class="pfam">${e(r.spalva)}</td>
      <td class="pc"><strong>${e(r.plotis)}</strong></td>
      <td class="pc">${e(r.apvadas)}</td>
      <td class="pc">${col2}</td>
    </tr>`;
  }).join('');

  const qty = cart.reduce((a, i) => a + (i.qty || 0), 0);

  return `
  <div class="pdh">
    <div><div class="pbrand">${e(head.seller || 'ERKADO')}<small>DURYS TAI MŪSŲ PASAULIS</small></div></div>
    <div class="ptt"><h1>GAMYBOS LAPAS · ERKADO VIDAUS</h1>
      <p>Duomenų suvedimui į gamintojo sistemą · kainų šiame lape nėra</p></div>
    <div class="pmeta">
      <div><b>Užsakymo numeris</b> <strong>${e(head.nr)}</strong></div>
      <div><b>Data</b> ${e(head.date)}</div>
      <div><b>Užsakovas</b> <strong>${e(head.customer || '—')}</strong></div>
      ${head.sender ? `<div><b>Pateikė</b> ${e(head.sender)}</div>` : ''}
    </div>
  </div>
  <table class="ptable">
    <colgroup>
      <col style="width:3%"><col style="width:14%"><col style="width:3.6%"><col style="width:5%">
      <col style="width:12.5%"><col style="width:5.6%"><col style="width:7.4%"><col style="width:5%">
      <col style="width:11.4%"><col style="width:4%"><col style="width:27.5%">
    </colgroup>
    <thead><tr>
      <th>Eil.<br>Nr.</th>
      <th>Durų tipas</th>
      <th>Mod.</th><th>Standar&shy;tas</th>
      <th>Danga<span class="psub">spalvos pavadinimas</span></th>
      <th>Pusė<span class="psub">plotis</span></th>
      <th>Stakta<span class="psub">apvadas</span></th>
      <th>Kam&shy;pas<span class="psub">diapazonas</span></th>
      <th>Spyna</th><th>Kie&shy;kis</th>
      <th>Papildomai — stiklas, furnitūra, įvorės, rankena, apdaila</th>
    </tr></thead>
    <tbody>${body || '<tr><td colspan="11" style="text-align:center;padding:20px;color:#999;">Nėra pozicijų</td></tr>'}</tbody>
  </table>
  <div class="pfoot">
    <div>
      <div class="psign">
        <div><span></span>Užsakymą paruošė</div>
        <div><span></span>Suvedė į sistemą / data</div>
      </div>
      <div class="plegend">Geltona = staktos spalva kita nei varčios arba spynos spalva kita nei furnitūros · Raudona = stakta neužsakyta · Mėlynos žymos = atkreipti dėmesį</div>
    </div>
    <div>Pozicijų: <b>${rows.length}</b> · Varčių iš viso: <b>${qty}</b> vnt.</div>
  </div>`;
}
