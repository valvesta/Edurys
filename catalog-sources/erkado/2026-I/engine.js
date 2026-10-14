/* ==========================================================================
   ERKADO VIDAUS — konfigūravimo ir kainos skaičiavimo variklis
   Šis failas nežino nieko apie konkrečią šeimą - visa elgsena valdoma
   duomenimis iš data.js (FAMILIES). Taip pridėti naują šeimą reiškia
   pridėti įrašą į data.js, ne keisti šitą logiką.
   ========================================================================== */

function familyGlassOptions(family, modelNo) {
  // Stiklo variantai imami iš glass.js (atnaujinta 2026-09-09 pagal užsakovo lentelę).
  // Pirmas variantas – be priemokos ir aktyvuojamas pagal nutylėjimą.
  // glassKey leidžia dažytoms šeimoms naudoti tą patį stiklo rinkinį kaip STILE
  // atitikmuo (pvz. PAINTED_NEMEZJA -> GLASS_SETS.NEMEZJA), nes etiketė skiriasi.
  return glassOptionsFor(family.glassKey || family.label, modelNo);
}

function availableDecorOptions(family, selections, modelNo) {
  let opts = family.decorOptions.map(([code, name, group]) => ({ code, name, group, available: true }));
  // Kai kuriems modeliams galimi tik tam tikri dekorų pogrupiai (pvz. FREZJA 9 — tik PREMIUM/CPL)
  const allowedGroups = family.modelDecorGroups && family.modelDecorGroups[modelNo];
  if (allowedGroups) {
    opts = opts.map(o => ({ ...o, available: o.available && allowedGroups.includes(o.group) }));
  }
  if (selections.DOOR_TYPE === 'REVERSIBLE' && family.reversibleDecorWhitelist) {
    const wl = family.reversibleDecorWhitelist;
    opts = opts.map(o => ({ ...o, available: o.available && wl.includes(o.code) }));
  }
  /* Skydinės durys: „reversinė varčia gaminama tik su STANDARD briauna ir
     PREMIUM bei ST CPL dekorais" (psl. 109) — CPL 0,2 danga reversinei negalima. */
  if (family.isPanel && selections.DOOR_TYPE === 'REVERSIBLE') {
    const excl = family.reversibleExcludedGroups || [];
    opts = opts.map(o => ({ ...o, available: o.available && !excl.includes(o.group) }));
  }
  // Pasirinkus vertikalius rėmus iš klijuotos medienos, galimi tik 5 katalogo nurodyti
  // dekorai — filtruojame taip pat, kaip prie reversinės varčios (patikslinta 2026-09-07).
  // `family.isPanel`, ne `family.line !== 'PANEL'` — Dažytos skydinės (line:'PAINTED',
  // isPanel:true) anksčiau klaidingai pateko čia, nes jų linija ne 'PANEL', ir šis
  // filtras (skirtas tik STILE rėminėms) nuleisdavo jų dekorų kiekį iki 0 (audito
  // radinys 2026-09-23).
  if (selections.FRAME_CORE === 'GLUED_WOOD' && !family.isPanel) {
    opts = opts.map(o => ({ ...o, available: o.available && VERTICAL_FRAME_ALLOWED_DECORS.includes(o.code) }));
  }
  // Stumdomos sistemos bėgelio apdaila filtruoja Dekorą (užsakovo
  // patikslinimas 2026-09-22): „Greko/Premium" → tik GREKO/PREMIUM;
  // „Dažyta/CPL" → visos kitos kolekcijos.
  if (selections.DOOR_TYPE === 'SLIDING' && selections.SLIDING_MATERIAL) {
    const allowedGroups2 = SLIDING_MATERIAL_GROUPS[selections.SLIDING_MATERIAL] || [];
    opts = opts.map(o => ({ ...o, available: o.available && allowedGroups2.includes(o.group) }));
  }
  return opts;
}

function availableDoorTypes(family, selections) {
  let types = family.doorTypes.map(t => ({ code: t, available: true }));
  // Stumdoma — 4-as varčios tipas, rodomas tik šeimoms, kurių kataloge yra
  // SP1N (viengubė sieninė stumdomoji sistema, psl. 158, v44).
  if (family.slidingSingle) types = types.concat([{ code: 'SLIDING', available: true }]);
  if (selections.WIDTH === '80N') {
    types = types.map(t => ({ ...t, available: ['FLUSH', 'REVERSIBLE'].includes(t.code) }));
  }
  /* Su PL2112 / CZ2112 reversinė varčia negalima — bet tik tose linijose, kur
     katalogas tai nurodo (STILE psl. 6 taip; dažytos ir skydinės — ne).
     Abipusis blokavimas su availableStandards; pataisyta 2026-09-11. */
  if (standardSurchargeApplies(selections.STANDARD) && (LINES[family.line] || LINES.STILE).reversibleBlocks2112) {
    types = types.map(t => ({ ...t, available: t.available && t.code !== 'REVERSIBLE' }));
  }
  return types;
}

function availableWidths(family, selections, modelNo) {
  // Pločių sąrašas gali būti siauresnis konkrečiai šeimai (pvz. FRAGI, psl. 58–59
  // — tik 60/70/80N/80/90). Jei šeima savo sąrašo neturi, galioja bendrasis.
  let widths = (family.widths || WIDTHS).map(w => ({ code: w, available: true }));
  /* „N" pločiai (60N/70N/80N/90N) skirti tik lygiabriaunėms ir reversinėms
     varčioms (psl. 109, išnašos 6 ir 7) — VISOSE linijose (STILE, Dažytos,
     Skydinės), ne tik Skydinėse (užsakovo patikslinimas 2026-09-22: „ta pati
     taisyklė"). Skydinių šeimos (ir kelios kitos) papildomai turi
     `widthRules.modelLimited` — 60N/70N/90N ribojami tik konkretiems
     modeliams ir negalimi su SOFT briauna; šeimoms be šio lauko galioja tik
     bendroji lygiabriaunė/reversinė taisyklė. */
  const flushOrRev = selections.DOOR_TYPE === 'FLUSH' || selections.DOOR_TYPE === 'REVERSIBLE';
  const R = family.widthRules;
  widths = widths.map(w => {
    if (!/N$/.test(w.code)) return w;
    let ok = flushOrRev;
    const ml = R && R.modelLimited;
    if (ok && ml && ml.widths.includes(w.code)) {
      ok = ml.models.includes(modelNo) && !(ml.noSoft && selections.EDGE_SOFT === 'YES');
    }
    return { ...w, available: ok };
  });
  if (selections.VENTILATION === 'GRILLE') {
    widths = widths.map(w => ({ ...w, available: GRILLE_ALLOWED_WIDTHS.includes(w.code) }));
  }
  // Stumdoma sistema — fiksuotas pločių sąrašas, ne visas šeimos sąrašas be
  // „N" (užsakovo patikslinimas 2026-09-22, žr. data.js SLIDING_WIDTHS).
  if (selections.DOOR_TYPE === 'SLIDING') {
    widths = widths.map(w => ({ ...w, available: w.available && SLIDING_WIDTHS.includes(w.code) }));
  }
  return widths;
}

function glazingSideApplicable(cfg) {
  return (cfg.glassOpts || []).length > 0;
}

function availableVentilationOptions(selections) {
  const dropSealBlocks = ['RECUP_STD', 'RECUP_MINI', 'VENT_SLOT_STD', 'VENT_SLOT_MINI'];
  return VENTILATION_OPTIONS.map(([code, name, price]) => {
    let available = true;
    if (code === 'GRILLE' && !GRILLE_ALLOWED_WIDTHS.includes(selections.WIDTH)) available = false;
    if (selections.DROP_SEAL === 'YES' && dropSealBlocks.includes(code)) available = false;
    return { code, name, price, available };
  });
}

// Kiekvienas varčios tipas turi savo spynų rinkinį (2026-09-15)
// Stumdomai sistemai normalios spynos/furnitūros spalvos visai neaktualios
// (ji turi savo SLIDING_LOCK/bėgelio furnitūrą) — grąžinam tuščią sąrašą, kad
// `||` atsarginė reikšmė (anksčiau čia klaidingai krisdavo į LOCK_OPTIONS.FLUSH
// / 'OTHER' furnitūros spalvą) nebepalikdavo varstomų durų spynos/furnitūros
// aprašo sąskaitoje (audito radinys 2026-09-23).
function lockOptions(doorType) {
  if (doorType === 'SLIDING') return [];
  return LOCK_OPTIONS[doorType] || LOCK_OPTIONS.FLUSH;
}
function availableLockOptions(doorType) {
  // Spynų pasirinkimas NEBEsiejamas su varčios standartu (pataisyta 2026-08-20) — visos visada galimos.
  return lockOptions(doorType).map(([code, name]) => ({ code, name, available: true }));
}

function hardwareColorOptions(doorType) {
  if (doorType === 'SLIDING') return [];
  return HARDWARE_COLOR_OPTIONS[doorType === 'REBATED' ? 'REBATED' : 'OTHER'];
}

// Spynos spalva — atskiras laukas tik Lygiabriaunei / Reversinei.
// Užlaidinei grąžina null: ten spyna įeina į furnitūros spalvą (2026-09-10).
function lockColorOptions(doorType) {
  return LOCK_COLOR_OPTIONS[doorType === 'REBATED' ? 'REBATED' : 'OTHER'];
}

// (b) variantas: nesuderintas kombinacijas LEIDŽIAME, bet apie jas įspėjame —
// tiek konfigūratoriuje, tiek gamybos lape (kaip „stakta kitos spalvos").
function hardwareColorMismatch(selections) {
  const { LOCK_COLOR: lc, HARDWARE_COLOR: hc } = selections || {};
  return !!(lc && hc && lc !== hc);
}

function hingeCapApplicable(doorType, hardwareColor) {
  return doorType === 'REBATED' && hardwareColor === 'STANDARD';
}

function verticalFrameAvailable(decorCode) {
  return VERTICAL_FRAME_ALLOWED_DECORS.includes(decorCode);
}

function handleFinishOptions(familyKey) {
  const fam = HANDLE_FAMILIES.find(h => h.key === familyKey) || HANDLE_FAMILIES[0];
  return fam.finishes;
}
// PLATE_CHOICE (s.HANDLE_PLATE) yra 'NONE'|'CYL'|'WC' — pasirenka pats vartotojas,
// numatytoji reikšmė priklauso nuo Spynos (žr. handlePlateChoiceOrder). "Raktui"
// tipo apyraktis (plokštelė) nebesiūloma (užsakovo patikslinimas 2026-08-20).
function handlePlateOptions(familyKey, lock) {
  const fam = HANDLE_FAMILIES.find(h => h.key === familyKey);
  if (!fam || fam.plateSystem === 'none') return [];
  return handlePlateChoiceOrder(lock).map(code => ({ code, name: HANDLE_PLATE_LABELS[code] }));
}
function handlePlatePrice(familyKey, finishCode, plateChoice) {
  const fam = HANDLE_FAMILIES.find(h => h.key === familyKey);
  if (!fam || fam.plateSystem === 'none' || !plateChoice || plateChoice === 'NONE') return 0;
  const finish = fam.finishes.find(f => f[0] === finishCode);
  if (!finish || !finish[3]) return 0;
  if (fam.plateSystem === 'dual') return finish[3][plateChoice === 'WC' ? 'wc' : 'keyOrCyl'] || 0;
  return finish[3][plateChoice === 'WC' ? 'wc' : 'cyl'] || 0;
}

