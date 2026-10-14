/* ==========================================================================
   STIKLINIMAS — atnaujinti duomenys (užsakovo 2026-09-09 lentelė + patikslinimai)

   Terminologija (suvienodinta pagal užsakovą):
     - visur „VSG 221 stiklas" (kataloge įvairiai: „laminuotas"/„klijuotas")
     - „matinis" = „pieno baltumo" = „pieniškas" -> naudojame TIK „matinis"

   Priemokos čia jau GALUTINĖS varčiai (stiklų skaičiaus koeficientas
   įskaičiuotas). Jei priemoka nenurodyta — stiklo pakeitimas įskaičiuotas
   į varčios kainą.

   Pasirinkime visada aktyvuojama PIRMA pozicija.

   Struktūra:
     GLASS_SETS[šeima][modelis] = { base: [...], extra: [[kodas, pavadinimas, priemoka], ...] }
     base — nemokami variantai (pirmas = numatytasis)
   Jei modelio nėra sąraše arba reikšmė null — modelis be stiklo.
   ========================================================================== */

// Dažniausi nemokami baziniai variantai
const G_MATTE_CLEAR = [['MATTE4', 'Matinis grūdintas 4mm'], ['CLEAR4', 'Skaidrus grūdintas 4mm']];
const G_MATTE_ONLY  = [['MATTE4', 'Matinis grūdintas 4mm']];
const G_CLEAR_ONLY  = [['CLEAR4', 'Skaidrus grūdintas 4mm']];

// Standartinės VSG 221 priemokos (matinis, juodas) + dekoratyviniai relief/point
function vsg(matte, dark, decorative) {
  const out = [
    ['VSG_MATTE', 'VSG 221 stiklas — matinis', matte],
    ['VSG_DARK',  'VSG 221 stiklas — juodas',  dark],
  ];
  if (decorative) {
    out.push(['RELIEF', 'Dekoratyvinis grūdintas — relief', dark]);
    out.push(['POINT',  'Dekoratyvinis grūdintas — point',  dark]);
  }
  return out;
}
// Trumpiklis: pilnas rinkinys su matiniu+skaidriu baze
function set(matte, dark, decorative) {
  return { base: G_MATTE_CLEAR, extra: vsg(matte, dark, decorative) };
}
// Kai kuriose šeimose nėra „skaidrus" bazinio varianto (ARALIA/NOLINA/EWODIA)
function setNoClear(matte, dark) {
  return { base: G_MATTE_ONLY, extra: vsg(matte, dark, false) };
}
// MISKANT: VSG su vidine aplikacija, +308,10 abiem.
// Patikslinta 2026-09-09: VSG stiklo tipas VISADA atitinka bazinį stiklą —
// modeliai 1, 3, 5 skaidrūs; 2, 4, 6 matiniai. Todėl tipą išvedame automatiškai,
// kad nebūtų galimybės jį sukryžiuoti.
function miskant(baseGlass) {
  const isClear = baseGlass === 'CLEAR';
  const t = isClear ? 'skaidrus' : 'matinis';
  return {
    base: isClear ? G_CLEAR_ONLY : G_MATTE_ONLY,
    extra: [
      ['VSG_APP_1', `VSG 221 stiklas — ${t} su juoda aplikacija`, 308.10],
      ['VSG_APP_2', `VSG 221 stiklas — ${t} su balta aplikacija`, 308.10],
    ],
  };
}
// FRAGI ir kt.: vienas fiksuotas stiklas, be pasirinkimo, be priemokos
function fixedGlass(name) {
  return { base: [['FIXED', name]], extra: [] };
}