// staktaTier() pašalinta 2026-09-11: ji grąžindavo tik GREKO/OTHER ir buvo
// naudojama karūnos kainai, todėl ST CPL varčios gaudavo klaidingą 120,00 €
// vietoj 136,80 €. Visur naudojame staktaAdjustableTier() — ji atpažįsta
// visus keturis katalogo lygius (GREKO / ST CPL ir PREMIUM / CPL 0,2 / Dažyta).

const DOOR_TYPE_NAME_ENGINE = { REBATED: 'Užlaidinė', FLUSH: 'Lygiabriaunė', REVERSIBLE: 'Reversinė' };
const STANDARD_NAME = { PL: 'PL', PL2112: 'PL2112', CZ: 'CZ (Čekiškas)', CZ2112: 'CZ2112 (Čekiškas)' };
function standardSurchargeApplies(standard) { return standard === 'PL2112' || standard === 'CZ2112'; }

/* Šeimos, kuriose PL2112 / CZ2112 standartas NEGALIMAS (užsakovo patikslinimas
   2026-09-08). Likusiose šeimose šis standartas galimas, bet tada negalima
   „Reversinė" varčia (blokuojama abipusiai — žr. availableStandards ir
   availableDoorTypes). */
const NO_2112_FAMILIES = [
  'LAURENCJA', 'MISKANT', 'BUDLEJA', 'POWOJNIK', 'EPIMEDIUM', 'ARALIA', 'NOLINA', 'EWODIA',
  'JUKA', 'FORSYCJA', 'LAWENDA', 'IRYS', 'DAGLEZJA', 'DEBECJA', 'SURMIA', 'BERBERYS', 'FLOKS',
  'KROKUS', 'KAMELIA', 'PETUNIA', 'AZALIA', 'HIACYNT', 'FRAGI',
];

function availableStandards(family, selections) {
  const codes = ['PL', 'PL2112', 'CZ', 'CZ2112'];
  let opts = codes.map(c => ({ code: c, available: true }));
  // 1) Šeimos, kuriose 2112 standarto visai nėra.
  //    Lyginame pagal baseLabel, nes dažytų šeimų etiketė yra „MISKANT Dažyta" —
  //    iki v24 ji į sąrašą nepatekdavo ir 2112 atsirasdavo atsitiktinai
  //    (patvirtinta 2026-09-11: dažyti MISKANT ir LAURENCJA 2112 neturi).
  if (NO_2112_FAMILIES.includes(family.baseLabel || family.label)) {
    opts = opts.map(o => ({ ...o, available: !standardSurchargeApplies(o.code) }));
    return opts;
  }
  // 2) 2112 nesuderinamumas su reversine varčia galioja tik toms linijoms,
  //    kuriose katalogas tai nurodo (STILE taip, dažytos ne — žr. LINES).
  const line = LINES[family.line] || LINES.STILE;
  if (line.reversibleBlocks2112 && selections.DOOR_TYPE === 'REVERSIBLE' && family.doorTypes.includes('REVERSIBLE')) {
    opts = opts.map(o => ({ ...o, available: !standardSurchargeApplies(o.code) }));
  }
  return opts;
}

function staktaAdjustableOptions(doorType, adjType) {
  if (doorType === 'REBATED' && adjType === 'STEEL_MOUNT') {
    return { rows: STAKTA_STEEL_MOUNT.rows, trimOptions: ['8'], defaultTrim: '8', miter90Extra: 0, miter90ExcludedRanges: [], twoTierOnly: true };
  }
  const table = STAKTA_ADJUSTABLE[doorType];
  if (!table) return null;
  return table;
}

function staktaAdjustablePrice(table, rangeKey, decorCode) {
  if (!table) return null;
  const row = table.rows.find(r => r[0] === rangeKey);
  if (!row) return null;
  const tier = staktaAdjustableTier(decorCode);
  const idx = { GREKO: 1, OTHER: 2, CPL02: 3, PAINTED: 4 }[tier];
  // psl.182 "uždedama plieninei" lentelė turi tik 2 stulpelius (GREKO/OTHER); CPL/Dažyta ten mapinama į OTHER
  if (table.twoTierOnly) return row[tier === 'GREKO' ? 1 : 2] ?? null;
  // Reversinei staktai (psl.183) CPL0,2 atskiro stulpelio nėra (tik GREKO/ST CPL ir PREMIUM/Dažyta) —
  // jei tier=CPL02 bet stulpelis tuščias, imame OTHER (ST CPL ir PREMIUM) kaip artimiausią.
  if (row[idx] == null && tier === 'CPL02') return row[2] ?? null;
  return row[idx] ?? null;
}

function staktaFixedPrice(decorCode, trimSet, trimQty, kampukas, kampukasQty, electromagnetic) {
  const tier = staktaAdjustableTier(decorCode);
  let total = STAKTA_FIXED.base[tier] || 0;
  if (trimSet && trimSet !== 'NONE') total += ((STAKTA_FIXED.trimSet[trimSet] || {})[tier] || 0) * Math.max(1, Number(trimQty) || 1);
  if (kampukas === 'YES') total += (STAKTA_FIXED.kampukas[tier] || 0) * Math.max(1, Number(kampukasQty) || 1);
  if (electromagnetic === 'YES') total += STAKTA_FIXED.electromagnetic;
  return total;
}

function staktaColorOptions(cfg) {
  // Staktos spalva pagal nutylėjimą sutampa su varčios dekoru, bet galima rinktis kitą
  // iš tų pačių šio modelio galimų dekorų (užsakovo papildymas).
  return (cfg.decorOpts || []).filter(o => o.available);
}

function staktaModeOptions(doorType) {
  // Fiksuota stakta katalogo psl. 185 numatyta tik Užlaidinei; Lygiabriaunei/Reversinei — tik reguliuojama.
  // Sujungta į vieną mygtukų eilutę (užsakovo patikslinimas 2026-09-22):
  // kiekvienas kodas atitinka STAKTA_MODE + (Užlaidinei) STAKTA_ADJ_TYPE
  // derinį — anksčiau „Uždedama plieninei staktai" buvo atskiras antras
  // žingsnis, rodomas tik pasirinkus „Reguliuojama stakta".
  // Stumdomai sistemai šis laukas visai neaktualus (ji turi savo tunelio
  // staktos pasirinkimą) — grąžiname tik „Neįtraukti", kad joks ADJUSTABLE/
  // FIXED kodas, pasiliekantis iš prieš tai buvusio varčios tipo, netaptų
  // „vis dar galiojančiu" ir nebūtų bandoma pasiekti neegzistuojančios
  // STAKTA_ADJUSTABLE.SLIDING lentelės (žr. staktaAdjustableOptions()).
  if (doorType === 'SLIDING') return [{ code: 'NONE', name: 'Neįtraukti' }];
  const opts = [{ code: 'NONE', name: 'Neįtraukti' }];
  if (doorType === 'REBATED') opts.push({ code: 'FIXED', name: 'Fiksuota stakta' });
  opts.push({ code: 'ADJUSTABLE_STANDARD', name: 'Reguliuojama stakta' });
  if (doorType === 'REBATED') opts.push({ code: 'ADJUSTABLE_STEEL_MOUNT', name: 'Uždedama plieninei staktai (psl. 182)' });
  return opts;
}


/* Sukonfigūruoja pasirinkimus konkrečiam durų vienetui, pritaiko trūkstamus
   numatytus pasirinkimus ir surenka klaidas, kai pasirinkimas tapo negalimas
   dėl kitų laukų pasikeitimo (pvz. dekoras, kuris negalimas reversinei). */
function configureDoor(familyKey, modelNo, selections) {
  const family = FAMILIES[familyKey];
  const errors = [];
  const messages = [];
  const s = { ...selections };

  // Realus vartotojo sąsaja niekada nesukuria neegzistuojančio modelio
  // numerio (mygtukai generuojami iš family.models), bet variklis buvo
  // kviečiamas tiesiogiai (be UI) su modeliu 999 ir likdavo `valid:true"
  // (audito radinys 2026-09-23) — apsauga bet kokiam tiesioginiam iškvietimui.
  if (family && !family.models.includes(modelNo)) {
    errors.push(`Modelis ${modelNo} neegzistuoja šeimoje ${familyKey}.`);
  }

  // Pagal nutylėjimą NIEKAS nepažymėta — visus būtinus laukus pasirenka vartotojas
  // (užsakovo patikslinimas 2026-09-08). Trūkstami laukai surenkami į `missing`.
  // Automatiškai užpildomi laukai kuriant naują poziciją (2026-09-08):
  // Standartas PL, Užlaidinė, stiklinimas pagal standartą, Aversas, BSR, standartinė furnitūra.
  if (!s.STANDARD) s.STANDARD = 'PL';
  if (!s.DOOR_TYPE && family.doorTypes.includes('REBATED')) s.DOOR_TYPE = 'REBATED';
  const doorTypes = availableDoorTypes(family, s);
  if (s.DOOR_TYPE && !doorTypes.find(t => t.code === s.DOOR_TYPE && t.available)) {
    if (s.DOOR_TYPE === 'REVERSIBLE' && standardSurchargeApplies(s.STANDARD)
        && (LINES[family.line] || LINES.STILE).reversibleBlocks2112) {
      messages.push(`Varčios tipas „Reversinė" negalimas su ${STANDARD_NAME[s.STANDARD]} standartu — pasirinkite kitą tipą arba standartą.`);
    }
    s.DOOR_TYPE = null;
  }

  const widths = availableWidths(family, s, modelNo);
  if (s.WIDTH && !widths.find(w => w.code === s.WIDTH && w.available)) {
    errors.push('Pasirinktas plotis nesuderinamas su ventiliacine grotele.');
  }


  // Vertikalūs rėmai — pasirinkimas galimas VISADA (visoms šeimoms ir varčios tipams).
  // Jį įjungus, filtruojami dekorai (žr. availableDecorOptions), o ne atvirkščiai
  // (pataisyta 2026-09-07 — anksčiau pats pasirinkimas dingdavo dėl netinkamo dekoro).
  /* Vertikalūs rėmai iš klijuotos medienos — tik STILE technologijos varčioms
     (STILE ir dažytos linijos, psl. 7/75/85). Skydinėms (ir Dažytoms skydinėms,
     kurių `line` yra 'PAINTED', ne 'PANEL', bet `isPanel:true`) šio priedo
     kataloge nėra (psl. 109), todėl laukas joms visai nerodomas (2026-09-15;
     `isPanel` patikslinta 2026-09-23 — anksčiau `line !== 'PANEL'` leisdavo
     Dažytai skydinei šį priedą, kuris paskui nuleisdavo jos dekorus iki 0). */
  const gluedFrameAllowed = !family.isPanel;
  if (!s.FRAME_CORE) s.FRAME_CORE = 'STANDARD';
  if (!gluedFrameAllowed && s.FRAME_CORE === 'GLUED_WOOD') {
    s.FRAME_CORE = 'STANDARD';
    messages.push('Vertikalūs rėmai iš klijuotos medienos galimi tik STILE technologijos varčioms — skydinėms jų nėra.');
  }

  // SLIDING_MATERIAL turi būti žinomas PRIEŠ dekoro sąrašo skaičiavimą, kad
  // dekoro filtras (žr. availableDecorOptions) veiktų nuo pirmo karto, o ne
  // tik kitą refresh() ciklą (užsakovo patikslinimas 2026-09-22). Dažytos
  // durys bėgelio apdailos pasirinkimo neturi — jai visada „Dažyta/CPL".
  if (s.DOOR_TYPE === 'SLIDING') {
    if (family.line === 'PAINTED') s.SLIDING_MATERIAL = 'PAINTED';
    else if (s.SLIDING_MATERIAL !== 'VENEER' && s.SLIDING_MATERIAL !== 'PAINTED') s.SLIDING_MATERIAL = 'VENEER';
  }

  let cfgPanel = null;
  const decorOpts = availableDecorOptions(family, s, modelNo);
  let chosenDecor = decorOpts.find(o => o.code === s.DECOR);
  if (chosenDecor && !chosenDecor.available) {
    const modelRestricted = family.modelDecorGroups && family.modelDecorGroups[modelNo]
      && !family.modelDecorGroups[modelNo].includes(chosenDecor.group);
    /* Skydinėms reversinėms CPL 0,2 danga negalima (psl. 109) — elgiamės kaip
       su kitais apribojimais: perkeliame į pirmą galimą dekorą ir paaiškiname,
       o ne paliekame klaidą, kurios operatorė nesupras. */
    const panelReversibleCpl02 = family.isPanel && s.DOOR_TYPE === 'REVERSIBLE'
      && (family.reversibleExcludedGroups || []).includes(chosenDecor.group);
    // Stumdomos sistemos bėgelio apdaila filtruoja Dekorą (2026-09-22) —
    // ta pati „automatiškai perkelti ir paaiškinti" logika.
    const slidingMaterialMismatch = s.DOOR_TYPE === 'SLIDING' && s.SLIDING_MATERIAL
      && !(SLIDING_MATERIAL_GROUPS[s.SLIDING_MATERIAL] || []).includes(chosenDecor.group);
    if (s.FRAME_CORE === 'GLUED_WOOD' || modelRestricted || panelReversibleCpl02 || slidingMaterialMismatch) {
      // Automatiškai perkeliame į pirmą galimą dekorą ir pasakome, kodėl
      const firstOk = decorOpts.find(o => o.available);
      if (firstOk) {
        const reason = modelRestricted
          ? `šiam modeliui (${family.label} ${modelNo}) galimi tik ${family.modelDecorGroups[modelNo].join(' / ')} dekorai`
          : panelReversibleCpl02
            ? `reversinė ${family.baseLabel} varčia negaminama ${(family.reversibleExcludedGroups || []).map(g => g === 'CPL02' ? 'CPL 0,2' : g === 'CPL07' ? 'CPL 0,7' : g).join(' ir ')} danga`
            : slidingMaterialMismatch
              ? `jis negalimas su pasirinkta bėgelio apdaila (${s.SLIDING_MATERIAL === 'VENEER' ? 'Greko/Premium' : 'Dažyta/CPL'})`
              : 'jis negalimas su vertikaliais rėmais iš klijuotos medienos';
        messages.push(`Dekoras „${chosenDecor.name}" pakeistas į „${firstOk.name}" — ${reason}.`);
        s.DECOR = firstOk.code;
        chosenDecor = firstOk;
      } else {
        errors.push('Šiam modeliui su pasirinktais parametrais nėra galimų dekorų.');
      }
    } else {
      errors.push('Pasirinktas dekoras nebesuderinamas su reversine varčia.');
    }
  }

  const glassOpts = familyGlassOptions(family, modelNo);
  if (!glassOpts.length) { s.GLASS = null; s.GLAZING_SIDE = null; }
  else {
    if (s.GLASS && !glassOpts.find(o => o.code === s.GLASS)) s.GLASS = null;
    if (!s.GLASS) s.GLASS = glassOpts[0].code;      // pagal standartą / kas įskaičiuota
    if (!s.GLAZING_SIDE) s.GLAZING_SIDE = 'AVERSAS'; // standartinis stiklinimas
  }

  const standards = availableStandards(family, s);
  if (s.STANDARD && !standards.find(o => o.code === s.STANDARD && o.available)) {
    messages.push(`${STANDARD_NAME[s.STANDARD] || s.STANDARD} standartas negalimas šiam modeliui ar varčios tipui — pasirinkite kitą.`);
    s.STANDARD = null;
  }

  const ventOpts = availableVentilationOptions(s);
  if (!s.VENTILATION) s.VENTILATION = 'NONE';
  if (!ventOpts.find(o => o.code === s.VENTILATION && o.available)) {
    s.VENTILATION = 'NONE';
    messages.push('Pasirinkta ventiliacijos opcija nebegalima su nuleidžiama tarpine — grąžinta į „be ventiliacijos".');
  }
  if (!s.DROP_SEAL) s.DROP_SEAL = 'NO';
  // Kai kurioms Skydinių/Dažytų skydinių šeimoms apatinė sija IR nuleidžiama
  // tarpinė netaikomos stiklinamiems modeliams (pvz. Dažytas BALDUR 1,3,5,
  // psl. 89 — ta pati taisyklė, kuri jau taikoma family.opts.bottomRail).
  // README_LT.md dokumentuoja šią taisyklę abiem priedams, bet kode ji buvo
  // realizuota tik BOTTOM_RAIL, ne DROP_SEAL (audito radinys 2026-09-23).
  const dropSealBottomRailOpt = family.opts && family.opts.bottomRail;
  const dropSealAllowed = !dropSealBottomRailOpt || dropSealBottomRailOpt === true
    || (dropSealBottomRailOpt.models || []).includes(modelNo);
  if (!dropSealAllowed && s.DROP_SEAL === 'YES') {
    s.DROP_SEAL = 'NO';
    messages.push('Nuleidžiama tarpinė netaikoma šiam modeliui (stiklinamas, be apatinės sijos) — pasirinkimas atšauktas.');
  }

  if (!s.QTY) s.QTY = 1;

  const lockOpts = availableLockOptions(s.DOOR_TYPE);
  // Numatytoji spyna imama iš paties sąrašo, o ne iš kieto kodo — 2026-09-15
  // pervadinus spynas čia buvo likęs nebeegzistuojantis „BSR", dėl kurio
  // dingdavo spynos spalvos laukas.
  // LOCK_CUSTOM (2026-09-22, pV45 pastabos): be šio požymio, pirmas atidarymas
  // (Užlaidinė pagal nutylėjimą) priskirdavo LOCK=LATCH_BSR, o pasirinkus
  // „Lygiabriaunė" ta reikšmė NEBUVO grąžinama, nes LATCH_BSR yra ir jos
  // sąraše (magnetinė+skląsčio sąjunga) — vartotojas matė skląsčio, ne
  // magnetinę spyną, nors jos NIEKADA sąmoningai nerinko. Ta pati logika,
  // kaip STAKTA_DECOR_CUSTOM: kol spyna „auto" (ne vartotojo paspausta),
  // ji visada seka varčios tipo numatytąją; tapusi negalima — grąžinama į
  // numatytąją ir vėl pažymima „auto".
  if (!s.LOCK_CUSTOM) s.LOCK_CUSTOM = 'NO';
  if (s.LOCK_CUSTOM === 'NO') {
    s.LOCK = (lockOpts.find(o => o.available) || {}).code || null;
  } else if (!s.LOCK || !lockOpts.find(o => o.code === s.LOCK && o.available)) {
    s.LOCK = (lockOpts.find(o => o.available) || {}).code || null;
    s.LOCK_CUSTOM = 'NO';
  }

  const hwColorOpts = hardwareColorOptions(s.DOOR_TYPE);
  if (s.HARDWARE_COLOR && !hwColorOpts.find(o => o[0] === s.HARDWARE_COLOR)) s.HARDWARE_COLOR = null;
  if (!s.HARDWARE_COLOR) s.HARDWARE_COLOR = 'STANDARD';

  // Spynos spalva (2026-09-10): atskiras laukas tik lygiabriaunei/reversinei.
  // Turi numatytąją reikšmę, todėl į „missing" sąrašą nepatenka.
  /* Spynos spalvos priemoka (9,60 €) kataloge skirta tik magnetinei spynai, todėl
     pasirinkus skląsčio tipo spyną lygiabriaunėje varčioje laukas nerodomas ir
     lieka standartinė sidabrinė (2026-09-15). */
  const lockColorOpts = lockIsMagnetic(s.LOCK) ? lockColorOptions(s.DOOR_TYPE) : null;
  if (lockColorOpts) {
    if (s.LOCK_COLOR && !lockColorOpts.find(o => o[0] === s.LOCK_COLOR)) s.LOCK_COLOR = null;
    if (!s.LOCK_COLOR) s.LOCK_COLOR = 'STANDARD';
  } else {
    s.LOCK_COLOR = null; // užlaidinei laukas neegzistuoja
  }
  if (hardwareColorMismatch(s)) {
    const lcName = (lockColorOpts.find(o => o[0] === s.LOCK_COLOR) || [])[1];
    const hcName = (hwColorOpts.find(o => o[0] === s.HARDWARE_COLOR) || [])[1];
    messages.push(`Spynos (${lcName}) ir furnitūros (${hcName}) spalvos nesutampa — užsakyti galima, bet patikrinkite, ar taip ir norėta. Gamybos lape bus pažymėta geltonai.`);
  }

  if (!hingeCapApplicable(s.DOOR_TYPE, s.HARDWARE_COLOR)) {
    s.HINGE_CAP = 'NONE';
  } else if (!s.HINGE_CAP) {
    s.HINGE_CAP = 'NONE';
  }

  // Stakta privaloma (užsakovo patikslinimas 2026-09-22) — NEBĖRA automatinio
  // „Neįtraukti"; vartotojas turi aktyviai pasirinkti (net jei nori atsisakyti
  // staktos), kitaip laukas patenka į `missing` ir blokuoja užsakymą, kaip
  // Plotis/Dekoras. STAKTA_CHOICE yra vienintelis vartotojui rodomas laukas
  // (viena mygtukų eilutė) — iš jo išvedami vidiniai STAKTA_MODE/STAKTA_ADJ_TYPE.
  const staktaModes = staktaModeOptions(s.DOOR_TYPE);
  if (s.STAKTA_CHOICE && !staktaModes.find(o => o.code === s.STAKTA_CHOICE)) s.STAKTA_CHOICE = null;
  if (s.STAKTA_CHOICE === 'FIXED') { s.STAKTA_MODE = 'FIXED'; s.STAKTA_ADJ_TYPE = null; }
  else if (s.STAKTA_CHOICE === 'ADJUSTABLE_STANDARD') { s.STAKTA_MODE = 'ADJUSTABLE'; s.STAKTA_ADJ_TYPE = 'STANDARD'; }
  else if (s.STAKTA_CHOICE === 'ADJUSTABLE_STEEL_MOUNT') { s.STAKTA_MODE = 'ADJUSTABLE'; s.STAKTA_ADJ_TYPE = 'STEEL_MOUNT'; }
  else if (s.STAKTA_CHOICE === 'NONE') { s.STAKTA_MODE = 'NONE'; s.STAKTA_ADJ_TYPE = null; }
  else { s.STAKTA_MODE = null; s.STAKTA_ADJ_TYPE = null; }
  if (s.STAKTA_MODE === 'FIXED') { s.KARUNA = 'NONE'; } else if (!s.KARUNA) { s.KARUNA = 'NONE'; }

  if (!s.STAKTA_DECOR_CUSTOM) s.STAKTA_DECOR_CUSTOM = 'NO';
  if (s.STAKTA_DECOR_CUSTOM === 'NO') {
    s.STAKTA_DECOR = s.DECOR; // pagal nutylėjimą stakta seka varčios dekorą
  } else if (!s.STAKTA_DECOR || !decorOpts.find(o => o.code === s.STAKTA_DECOR && o.available)) {
    s.STAKTA_DECOR = s.DECOR;
    s.STAKTA_DECOR_CUSTOM = 'NO';
  }

  let staktaAdjustable = null;
  if (s.STAKTA_MODE === 'ADJUSTABLE') {
    if (s.DOOR_TYPE !== 'REBATED') s.STAKTA_ADJ_TYPE = 'STANDARD';
    if (!s.STAKTA_ADJ_TYPE) s.STAKTA_ADJ_TYPE = 'STANDARD';
    staktaAdjustable = staktaAdjustableOptions(s.DOOR_TYPE, s.STAKTA_ADJ_TYPE);
    if (!staktaAdjustable) {
      // Šiam varčios tipui (pvz. Stumdoma, arba atmestas/nežinomas tipas)
      // reguliuojamos staktos lentelės nėra — grąžiname į „neįtraukti", kad
      // nebūtų bandoma skaityti iš neegzistuojančios lentelės (audito radinys
      // 2026-09-23: perjungimas į Stumdomą su jau pasirinkta reguliuojama
      // stakta mesdavo „Cannot read properties of null (reading 'trimOptions')").
      s.STAKTA_MODE = 'NONE'; s.STAKTA_CHOICE = 'NONE'; s.STAKTA_ADJ_TYPE = null;
    } else {
      if (!s.STAKTA_TRIM || !staktaAdjustable.trimOptions.includes(s.STAKTA_TRIM)) s.STAKTA_TRIM = staktaAdjustable.defaultTrim;
      if (!s.STAKTA_MITER) s.STAKTA_MITER = '45';
      if (s.STAKTA_MITER === '90' && s.STAKTA_TRIM !== '8') {
        s.STAKTA_MITER = '45';
        messages.push('90° supjovimas galimas tik su 8 cm apvadu — grąžinta į 45°.');
      }
      if (!s.STAKTA_RANGE || !staktaAdjustable.rows.find(r => r[0] === s.STAKTA_RANGE)) s.STAKTA_RANGE = staktaAdjustable.rows[0][0];
    }
  }
  if (s.STAKTA_MODE === 'FIXED') {
    if (!s.KAMPUKAS) s.KAMPUKAS = 'NO';
  } else {
    // Kampukas skirtas TIK fiksuotai staktai — jei stakta pakeičiama (į
    // reguliuojamą arba neįtraukta), KAMPUKAS anksčiau likdavo „YES" (kainai
    // tai nekliudė, nes priceDoor() jau tikrina STAKTA_MODE==='FIXED', bet
    // gamybos lapas KAMPUKAS tikrina tiesiogiai, be šio konteksto, todėl
    // toliau rodydavo neįkainotą priedą — audito radinys 2026-09-23).
    s.KAMPUKAS = 'NO';
  }
  // Apvadų komplektas (FIXED_TRIM_SET) galimas ir reguliuojamai, ir fiksuotai
  // staktai — bet ne kai staktos iš viso nėra. Ta pati priežastis kaip
  // aukščiau: gamybos lapas šį lauką tikrina be STAKTA_MODE konteksto.
  if (s.STAKTA_MODE !== 'ADJUSTABLE' && s.STAKTA_MODE !== 'FIXED') {
    s.FIXED_TRIM_SET = 'NONE';
  }

  /* ----- SKYDINIŲ DURŲ pasirinkimai (psl. 108–121, įvesta 2026-09-11) -----
     Šių laukų kitos linijos neturi, todėl joms jie nustatomi į null ir į
     kainą nepatenka. Visi turi numatytąsias reikšmes, tad į „missing" sąrašą
     nepatenka ir neblokuoja užsakymo. */
  const isPanel = family.isPanel;
  if (isPanel) {
    // SOFT briauna — tik tam tikriems modeliams ir dekorams, ne reversinei,
    // ne pagal PL2112, ir reikalauja pilnos plokštės užpildo (psl. 109, išnaša 4)
    const softOk = (family.softModels || []).includes(modelNo)
      && (family.softDecors || []).includes(s.DECOR)
      && s.DOOR_TYPE !== 'REVERSIBLE'
      && !standardSurchargeApplies(s.STANDARD);
    if (!s.EDGE_SOFT) s.EDGE_SOFT = 'NO';
    if (!softOk && s.EDGE_SOFT === 'YES') {
      s.EDGE_SOFT = 'NO';
      messages.push('SOFT briauna galima tik BALDUR 1 varčiai dekore Balta ST CPL, be PL2112 standarto ir ne reversinei — pasirinkimas atšauktas.');
    }

    // Užpildas. BALDUR 9 užpildo neturi (stiklas per visą plokštumą).
    const fillOk = !(family.noFillModels || []).includes(modelNo);
    if (!fillOk) {
      s.FILL_TYPE = null;
    } else {
      if (!s.FILL_TYPE) s.FILL_TYPE = 'HONEYCOMB';
      if (s.EDGE_SOFT === 'YES' && s.FILL_TYPE !== 'FULL') {
        s.FILL_TYPE = 'FULL';
        messages.push('SOFT briauna gaminama tik su pilnos plokštės užpildu — užpildas pakeistas.');
      }
    }

    if (!s.INNER_FRAME_WOOD) s.INNER_FRAME_WOOD = 'NO';
    if (!s.EDGE_BLACK) s.EDGE_BLACK = 'NO';

    /* Apatinės dalies apsauga kraštu — nėra su ventiliacijos įpjova ir su SOFT
       apdaila (psl. 109, išnaša 9). */
    const guardOk = (!s.VENTILATION || s.VENTILATION === 'NONE') && s.EDGE_SOFT !== 'YES';
    if (!s.BOTTOM_GUARD) s.BOTTOM_GUARD = 'NO';
    if (!guardOk && s.BOTTOM_GUARD === 'YES') {
      s.BOTTOM_GUARD = 'NO';
      messages.push('Apatinės dalies apsauga kraštu negalima su ventiliacijos įpjova arba SOFT apdaila — pasirinkimas atšauktas.');
    }
    /* Priedai, kuriuos turi ne visos skydinių šeimos (psl. 111). Jei šeima jų
       nesiūlo, laukai nustatomi į null ir į kainą nepatenka. */
    const O = family.opts || {};
    // Priedas gali būti tiesiog `true` arba ribotas modeliais: { models: [1] }
    const optOn = v => !!v && (v === true || (v.models || []).includes(modelNo));
    const setOpt = (key, allowed, dflt) => {
      if (!allowed) { s[key] = null; return; }
      if (!s[key]) s[key] = dflt;
    };
    // Visi priedai eina per optOn(), kad veiktų ir modeliais riboti variantai
    // (pvz. dažyto BALDUR apatinė sija netaikoma 1, 3, 5 modeliams — psl. 89)
    setOpt('CLOSER_REINFORCE', optOn(O.closer), 'NO');
    setOpt('DOOR_CLOSER', optOn(O.closer), 'NO');   // jungiklis naudoja YES/NO
    setOpt('BOTTOM_RAIL', optOn(O.bottomRail), 'NO');
    setOpt('VENT_SLEEVES', optOn(O.vents), 'NONE');
    setOpt('ROUND_WINDOW', optOn(O.roundWindow), 'NONE');
    /* Intarsijos (psl. 100–107). Galimos tik tam tikriems modeliams, o serijų
       rinkinys priklauso nuo šeimos: UNO PREMIUM turi keturias spalvas,
       ALTAMURA — visas aštuonias. */
    const intarsiaOn = optOn(O.intarsia);
    const intarsiaOpts = intarsiaOn ? intarsiaOptions((O.intarsia || {}).series || null) : [];
    if (!intarsiaOn) {
      s.INTARSIA = null;
    } else {
      if (!s.INTARSIA) s.INTARSIA = 'NONE';
      if (s.INTARSIA !== 'NONE' && !intarsiaOpts.find(o => o[0] === s.INTARSIA)) {
        s.INTARSIA = 'NONE';
        messages.push('Pasirinkta intarsija šiai varčiai negalima — pasirinkimas atšauktas.');
      }
    }
    /* Iliuminatorius (buvusi „apvali anga") ir LUX intarsija tarpusavyje
       nesuderinami ALTAMURA 1 ir UNO PREMIUM varčioms (užsakovo patikslinimas
       2026-09-18) — jei intarsija jau pasirinkta, iliuminatorius atšaukiamas. */
    if (s.INTARSIA && s.INTARSIA !== 'NONE' && s.ROUND_WINDOW && s.ROUND_WINDOW !== 'NONE') {
      s.ROUND_WINDOW = 'NONE';
      messages.push('Iliuminatorius negalimas kartu su LUX intarsija — pasirinkite tik vieną; iliuminatorius atšauktas.');
    }
    /* Nerūdijančio plieno panelis — tik užlaidinei varčiai su STANDARD briauna,
       ir kiekvienas variantas galimas tik tam tikriems modeliams (psl. 113). */
    const steelOpts = O.steelPanel
      ? STEEL_PANEL_OPTIONS.filter(o => o[3].includes(modelNo))
      : [];
    const steelOk = s.DOOR_TYPE === 'REBATED' && s.EDGE_SOFT !== 'YES' && steelOpts.length > 0;
    if (!steelOk) {
      if (s.STEEL_PANEL && s.STEEL_PANEL !== 'NONE') {
        messages.push('Nerūdijančio plieno panelis montuojamas tik užlaidinėms varčioms su STANDARD briauna — pasirinkimas atšauktas.');
      }
      s.STEEL_PANEL = steelOpts.length ? 'NONE' : null;
    } else {
      if (!s.STEEL_PANEL) s.STEEL_PANEL = 'NONE';
      if (s.STEEL_PANEL !== 'NONE' && !steelOpts.find(o => o[0] === s.STEEL_PANEL)) {
        s.STEEL_PANEL = 'NONE';
        messages.push(`Šis plieno panelio variantas ${family.baseLabel} ${modelNo} modeliui negalimas — pasirinkimas atšauktas.`);
      }
    }
    // Pritraukiklio spalva reikalinga tik jį pasirinkus
    if (s.DOOR_CLOSER === 'YES') {
      if (!s.DOOR_CLOSER_COLOR) s.DOOR_CLOSER_COLOR = 'SILVER';
    } else s.DOOR_CLOSER_COLOR = null;
    // Metalinių įvorių apdaila — tik pasirinkus metalines
    if (s.VENT_SLEEVES === 'METAL') {
      if (!s.VENT_SLEEVE_FINISH) s.VENT_SLEEVE_FINISH = 'NICKEL';
    } else s.VENT_SLEEVE_FINISH = null;
    // Iliuminatoriaus stiklas — reikalingas tik pasirinkus patį iliuminatorių
    if (s.ROUND_WINDOW && s.ROUND_WINDOW !== 'NONE') {
      if (!s.ROUND_WINDOW_GLASS) s.ROUND_WINDOW_GLASS = 'CLEAR';
    } else s.ROUND_WINDOW_GLASS = null;

    cfgPanel = { softOk, fillOk, guardOk, opts: O, optOn, steelOpts: steelOk ? steelOpts : [], intarsiaOpts };
  } else {
    s.EDGE_SOFT = null; s.FILL_TYPE = null; s.INNER_FRAME_WOOD = null;
    s.EDGE_BLACK = null; s.BOTTOM_GUARD = null;
    s.CLOSER_REINFORCE = null; s.DOOR_CLOSER = null; s.DOOR_CLOSER_COLOR = null;
    s.BOTTOM_RAIL = null; s.VENT_SLEEVES = null; s.VENT_SLEEVE_FINISH = null;
    s.ROUND_WINDOW = null; s.ROUND_WINDOW_GLASS = null; s.STEEL_PANEL = null; s.INTARSIA = null;
  }

  /* ----- STUMDOMOSIOS SISTEMOS — SIENINĖ, VIENGUBA (psl. 158, įvesta v44) -----
     Tik SP1Nz/SP1Nb (viengubas). Dvipusė SP2N ir tunelio tipo stakta — kitas
     etapas (SP2N kataloge visada reikalauja tunelio, kurio kaina čia dar
     neįvesta — geriau nesiūlyti SP2N, nei siūlyti be privalomos dalies).
     Šis varčios tipas naudoja VISIŠKAI KITĄ furnitūros/staktos modelį, todėl
     normalūs laukai (spyna, rankena, stakta, ventiliacija) nustatomi į
     neutralias/nemokamas reikšmes, kad liktų nuoseklūs, bet nekainuotų. */
  const isSliding = s.DOOR_TYPE === 'SLIDING';
  if (isSliding) {
    // SLIDING_MATERIAL jau nustatytas aukščiau (prieš dekoro filtravimą).
    if (s.SLIDING_VARIANT !== 'SP1Nz' && s.SLIDING_VARIANT !== 'SP1Nb') s.SLIDING_VARIANT = 'SP1Nz';
    // Kablio tipo spyna — tik SP1Nz variantui (psl. 158: „opcija tik viengubai
    // sistemai" su rezervuota vieta spynai; SP1Nb tokios vietos neturi).
    if (s.SLIDING_VARIANT === 'SP1Nz') {
      if (!['NONE', 'KEY', 'WC'].includes(s.SLIDING_LOCK)) s.SLIDING_LOCK = 'NONE';
    } else {
      s.SLIDING_LOCK = null;
    }
    // Spynos spalva (Raktas/WC) — 4 spalvos, nemokamai (2026-09-22).
    if (s.SLIDING_LOCK === 'KEY' || s.SLIDING_LOCK === 'WC') {
      if (!SLIDING_LOCK_COLORS.find(c => c[0] === s.SLIDING_LOCK_COLOR)) s.SLIDING_LOCK_COLOR = SLIDING_LOCK_COLORS[0][0];
    } else {
      s.SLIDING_LOCK_COLOR = null;
    }
    if (!s.SLIDING_HANDLE) s.SLIDING_HANDLE = 'NONE';
    if (s.SLIDING_SOFTCLOSE !== 'YES') s.SLIDING_SOFTCLOSE = 'NO';

    /* Tunelio tipo stakta (2026-09-22) — kaina pakartotinai naudoja esamą
       reguliuojamos staktos lentelę (psl. 187 pastaba: tunelio kainos
       užlaidinei tokios pačios). Spalva VISADA sutampa su varčios dekoru —
       atskiro pasirinkimo (kaip STAKTA_DECOR_CUSTOM normaliose duryse) nėra,
       nes taip nurodė užsakovas. */
    if (s.SLIDING_TUNNEL !== 'YES') s.SLIDING_TUNNEL = 'NO';
    if (s.SLIDING_TUNNEL === 'YES') {
      const tunnelTable = STAKTA_ADJUSTABLE.REBATED;
      if (!s.SLIDING_TUNNEL_TRIM || !tunnelTable.trimOptions.includes(s.SLIDING_TUNNEL_TRIM)) s.SLIDING_TUNNEL_TRIM = tunnelTable.defaultTrim;
      if (!s.SLIDING_TUNNEL_MITER) s.SLIDING_TUNNEL_MITER = '45';
      if (s.SLIDING_TUNNEL_MITER === '90' && s.SLIDING_TUNNEL_TRIM !== '8') {
        s.SLIDING_TUNNEL_MITER = '45';
        messages.push('Tunelio 90° supjovimas galimas tik su 8 cm apvadu — grąžinta į 45°.');
      }
      if (!s.SLIDING_TUNNEL_RANGE || !tunnelTable.rows.find(r => r[0] === s.SLIDING_TUNNEL_RANGE)) s.SLIDING_TUNNEL_RANGE = tunnelTable.rows[0][0];
      // Karūna — tik pasirinkus tunelį, kaip ir normaliose duryse (2026-09-22:
      // anksčiau buvo nepriklausoma, užsakovas paprašė perkelti prie tunelio).
      if (s.SLIDING_KARUNA !== 'YES') s.SLIDING_KARUNA = 'NO';
    } else {
      s.SLIDING_TUNNEL_TRIM = null; s.SLIDING_TUNNEL_MITER = null; s.SLIDING_TUNNEL_RANGE = null;
      s.SLIDING_KARUNA = 'NO';
    }

    // Normalūs furnitūros/staktos/ventiliacijos laukai šiam tipui nerodomi —
    // grąžinami į neutralias, nemokamas reikšmes (ne null, kad gamybos lapo
    // laukai, kurie jų tikisi, netaptų "null" užrašu).
    s.LOCK_COLOR = null; s.HARDWARE_COLOR = 'STANDARD'; s.HINGE_CAP = 'NONE'; s.HINGE_COUNT = '2';
    s.STAKTA_MODE = 'NONE'; s.STAKTA_CHOICE = 'NONE'; s.STAKTA_ADJ_TYPE = null; s.KARUNA = 'NONE';
    // Tunelio spalva visada = varčios dekoras (komentaras aukščiau) — bet jei
    // prieš pereinant į Stumdomą buvo pasirinkta individuali (STAKTA_DECOR_CUSTOM
    // = YES) staktos spalva normaliai durų tipui, ji NEIŠSIVALYDAVO, ir tunelio
    // kaina (žr. priceDoor()) toliau naudodavo tą pasenusią spalvą vietoj
    // einamo DECOR (audito radinys 2026-09-23). Priverstinai sulyginame.
    s.STAKTA_DECOR_CUSTOM = 'NO'; s.STAKTA_DECOR = s.DECOR;
    s.HANDLE_FAMILY = 'NONE'; s.HANDLE_FINISH = null; s.HANDLE_SIDE = null;
    s.HANDLE_PLATE = null; s.HANDLE_PLATE_CUSTOM = null; s.HANDLE_DRILL = null;
    s.DROP_SEAL = 'NO'; s.VENTILATION = 'NONE'; s.FRAME_CORE = 'STANDARD';
  } else {
    s.SLIDING_VARIANT = null; s.SLIDING_MATERIAL = null; s.SLIDING_LOCK = null;
    s.SLIDING_LOCK_COLOR = null; s.SLIDING_HANDLE = null; s.SLIDING_SOFTCLOSE = null;
    s.SLIDING_KARUNA = null; s.SLIDING_TUNNEL = null; s.SLIDING_TUNNEL_TRIM = null;
    s.SLIDING_TUNNEL_MITER = null; s.SLIDING_TUNNEL_RANGE = null;
  }

  /* Trečias vyris (2026-09-11, patikslinta 2026-09-22). Galimas tik
     lygiabriaunei ir reversinei varčiai — užlaidinė standartiškai turi tris.
     Anksčiau reikalavo, kad būtų jau pasirinkta stakta (vyriai tiekiami ir
     įkainojami kartu su ja, psl. 59/75), bet užsakovas nurodė: pasirinkimų
     logika turi eiti iš viršaus žemyn, ne šokinėti tarp modulių — pasirinkus
     varčios tipą, vyrio pasirinkimas turi atsirasti IŠ KARTO, nepriklausomai
     nuo to, ar stakta jau užsakyta. Kaina (51,60 €) skaičiuojama tas pats,
     nesvarbu kada stakta pasirenkama — prieš tai ar po. */
  const thirdHingeAllowed = s.DOOR_TYPE === 'FLUSH' || s.DOOR_TYPE === 'REVERSIBLE';
  if (thirdHingeAllowed) {
    if (s.HINGE_COUNT !== '3') s.HINGE_COUNT = '2';
  } else {
    if (s.HINGE_COUNT === '3') {
      messages.push('Užlaidinė varčia standartiškai turi tris vyrius — atskiro pasirinkimo nėra.');
    }
    s.HINGE_COUNT = null;
  }

  /* Diapazono keitimas +20 mm — tik reguliuojamai lygiabriaunei / reversinei
     staktai ir tik tam tikruose diapazonuose (ribos skiriasi, žr. data.js). */
  const rangeExtAllowed = s.STAKTA_MODE === 'ADJUSTABLE' && s.STAKTA_ADJ_TYPE !== 'STEEL_MOUNT'
    && !!(RANGE_EXT_ALLOWED[s.DOOR_TYPE] || []).includes(s.STAKTA_RANGE);
  if (!s.STAKTA_RANGE_EXT) s.STAKTA_RANGE_EXT = 'NO';
  if (!rangeExtAllowed && s.STAKTA_RANGE_EXT === 'YES') {
    s.STAKTA_RANGE_EXT = 'NO';
    messages.push(`Diapazono keitimas +20 mm šiam diapazonui (${s.STAKTA_RANGE || '—'}) negalimas — pasirinkimas atšauktas.`);
  }
  // Elektromagnetinė sklendė galima ir Fiksuotai, ir Reguliuojamai staktai (patikslinta 2026-09-01)
  if (s.STAKTA_MODE === 'ADJUSTABLE' || s.STAKTA_MODE === 'FIXED') {
    if (!s.ELECTROMAGNETIC) s.ELECTROMAGNETIC = 'NO';
  } else {
    s.ELECTROMAGNETIC = 'NO';
  }
  if (!s.FIXED_TRIM_SET) s.FIXED_TRIM_SET = 'NONE';
  if (!s.FIXED_TRIM_QTY) s.FIXED_TRIM_QTY = 1;
  if (!s.KAMPUKAS_QTY) s.KAMPUKAS_QTY = 1;

  if (!s.FLOOR_TRIM) s.FLOOR_TRIM = 'NO';
  if (!s.FLOOR_TRIM_TYPE) s.FLOOR_TRIM_TYPE = 'laminated';
  if (!s.FLOOR_TRIM_QTY) s.FLOOR_TRIM_QTY = 1;
  if (!s.FLOOR_TRIM_COLOR_CUSTOM) s.FLOOR_TRIM_COLOR_CUSTOM = 'NO';
  if (s.FLOOR_TRIM_TYPE === 'laminated') {
    const opts = decorOpts.filter(o => o.available);
    if (s.FLOOR_TRIM_COLOR_CUSTOM === 'NO') {
      s.FLOOR_TRIM_COLOR = s.STAKTA_DECOR || s.DECOR;
    } else if (!s.FLOOR_TRIM_COLOR || !opts.find(o => o.code === s.FLOOR_TRIM_COLOR)) {
      s.FLOOR_TRIM_COLOR = s.STAKTA_DECOR || s.DECOR;
      s.FLOOR_TRIM_COLOR_CUSTOM = 'NO';
    }
  } else {
    if (!s.FLOOR_TRIM_COLOR || !FLOOR_TRIM_PAINTED_COLORS.find(c => c[0] === s.FLOOR_TRIM_COLOR)) {
      s.FLOOR_TRIM_COLOR = FLOOR_TRIM_PAINTED_COLORS[0][0];
    }
  }

  if (!s.HANDLE_FAMILY) s.HANDLE_FAMILY = 'NONE';
  const handleFam = HANDLE_FAMILIES.find(h => h.key === s.HANDLE_FAMILY) || HANDLE_FAMILIES[0];
  if (!s.HANDLE_FINISH || !handleFam.finishes.find(f => f[0] === s.HANDLE_FINISH)) {
    s.HANDLE_FINISH = handleFam.finishes[0][0];
  }
  if (handleFam.hasLR) {
    if (!s.HANDLE_SIDE_CUSTOM) s.HANDLE_SIDE_CUSTOM = 'NO';
    if (s.HANDLE_SIDE_CUSTOM === 'NO') s.HANDLE_SIDE = s.DIRECTION;
    else if (!s.HANDLE_SIDE) s.HANDLE_SIDE = s.DIRECTION;
  } else {
    s.HANDLE_SIDE = null;
  }
  if (handleFam.key !== 'NONE' && handleFam.plateSystem !== 'none') {
    const order = handlePlateChoiceOrder(s.LOCK);
    if (!s.HANDLE_PLATE_CUSTOM) s.HANDLE_PLATE_CUSTOM = 'NO';
    if (s.HANDLE_PLATE_CUSTOM === 'NO') s.HANDLE_PLATE = order[0];
    else if (!s.HANDLE_PLATE || !order.includes(s.HANDLE_PLATE)) s.HANDLE_PLATE = order[0];
  } else {
    s.HANDLE_PLATE = null;
  }
  if (handleFam.key !== 'NONE') {
    if (!s.HANDLE_DRILL) s.HANDLE_DRILL = 'YES';
  } else {
    s.HANDLE_DRILL = null;
  }

  // Būtini laukai — kol jie nepasirinkti, "Įtraukti į užsakymą" neaktyvus
  const missing = [];
  if (!s.STANDARD) missing.push('Standartas');
  if (!s.DOOR_TYPE) missing.push('Varčios tipas');
  if (!s.WIDTH) missing.push('Plotis');
  if (!s.DIRECTION) missing.push('Atidarymo kryptis');
  if (!s.DECOR) missing.push('Dekoras');
  if (glassOpts.length && !s.GLASS) missing.push('Stiklinimas');
  if (glassOpts.length && s.GLASS && !s.GLAZING_SIDE) missing.push('Stiklinimo pusė');
  if (!s.LOCK) missing.push('Spyna');
  if (!s.HARDWARE_COLOR) missing.push('Furnitūros spalva');
  if (!s.STAKTA_CHOICE) missing.push('Stakta');

  return { family, familyKey, modelNo, selections: s, doorTypes, widths, decorOpts, glassOpts, standards, ventOpts,
    lockOpts, hwColorOpts, lockColorOpts, staktaModes, staktaAdjustable, thirdHingeAllowed, rangeExtAllowed, gluedFrameAllowed, panel: cfgPanel, errors, messages, missing };
}