const GLASS_SETS = {
  WERBENA: {
    4: set(127.50, 174.30), 5: set(127.50, 174.30), 6: set(127.50, 174.30),
    7: set(127.50, 174.30, true), 8: set(127.50, 174.30, true), 9: set(127.50, 174.30, true),
  },
  LAURENCJA: { 1: set(15.60, 20.40), 2: set(7.80, 10.20), 3: set(3.90, 5.10), 4: set(7.80, 10.20), 5: set(7.80, 10.20) },
  /* SKYDINĖS DURYS — BALDUR (psl. 108–109). Kita stiklo sistema nei STILE:
     bazė yra grūdintas matinis 8 mm (ne 4 mm), o priemoka — VSG/ESG 441
     (ne VSG 221). BALDUR 9 stiklinimas fiksuotas: Lacobel juodas 4 mm,
     įklijuotas iš abiejų pusių ir sulygintas su paviršiumi — pasirinkimo nėra,
     todėl pateikiamas vienintelis nemokamas variantas. */
  BALDUR: {
    1: { base: [['TEMP8', 'Grūdintas matinis 8mm']],
         extra: [['VSG441_MATTE', 'VSG/ESG 441 stiklas — matinis', 32.70],
                 ['VSG441_DARK',  'VSG/ESG 441 stiklas — juodas',  32.70]] },
    3: { base: [['TEMP8', 'Grūdintas matinis 8mm']],
         extra: [['VSG441_MATTE', 'VSG/ESG 441 stiklas — matinis', 74.40],
                 ['VSG441_DARK',  'VSG/ESG 441 stiklas — juodas',  74.40]] },
    9: { base: [['LACOBEL4', 'Lacobel juodas 4mm (sulygintas su paviršiumi)']], extra: [] },
  },
  /* ALTAMURA (skydinės, psl. 112–113). Standartas — grūdintas decormat pieno
     baltumo arba skaidrus; priemoka tik už VSG 221 matinį, ir ji priklauso nuo
     modelio (stiklo plotas skiriasi). ALTAMURA 1 stiklo neturi. */
  ALTAMURA: (() => {
    const base = [['DECORMAT_MATTE', 'Decormat grūdintas — pieno baltumo'],
                  ['DECORMAT_CLEAR', 'Decormat grūdintas — skaidrus']];
    const mk = price => ({ base, extra: [['VSG_MATTE', 'VSG 221 stiklas — matinis', price]] });
    return { 2: mk(94.80), 3: mk(66.90), 4: mk(25.50), 5: mk(30.90), 6: mk(15.30), 7: mk(30.90), 8: mk(15.30) };
  })(),
  /* ANSEDONIA (skydinės, psl. 114–115). Kaip ir LAURENCJA, VSG 221 kainuojamas
     UŽ VIENĄ STIKLO VIENETĄ — 10,50 €, todėl priemoka = 10,50 × stiklų skaičius.
     Standartas (decormat pieno baltumo arba skaidrus) — nemokamas.
     Stiklų skaičius nuskaitytas iš katalogo vaizdo psl. 114: raštas kartojasi
     keturiose modelių grupėse po (3, 1, 0). */
  ANSEDONIA: (() => {
    const base = [['DECORMAT_MATTE', 'Decormat grūdintas — pieno baltumo'],
                  ['DECORMAT_CLEAR', 'Decormat grūdintas — skaidrus']];
    const UNIT = 10.50;
    const mk = n => ({ base, extra: [['VSG_MATTE', `VSG 221 stiklas — matinis (${n} vnt.)`, +(UNIT * n).toFixed(2)]] });
    return { 1: mk(3), 2: mk(1), 4: mk(3), 5: mk(1), 7: mk(3), 8: mk(1), 10: mk(3), 11: mk(1) };
  })(),
  /* LORIENT (skydinės, psl. 116–117) — VSG 221 kaina FIKSUOTA pagal modelį,
     ne už vienetą (skirtingai nei ANSEDONIA, MENTON ir SORANO). */
  LORIENT: (() => {
    const base = [['DECORMAT_MATTE', 'Decormat grūdintas — matinis'],
                  ['DECORMAT_CLEAR', 'Decormat grūdintas — skaidrus']];
    const mk = p => ({ base, extra: [['VSG_MATTE', 'VSG 221 stiklas — matinis', p]] });
    return { 1: mk(30.90), 4: mk(30.90), 7: mk(30.90), 10: mk(30.90),
             2: mk(15.30), 5: mk(15.30), 8: mk(15.30), 11: mk(15.30) };
  })(),

  /* MENTON (psl. 118–119) ir SORANO (psl. 120–121) — VSG 221 kainuojamas UŽ
     VIENĄ STIKLO VIENETĄ, ir vieneto kaina skiriasi pagal modelių grupę.
     Priemoka = vieneto kaina × stiklų skaičius.
     ⚠ Stiklų skaičius nuskaitytas iš katalogo vaizdo — kataloge lentelės nėra.
     Skaičius rodomas pasirinkimo pavadinime, kad klaidą būtų galima pastebėti. */
  MENTON: (() => {
    const base = [['DECORMAT_MATTE', 'Decormat grūdintas — pieno baltumo'],
                  ['DECORMAT_CLEAR', 'Decormat grūdintas — skaidrus']];
    const mk = (unit, n) => ({ base, extra: [['VSG_MATTE', `VSG 221 stiklas — matinis (${n} vnt. × ${unit.toFixed(2).replace('.', ',')} €)`, +(unit * n).toFixed(2)]] });
    // Modeliai 6 ir 10 patikslinti — iš tikrųjų 3 stiklo vienetai, ne 2
    // (užsakovo patikslinimas 2026-09-18): 6 → 3×10,50=31,50 €; 10 → 3×8,10=24,30 €.
    return { 1: mk(21.00, 3), 2: mk(21.00, 2), 3: mk(21.00, 1),
             5: mk(10.50, 4), 6: mk(10.50, 3), 7: mk(10.50, 1),
             9: mk(8.10, 4), 10: mk(8.10, 3), 11: mk(8.10, 1) };
  })(),

  SORANO: (() => {
    const base = [['DECORMAT_MATTE', 'Decormat grūdintas — matinis'],
                  ['DECORMAT_CLEAR', 'Decormat grūdintas — skaidrus']];
    const mk = (unit, n) => ({ base, extra: [['VSG_MATTE', `VSG 221 stiklas — matinis (${n} vnt. × ${unit.toFixed(2).replace('.', ',')} €)`, +(unit * n).toFixed(2)]] });
    return { 1: mk(10.50, 6), 2: mk(10.50, 2),
             4: mk(23.40, 4), 5: mk(23.40, 3), 6: mk(23.40, 2), 7: mk(23.40, 1),
             9: mk(15.30, 4), 10: mk(15.30, 3), 11: mk(15.30, 1) };
  })(),
  /* BALDUR dažytas (psl. 88–89). Skirtingai nei dekoruotas BALDUR, čia VSG/ESG 441
     yra STANDARTAS — pasirenkama tik matinė ar juoda, abi nemokamai. */
  'BALDUR PAINTED': {
    1: { base: [['VSG441_MATTE', 'VSG/ESG 441 — matinis'], ['VSG441_DARK', 'VSG/ESG 441 — juodas']], extra: [] },
    3: { base: [['VSG441_MATTE', 'VSG/ESG 441 — matinis'], ['VSG441_DARK', 'VSG/ESG 441 — juodas']], extra: [] },
    5: { base: [['VSG441_MATTE', 'VSG/ESG 441 — matinis'], ['VSG441_DARK', 'VSG/ESG 441 — juodas']], extra: [] },
  },
  // TURAN (dažytos durys, psl. 94–95) — vienintelė dažytų šeima be STILE atitikmens.
  // VSG 221 taikomas TIK TURAN 1 ir TURAN 8; relief/point — tik TURAN 1.
  // TURAN 7 yra veidrodinis modelis (ne stiklas), todėl čia jo nėra.
  TURAN: { 1: set(127.50, 174.30, true), 8: set(127.50, 174.30) },
  FREZJA: {
    1: set(30.90, 42.30, true), 3: set(127.50, 174.30, true), 5: set(15.30, 21.30, true),
    7: fixedGlass('Veidrodis'), 8: fixedGlass('Stiklas 8mm'), 9: set(127.50, 174.30, true),
  },
  JASMIN: Object.fromEntries([1,2,3,4,5,6,7,8].map(n => [n, set(127.50, 174.30)])),
  NEMEZJA: {
    4: set(76.80, 104.70, true), 7: set(87.00, 118.80, true), 9: set(83.40, 142.80, true),
    10: set(21.00, 28.20, true), 11: set(76.80, 104.70, true), 15: set(205.20, 342.60, true),
  },
  PEONIA: {
    1: set(87.00, 118.80, true), 2: set(87.00, 118.80, true),
    3: set(76.80, 104.70, true), 4: set(76.80, 104.70, true),
    5: set(76.80, 104.70, true), 6: set(76.80, 104.70, true),
  },
  AMARYLIS: Object.fromEntries([1,2,3,4,5,6,7,8,9].map(n => [n, set(127.50, 174.30, true)])),
  MISKANT: {
    // 1, 3, 5 — skaidrūs; 2, 4, 6 — matiniai (patvirtinta 2026-09-09)
    1: miskant('CLEAR'), 2: miskant('MATTE'), 3: miskant('CLEAR'),
    4: miskant('MATTE'), 5: miskant('CLEAR'), 6: miskant('MATTE'),
  },
  MAGNOLIA: {
    1: set(49.50, 66.00), 2: set(39.60, 52.80), 3: set(29.70, 39.60), 4: set(19.80, 26.40),
    5: set(9.90, 13.20), 6: set(29.70, 39.60), 7: set(19.80, 26.40),
  },
  BUDLEJA: { 1: set(91.80, 125.40), 2: set(8.70, 12.00), 4: set(8.70, 12.00), 6: set(8.70, 12.00), 8: set(8.70, 12.00) },
  POWOJNIK: { 1: set(65.70, 90.00), 2: set(43.80, 60.00) },
  LUKRECJA: Object.fromEntries([1,2,3,4,5,6,7,8,9].map(n => [n, set(127.50, 174.30)])),
  EPIMEDIUM: { 1: set(84.60, 111.60), 3: set(28.20, 37.20), 4: set(28.20, 37.20), 6: set(28.20, 37.20) },
  ARALIA: { 1: setNoClear(55.80, 69.90) },
  NOLINA: { 1: setNoClear(55.80, 69.90) },
  EWODIA: { 1: setNoClear(55.80, 69.90), 2: setNoClear(55.80, 69.90), 4: setNoClear(55.80, 69.90) },
  JUKA: {
    1: set(102.30, 139.50), 2: set(55.20, 75.00), 3: set(7.50, 10.20), 4: set(102.30, 139.50),
    5: set(76.80, 104.70), 6: set(51.60, 69.90), 7: set(25.50, 34.80),
  },
  FORSYCJA: {
    1: set(107.40, 146.70), 2: set(56.40, 75.00), 4: set(107.40, 146.70),
    5: set(71.40, 97.80), 6: set(36.00, 48.90), 7: set(71.40, 97.80),
  },
  LAWENDA: {
    1: set(100.20, 136.20), 2: set(33.60, 45.90), 4: set(66.90, 91.20), 5: set(33.60, 45.90),
    6: set(66.90, 91.20), 7: set(100.20, 136.20), 8: set(48.90, 66.90), 9: set(4.20, 6.30),
  },
  IRYS: {
    1: set(76.50, 106.50), 2: set(61.20, 85.20), 3: set(30.60, 42.60), 4: set(15.30, 21.30),
    5: set(45.90, 63.90), 6: set(45.90, 63.90), 7: set(30.60, 42.60),
  },
  DAGLEZJA: {
    1: set(19.50, 25.50), 2: set(15.60, 20.40), 3: set(11.70, 15.30), 4: set(7.80, 10.20),
    5: set(3.90, 5.10), 6: set(11.70, 15.30), 7: set(11.70, 15.30),
  },
  DEBECJA: {
    1: set(74.40, 100.80), 2: set(55.80, 75.60), 3: set(37.20, 50.40),
    4: set(18.60, 25.20), 5: set(37.20, 50.40), 6: set(37.20, 50.40),
  },
  SURMIA: { 1: set(29.70, 39.60), 2: set(9.90, 13.20), 3: set(9.90, 13.20) },
  BERBERYS: { 1: set(49.50, 66.00), 3: set(19.80, 26.40), 5: set(29.70, 39.60) },
  // FLOKS — patvirtinta 2026-09-09: katalogo numeracija (1, 4, 5, 6) ir
  // koeficientai 6, 2, 4, 2. Modelio 5 koeficientas patikslintas iš 5 į 4
  // (ankstesniame 2026-08-21 dokumente buvo klaida).
  // Vieneto kaina 12,30 / 17,40 — visos eilutės sutampa: 6×=73,80/104,40;
  // 2×=24,60/34,80; 4×=49,20/69,60.
  FLOKS: { 1: set(73.80, 104.40), 4: set(24.60, 34.80), 5: set(49.20, 69.60), 6: set(24.60, 34.80) },
  KROKUS: {
    1: set(92.70, 126.90), 2: set(61.80, 84.60), 3: set(30.90, 42.30),
    4: set(61.80, 84.60), 5: set(30.90, 42.30),
  },
  KAMELIA: {
    1: set(31.20, 40.80), 2: set(23.40, 30.60), 3: set(19.50, 25.50), 4: set(11.70, 15.30),
    5: set(7.80, 10.20), 6: set(7.80, 10.20), 7: set(15.60, 20.40),
  },
  PETUNIA: {
    1: set(45.00, 55.80), 2: set(30.00, 37.20), 3: set(22.50, 27.90), 4: set(15.00, 18.60),
    5: set(7.50, 9.30), 6: set(15.00, 18.60), 7: set(30.00, 37.20),
  },
  AZALIA: {
    1: set(109.50, 150.00), 2: set(87.60, 120.00), 3: set(65.70, 90.00), 4: set(43.80, 60.00),
    5: set(21.90, 30.00), 6: set(65.70, 90.00), 7: set(43.80, 60.00),
  },
  HIACYNT: {
    1: set(81.90, 111.60), 2: set(56.40, 77.10), 3: set(71.40, 97.80), 4: set(29.70, 40.20),
    5: set(56.40, 77.10), 6: set(94.80, 129.30), 7: set(29.70, 40.20),
  },
  FRAGI: {
    4: fixedGlass('Grūdintas 8mm'), 5: fixedGlass('Skaidrus grūdintas 8mm'),
    7: fixedGlass('Grūdintas 8mm'), 9: fixedGlass('Grūdintas 8mm'),
    10: fixedGlass('Grūdintas 8mm'), 15: fixedGlass('VSG/ESG 441 stiklas — matinis'),
    16: fixedGlass('VSG/ESG 441 stiklas — juodas'), 17: fixedGlass('Dūminis grafitas'),
    18: fixedGlass('Dekoratyvinis relief 8mm'), 19: fixedGlass('Point 8mm stiklas'),
  },
};

/* Grąžina stiklo pasirinkimus konkrečiam modeliui.
   Pirmas variantas visada be priemokos ir aktyvuojamas pagal nutylėjimą. */
function glassOptionsFor(familyLabel, modelNo) {
  const fam = GLASS_SETS[familyLabel];
  if (!fam) return [];
  const s = fam[modelNo];
  if (!s) return [];
  const out = s.base.map(([code, name]) => ({ code, name, price: 0 }));
  s.extra.forEach(([code, name, price]) => out.push({ code, name, price }));
  return out;
}