function priceDoor(cfg) {
  const { family, modelNo, selections: s } = cfg;
  // Priedų įkainiai priklauso nuo produktų linijos: dažytoms durims reversinė
  // varčia ir plotis „100" kainuoja kitaip (psl. 75 / 85), likę — identiški.
  // extrasKey leidžia šeimai turėti savo priedų rinkinį — dažytoms skydinėms jis
  // mišrus (reversinė kaip skydinių, plotis „100" kaip dažytų; psl. 88–99)
  const ex = lineExtras(family.extrasKey || family.line);
  const adjustments = [];
  // Kiekviena eilutė turi grupę (door / frame / handle / trim), kad "Šis vienetas"
  // panelį būtų galima rodyti sugrupuotą su tarpinėmis sumomis (2026-09-07 pastabos).
  const add = (description, amountNet, group) => adjustments.push({ description, amountNet, group: group || 'door' });
  const spec = (description, group) => adjustments.push({ description, amountNet: 0, group: group || 'door', spec: true });
  const surcharge = standardSurchargeApplies(s.STANDARD);

  const baseNet = family.basePrice(modelNo, s.DECOR);

  /* PL2112 priemoka varčiai: paprastai +15 % nuo bazinės kainos, bet DAŽYTOS
     SKYDINĖS (psl. 88–99) turi FIKSUOTĄ 51,60 € įkainį — ta pati BALDUR šeima
     dekoruota (psl. 109) skaičiuojama procentais, o dažyta — fiksuotai. */
  if (surcharge) {
    if (family.pl2112Fixed) {
      add(`Standartas ${STANDARD_NAME[s.STANDARD]}`, family.pl2112Fixed, 'door');
    } else {
      add(`Standartas ${STANDARD_NAME[s.STANDARD]} (+15%)`, baseNet * ex.pl2112Pct, 'door');
    }
  }
  /* Sieninė stumdomoji sistema, viengubė (psl. 158, v44) — žr. data.js
     SLIDING_EXTRAS komentarą dėl to, kas šioje versijoje sąmoningai neįvesta
     (SP2N, tunelio tipo stakta). */
  if (s.DOOR_TYPE === 'SLIDING') {
    const SX = SLIDING_EXTRAS;
    const doorPrice = s.SLIDING_MATERIAL === 'PAINTED' ? SX.doorPainted : SX.doorVeneer;
    const materialLabel = s.SLIDING_MATERIAL === 'PAINTED' ? 'Dažyta/CPL' : 'Greko/Premium';
    add(`Sieninė stumdomoji sistema ${s.SLIDING_VARIANT} (${materialLabel})`, doorPrice, 'door');
    if (surcharge) add('Stumdomos sistemos standarto priemoka (+15%)', doorPrice * ex.pl2112Pct, 'door');
    if (s.SLIDING_LOCK === 'KEY' || s.SLIDING_LOCK === 'WC') {
      const lc = SLIDING_LOCK_COLORS.find(c => c[0] === s.SLIDING_LOCK_COLOR);
      const lockLabel = s.SLIDING_LOCK === 'KEY' ? 'Kablio užraktas su raktu' : 'Kablio užraktas, WC';
      add(`${lockLabel}${lc ? ' (' + lc[1].toLowerCase() + ')' : ''}`, s.SLIDING_LOCK === 'KEY' ? SX.lockKey : SX.lockWC, 'door');
    }
    if (s.SLIDING_HANDLE !== 'NONE') {
      const hc = SLIDING_HANDLE_COLORS.find(c => c[0] === s.SLIDING_HANDLE);
      add(`Rankenėlė${hc ? ' (' + hc[1].toLowerCase() + ')' : ''}, komplektas`, SX.handleSet, 'door');
    }
    if (s.SLIDING_SOFTCLOSE === 'YES') {
      const wide = ['90', '100'].includes(s.WIDTH);
      add(`Lėtintuvas${wide ? ' (plotis „' + s.WIDTH + '")' : ''}`, wide ? SX.softCloseWide : SX.softCloseStd, 'door');
    }
    /* Tunelio tipo stakta (2026-09-22) — pakartotinai naudoja esamą
       reguliuojamos staktos lentelę (STAKTA_ADJUSTABLE.REBATED), spalva
       visada = varčios dekoras (s.STAKTA_DECOR jai visada lygu s.DECOR,
       nes stumdomai sistemai atskiro STAKTA_DECOR_CUSTOM nesiūloma). */
    if (s.SLIDING_TUNNEL === 'YES') {
      const tunnelPrice = staktaAdjustablePrice(STAKTA_ADJUSTABLE.REBATED, s.SLIDING_TUNNEL_RANGE, s.STAKTA_DECOR);
      if (tunnelPrice != null) {
        add(`Tunelio tipo stakta (${s.SLIDING_TUNNEL_RANGE} mm, ${s.SLIDING_TUNNEL_TRIM}cm apvadas)`, tunnelPrice, 'frame');
        if (surcharge) add('Tunelio standarto priemoka (+15%)', tunnelPrice * ex.pl2112Pct, 'frame');
      }
      if (s.SLIDING_TUNNEL_MITER === '90') add('Tunelio 90° supjovimas', STAKTA_ADJUSTABLE.REBATED.miter90Extra, 'frame');
      if (s.SLIDING_KARUNA === 'YES') {
        const karunaBase = KARUNA_SET_PRICE[staktaAdjustableTier(s.STAKTA_DECOR)];
        add('Karūna + apvadinės juostelės (1 pusė)', karunaBase, 'frame');
        if (surcharge) add('Karūna — standarto priemoka (+15%)', karunaBase * ex.pl2112Pct, 'frame');
      }
    }
  }
  // Skydinių durų priedai (psl. 109). Visi — prie varčios, ne prie staktos.
  if (s.FILL_TYPE === 'FULL') add('Pilnos plokštės užpildas', PANEL_EXTRAS.fullBoard, 'door');
  if (s.FILL_TYPE === 'PERFORATED') add('Perforuotos medžio drožlių plokštės užpildas', PANEL_EXTRAS.perforated, 'door');
  if (s.INNER_FRAME_WOOD === 'YES') add('Vidinis medinis rėmas', PANEL_EXTRAS.innerWoodFrame, 'door');
  if (s.EDGE_BLACK === 'YES') add('Varčios krašto apdaila juoda', PANEL_EXTRAS.blackEdge, 'door');
  if (s.BOTTOM_GUARD === 'YES') add('Apatinės dalies apsauga kraštu', PANEL_EXTRAS.bottomGuard, 'door');
  if (s.CLOSER_REINFORCE === 'YES') add('Sutvirtinimas durų pritraukikliui', PANEL_EXTRAS.closerReinforce, 'door');
  if (s.DOOR_CLOSER === 'YES') {
    const cc = DOOR_CLOSER_COLORS.find(c => c[0] === s.DOOR_CLOSER_COLOR);
    add(`Svirtinis durų pritraukiklis${cc ? ' (' + cc[1].toLowerCase() + ')' : ''}`, PANEL_EXTRAS.doorCloser, 'door');
  }
  if (s.BOTTOM_RAIL === 'YES') add('Papildoma apatinė sija', PANEL_EXTRAS.bottomRail, 'door');
  if (s.VENT_SLEEVES === 'METAL') {
    const vf = VENT_SLEEVE_FINISHES.find(c => c[0] === s.VENT_SLEEVE_FINISH);
    add(`Metaliniai įvorės, 4 vnt.${vf ? ' (' + vf[1].toLowerCase() + ')' : ''}`, PANEL_EXTRAS.ventsMetal, 'door');
  }
  if (s.VENT_SLEEVES === 'PLASTIC') add('Plastikiniai įvorės, 4 vnt. (medienos imitacija)', PANEL_EXTRAS.ventsPlastic, 'door');
  if (s.ROUND_WINDOW && s.ROUND_WINDOW !== 'NONE') {
    const RW_FINISH_NAME = { CHROME: 'poliruotas chromas', SATIN: 'šlifuota satina', BLACK: 'juodas matinis' };
    const RW_GLASS_NAME = { CLEAR: 'skaidrus stiklas', MATTE: 'decormat pieno matinis' };
    const rwPrice = s.ROUND_WINDOW === 'BLACK' ? PANEL_EXTRAS.roundWindowBlack : PANEL_EXTRAS.roundWindowSteel;
    add(`Iliuminatorius, ${RW_FINISH_NAME[s.ROUND_WINDOW]}, ${RW_GLASS_NAME[s.ROUND_WINDOW_GLASS] || RW_GLASS_NAME.CLEAR}`, rwPrice, 'door');
  }
  if (s.WIDTH === '110') add('Varčia „110\"', PANEL_EXTRAS.width110, 'door');
  if (s.STEEL_PANEL && s.STEEL_PANEL !== 'NONE') {
    const sp = STEEL_PANEL_OPTIONS.find(o => o[0] === s.STEEL_PANEL);
    if (sp) add(`Nerūdijančio plieno panelis — ${sp[1].toLowerCase()}`, sp[2], 'door');
  }
  if (s.INTARSIA && s.INTARSIA !== 'NONE') {
    add(`Intarsija ${s.INTARSIA.replace('LUX', 'LUX ')} (iš abiejų pusių)`, PANEL_EXTRAS.intarsia, 'door');
  }
  if (s.DOOR_TYPE === 'REVERSIBLE') add('Reversinė varčia', ex.reversible, 'door');
  // Stumdomai sistemai varčios tipo pavadinimas nerašomas čia — jis jau yra
  // atskiroje „Sieninė stumdomoji sistema ..." eilutėje (žr. aukščiau); be šios
  // išimties DOOR_TYPE_NAME_ENGINE['SLIDING'] (neegzistuojantis raktas) sukurdavo
  // specifikacijos įrašą be pavadinimo (audito radinys 2026-09-23).
  if (s.DOOR_TYPE && s.DOOR_TYPE !== 'REVERSIBLE' && s.DOOR_TYPE !== 'SLIDING') spec(DOOR_TYPE_NAME_ENGINE[s.DOOR_TYPE], 'door');
  if (s.WIDTH === '100') add('Varčia „100"', ex.width100, 'door');
  else if (s.WIDTH) spec(String(s.WIDTH), 'door');
  if (s.DIRECTION) spec(s.DIRECTION === 'RIGHT' ? 'Dešinė' : 'Kairė', 'door');
  const decorSpec = (cfg.decorOpts || []).find(o => o.code === s.DECOR);
  if (decorSpec) spec(decorSpec.name, 'door');
  if (s.FRAME_CORE === 'GLUED_WOOD') add('Vertikalūs rėmai iš klijuotos medienos', VERTICAL_FRAME_PRICE, 'door');

  const glassOpt = (cfg.glassOpts || []).find(o => o.code === s.GLASS);
  if (glassOpt) {
    if (glassOpt.price) add(glassOpt.name, glassOpt.price, 'door');
    else spec(glassOpt.name, 'door');
  }
  if (s.GLAZING_SIDE) spec(s.GLAZING_SIDE === 'REVERSAS' ? 'Reversas' : 'Aversas', 'door');

  const lockSpec = (cfg.lockOpts || []).find(o => o.code === s.LOCK);
  if (lockSpec) spec(lockSpec.name, 'door');
  // Spynos spalva — atskira eilutė (tik lygiabriaunei/reversinei)
  const lockColor = (cfg.lockColorOpts || []).find(o => o[0] === s.LOCK_COLOR);
  if (lockColor) {
    if (lockColor[2]) add(`Spynos spalva: ${lockColor[1]}`, lockColor[2], 'door');
    else spec(`Spynos spalva: ${lockColor[1]}`, 'door');
  }
  const hwColor = (cfg.hwColorOpts || []).find(o => o[0] === s.HARDWARE_COLOR);
  if (hwColor) {
    // Užlaidinei ši eilutė apima ir spyną, lygiabriaunei/reversinei — tik vyrius ir plokštelę
    const hwLabel = s.DOOR_TYPE === 'REBATED' ? 'Furnitūros spalva' : 'Furnitūros spalva (vyriai + plokštelė)';
    // Lygiabriaunei/reversinei furnitūros spalva keliauja prie staktos grupės,
    // kaip ir paslėpti vyriai (užsakovo patikslinimas 2026-09-22) — Užlaidinei
    // lieka prie varčios, nes ten ji apima ir spyną.
    const hwGroup = s.DOOR_TYPE === 'REBATED' ? 'door' : 'frame';
    if (hwColor[2]) add(`${hwLabel}: ${hwColor[1]}`, hwColor[2], hwGroup);
    else spec(`${hwLabel}: ${hwColor[1]}`, hwGroup);
  }
  if (s.HINGE_CAP && s.HINGE_CAP !== 'NONE') {
    const hc = HINGE_CAP_OPTIONS.find(([code]) => code === s.HINGE_CAP);
    if (hc) {
      const a = { description: `Vyrių dangteliai — ${hc[1]} (${HINGE_CAP_HINGES_COUNT} vnt.)`,
        amountNet: HINGE_CAP_UNIT_PRICE * HINGE_CAP_HINGES_COUNT, group: 'door',
        pdfSplit: true, pdfQty: HINGE_CAP_HINGES_COUNT, pdfUnit: 'vnt.', pdfUnitPrice: HINGE_CAP_UNIT_PRICE };
      adjustments.push(a);
    }
  }

  if (s.VENTILATION && s.VENTILATION !== 'NONE') {
    const vopt = VENTILATION_OPTIONS.find(([code]) => code === s.VENTILATION);
    if (vopt) { if (vopt[2]) add(vopt[1], vopt[2], 'door'); else spec(vopt[1], 'door'); }
  }
  if (s.DROP_SEAL === 'YES') add('Nuleidžiama tarpinė', ex.dropSeal, 'door');

  if (s.STAKTA_MODE === 'ADJUSTABLE') {
    const price = staktaAdjustablePrice(cfg.staktaAdjustable, s.STAKTA_RANGE, s.STAKTA_DECOR);
    if (price == null) {
      cfg.errors = cfg.errors || [];
      cfg.errors.push(`Staktos kaina šiam diapazonui/dekorui kataloge nenurodyta (galimai LAKUOTOS lygis, kurio šis įrankis dar neskiria) — kreiptis dėl kainos.`);
    } else {
      const typeLabel = s.STAKTA_ADJ_TYPE === 'STEEL_MOUNT' ? 'uždedama plieninei staktai' : 'reguliuojama';
      add(`Stakta (${typeLabel}, ${s.STAKTA_RANGE} mm, ${s.STAKTA_TRIM}cm apvadas)`, price, 'frame');
      if (s.STAKTA_ADJ_TYPE !== 'STEEL_MOUNT') {
        const table = cfg.staktaAdjustable;
        if (s.STAKTA_MITER === '90' && table.miter90Extra && !table.miter90ExcludedRanges.includes(s.STAKTA_RANGE)) {
          add('Staktos jungimas 90° kampu', table.miter90Extra, 'frame');
        }
      }
      if (surcharge) add('Stakta — standarto priemoka (+15%)', price * ex.pl2112Pct, 'frame');
    }
    if (s.STAKTA_RANGE_EXT === 'YES') add('Diapazono keitimas +20 mm', RANGE_EXT_PRICE, 'frame');
    if (s.ELECTROMAGNETIC === 'YES') add('Elektromagnetinė sklendė', STAKTA_FIXED.electromagnetic, 'frame');
  } else if (s.STAKTA_MODE === 'FIXED') {
    const price = staktaFixedPrice(s.STAKTA_DECOR, null, null, s.KAMPUKAS, s.KAMPUKAS_QTY, s.ELECTROMAGNETIC);
    const extras = [s.KAMPUKAS === 'YES' ? `kampukas ×${s.KAMPUKAS_QTY}` : null, s.ELECTROMAGNETIC === 'YES' ? 'el. sklendė' : null].filter(Boolean);
    add(`Fiksuota stakta${extras.length ? ' (+ ' + extras.join(' + ') + ')' : ''}`, price, 'frame');
    // Standarto priemoka taikoma TIK staktos bazei, ne kampukui/el. sklendei
    // (audito radinys 2026-09-23: `price` čia apima ir priedus, todėl 15%
    // klaidingai persikeldavo ir jiems — reguliuojamai staktai aukščiau šis
    // atskyrimas jau buvo teisingas, nes ten priedai pridedami atskirai).
    const baseOnly = staktaFixedPrice(s.STAKTA_DECOR, null, null, 'NO', 1, 'NO');
    if (surcharge) add('Stakta — standarto priemoka (+15%)', baseOnly * ex.pl2112Pct, 'frame');
  }
  // Trečias vyris — į staktos grupę, nes taip jis ir tiekiamas (psl. 59, 75)
  if (s.HINGE_COUNT === '3') add('Trečias vyris (tiekiamas su stakta)', THIRD_HINGE_PRICE, 'frame');
  if (s.STAKTA_MODE === 'ADJUSTABLE' && s.KARUNA === 'SET') {
    const karunaBase = KARUNA_SET_PRICE[staktaAdjustableTier(s.STAKTA_DECOR)];
    add('Karūna + apvadinės juostelės (1 pusė)', karunaBase, 'frame');
    if (surcharge) add('Karūna — standarto priemoka (+15%)', karunaBase * ex.pl2112Pct, 'frame');
  }
  if ((s.STAKTA_MODE === 'ADJUSTABLE' || s.STAKTA_MODE === 'FIXED') && s.FIXED_TRIM_SET && s.FIXED_TRIM_SET !== 'NONE') {
    const tier = staktaAdjustableTier(s.STAKTA_DECOR);
    const unit = (STAKTA_FIXED.trimSet[s.FIXED_TRIM_SET] || {})[tier] || 0;
    const qty = Math.max(1, Number(s.FIXED_TRIM_QTY) || 1);
    adjustments.push({ description: `Apvadų komplektas vienai pusei (${s.FIXED_TRIM_SET}, ${decorOptName(cfg, s.STAKTA_DECOR)}, ${qty} vnt.)`,
      amountNet: unit * qty, group: 'trim', pdfSplit: true, pdfQty: qty, pdfUnit: 'vnt.', pdfUnitPrice: unit });
  }
  if (s.FLOOR_TRIM === 'YES') {
    const qty = Math.max(1, Number(s.FLOOR_TRIM_QTY) || 1);
    const unit = FLOOR_TRIM_PRICE[s.FLOOR_TRIM_TYPE] || FLOOR_TRIM_PRICE.laminated;
    const typeLabel = s.FLOOR_TRIM_TYPE === 'painted' ? 'dažyta' : 'laminuota';
    const colorLabel = s.FLOOR_TRIM_TYPE === 'painted'
      ? (FLOOR_TRIM_PAINTED_COLORS.find(c => c[0] === s.FLOOR_TRIM_COLOR) || [])[1]
      : decorOptName(cfg, s.FLOOR_TRIM_COLOR);
    adjustments.push({ description: `Grindjuostė (${typeLabel}, ${colorLabel}, ${qty} vnt. × 2,40 m)`,
      amountNet: unit * qty, group: 'trim', pdfSplit: true, pdfQty: qty, pdfUnit: 'vnt.', pdfUnitPrice: unit });
  }

  if (s.HANDLE_FAMILY && s.HANDLE_FAMILY !== 'NONE') {
    const fam = HANDLE_FAMILIES.find(h => h.key === s.HANDLE_FAMILY);
    const finish = fam.finishes.find(f => f[0] === s.HANDLE_FINISH);
    if (finish) {
      const drillTxt = s.HANDLE_DRILL === 'YES' ? ' + skylių gręžimas' : ' · skylių gręžimas: ne';
      const versionTxt = fam.hasLR ? ` Versija: ${s.HANDLE_SIDE === 'RIGHT' ? 'dešinė' : 'kairė'} —` : ' —';
      adjustments.push({ description: `Rankena ${fam.name}${versionTxt} ${finish[1]}${drillTxt}`,
        amountNet: finish[2], group: 'handle', pdfSplit: true, pdfQty: 1, pdfUnit: 'vnt.', pdfUnitPrice: finish[2] });
      if (s.HANDLE_PLATE) {
        if (s.HANDLE_PLATE === 'NONE') {
          spec('Apyraktis: nereikia', 'handle');
        } else {
          const platePrice = handlePlatePrice(s.HANDLE_FAMILY, s.HANDLE_FINISH, s.HANDLE_PLATE);
          if (platePrice) {
            adjustments.push({ description: `Rankenos ${HANDLE_PLATE_LABELS[s.HANDLE_PLATE]}${drillTxt}`,
              amountNet: platePrice, group: 'handle', pdfSplit: true, pdfQty: 1, pdfUnit: 'vnt.', pdfUnitPrice: platePrice });
          } else spec(HANDLE_PLATE_LABELS[s.HANDLE_PLATE], 'handle');
        }
      }
    }
  }

  const optionsNet = adjustments.reduce((a, x) => a + x.amountNet, 0);
  const unitNet = baseNet + optionsNet;
  const unitGross = unitNet * (1 + ex.vatRate);
  const errors = cfg.errors || [];
  const missing = cfg.missing || [];
  return { valid: errors.length === 0 && missing.length === 0, errors, missing,
    baseNet, adjustments, unitNet, unitGross, vatRate: ex.vatRate };
}

function describeSelections(cfg) {
  const { family, selections: s } = cfg;
  const doorTypeName = { REBATED: 'Užlaidinė', FLUSH: 'Lygiabriaunė', REVERSIBLE: 'Reversinė' }[s.DOOR_TYPE];
  const directionName = { LEFT: 'Kairė', RIGHT: 'Dešinė' }[s.DIRECTION];
  const decor = (cfg.decorOpts || []).find(o => o.code === s.DECOR);
  const glass = (cfg.glassOpts || []).find(o => o.code === s.GLASS);
  const rows = [
    ['Standartas', STANDARD_NAME[s.STANDARD] || s.STANDARD],
    ['Varčios tipas', doorTypeName], ['Plotis', s.WIDTH], ['Atidarymo kryptis', directionName],
    ['Dekoras', decor ? `${decor.name} (${decor.group})` : '—'],
  ];
  if (glass) {
    rows.push(['Stiklinimas', glass.name]);
    rows.push(['Stiklinimo pusė', s.GLAZING_SIDE === 'REVERSAS' ? 'Reversas' : 'Aversas']);
  }
  if (s.VENTILATION && s.VENTILATION !== 'NONE') {
    const vopt = VENTILATION_OPTIONS.find(([code]) => code === s.VENTILATION);
    rows.push(['Ventiliacija', vopt ? vopt[1] : s.VENTILATION]);
  }
  if (s.DROP_SEAL === 'YES') rows.push(['Nuleidžiama tarpinė', 'Taip']);
  if (s.FRAME_CORE === 'GLUED_WOOD') rows.push(['Vertikalūs rėmai', 'Klijuotos medienos']);
  const lockOpt = (cfg.lockOpts || []).find(o => o.code === s.LOCK);
  if (lockOpt) rows.push(['Spyna', lockOpt.name]);
  if (s.INTARSIA && s.INTARSIA !== 'NONE') rows.push(['Intarsija', s.INTARSIA.replace('LUX', 'LUX ') + ' (iš abiejų pusių)']);
  if (s.HINGE_COUNT === '3') rows.push(['Vyriai', 'Trys paslėpti vyriai (trečias už priemoką)']);
  const lockColorRow = (cfg.lockColorOpts || []).find(o => o[0] === s.LOCK_COLOR);
  if (lockColorRow && lockColorRow[0] !== 'STANDARD') rows.push(['Spynos spalva', lockColorRow[1]]);
  const hwColor = (cfg.hwColorOpts || []).find(o => o[0] === s.HARDWARE_COLOR);
  if (hwColor && hwColor[0] !== 'STANDARD') {
    rows.push([s.DOOR_TYPE === 'REBATED' ? 'Furnitūros spalva' : 'Furnitūros spalva (vyriai + plokštelė)', hwColor[1]]);
  }
  if (s.HINGE_CAP && s.HINGE_CAP !== 'NONE') {
    const hc = HINGE_CAP_OPTIONS.find(([code]) => code === s.HINGE_CAP);
    if (hc) rows.push(['Vyrių dangteliai', hc[1]]);
  }
  if (s.STAKTA_MODE === 'ADJUSTABLE') {
    const typeLabel = s.STAKTA_ADJ_TYPE === 'STEEL_MOUNT' ? ' (uždedama plieninei staktai)' : '';
    rows.push(['Stakta', `Reguliuojama stakta${typeLabel}: ${s.STAKTA_RANGE}${s.STAKTA_RANGE_EXT === 'YES' ? '+20' : ''} mm, ${s.STAKTA_TRIM}cm apvadas, ${s.STAKTA_MITER}° kampas${s.KARUNA === 'SET' ? ' + karūna/apvadai' : ''}${s.STAKTA_DECOR !== s.DECOR ? ' (staktos spalva: ' + (decorOptName(cfg, s.STAKTA_DECOR)) + ')' : ''}`]);
  } else if (s.STAKTA_MODE === 'FIXED') {
    const extras = [s.KAMPUKAS === 'YES' ? `kampukas 10x18 ×${s.KAMPUKAS_QTY}` : null, s.ELECTROMAGNETIC === 'YES' ? 'el. sklendė' : null].filter(Boolean);
    rows.push(['Stakta', `Fiksuota stakta${extras.length ? ': ' + extras.join(', ') : ''}${s.STAKTA_DECOR !== s.DECOR ? ' (staktos spalva: ' + (decorOptName(cfg, s.STAKTA_DECOR)) + ')' : ''}`]);
  }
  if ((s.STAKTA_MODE === 'ADJUSTABLE' || s.STAKTA_MODE === 'FIXED') && s.FIXED_TRIM_SET !== 'NONE') {
    rows.push(['Apvadų komplektas', `${s.FIXED_TRIM_SET}, ${s.FIXED_TRIM_QTY} vnt.`]);
  }
  if (s.FLOOR_TRIM === 'YES') {
    const typeLabel = s.FLOOR_TRIM_TYPE === 'painted' ? 'Dažyta' : 'Laminuota';
    const colorLabel = s.FLOOR_TRIM_TYPE === 'painted'
      ? (FLOOR_TRIM_PAINTED_COLORS.find(c => c[0] === s.FLOOR_TRIM_COLOR) || [])[1]
      : decorOptName(cfg, s.FLOOR_TRIM_COLOR);
    rows.push(['Grindjuostė', `${typeLabel}, ${colorLabel}, ${s.FLOOR_TRIM_QTY} vnt.`]);
  }
  if (s.HANDLE_FAMILY && s.HANDLE_FAMILY !== 'NONE') {
    const fam = HANDLE_FAMILIES.find(h => h.key === s.HANDLE_FAMILY);
    const finish = fam.finishes.find(f => f[0] === s.HANDLE_FINISH);
    const sideTxt = fam.hasLR ? ` (${s.HANDLE_SIDE === 'RIGHT' ? 'dešinė' : 'kairė'} versija)` : '';
    rows.push(['Rankena', `${fam.name} — ${finish ? finish[1] : ''}${sideTxt}`]);
    if (s.HANDLE_PLATE) rows.push(['Apyraktis', s.HANDLE_PLATE === 'NONE' ? 'Apyraktis: nereikia' : HANDLE_PLATE_LABELS[s.HANDLE_PLATE]]);
    if (s.HANDLE_DRILL) rows.push(['Skylių gręžimas rankenai', s.HANDLE_DRILL === 'YES' ? 'Gręžimas rankenai: taip (nemokamai)' : 'Gręžimas rankenai: ne']);
  }
  return rows;
}
function decorOptName(cfg, code) {
  const o = (cfg.decorOpts || []).find(x => x.code === code);
  return o ? o.name : code;
}

/* Užsakymo pozicijos aprašymas, suskaidytas į 4 dalis (varčia / stakta /
   rankena / apdaila), su visais pasirinkimais — ir mokamais, ir nemokamais —
   bei tarpinėmis sumomis (užsakovo patikslinimas 2026-09-08). */
function describeGrouped(cfg, price) {
  const s = cfg.selections;
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const eur = n => new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR' }).format(n);

  const GROUPS = [
    { key: 'door', title: 'Varčia', total: 'Viso už varčią be PVM', base: price.baseNet },
    { key: 'frame', title: 'Stakta', total: 'Viso už staktą be PVM' },
    { key: 'handle', title: 'Rankena', total: 'Viso už rankeną be PVM' },
    { key: 'trim', title: 'Apdaila', total: 'Viso už apdailą be PVM' },
  ];

  const out = [];
  GROUPS.forEach(g => {
    const lines = price.adjustments.filter(a => a.group === g.key);
    if (!lines.length && g.base == null) return;
    const parts = [];
    let sub = 0;
    if (g.base != null) {
      sub = r2(g.base);
      parts.push(`${cfg.family.label} ${cfg.modelNo} (${eur(sub)})`);
    }
    // Staktos spalva rašoma TIK jei skiriasi nuo varčios spalvos
    if (g.key === 'frame' && s.STAKTA_DECOR && s.STAKTA_DECOR !== s.DECOR) {
      parts.push(`Staktos spalva kita nei varčios: ${decorOptName(cfg, s.STAKTA_DECOR)}`);
    }
    lines.forEach(a => {
      if (a.spec) { parts.push(a.description); return; }
      const amt = r2(a.amountNet);
      sub = r2(sub + amt);
      parts.push(`${a.description} (+${eur(amt)})`);
    });
    const grossSub = r2(sub * (1 + SHARED_EXTRAS.vatRate));
    out.push({ title: g.title, text: parts.join(' · '), totalLabel: g.total, total: sub, totalGross: grossSub });
  });
  return out;
}

/* PDF / sąskaitos eilutės vienai užsakymo pozicijai (2026-09-08 patikslinimas):
   - Varčia = viena eilutė su visa detalia informacija; vyrių dangteliai — atskira eilutė
   - Stakta = viena eilutė su visa detalia informacija
   - Rankena = kiekvienas elementas atskira eilutė (rankena, apyraktis)
   - Apdaila = kiekvienas elementas atskira eilutė (apvadai, grindjuostė)
   Numeracija grupuota: 1.1, 1.2, ... (pozicijos nr. + eilutės nr.) */
function invoiceRowsForItem(item, posIndex) {
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const eur = n => new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR' }).format(n);
  const adj = item.priceAdjustments || [];
  const rows = [];
  let sub = 0;

  const push = (desc, qty, unit, unitPrice, sum) => {
    sub += 1;
    rows.push({ no: `${posIndex}.${sub}`, desc, qty, unit, unitPrice: r2(unitPrice), sum: r2(sum) });
  };

  // --- 1) Varčia: viena eilutė (be pdfSplit eilučių) ---
  const doorLines = adj.filter(a => a.group === 'door' && !a.pdfSplit);
  const doorParts = [`${item.familyLabel} ${item.modelNo} (${eur(r2(item.baseNet))})`];
  let doorNet = r2(item.baseNet);
  doorLines.forEach(a => {
    if (a.spec) { doorParts.push(a.description); return; }
    const amt = r2(a.amountNet);
    doorNet = r2(doorNet + amt);
    doorParts.push(`${a.description} (+${eur(amt)})`);
  });
  push(`Varčia ${doorParts.join(' · ')}`, item.qty, 'vnt.', doorNet, doorNet * item.qty);

  // --- 1b) atskiros "door" eilutės (vyrių dangteliai) ---
  adj.filter(a => a.group === 'door' && a.pdfSplit).forEach(a => {
    const q = (a.pdfQty || 1) * item.qty;
    push(a.description, q, a.pdfUnit || 'vnt.', a.pdfUnitPrice || a.amountNet, r2(a.amountNet) * item.qty);
  });

  // --- 2) Stakta: viena eilutė ---
  const frameLines = adj.filter(a => a.group === 'frame');
  if (frameLines.length) {
    const s = item.selections || {};
    const parts = [];
    if (s.STAKTA_DECOR && s.STAKTA_DECOR !== s.DECOR && item.staktaDecorName) {
      parts.push(`Staktos spalva kita nei varčios: ${item.staktaDecorName}`);
    }
    let net = 0;
    frameLines.forEach(a => {
      if (a.spec) { parts.push(a.description); return; }
      const amt = r2(a.amountNet);
      net = r2(net + amt);
      parts.push(`${a.description} (+${eur(amt)})`);
    });
    push(parts.join(' · '), item.qty, 'vnt.', net, net * item.qty);
  }

  // --- 3) Rankena ir 4) Apdaila: kiekvienas elementas atskirai ---
  ['handle', 'trim'].forEach(g => {
    adj.filter(a => a.group === g && !a.spec).forEach(a => {
      const q = (a.pdfQty || 1) * item.qty;
      const up = a.pdfUnitPrice != null ? a.pdfUnitPrice : a.amountNet;
      push(a.description, q, a.pdfUnit || 'vnt.', up, r2(a.amountNet) * item.qty);
    });
  });

  return rows;
}
