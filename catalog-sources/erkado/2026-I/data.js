/* ==========================================================================
   ERKADO VIDAUS — katalogo duomenys
   Kiekvienos šeimos duomenys paimti iš ERKADO 2026 katalogo (I/2026/B),
   puslapiai nurodyti prie kiekvienos šeimos. Bendri priedų įkainiai (žr.
   SHARED_EXTRAS) pasikartojo identiški visose patikrintose šeimose, todėl
   laikomi katalogo standartu STILE rėminių durų linijai.
   ========================================================================== */

/* ==========================================================================
   PRODUKTŲ LINIJOS
   Įrankis apima dvi katalogo linijas. Kiekviena šeima turi `line` savybę,
   nes 7 šeimų pavadinimai kartojasi abiejose linijose (WERBENA, JASMIN,
   AMARYLIS, PEONIA, MISKANT, NEMEZJA, LAURENCJA) — todėl FAMILIES raktai
   dažytoms yra su prefiksu `PAINTED_`, o etiketėje rodoma linija.

   Pastaba terminologijai: katalogas šią liniją vadina „LAKUOTOS durys"
   (psl. 74–99), bet užsakovo nurodymu (2026-09-11) visur naudojame
   „Dažytos" — ir naudotojo sąsajoje, ir kodo raktuose (PAINTED).
   ========================================================================== */
const LINES = {
  /* reversibleBlocks2112 — ar 2112 standartas nesuderinamas su reversine varčia.
     Katalogas tai formuluoja skirtingai kiekvienai linijai:
       STILE   psl. 6:  „standartas PL2112 (negalima su reversine varčia)"
       Dažytos psl. 75: „norma PL2112" — jokio apribojimo
     Patikrinta visuose aštuoniuose dažytų durų puslapiuose 2026-09-11; nė
     viename apribojimo nėra. Iki v24 STILE taisyklė klaidingai galiojo abiem. */
  STILE:   { key: 'STILE',   label: 'STILE rėminės durys', short: 'STILE',  pages: '5–58',  eyebrow: 'STILE RĖMINĖS DURYS', reversibleBlocks2112: true },
  PAINTED: { key: 'PAINTED', label: 'Dažytos durys',       short: 'Dažyta', pages: '74–99', eyebrow: 'DAŽYTOS DURYS',       reversibleBlocks2112: false },
  PANEL:   { key: 'PANEL',   label: 'Skydinės durys',      short: 'Skydinė', pages: '108–121', eyebrow: 'SKYDINĖS DURYS',     reversibleBlocks2112: false },
};

const SHARED_EXTRAS = {
  reversible: 93.00,        // reversinė varčia (STILE; dažytoms kitokia — žr. LINE_EXTRAS)
  width100: 18.90,          // užlaidinė ir lygiabriaunė varčia „100" (STILE)
  ventilation: 9.60,        // bet kuri ventiliacijos/rekuperacijos opcija (grotelė tik 80/90/100 pločiui)
  dropSeal: 42.00,          // nuleidžiama tarpinė
  gluedFrame: 34.20,        // vertikalūs rėmeliai iš klijuotos medienos
  pl2112Pct: 0.15,          // standartas PL2112, +15% nuo varčios (ir nuo staktos komplekto) kainos
  vatRate: 0.21,
};

/* Priedai, kurių įkainis SKIRIASI tarp linijų (patikrinta psl. 75, 85 ir kt.
   2026-09-11). Visi kiti SHARED_EXTRAS įkainiai abiejose linijose identiški:
   ventiliacija 9,60, nuleidžiama tarpinė 42,00, klijuotos medienos rėmai 34,20,
   PL2112 +15%, vyrių dangteliai 4,20/vyriui, gręžimas rankenoms — nemokamai. */
const LINE_EXTRAS = {
  STILE:   { reversible: 93.00,  width100: 18.90 },
  PAINTED: { reversible: 127.20, width100: 35.10 },
  // Skydinės (psl. 109) — reversinė ir plotis „100" kaip STILE, NE kaip dažytos
  PANEL:   { reversible: 93.00,  width100: 18.90 },
  /* Dažytos skydinės (psl. 88–99) — MIŠRUS rinkinys, patikrintas visose penkiose
     šeimose: reversinė 93,00 kaip skydinių, bet plotis „100" 35,10 kaip dažytų.
     Todėl joms reikia atskiro įrašo, o ne vienos iš tėvinių linijų. */
  PAINTED_PANEL: { reversible: 93.00, width100: 35.10 },
};

/* SKYDINIŲ DURŲ priedai (psl. 108–121) — jų STILE ir dažytų linijos neturi.
   Patikrinta katalogo vaizde 2026-09-11 (psl. 109), nes teksto sluoksnyje
   kainos susimaišo su gretimomis eilutėmis. */
const PANEL_EXTRAS = {
  fullBoard: 46.50,      // pilnos plokštės užpildas
  perforated: 40.50,     // perforuotos medžio drožlių plokštės užpildas
  innerWoodFrame: 16.20, // vidinis medinis rėmas (šonai bei viršus, apačia MDF)
  bottomGuard: 16.20,    // apatinės sparno dalies apsauga kraštu
  blackEdge: 23.40,      // varčios krašto apdaila juoda
  // Toliau — priedai, kuriuos turi ne visos skydinių šeimos. Kiekviena šeima
  // pati nurodo, ką siūlo (žr. `opts` PANEL_FAMILIES įrašuose), nes BALDUR
  // psl. 109 jų neturi, o UNO PREMIUM psl. 111 — turi.
  closerReinforce: 9.60, // sutvirtinimas durų pritraukikliui
  doorCloser: 93.00,     // svirtinis durų pritraukiklis
  bottomRail: 9.60,      // papildoma apatinė sija
  ventsMetal: 37.20,     // apvalūs ir kvadratiniai metaliniai įvorės (4 vnt.)
  ventsPlastic: 7.20,    // medienos imitacijos plastikiniai įvorės (4 vnt.)
  // Iliuminatorius (buvęs „apvali anga", pervadinta 2026-09-18). Trys apdailos:
  // poliruotas chromas ir šlifuota satina abu tos pačios kainos, juodas matinis
  // brangesnis. Kiekviena apdaila renkama su skaidriu arba decormat pieno
  // matinio stiklu — stiklo tipas kainos nekeičia (psl. 113).
  roundWindowSteel: 186.90,  // iliuminatorius: poliruotas chromas arba šlifuota satina
  roundWindowBlack: 293.70,  // iliuminatorius: juodas matinis
  width110: 37.20,       // užlaidinė ir lygiabriaunė varčia „110"
  intarsia: 84.30,       // LUX intarsija (versijos psl. 100–107)
  // Nerūdijančio plieno panelis, aukštis 300 mm (ALTAMURA psl. 113).
  // Montuojamas iš abiejų pusių tik UŽLAIDINĖMS varčioms su STANDARD briauna.
  steelPanel: 106.80,        // apatinis arba vidurinis
  steelPanelVent: 116.10,    // apatinis su ventiliacija
};

/* INTARSIJOS — dekoratyviniai įdėklai, sulyginti su varčios paviršiumi,
   psl. 100–107. Vienoda kaina visiems variantams: 84,30 € (PANEL_EXTRAS.intarsia).

   Kodas sudarytas iš spalvos serijos (šimtai) ir rašto numerio:
     1xx šluotuotas plienas · 2xx juoda · 3xx ąžuolas · 4xx šluotuotas auksas
     5xx šluotuotas varis · 6xx raudona · 7xx mėlyna · 8xx alyvinė
   Pirmos penkios serijos turi po 12 vienodų raštų; trys naujosios (psl. 101) —
   mažesnį rinkinį. Įdėklai montuojami iš abiejų varčios pusių. */
const INTARSIA_PATTERNS = [3, 4, 7, 12, 13, 14, 16, 17, 18, 19, 20, 21];
const INTARSIA_SERIES = [
  ['STEEL',  1, 'Šluotuotas plienas', INTARSIA_PATTERNS],
  ['BLACK',  2, 'Juoda',              INTARSIA_PATTERNS],
  ['OAK',    3, 'Ąžuolas',            INTARSIA_PATTERNS],
  ['GOLD',   4, 'Šluotuotas auksas',  INTARSIA_PATTERNS],
  ['COPPER', 5, 'Šluotuotas varis',   INTARSIA_PATTERNS],
  ['RED',    6, 'Raudona',            [17, 18, 19, 20, 21]],
  ['BLUE',   7, 'Mėlyna',             [3, 4, 12, 13]],
  ['LILAC',  8, 'Alyvinė',            [7, 14, 16]],
];
// Grąžina [[kodas, pavadinimas], ...] nurodytoms serijoms
function intarsiaOptions(allowedSeries) {
  const out = [];
  INTARSIA_SERIES.forEach(([key, prefix, name, patterns]) => {
    if (allowedSeries && !allowedSeries.includes(key)) return;
    patterns.forEach(n => {
      const code = prefix * 100 + n;
      out.push(['LUX' + code, `LUX ${code} — ${name}`, name]);
    });
  });
  return out;
}

// Nerūdijančio plieno panelio variantai: kaina, galimi modeliai
const STEEL_PANEL_OPTIONS = [
  ['BOTTOM',      'Apatinis skydas',                  106.80, [1, 3, 4, 6, 8]],
  ['MIDDLE',      'Vidurinis skydas',                 106.80, [1, 4]],
  ['BOTTOM_VENT', 'Apatinis skydas su ventiliacija',  116.10, [1, 3, 4, 6, 8]],
];

const DOOR_CLOSER_COLORS = [
  ['SILVER', 'Sidabrinis'], ['BLACK', 'Juodas'], ['WHITE', 'Baltas'], ['BROWN', 'Rudas'],
];
const VENT_SLEEVE_FINISHES = [
  ['NICKEL', 'Šlifuotas nikelis'], ['PATINA', 'Patina'], ['WHITE', 'Balta'], ['BLACK', 'Juoda'],
];

// Skydinių pločiai (psl. 109) — su „N" variantais, kurių STILE linija neturi
const PANEL_WIDTHS = ['60N','60','65','70N','70','75','80N','80','85','90N','90','95','100'];
function lineExtras(lineKey) {
  return { ...SHARED_EXTRAS, ...(LINE_EXTRAS[lineKey] || LINE_EXTRAS.STILE) };
}

/* ==========================================================================
   STAKTA (durų rėmas/anga) — katalogo psl. 155–157.
   Reguliuojama stakta kainuojama PAGAL VARČIOS TIPĄ IR PLOTĮ (ne pagal
   dekoro grupę, kaip varčia). Lentelė - "VIDAUS DURYS" stulpelis S1
   (standartinis sienos storis, norma iki ~146 mm su apvadais).
   Trūkstami pločiai (65/75/85/95") kataloge staktai nenurodyti atskirai —
   tokiam pločiui kaina nurodoma individualiai (nemodeliuojama čia).
   ========================================================================== */
const STAKTA_BASE = {
  REBATED:     { 60: 786, 70: 886, 80: 986, 90: 1086, 100: 1186, 110: 1286 },               // Reguliuojama stakta, užlaidinė
  FLUSH:       { 60: 811, 70: 911, '80N': 987, 80: 1011, 90: 1111, 100: 1211, 110: 1311 },   // Reguliuojama stakta, lygiabriaunė
  REVERSIBLE:  { 60: 834, 70: 934, '80N': 1010, 80: 1034, 90: 1134, 100: 1234, 110: 1334 },  // Reversinė stakta
};
const STAKTA_STANDARD_MAX_MM = 146; // psl. 155 pavyzdys: 140mm siena + dvipusis apvadas = 146mm dar tinka normai
const STAKTA_EXTEND_PANEL_RATE = { GREKO: 84.30, OTHER: 126.60, PAINTED: 168.90 }; // €/m², sieninės (psl.156)

/* Trečias vyris — psl. 181 („Staktos standartiškai turi du vyrius... trečias
   vyris 51,60 €"), psl. 183 (reversinė) ir psl. 184 (lygiabriaunė).
   Kaina dedama prie STAKTOS, nes kataloge (psl. 59, 75) aiškiai pasakyta:
   „vyriai tiekiami ir įkainojami kartu su stakta". Užlaidinė varčia
   standartiškai turi tris vyrius, todėl jai pasirinkimo nėra.
   Priemoka NEGAUNA PL2112 +15% — kaip ir kiti staktos priedai (90° jungimas,
   elektromagnetinė sklendė), +15% taikomas tik staktos bazei ir karūnai. */
const THIRD_HINGE_PRICE = 51.60;

/* Diapazono keitimas +20 mm — psl. 184 (lygiabriaunė) ir psl. 183 (reversinė,
   kataloge pavadinta „Intervalo padidinimas +20 mm" — tas pats dalykas, kitas
   vertimas; užsakovo nurodymu naudojame „Diapazono keitimas +20 mm").
   Kaina ta pati 17,40 €, bet GALIMŲ DIAPAZONŲ RIBOS SKIRIASI:
     lygiabriaunė  135-155 … 295-315
     reversinė     135-155 … 235-255  */
const RANGE_EXT_PRICE = 17.40;
const RANGE_EXT_ALLOWED = {
  FLUSH:      ['135-155','155-175','175-195','195-215','215-235','235-255','255-275','275-295','295-315'],
  REVERSIBLE: ['135-155','155-175','175-195','195-215','215-235','235-255'],
};

/* Karūna + apvadinės juostelės KOMPLEKTAS (viena pusė), psl. 155.
   PATAISYTA 2026-09-11: kataloge yra KETURI kainų lygiai, o ne du. Iki šios
   versijos kodas turėjo tik GREKO ir OTHER, todėl ST CPL spalvos varčios
   karūna buvo kainuojama 120,00 vietoj 136,80 (nurodoma 16,80 € mažiau už
   komplektą, su PL2112 ir dvivėrėmis — dar daugiau). */
const KARUNA_SET_PRICE = {
  GREKO: 102.60,   // GREKO
  OTHER: 120.00,   // ST CPL ir PREMIUM
  CPL02: 136.80,   // CPL 0,2 ir CPL 0,7
  PAINTED: 154.20, // LAKUOTOS (kataloge) = Dažytos
};

/* ==========================================================================
   REGULIUOJAMA STAKTA — diapazonu pagrįstos kainos pagal varčios tipą.
   Katalogo psl. 183 (Reversinė), 184 (Lygiabriaunė), 186–187 (Užlaidinė).
   Kiekvienas įrašas — [diapazono_žymė, GREKO, OTHER(ST CPL ir PREMIUM), CPL02, PAINTED]
   Reversinei CPL0,2 tarpinio lygio kataloge nėra — tas stulpelis null.
   ========================================================================== */
const STAKTA_ADJUSTABLE = {
  REBATED: { // psl. 186–187, "REGULIUOJAMA STAKTA IR TUNELIS", apvadas 6cm/8cm ta pati kaina
    defaultTrim: '8', trimOptions: ['8', '6'], miter90Extra: 37.20, miter90ExcludedRanges: [],
    rows: [
      ['65-80', 132.30, 146.70, 161.10, 248.40], ['80-100', 132.30, 146.70, 161.10, 248.40],
      ['100-120', 135.60, 148.80, 163.80, 258.30], ['120-140', 140.70, 154.20, 168.90, 267.90],
      ['140-160', 145.80, 159.30, 174.30, 277.80], ['160-180', 153.30, 168.00, 182.40, 288.30],
      ['180-200', 156.90, 170.40, 185.10, 298.20], ['200-220', 162.00, 175.80, 190.50, 308.10],
      ['220-240', 167.10, 181.50, 195.90, 318.00], ['240-260', 172.50, 186.60, 201.90, 328.20],
      ['260-280', 177.90, 191.70, 206.40, 338.10], ['280-300', 188.40, 202.50, 217.50, 360.60],
      ['300-340', 193.50, 207.30, 222.00, 372.60], ['340-360', 213.30, 227.10, 242.10, 385.20],
      ['360-380', 218.70, 232.20, 247.50, 392.10], ['380-400', 228.90, 242.70, 258.00, 405.00],
      ['400-420', 234.90, 248.40, 263.40, 422.10],
    ],
  },
  FLUSH: { // psl. 184, apvadas 6cm/8cm ta pati kaina
    defaultTrim: '8', trimOptions: ['8', '6'], miter90Extra: 37.20, miter90ExcludedRanges: [],
    rows: [
      ['80-95', 272.10, 289.20, 304.50, 382.50], ['95-115', 272.10, 289.20, 304.50, 382.50],
      ['115-135', 272.10, 289.20, 304.50, 382.50],
      ['135-155', 285.00, 301.50, 316.50, 402.30], ['155-175', 285.00, 301.50, 316.50, 402.30],
      ['175-195', 285.00, 301.50, 316.50, 402.30],
      ['195-215', 292.50, 309.00, 324.00, 422.10], ['215-235', 292.50, 309.00, 324.00, 422.10],
      ['235-255', 292.50, 309.00, 324.00, 422.10],
      ['255-275', 300.30, 317.10, 331.80, 442.20], ['275-295', 300.30, 317.10, 331.80, 442.20],
      ['295-315', 310.50, 327.30, 342.00, 452.40],
      ['315-355', 324.00, 341.10, 355.80, 465.90],
      ['355-375', 354.60, 371.40, 386.10, 491.70],
      ['375-395', 369.90, 386.70, 401.40, 511.50], ['395-415', 369.90, 386.70, 401.40, 511.50],
    ],
  },
  REVERSIBLE: { // psl. 183 — TIK 8cm apvadas (pasirinkimo nėra), CPL0,2 lygio nėra (naudoja OTHER stulpelį lakuotoms atskirti)
    defaultTrim: '8', trimOptions: ['8'], miter90Extra: 67.80, miter90ExcludedRanges: ['75-95'],
    rows: [
      ['75-95', 374.10, 390.30, null, 491.70], ['95-115', 374.10, 390.30, null, 491.70],
      ['115-135', 374.10, 390.30, null, 491.70],
      ['135-155', 385.80, 402.00, null, 511.50], ['155-175', 385.80, 402.00, null, 511.50],
      ['175-195', 385.80, 402.00, null, 511.50],
      ['195-215', 392.70, 409.50, null, 531.90], ['215-235', 392.70, 409.50, null, 531.90],
      ['235-255', 400.50, 417.30, null, 551.10],
      ['255-295', 426.90, 443.40, null, 581.10], ['295-315', 426.90, 443.40, null, 581.10],
      ['315-335', 453.30, 469.80, null, 600.90], ['335-355', 453.30, 469.80, null, 600.90],
    ],
  },
};

// FIKSUOTA STAKTA — tik Užlaidinei, psl. 185. Bazinė stakta + apvado profilis (8/16mm)
// + kampinis apvadas su spaustukais (6/8cm) + kampukas 10x18 + elektromagnetinė sklendė.
// Grindjuostė (psl. 185) yra atskiras, bendras (ne tik fiksuotai staktai) priedas — žr. FLOOR_TRIM žemiau.
const STAKTA_FIXED = {
  base: { GREKO: 80.10, OTHER: 88.50, CPL02: 102.90, PAINTED: 178.80 },
  // "Apvadų komplektas vienai pusei" (buvęs "apvado profilis"). Pagal nutylėjimą
  // nereikalingas (0 €); pasirinkus 8x60mm/16x80mm, kaina priskaičiuojama už
  // tiek komplektų, kiek nurodo kiekis (dvivėrei durų komplektacijai gali
  // reikėti dviejų vienodų apvadų — užsakovo pastaba, 2026-08-19).
  trimSet: {
    '8x60mm': { GREKO: 16.20, OTHER: 18.90, CPL02: 28.20, PAINTED: 49.80 },
    '16x80mm': { GREKO: 29.40, OTHER: 33.60, CPL02: 51.90, PAINTED: 74.40 },
  },
  kampukas: { GREKO: 7.50, OTHER: 9.00, CPL02: 9.00, PAINTED: 20.40 }, // "kampukas" 10x18, psl.185 (nėra atskiro CPL0,2 - naudojame OTHER); kiekis pasirenkamas atskirai
  electromagnetic: 93.00, // elektromagnetinė sklendė, universali kaina (psl. 155/157/185/187)
};

// GRINDJUOSTĖ (floor/threshold trim), ilgis 2,40 m, psl. 185. Bendras priedas —
// nepriklauso nuo staktos tipo, todėl klausiama paskutinė. Pataisyta 2026-08-20:
// "okleinuota"->Laminuota (visos GREKO/PREMIUM/CPL dekoro spalvos, kaina ta pati
// nepriklausomai nuo spalvos), "lakuota"->Dažyta (tik 2 spalvos: Balta Titano UV,
// Kašmiras Titano UV). Spalva pagal nutylėjimą seka staktos spalvą.
const FLOOR_TRIM_PRICE = { laminated: 14.40, painted: 29.40 };
const FLOOR_TRIM_PAINTED_COLORS = [['WHITE_TITAN', 'Balta Titano UV'], ['CASHMERE_TITAN', 'Kašmiras Titano UV']];

/* ==========================================================================
   Ventiliacija / rekuperacinis išpjovimas — pilnas sąrašas (psl. 153).
   Visos įvorės (bet kurios formos/spalvos) tos pačios kainos savo kategorijoje
   (patvirtinta užsakovo 2026-08-20). Grotelė — vienintelė su pločio apribojimu.
   ========================================================================== */
const VENTILATION_OPTIONS = [
  ['NONE', 'Be ventiliacijos opcijos', 0],
  ['RECUP_STD', 'Standartinis rekuperacinis išpjovimas (psl.153)', 9.60],
  ['RECUP_MINI', 'Mini rekuperacinis išpjovimas (psl.153)', 9.60],
  ['VENT_SLOT_STD', 'Standartinė ventiliacinė įpjova (psl.153)', 9.60],
  ['VENT_SLOT_MINI', 'Mini ventiliacinė įpjova (psl.153)', 9.60],
  ['PLASTIC_SLEEVE', 'Medienos imitacijos plastikinės įvorės (4 vnt.)', 7.20],
  ['ROUND_NICKEL', 'Apvalios įvorės (4vnt.) — šlifuotas nikelis', 37.20],
  ['ROUND_PATINA', 'Apvalios įvorės (4vnt.) — patina', 37.20],
  ['ROUND_WHITE', 'Apvalios įvorės (4vnt.) — balta', 37.20],
  ['ROUND_BLACK', 'Apvalios įvorės (4vnt.) — juoda', 37.20],
  ['SQUARE_NICKEL', 'Kvadratinės metalinės įvorės (4vnt.) — šlifuotas nikelis', 37.20],
  ['SQUARE_PATINA', 'Kvadratinės metalinės įvorės (4vnt.) — patina', 37.20],
  ['SQUARE_WHITE', 'Kvadratinės metalinės įvorės (4vnt.) — balta', 37.20],
  ['SQUARE_BLACK', 'Kvadratinės metalinės įvorės (4vnt.) — juoda', 37.20],
  ['GRILLE', 'Ventiliacinė grotelė (tik plotis 80, 90, 100)', 9.60],
];
const GRILLE_ALLOWED_WIDTHS = ['80', '90', '100']; // patvirtinta 2026-08-20, senasis sąrašas buvo teisingas

/* Spyna — tik aprašomasis pasirinkimas, BE PRIEMOKOS. Pataisyta 2026-08-20:
   NESIEJAME su varčios standartu (anksčiau siejome su PL/CZ — tai buvo klaida). */
/* SPYNOS (užsakovo lentelė 2026-09-15). Yra du spynų TIPAI — magnetinės ir su
   skląsčiu — ir kiekvienas galimas tik tam tikriems varčios tipams:

     Tipas        Spyna                                 Užl.  Lyg.  Rev.
     magnetinė    BSR-magnetinė spyna be skylės raktui   ne   taip  taip
     magnetinė    WC-magnetinė spyna                     ne   taip  taip
     magnetinė    WB — magnetinė cilindrinė spyna        ne   taip  taip
     su skląsčiu  BSR-spyna su skląsčiu be skylės raktui taip taip   ne
     su skląsčiu  WC spyna su skląsčiu-4mm(PL)           taip taip   ne
     su skląsčiu  WC spyna su skląsčiu-6mm(CZ)           taip taip   ne
     su skląsčiu  WB — cilindrinė spyna su skląsčiu      taip taip   ne

   Todėl sąrašas nebeskirstomas į REBATED/OTHER — kiekvienas varčios tipas
   turi savo rinkinį: užlaidinė 4, lygiabriaunė 7, reversinė 3.
   Galioja VISOSE linijose (STILE, dažytos, skydinės) — patvirtinta 2026-09-15.
   Visos nemokamos; „4mm(PL)" ir „6mm(CZ)" nuo varčios standarto NEPRIKLAUSO. */
const LOCK_MAGNETIC = [
  ['MAG_BSR', 'BSR-magnetinė spyna be skylės raktui'],
  ['MAG_WC',  'WC-magnetinė spyna'],
  ['MAG_WB',  'WB — magnetinė cilindrinė spyna'],
];
const LOCK_LATCH = [
  ['LATCH_BSR', 'BSR-spyna su skląsčiu be skylės raktui'],
  ['LATCH_WC4', 'WC spyna su skląsčiu-4mm(PL)'],
  ['LATCH_WC6', 'WC spyna su skląsčiu-6mm(CZ)'],
  ['LATCH_WB',  'WB — cilindrinė spyna su skląsčiu'],
];
const LOCK_OPTIONS = {
  REBATED:    LOCK_LATCH,
  FLUSH:      LOCK_MAGNETIC.concat(LOCK_LATCH),
  REVERSIBLE: LOCK_MAGNETIC,
};
// Spynos spalvos priemoka (9,60 €) kataloge skirta TIK magnetinei spynai
// („keitimas į magnetinę spyną juodos, baltos arba auksinės spalvos").
function lockIsMagnetic(lockCode) {
  return (lockCode || '').startsWith('MAG_');
}

/* Spynos ir furnitūros spalvos — ATSKIRTOS (2026-09-10 užsakovo nurodymas;
   atšaukiamas 2026-08-18 sujungimas į vieną 34,80 € eilutę).

   Lygiabriaunė / Reversinė (OTHER), katalogo psl. 9:
     Spynos spalva                             +9,60 €  (magnetinė spyna)
     Furnitūros spalva (vyriai + plokštelė)   +25,20 €
   Abu kartu = 34,80 € — tiek pat, kiek buvo sujungtoje eilutėje, tik dabar
   renkami nepriklausomai vienas nuo kito.

   Užlaidinė (REBATED) — NEKEIČIAMA: lieka viena sujungta eilutė „Juoda
   +25,20 €" (spyna + vyriai + plokštelė); baltos/auksinės kataloge nėra,
   spynos spalvos atskirai rinktis negalima. */
const LOCK_COLOR_OPTIONS = {
  REBATED: null, // užlaidinei neatskiriama — spyna įeina į furnitūros spalvą
  OTHER: [
    ['STANDARD', 'Standartinė (sidabrinė)', 0], ['BLACK', 'Juoda', 9.60],
    ['WHITE', 'Balta', 9.60], ['GOLD', 'Auksinė', 9.60],
  ],
};

// Furnitūros spalva: REBATED — spyna + vyriai + užrakinimo plokštelė;
// OTHER — TIK vyriai ir užrakinimo plokštelė (spyna turi savo lauką).
const HARDWARE_COLOR_OPTIONS = {
  REBATED: [['STANDARD', 'Standartinė (sidabrinė)', 0], ['BLACK', 'Juoda', 25.20]],
  OTHER: [
    ['STANDARD', 'Standartinė (sidabrinė)', 0], ['BLACK', 'Juoda', 25.20],
    ['WHITE', 'Balta', 25.20], ['GOLD', 'Auksinė', 25.20],
  ],
};

// Metaliniai vyrių dangteliai — tik Užlaidinei IR tik su standartine (sidabrine)
// furnitūra. Kaina visada už 3 vyrių komplektą (STILE užlaidinė = 3 vyriai).
const HINGE_CAP_UNIT_PRICE = 4.20;
const HINGE_CAP_HINGES_COUNT = 3;
const HINGE_CAP_OPTIONS = [
  ['NONE', 'Nereikia'], ['NICKEL', 'Šlifuotas nikelis'], ['PATINA', 'Patina'],
  ['CHROME', 'Blizgus chromas'], ['BRASS', 'Blizgus žalvaris'], ['WHITE', 'Balta'], ['BLACK', 'Juodi'],
];

// Vertikalūs rėmai iš klijuotos medienos — galioja VISOMS STILE šeimoms, VISIEMS
// varčios tipams; apribojimas tik pagal dekorą (patvirtinta 2026-08-20).
const VERTICAL_FRAME_PRICE = 34.20;
const VERTICAL_FRAME_ALLOWED_DECORS = ['PREMIUM_WHITE', 'PREMIUM_OAKNAT', 'PREMIUM_ASH', 'PREMIUM_MAPLE', 'CPL_OAK'];


// "UŽDEDAMA REGULIUOJAMA STAKTA PLIENINEI STAKTAI" — alternatyvus Reguliuojamos staktos
// variantas Užlaidinei varčiai, kai montuojama ant esamos plieninės staktos (psl. 182).
// Tik 2 kainų lygiai (GREKO / ST CPL ir PREMIUM — nėra atskiro CPL0,2/Dažytų stulpelio).
const STAKTA_STEEL_MOUNT = {
  widths: ['60', '70', '80', '90', '100'], // GALIMI PRISPAUDŽIAMŲ STAKTŲ PLOČIAI (siauresnis sąrašas nei įprastai)
  rows: [ // [diapazonas, GREKO, OTHER]
    ['80-100', 166.80, 193.80], ['100-120', 171.90, 198.90], ['120-140', 178.80, 206.40],
    ['140-160', 188.70, 216.30], ['160-180', 198.90, 226.50], ['180-200', 213.60, 240.90],
    ['200-220', 228.60, 255.90], ['220-240', 238.80, 265.80], ['240-260', 248.40, 276.00],
    ['260-280', 258.30, 285.90], ['280-300', 267.90, 295.50], ['300-320', 277.80, 305.70],
    ['320-340', 288.30, 315.90], ['340-360', 298.20, 325.80], ['360-380', 308.10, 335.40],
    ['380-400', 322.80, 350.70], ['400-420', 338.10, 365.40], ['420-440', 352.80, 380.40],
  ],
};

function staktaAdjustableTier(decorCode) {
  const g = (decorCode || '').split('_')[0];
  if (g === 'GREKO') return 'GREKO';
  // Dažytai varčiai stakta taip pat dažoma — kataloge tai „LAKUOTOS" stulpelis
  // (psl. 183, 184, 185, 186–187). Kainos lentelėse jau buvo, tik iki šiol
  // nepasiekiamos, nes nė vienas dekoras nebuvo dažytas.
  if (g === 'PAINTED') return 'PAINTED';
  // Užsakovo patikslinimas: staktoms CPL 0,7mm negalimos — CPL varčios spalvai stakta
  // visada gaminama CPL 0,2mm danga (ta pati spalva, plonesnė plėvelė).
  if (g === 'CPL02' || g === 'CPL07') return 'CPL02'; // skydinių CPL varčios danga
  if (g === 'CPL') return 'CPL02';
  return 'OTHER'; // PREMIUM
}




const WIDTHS = ['60','65','70','75','80N','80','85','90','95','100'];

// RANKENOS (door handles), katalogas psl. 138-139 (pradinis rinkinys, kaip
// sutarta su užsakovu 2026-08-21). Kiekviena rankena turi bazinę kainą pagal
// apdailą, ir (jei plateSystem != 'none') skydo plokštelės kainą, kuri
// PRIKLAUSO nuo pasirinktos spynos (LOCK): BSR (be rakto) -> WC tipo
// plokštelė (be skylės raktui), WC4/WC6 -> plokštelė raktui, WB (cilindrinė)
// -> plokštelė cilindrui. Tai išvedama automatiškai, atskiro pasirinkimo
// nereikia. NOVA CLICK / TOPAZ CLICK turi kairę/dešinę versiją, kuri pagal
// nutylėjimą seka durų atidarymo kryptį (DIRECTION) — žr. katalogo psl. 149.
const HANDLE_FAMILIES = [
  { key: 'NONE', name: 'Nereikia rankenos', hasLR: false, plateSystem: 'none',
    finishes: [['NONE', '—', 0]] },
  { key: 'NOVA_CLICK', name: 'NOVA CLICK', hasLR: true, plateSystem: 'none',
    finishes: [['INOX', 'Inox', 65.10], ['BLACK_MATTE', 'Juodas matinis', 65.10]] },
  { key: 'TOPAZ_CLICK', name: 'TOPAZ CLICK', hasLR: true, plateSystem: 'none',
    finishes: [['INOX', 'Inox', 65.10], ['BLACK_MATTE', 'Juodas matinis', 65.10]] },
  { key: 'CORONA_TIME_SLIM_R', name: 'CORONA Time Slim R', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BRASS_MATTE', 'Matinis žalvaris', 128.40, { key: 25.50, cyl: 25.50, wc: 36.60 }],
      ['GUNMETAL', 'Gunmetal', 128.40, { key: 25.50, cyl: 25.50, wc: 36.60 }],
      ['BLACK_MATTE', 'Juodas matinis', 109.80, { key: 22.20, cyl: 22.20, wc: 33.30 }],
    ] },
  { key: 'CORONA_IMPERA_RT', name: 'CORONA Impera RT', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 135.60, { key: 22.20, cyl: 18.30, wc: 36.60 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 135.60, { key: 22.20, cyl: 18.30, wc: 36.60 }],
      ['NICKEL_MATTE', 'Matinė šlifuota nikelio danga', 135.60, { key: 22.20, cyl: 18.30, wc: 36.60 }],
      ['BLACK_MATTE', 'Juodas matinis', 135.60, { key: 22.20, cyl: 18.30, wc: 36.60 }],
      ['COPPER_GLOSS', 'Blizganti vario danga', 146.70, { key: 22.20, cyl: 22.20, wc: 43.80 }],
      ['WHITE_MATTE', 'Balta matinė danga', 146.70, { key: 22.20, cyl: 22.20, wc: 43.80 }],
    ] },
  { key: 'CORONA_ARROW_R', name: 'CORONA Arrow R', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 58.20, { key: 16.20, cyl: 16.20, wc: 29.40 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 58.20, { key: 16.20, cyl: 16.20, wc: 29.40 }],
      ['BLACK_MATTE', 'Juodas matinis', 58.20, { key: 16.20, cyl: 16.20, wc: 29.40 }],
      ['WHITE_MATTE', 'Balta matinė danga', 69.00, { key: 22.20, cyl: 22.20, wc: 36.60 }],
    ] },
  { key: 'CORONA_ARROW_Q', name: 'CORONA Arrow Q', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 61.80, { key: 18.30, cyl: 18.30, wc: 31.20 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 61.80, { key: 18.30, cyl: 18.30, wc: 31.20 }],
      ['BLACK_MATTE', 'Juodas matinis', 61.80, { key: 18.30, cyl: 18.30, wc: 31.20 }],
      ['WHITE_MATTE', 'Balta matinė danga', 72.90, { key: 21.90, cyl: 22.20, wc: 36.60 }],
    ] },
  { key: 'CORONA_MOON_R_SLIM', name: 'CORONA Moon R Slim', hasLR: false, plateSystem: 'dual',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 83.70, { keyOrCyl: 22.20, wc: 33.30 }],
      ['BLACK_MATTE', 'Juodas matinis', 83.70, { keyOrCyl: 22.20, wc: 33.30 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 98.70, { keyOrCyl: 25.50, wc: 36.60 }],
      ['BRASS_MATTE', 'Matinė žalvario danga', 98.70, { keyOrCyl: 25.50, wc: 36.60 }],
    ] },

  /* Psl. 140 – psl. 147 vidurio (2026-09-23, užsakovo patvirtinta „realizuojam").
     Toliau iki psl. 148 einanti „ilgo skydelio" (ilgas skydelis) sekcija — įskaitant
     jau anksčiau perbrauktą HERSE SET/HERSE LUX SET/HERSE MAX SET bloką —
     SĄMONINGAI neįtraukta: užsakovas patvirtino „Laikome neaktualia", nes ilgas
     skydelis labiau būdingas įėjimo/priešgaisrinėms durims, kurių šis įrankis
     dar neapima (žr. PENDING_FAMILIES). */
  { key: 'QUANTA_FIT', name: 'QUANTA FIT', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
      ['NICKEL_MATTE', 'Šlifuota nikelio danga', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
      ['BRASS_GLOSS', 'Šlifuota žalvario danga', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
    ] },
  { key: 'DIVA_FIT', name: 'DIVA FIT', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['NICKEL_MATTE', 'Šlifuota nikelio danga', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
      ['BRASS_GLOSS', 'Šlifuota žalvario danga', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
    ] },
  { key: 'ZOJA_FIT', name: 'ZOJA FIT', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['NICKEL_MATTE', 'Šlifuota nikelio danga', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
      ['BRASS_GLOSS', 'Šlifuota žalvario danga', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
    ] },
  { key: 'TORA_FIT', name: 'TORA FIT', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.60, cyl: 12.60, wc: 16.50 }],
    ] },
  { key: 'BELLA_SLIM_KVADRAT', name: 'BELLA SLIM kvadratas', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_SATIN', 'Satininė žalvario danga', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BLACK_MATTE', 'Juoda matinė danga', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
    ] },

  { key: 'CUBE_SLIM', name: 'CUBE SLIM', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 48.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 48.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 48.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_SATIN', 'Satininė žalvario danga', 48.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BLACK_MATTE', 'Juoda matinė danga', 48.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
    ] },
  { key: 'CUBE', name: 'CUBE', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 40.20, { key: 13.50, cyl: 13.50, wc: 24.00 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 40.20, { key: 13.50, cyl: 13.50, wc: 24.00 }],
      ['NICKEL_MATTE', 'Matinė šlifuota nikelio danga', 40.20, { key: 13.50, cyl: 13.50, wc: 24.00 }],
      ['BLACK_MATTE', 'Juoda matinė', 40.20, { key: 13.50, cyl: 13.50, wc: 24.00 }],
    ] },
  { key: 'CUBE_PREMIUM', name: 'CUBE PREMIUM', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 52.20, { key: 15.30, cyl: 15.30, wc: 26.40 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 52.20, { key: 15.30, cyl: 15.30, wc: 26.40 }],
      ['NICKEL_MATTE', 'Matinė šlifuota nikelio danga', 52.20, { key: 15.30, cyl: 15.30, wc: 26.40 }],
      ['BLACK_MATTE', 'Juoda matinė', 52.20, { key: 15.30, cyl: 15.30, wc: 26.40 }],
    ] },

  { key: 'OLIWIA_R', name: 'OLIWIA R', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 59.70, { key: 13.50, cyl: 13.50, wc: 18.90 }],
      ['BLACK_MATTE', 'Juodas matinis', 59.70, { key: 13.50, cyl: 13.50, wc: 18.90 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 66.90, { key: 17.40, cyl: 17.40, wc: 22.20 }],
    ] },
  { key: 'LAURA_R', name: 'LAURA R', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 36.00, { key: 13.50, cyl: 13.50, wc: 18.90 }],
      ['BLACK_MATTE', 'Juodas matinis', 36.00, { key: 13.50, cyl: 13.50, wc: 18.90 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 42.90, { key: 17.40, cyl: 17.40, wc: 22.20 }],
    ] },
  { key: 'JULIA_R', name: 'JULIA R', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 44.40, { key: 13.50, cyl: 13.50, wc: 24.00 }],
      ['BLACK_MATTE', 'Juodas matinis', 44.40, { key: 13.50, cyl: 13.50, wc: 24.00 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 54.90, { key: 13.50, cyl: 13.50, wc: 24.00 }],
    ] },
  { key: 'NOVA', name: 'NOVA', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BRASS_MATTE', 'Matinis PVD žalvaris', 32.70, { key: 12.60, cyl: 12.60, wc: 27.30 }],
      ['BLACK_MATTE', 'Juodas matinis', 27.30, { key: 12.60, cyl: 12.60, wc: 27.30 }],
    ] },
  { key: 'JOWISZ', name: 'JOWISZ', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BLACK_MATTE', 'Juodas matinis', 19.80, { key: 9.60, cyl: 9.60, wc: 24.00 }],
    ] },

  { key: 'RUMBA_K_FIT', name: 'RUMBA K FIT', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BRASS_MATTE', 'Matinis žalvaris', 22.50, { key: 12.60, cyl: 12.60, wc: 16.50 }],
    ] },
  { key: 'LUNA_SLIM_PREMIUM_KVADRATAS', name: 'LUNA SLIM PREMIUM kvadratas', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 40.20, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 40.20, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 40.20, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BLACK_MATTE', 'Juodas matinis', 40.20, { key: 15.90, cyl: 15.90, wc: 26.40 }],
    ] },
  { key: 'BELLA_SLIM_APVALI', name: 'BELLA SLIM apvali', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_SATIN', 'Satininė žalvario danga', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BLACK_MATTE', 'Juodas matinis', 44.10, { key: 15.90, cyl: 15.90, wc: 26.40 }],
    ] },
  { key: 'LUNA_SLIM_PREMIUM_APVALI', name: 'LUNA SLIM PREMIUM apvali', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 36.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['CHROME_MATTE', 'Matinė šlifuota chromo danga', 36.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 36.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
      ['BLACK_MATTE', 'Juodas matinis', 36.00, { key: 15.90, cyl: 15.90, wc: 26.40 }],
    ] },

  { key: 'DECO', name: 'DECO', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['DECO_DARKOAK', 'Dekoras tamsus ąžuolas GRECO', 36.00, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['DECO_BLACK', 'Dekoras juodas', 36.00, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['DECO_WHITE', 'Dekoras balta GRECO', 36.00, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['DECO_SONOMA', 'Dekoras sonoma GRECO', 36.00, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['DECO_WALNUT', 'Dekoras riešutas GRECO', 36.00, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['DECO_OAK', 'Dekoras ąžuolas GRECO', 36.00, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },
  { key: 'IBIZA', name: 'IBIZA', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['GRAPHITE_CHROME', 'Grafitas/chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['NICKEL_SATIN', 'Nikelis satinas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['WHITE_MATTE', 'Balta matinė danga', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },
  { key: 'LINEA', name: 'LINEA', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_GLOSS', 'Blizgantis chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['GRAPHITE_CHROME', 'Grafitas/chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['NICKEL_SATIN', 'Nikelis satinas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },
  { key: 'TREND', name: 'TREND', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['NICKEL_SATIN', 'Nikelis satinas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['GRAPHITE_CHROME', 'Grafitas/chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['CHROME_GLOSS', 'Blizgantis chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },

  { key: 'QUBIK', name: 'QUBIK', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['NICKEL_VELVET', 'Nikelis velvet', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['CHROME_GLOSS', 'Blizgantis chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['WHITE_MATTE', 'Balta matinė danga', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['BRASS_GLOSS', 'Blizganti žalvario danga', 25.50, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },
  { key: 'BARCELONA', name: 'BARCELONA', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['NICKEL_VELVET', 'Nikelis velvet', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['CHROME_GLOSS', 'Blizgantis chromas', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
      ['NICKEL_MATTE', 'Šlifuota nikelio danga', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },
  { key: 'RUMBA_K', name: 'RUMBA K', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BLACK_MATTE', 'Juodas matinis', 22.20, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },
  { key: 'SCALA_RT_SLIM', name: 'SCALA RT SLIM', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['NICKEL_SATIN', 'Nikelis satinas', 54.90, { key: 15.90, cyl: 15.90, wc: 25.80 }],
      ['BRASS_SATIN', 'Satininė žalvario danga', 54.90, { key: 15.90, cyl: 15.90, wc: 25.80 }],
      ['BLACK_MATTE', 'Juodas matinis', 54.90, { key: 15.90, cyl: 15.90, wc: 25.80 }],
    ] },
  { key: 'ELEGANZA_K_FIT', name: 'ELEGANZA K FIT', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BLACK_GOLD', 'Juoda matinė, auksinė intarpa', 28.20, { key: 12.90, cyl: 12.90, wc: 18.30 }],
      ['BLACK_COPPER', 'Juoda matinė, varinė intarpa', 28.20, { key: 12.90, cyl: 12.90, wc: 18.30 }],
    ] },

  { key: 'MONDO', name: 'MONDO', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['NICKEL_SATIN', 'Nikelis satinas', 17.40, { key: 12.00, cyl: 12.00, wc: 15.90 }],
    ] },
  { key: 'ERKADO_TOPAZ', name: 'ERKADO TOPAZ', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['BLACK_MATTE', 'Juodas matinis', 34.20, { key: 12.00, cyl: 12.00, wc: 24.00 }],
    ] },

  /* ERKADO inox grupė (11 modelių, psl. 146) — visi tik vienos (inox)
     apdailos, todėl skiriasi ne apdaila, o pati plokštelė: apvali (pigesnė)
     modeliams su „apvali" pavadinime, kvadratinė (brangesnė) modeliams su
     „kvadratinė" arba be jokio priedo. Patvirtinta su užsakovu 2026-09-23. */
  { key: 'SAPPHIRE_INOX', name: 'SAPPHIRE inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 18.30, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },
  { key: 'SUPRA_APVALI_INOX', name: 'SUPRA apvali inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 20.70, { key: 3.90, cyl: 3.90, wc: 10.20 }]] },
  { key: 'PROXIMA_APVALI_INOX', name: 'PROXIMA apvali inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 18.30, { key: 3.90, cyl: 3.90, wc: 10.20 }]] },
  { key: 'TOPAZ_INOX', name: 'TOPAZ inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 15.90, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },
  { key: 'METRO_INOX', name: 'METRO inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 20.40, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },
  { key: 'PROXIMA_KVADRATINE_INOX', name: 'PROXIMA kvadratinė inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 18.30, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },
  { key: 'NOVA_APVALI_INOX', name: 'NOVA apvali inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 12.00, { key: 3.90, cyl: 3.90, wc: 10.20 }]] },
  { key: 'ONYX_INOX', name: 'ONYX inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 20.40, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },
  { key: 'NOVA_KVADRATINE_INOX', name: 'NOVA kvadratinė inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 15.90, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },
  { key: 'JOWISZ_INOX', name: 'JOWISZ inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 12.00, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },
  { key: 'ROMA_INOX', name: 'ROMA inox', hasLR: false, plateSystem: 'triple',
    finishes: [['INOX', 'Inox', 22.20, { key: 6.90, cyl: 6.90, wc: 12.00 }]] },

  { key: 'CAMILA', name: 'CAMILA', hasLR: false, plateSystem: 'triple',
    finishes: [
      ['CHROME_MATTE', 'Chromo satinas', 13.50, { key: 6.30, cyl: 6.30, wc: 10.20 }],
      ['BLACK_MATTE', 'Juodas matinis', 18.90, { key: 10.20, cyl: 10.20, wc: 15.30 }],
    ] },
];
// Spynos šeima iš kodo: BSR / WC / WB (nepriklausomai nuo magnetinė ar skląsčio)
function lockKind(lock) {
  const c = lock || '';
  if (c.includes('WB')) return 'WB';
  if (c.includes('WC')) return 'WC';
  if (c.includes('BSR')) return 'BSR';
  return 'WC';
}
function handlePlateNeed(lock) {
  const k = lockKind(lock);
  if (k === 'WB') return 'cyl';
  if (k === 'BSR') return 'wc';
  return 'cyl';
}
// Apyraktis (skydelis) — visada 3 pasirinkimai (Nereikia / cilindrui WB / WC),
// numatytoji tvarka priklauso nuo pasirinktos spynos, bet renkasi pats
// vartotojas (patikslinta 2026-08-20). "Raktui" tipo apyraktis nebesiūlomas.
function handlePlateChoiceOrder(lock) {
  const k = lockKind(lock);
  if (k === 'WB') return ['CYL', 'WC', 'NONE'];
  if (k === 'WC') return ['WC', 'NONE', 'CYL'];
  return ['NONE', 'CYL', 'WC']; // BSR
}
const HANDLE_PLATE_LABELS = { NONE: 'Nereikia', CYL: 'Apyraktis cilindrui WB', WC: 'Apyraktis WC' };


// GREKO / PREMIUM / CPL spalvos — bendras dekorų žodynas (katalogo psl. 4)
const DECOR = {
  GREKO: [
    ['GREKO_WALNUT','Riešutas GREKO'],['GREKO_DARKOAK','Tamsus ąžuolas GREKO'],
    ['GREKO_GOLDOAK','Auksinis ąžuolas GREKO'],['GREKO_OAK','Ąžuolas GREKO'],
    ['GREKO_GREYOAK','Pilkas ąžuolas GREKO'],['GREKO_SONOMA','Sonoma GREKO'],
    ['GREKO_ACACIA','Šviesioji akacija GRECO'],['GREKO_WHITE','Balta GREKO'],
    ['GREKO_SNOW','Sniego balta GREKO'],
  ],
  PREMIUM: [
    ['PREMIUM_OAKNAT','Natūralus ąžuolas PREMIUM'],['PREMIUM_OAK','Ąžuolas PREMIUM'],
    ['PREMIUM_ASH','Uosis grafitas PREMIUM'],['PREMIUM_MAPLE','Pilkas klevas PREMIUM'],
    ['PREMIUM_WHITETEX','Balta tekstūra PREMIUM'],['PREMIUM_WHITE','Balta PREMIUM'],
    ['PREMIUM_WALNUTCL','Riešutas classic PREMIUM'],
    // Tik skydinėse duryse (psl. 109) — STILE linijoje šių dekorų nėra
    ['PREMIUM_CONCRETE','Betonas PREMIUM'],
    ['PREMIUM_OAKCROSS','Natūralus skersinis ąžuolas PREMIUM'],
  ],
  CPL: [
    ['CPL_WENGE','Wenge dark ST CPL'],['CPL_OAK','Ąžuolas ST CPL'],
    ['CPL_GREYOAK','Pilkas ąžuolas ST CPL'],['CPL_ANTHRACITE','Antracitas ST CPL'],
    ['CPL_BLACK','Juoda ST CPL'],['CPL_DARKGREEN','Tamsiai žalia ST CPL'],
    ['CPL_CAPPUCCINO','Cappuccino ST CPL'],['CPL_WHITE','Balta ST CPL'],
    ['CPL_LIGHTGREY','Šviesiai pilka ST CPL'],['CPL_GREY','Pilka ST CPL'],
    ['CPL_SAGE','Šalavijas ST CPL'],['CPL_STONEGREY','Akmens pilkumo ST CPL'],
  ],
  /* CPL 0,2 — varčios danga, naudojama tik skydinėse duryse (psl. 109).
     Nepainioti su tuo pačiu pavadinimu vadinamu STAKTOS kainų lygiu: stakta
     CPL 0,2 danga gaminama ir ST CPL spalvos varčioms. */
  CPL02: [
    ['CPL02_GREY','Pilka CPL 0,2'],['CPL02_OAKRETRO','Ąžuolas retro CPL 0,2'],
    ['CPL02_OAKCLASSIC','Ąžuolas classic CPL 0,2'],['CPL02_ANTHSATIN','Antracitas satinas CPL 0,2'],
    ['CPL02_WALNUTCL','Riešutas classic CPL 0,2'],['CPL02_WHITE','Balta CPL 0,2'],
  ],
  /* CPL 0,7 — storesnė CPL danga, kataloge žymima „0,2 ir 0,7" (psl. 4).
     Naudojama skydinėse (ALTAMURA psl. 113) kaip atskira kainų pakopa. */
  CPL07: [
    ['CPL07_GREY','Pilka CPL 0,7'],['CPL07_OAKRETRO','Ąžuolas retro CPL 0,7'],
    ['CPL07_OAKCLASSIC','Ąžuolas classic CPL 0,7'],['CPL07_WALNUTCL','Riešutas classic CPL 0,7'],
    ['CPL07_WHITE','Balta CPL 0,7'],
  ],
  // Dažytos durys — visa paletė, psl. 4 blokas „LAKUOTOS UV". Tik dvi spalvos,
  // ir bazinė varčios kaina nuo spalvos NEPRIKLAUSO (patikrinta psl. 74, 84).
  // Tos pačios dvi spalvos naudojamos ir dažytai grindjuostei (psl. 185).
  PAINTED: [
    ['PAINTED_WHITETITAN','Balta Titano UV'],
    ['PAINTED_CASHMERETITAN','Kašmiras Titano UV'],
  ],
};

function decorGroupOptions(groups, exclude) {
  exclude = exclude || [];
  const out = [];
  groups.forEach(g => (DECOR[g] || []).forEach(([code, name]) => {
    if (!exclude.includes(code)) out.push([code, name, g]);
  }));
  return out;
}

/* ==========================================================================
   DEKORŲ AUDITAS (2026-09-08, 1 etapas) — visos 31 STILE šeima patikrintos
   katalogo vaizde. Paaiškėjo, kad yra tik 4 skirtingos kombinacijos:

   [A] GREKO 8 / PREMIUM 7 / CPL 12  — be „Šviesioji akacija GRECO"
   [B] —       / PREMIUM 7 / CPL 12
   [C] —       / PREMIUM 6 / —       — be „Balta PREMIUM"
   [D] GREKO 7 / PREMIUM 7 / CPL 12  — be „Šviesioji akacija" ir „Auksinis ąžuolas"

   Svarbu: „Šviesioji akacija GRECO" (GREKO_ACACIA) NETAIKOMA nė vienai STILE
   šeimai — kataloge ji yra tik psl. 113–121, visai kitoje produktų linijoje.
   ========================================================================== */
const DECOR_COMBOS = {
  A: { GREKO: ['GREKO_ACACIA'], PREMIUM: [], CPL: [] },                 // ką IŠIMTI iš pilno sąrašo
  B: { noGreko: true, GREKO: [], PREMIUM: [], CPL: [] },
  C: { noGreko: true, noCpl: true, GREKO: [], PREMIUM: ['PREMIUM_WHITE'], CPL: [] },
  D: { GREKO: ['GREKO_ACACIA', 'GREKO_GOLDOAK'], PREMIUM: [], CPL: [] },
};
const FAMILY_DECOR_COMBO = {
  // [A] — 17 šeimų
  PEONIA:'A', AMARYLIS:'A', MISKANT:'A', MAGNOLIA:'A', EPIMEDIUM:'A', JUKA:'A', FORSYCJA:'A',
  LAWENDA:'A', IRYS:'A', BERBERYS:'A', FLOKS:'A', KROKUS:'A', KAMELIA:'A', PETUNIA:'A',
  AZALIA:'A', HIACYNT:'A', FRAGI:'A',
  // [B] — 7 šeimos
  WERBENA:'B', LAURENCJA:'B', JASMIN:'B', BUDLEJA:'B', POWOJNIK:'B', LUKRECJA:'B', SURMIA:'B',
  // [C] — 3 šeimos
  ARALIA:'C', NOLINA:'C', EWODIA:'C',
  // [D] — 4 šeimos
  FREZJA:'D', NEMEZJA:'D', DAGLEZJA:'D', DEBECJA:'D',
};

// Dekorai, kurie kataloge egzistuoja TIK skydinėse duryse (psl. 109)
const PANEL_ONLY_DECORS = ['PREMIUM_CONCRETE', 'PREMIUM_OAKCROSS'];

function decorsForFamily(familyLabel) {
  const combo = DECOR_COMBOS[FAMILY_DECOR_COMBO[familyLabel] || 'A'];
  const groups = ['GREKO', 'PREMIUM', 'CPL'].filter(g =>
    !(g === 'GREKO' && combo.noGreko) && !(g === 'CPL' && combo.noCpl));
  const exclude = [].concat(combo.GREKO || [], combo.PREMIUM || [], combo.CPL || [], PANEL_ONLY_DECORS);
  return decorGroupOptions(groups, exclude);
}

/* Kiekviena šeima: doorTypes (kurie varčios tipai galimi), models (numeriai),
   basePrice(modelNo, decorGroup) — kaina be PVM, decorOptions, glass — stiklo
   pasirinkimo logika (žr. skirtingus glass.mode variantus žemiau), notes. */
const FAMILIES = {

  WERBENA: {
    label: 'WERBENA', pages: '6–7', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    models: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    glazed: [4, 5, 6, 7, 8, 9], decorativeGlass: [7, 8, 9],
    basePrice: (n) => ([4, 5, 6].includes(n) ? 415.50 : 348.90),
    decorOptions: decorsForFamily('WERBENA'),
    glass: {
      mode: 'choice-flat',
      matte: 127.50, dark: 174.30, decorativeOnly: [7, 8, 9],
    },
    note: (n) => (n <= 3 ? 'Aklinas modelis, 16 mm MDF panelis su plona įstrižine juostele.'
      : n <= 6 ? 'Stiklinamas modelis, 3 mm HDF panelis klijuojamas ant stiklo. Panelio briauna visada juoda.'
        : 'Stiklinamas modelis; galimas relief / point dekoratyvinis stiklas.'),
  },

  LAURENCJA: {
    label: 'LAURENCJA', pages: '8–9', doorTypes: ['REBATED', 'FLUSH'],
    models: [1, 2, 3, 4, 5, 6],
    glazed: [], decorativeGlass: [],
    basePrice: () => 249.00,
    decorOptions: decorsForFamily('LAURENCJA'),
    // Pataisyta 2026-09-11: čia buvo mode:'none', nors LAURENCJA TURI stiklo
    // juosteles (VSG 221, kaina pagal juostelių skaičių — žr. glass.js).
    // Variklis nuo v18 ima stiklą iš glass.js, todėl skaičiavimas buvo teisingas,
    // bet šis įrašas klaidino skaitant kodą.
    glass: { mode: 'from-glass-js' },
    note: () => 'Aklinas modelis su plačia (35 mm) skersine juosta.',
  },

  FREZJA: {
    label: 'FREZJA', pages: '10–11', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    // Pataisyta 2026-09-07: modelių sąrašas buvo klaidingas ([...,8,9] vietoj [...,7,8]).
    // Katalogo psl. 10 tinklelyje yra modeliai 1–8. Stiklo kaina kataloge nurodyta
    // tik modeliams 1, 3, 5 — modeliai 7 (tik veidrodis) ir 8 (8 mm stiklas) turi
    // stiklinimą jau įskaičiuotą, be pasirinkimo.
    models: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    glazed: [1, 3, 5, 9], decorativeGlass: [1, 3, 5, 9],
    // FREZJA 9 — atskira kaina 359,70 € (katalogas psl. 11) ir galimas TIK
    // PREMIUM bei CPL dekorams (patvirtinta 2026-09-08).
    basePrice: (n, decorCode) => {
      if (n === 9) return 359.70;
      return decorCode && decorCode.startsWith('GREKO') ? 233.40 : 259.20;
    },
    modelDecorGroups: { 9: ['PREMIUM', 'CPL'] },
    decorOptions: decorsForFamily('FREZJA'),
    glass: {
      mode: 'choice-by-model',
      table: {
        1: { matte: 30.90, dark: 42.30 },
        3: { matte: 127.50, dark: 174.30 },
        5: { matte: 15.30, dark: 21.30 },
        9: { matte: 127.50, dark: 174.30 },
      },
    },
    note: (n) => ({
      1: 'Stiklinamas modelis su siaura vertikalia stiklo juosta.',
      2: 'Aklinas modelis.',
      3: 'Stiklinamas modelis su dideliu stiklo langu.',
      4: 'Aklinas modelis.',
      5: 'Stiklinamas modelis su siaura vertikalia stiklo juosta.',
      6: 'Aklinas modelis.',
      7: 'Modelis tik su veidrodžiu; kita pusė – plokštė apklijuota pasirinktu dekoru (aversas – veidrodis iš vyrių pusės). Stiklinimas įskaičiuotas.',
      8: '8 mm storio stiklas, įskaičiuotas; ventiliacinė įpjova galima šiam modeliui.',
      9: '3 mm storio HDF plokštė klijuojama iš abiejų pusių ant stiklo; plokštės briauna visada juodos spalvos. Galimi tik PREMIUM ir CPL dekorai.',
    }[n] || 'Stiklinamas modelis, panelio briauna visada juoda.'),
  },

  JASMIN: {
    label: 'JASMIN', pages: '12–13', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    models: [1, 2, 3, 4, 5, 6, 7, 8],
    glazed: [1, 2, 3, 4, 5, 6, 7, 8], decorativeGlass: [],
    basePrice: () => 382.20,
    decorOptions: decorsForFamily('JASMIN'),
    glass: { mode: 'choice-flat', matte: 127.50, dark: 174.30, decorativeOnly: [] },
    note: (n) => (n >= 5 ? 'Nuotraukoje 80 cm pločio varčia; kituose pločiuose stiklo proporcijos gali skirtis.'
      : 'Stiklinamas modelis su vienu didesniu stiklo langu.'),
  },

  NEMEZJA: {
    label: 'NEMEZJA', pages: '14–15', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    // NEMEZJA 14 kataloge rodomas tik didžiojoje nuotraukoje (psl. 14), modelių
    // tinklelyje jo nėra — todėl anksčiau buvo praleistas. Pridėtas 2026-09-11
    // užsakovo nurodymu; tai aklinas vienos plokštės modelis, o NEMEZJA bazinė
    // kaina nuo modelio nepriklauso, todėl kainodara nesikeičia.
    models: [4, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16],
    glazed: [4, 7, 9, 10, 11, 15], decorativeGlass: [4, 7, 11, 15],
    basePrice: (n, decorCode) => (decorCode && decorCode.startsWith('GREKO') ? 231.90 : 261.60),
    decorOptions: decorsForFamily('NEMEZJA'),
    glass: {
      mode: 'choice-by-model',
      table: {
        4: { matte: 76.80, dark: 104.70 }, 7: { matte: 87.00, dark: 118.80 },
        9: { matte: 83.40, dark: 142.80 }, 10: { matte: 21.00, dark: 28.20 },
        11: { matte: 76.80, dark: 104.70 }, 15: { matte: 102.60, dark: 171.30 },
      },
    },
    note: (n) => (n === 16 ? 'NEMEZJA 16 kataloge turi tiesios plokštės variantą.'
      : [4, 7, 9, 10, 11, 15].includes(n) ? 'Stiklinamas modelis.' : 'Aklinas modelis.'),
  },

  PEONIA: {
    label: 'PEONIA', pages: '16–17', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    models: [1, 2, 3, 4, 5, 6],
    glazed: [1, 2, 3, 4, 5, 6], decorativeGlass: [1, 2],
    basePrice: (n, decorCode) => (decorCode && decorCode.startsWith('GREKO') ? 333.60 : 359.70),
    decorOptions: decorsForFamily('PEONIA'),
    glass: {
      mode: 'choice-by-model',
      table: {
        1: { matte: 87.00, dark: 118.80 }, 2: { matte: null, dark: 118.80 },
        3: { matte: 76.80, dark: 104.70 }, 4: { matte: 76.80, dark: 104.70 },
        5: { matte: 76.80, dark: 104.70 }, 6: { matte: 76.80, dark: 104.70 },
      },
    },
    note: () => 'Stiklinamas modelis su dekoratyvine karūna ir apvadinėmis juostelėmis.',
  },

  AMARYLIS: {
    label: 'AMARYLIS', pages: '18–19', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    models: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    glazed: [1, 2, 3, 4, 5, 6, 7, 8, 9], decorativeGlass: [],
    basePrice: (n, decorCode) => (decorCode && decorCode.startsWith('GREKO') ? 333.60 : 359.70),
    decorOptions: decorsForFamily('AMARYLIS'),
    glass: { mode: 'choice-flat', matte: 127.50, dark: 174.30, decorativeOnly: [] },
    note: () => 'Daugiastiklė (grid) varčia su dvipusiu klijuojamu šprosu.',
  },

  MISKANT: {
    label: 'MISKANT', pages: '20–21', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    models: [1, 2, 3, 4, 5, 6],
    glazed: [1, 2, 3, 4, 5, 6], decorativeGlass: [],
    basePrice: (n, decorCode) => (decorCode && decorCode.startsWith('GREKO') ? 261.60 : 291.60),
    decorOptions: decorsForFamily('MISKANT'),
    glass: {
      mode: 'fixed-plus-upgrade',
      fixedNote: (n) => (n % 2 === 0 ? 'įskaičiuotas pieniškas stiklas' : 'įskaičiuotas skaidrus stiklas'),
      upgradeName: 'VSG stiklas su vidine aplikacija (juoda/balta)', upgradePrice: 308.10,
    },
    note: () => 'Juodos linijos (18 mm), dažytos šilkografijos technologija vienoje stiklo pusėje.',
  },

  SURMIA: {
    label: 'SURMIA', pages: '44–45', doorTypes: ['REBATED', 'FLUSH'],
    models: [1, 2, 3, 4],
    glazed: [1, 2, 3, 4], decorativeGlass: [],
    basePrice: () => 251.40,
    decorOptions: decorsForFamily('SURMIA'),
    glass: { mode: 'choice-flat-unit', matte: 9.90, dark: 13.20, decorativeOnly: [] },
    note: () => 'Siaura vertikali stiklo juosta. BALTA PREMIUM ir BALTA ST CPL šiai šeimai netaikoma.',
  },

  KROKUS: {
    label: 'KROKUS', pages: '48–49', doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    models: [1, 2, 3, 4, 5, 6],
    glazed: [1, 2, 3, 4, 5, 6], decorativeGlass: [],
    basePrice: (n, decorCode) => (decorCode && decorCode.startsWith('GREKO') ? 213.00 : 228.30),
    decorOptions: decorsForFamily('KROKUS'),
    glass: {
      mode: 'fixed-plus-upgrade',
      fixedNote: () => 'įskaičiuotas grūdintas pieno baltumo stiklas',
      upgradeName: 'VSG 221 stiklas (saugus)', upgradePrice: 30.90, upgradeDarkPrice: 42.30,
    },
    note: () => 'Trys horizontalūs stiklo langai, aliuminio intarpas.',
  },
};

// Katalogo psl. 6-21,44-49 pastaba: reversinei varčiai kai kuriose šeimose
// leidžiama tik ribotas dekorų sąrašas. Patikrinta ir taikoma šioms šeimoms;
// PEONIA/SURMIA/LAURENCJA tokios pastabos neturi (SURMIA/LAURENCJA reversinės
// visai neturi, PEONIA leidžia visus dekorus).
const REVERSIBLE_DECOR_WHITELIST = ['PREMIUM_WHITE', 'PREMIUM_OAKNAT', 'CPL_WHITE', 'CPL_CAPPUCCINO', 'CPL_OAK'];
Object.entries(FAMILIES).forEach(([key, f]) => {
  if (f.doorTypes.includes('REVERSIBLE') && key !== 'PEONIA') {
    f.reversibleDecorWhitelist = REVERSIBLE_DECOR_WHITELIST;
  }
});

const FAMILY_ORDER = ['WERBENA', 'JASMIN', 'NEMEZJA', 'PEONIA', 'AMARYLIS', 'MISKANT', 'KROKUS', 'FREZJA', 'LAURENCJA', 'SURMIA'];

/* ==========================================================================
   2 lygis: likusios 17 STILE šeimų (psl. 22–58). Kategorijos/konstrukcijos
   duomenys (modeliai, kaina pagal dekoro grupę, varčios tipai, reversinės
   dekorų apribojimas) išgauti iš katalogo teksto sluoksnio automatizuotai ir
   sutampa su 1 lygio šeimų šablonu. NEpatikrinta vizualiai puslapio
   nuotraukoje (kaip WERBENA/NEMEZJA ir kt.), todėl stiklo priedų kainos
   ŠIOJE VERSIJOJE NEĮTRAUKTOS – jei modelis stiklinamas, tai pažymima kaip
   pastaba, o ne kaip konkreti kaina, kad nebūtų nurodyta klaidinga suma.
   ========================================================================== */
// Stiklo kaina, kai priedas = kaina už vienetą × stiklo langelių skaičius modelyje
// (patvirtinta užsakovo 2026-08-21: Daglezija, Berberys, Floks, Powojnik).
function glassByCount(perUnitMatte, perUnitDark, counts) {
  const table = {};
  Object.entries(counts).forEach(([modelNo, count]) => {
    table[modelNo] = { matte: round2gc(perUnitMatte * count), dark: round2gc(perUnitDark * count) };
  });
  return table;
}
function round2gc(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

const TIER2 = {
  MAGNOLIA: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 208.50, PREMIUM: 239.10, CPL: 239.10 },
    glazed: [1,2,3,4,6], glass: { matte: 9.90, dark: 13.20 } },
  BUDLEJA: { models: [1,2,4,6,8], doorTypes: ['REBATED','FLUSH'], reversibleWl: false,
    price: { PREMIUM: 249.00, CPL: 249.00 },
    glazed: [1,2,4,6,8], glassByModel: { 1: { matte: 91.80, dark: 125.40 }, 2: { matte: 8.70, dark: 12.00 }, 4: { matte: 8.70, dark: 12.00 }, 6: { matte: 8.70, dark: 12.00 }, 8: { matte: 8.70, dark: 12.00 } } },
  POWOJNIK: { models: [1,2,3], doorTypes: ['REBATED','FLUSH'], reversibleWl: false,
    price: { PREMIUM: 228.30, CPL: 228.30 },
    glazed: [1,2], glassByModel: glassByCount(21.90, 30.00, { 1: 3, 2: 1 }) }, // psl. patvirtinta 2026-08-21; Powojnik3 stiklų kiekis nepatvirtintas
  LUKRECJA: { models: [1,2,3,4,5,6,7,8,9], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { PREMIUM: 359.70, CPL: 359.70 },
    glazed: [1,2,3,4,5,6,7,8,9], glass: { matte: 127.50, dark: 174.30 } },
  EPIMEDIUM: { widths: ['60','70','80N','80','90','100'],  // psl. 29 — tik šeši pločiai (auditas 2026-09-15)
    models: [1,2,3,4,6], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 215.40, PREMIUM: 240.60, CPL: 240.60 },
    glazed: [1,2,3,4,6], glass: { matte: 14.10, dark: 18.60 } },
  ARALIA: { widths: ['60','70','80N','80','90','100'],  // psl. 31 — tik šeši pločiai (auditas 2026-09-15)
    models: [1], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { PREMIUM: 271.80 },
    glazed: [1], glass: { matte: 55.80, dark: 69.90 } }, // fiksuota priemoka, NEpriklauso nuo stiklo langelių kiekio (patvirtinta 2026-08-21)
  NOLINA: { widths: ['60','70','80N','80','90','100'],  // psl. 31 — tik šeši pločiai (auditas 2026-09-15)
    models: [1], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { PREMIUM: 271.80 },
    glazed: [1], glass: { matte: 55.80, dark: 69.90 } },
  EWODIA: { widths: ['60','70','80N','80','90','100'],  // psl. 31 — tik šeši pločiai (auditas 2026-09-15)
    models: [1,2,4], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { PREMIUM: 271.80 },
    glazed: [1,2,4], glass: { matte: 55.80, dark: 69.90 } },
  JUKA: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 181.20, PREMIUM: 219.00, CPL: 219.00 },
    glazed: [1,2,3,4,5,6,7], glassByModel: { 1:{matte:102.30,dark:139.50}, 2:{matte:55.20,dark:75.00}, 3:{matte:7.50,dark:10.20}, 4:{matte:102.30,dark:139.50}, 5:{matte:76.80,dark:104.70}, 6:{matte:51.60,dark:69.90}, 7:{matte:25.50,dark:34.80} } },
  FORSYCJA: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 181.20, PREMIUM: 219.00, CPL: 219.00 },
    glazed: [1,2,4,5,6,7], glassByModel: { 1:{matte:107.40,dark:146.70}, 4:{matte:107.40,dark:146.70}, 2:{matte:56.40,dark:77.10}, 5:{matte:71.40,dark:97.80}, 7:{matte:71.40,dark:97.80}, 6:{matte:36.00,dark:48.90} } },
  LAWENDA: { models: [1,2,3,4,5,6,7,8,9], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 181.20, PREMIUM: 219.00, CPL: 219.00 },
    glazed: [1,2,4,5,6,7,8,9], glassByModel: { 1:{matte:100.20,dark:136.20}, 7:{matte:100.20,dark:136.20}, 2:{matte:33.60,dark:45.90}, 5:{matte:33.60,dark:45.90}, 4:{matte:66.90,dark:91.20}, 6:{matte:66.90,dark:91.20}, 8:{matte:48.90,dark:66.90}, 9:{matte:4.20,dark:6.30} } },
  IRYS: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 202.80, PREMIUM: 228.30, CPL: 228.30 },
    glazed: [1,2,3,4,5,6,7,8], glass: { matte: 15.30, dark: 21.30 } },
  DAGLEZJA: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 222.90, PREMIUM: 239.70, CPL: 239.70 },
    glazed: [1,4,5], glassByModel: glassByCount(3.90, 5.10, { 1: 3, 4: 2, 5: 1 }) },
  DEBECJA: { models: [1,2,3,4,5,6,7], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 202.80, PREMIUM: 228.30, CPL: 228.30 },
    glazed: [1,2,5], glass: { matte: 18.60, dark: 25.20 } },
  BERBERYS: { models: [1,3,5,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 244.50, PREMIUM: 270.30, CPL: 270.30 },
    glazed: [1,3,5], glassByModel: glassByCount(9.90, 13.20, { 1: 5, 3: 2, 5: 3 }) },
  FLOKS: { models: [1,4,5,6], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 244.50, PREMIUM: 270.30, CPL: 270.30 },
    glazed: [1,4,5,6], glassByModel: glassByCount(12.30, 17.40, { 1: 6, 4: 2, 5: 5, 6: 2 }) },
  KAMELIA: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 222.90, PREMIUM: 239.70, CPL: 239.70 },
    glazed: [1,2,3,4,5,6,7,8], glass: { matte: 3.90, dark: 5.10 } },
  PETUNIA: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 213.00, PREMIUM: 239.70, CPL: 239.70 },
    glazed: [1,2,3], glass: { matte: 7.50, dark: 9.30 } },
  AZALIA: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { GREKO: 195.00, PREMIUM: 225.90, CPL: 225.90 },
    glazed: [1,2,3,5,6], glass: { matte: 21.90, dark: 30.00 } },
  HIACYNT: { models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'], reversibleWl: true,
    price: { PREMIUM: 228.30, CPL: 228.30 },
    glazed: [1,2,3,4,5,6,7], glassByModel: { 1:{matte:81.90,dark:111.60}, 2:{matte:56.40,dark:77.10}, 5:{matte:56.40,dark:77.10}, 3:{matte:71.40,dark:97.80}, 4:{matte:29.70,dark:40.20}, 7:{matte:29.70,dark:40.20}, 6:{matte:94.80,dark:129.30} } },
  FRAGI: { models: [4,5,7,9,10,15,16,17,18,19], doorTypes: ['REBATED','FLUSH'], reversibleWl: false,
    // Pataisyta 2026-09-11: FRAGI kataloge (psl. 59) galimi tik penki pločiai,
    // o įrankis siūlė visus dešimt. Patikrinta katalogo vaizde.
    widths: ['60','70','80N','80','90'],
    // Kiekvienas FRAGI modelis (grupė) turi savo bazinę kainą — stiklas visada įskaičiuotas,
    // keisti negalima (patvirtinta 2026-08-21, katalogas psl. 58).
    priceGroups: [
      { models: [7,9,10,17], price: { GREKO: 278.70, PREMIUM: 334.50, CPL: 334.50 } },
      { models: [4], price: { GREKO: 264.60, PREMIUM: 319.20, CPL: 319.20 } },
      { models: [5], price: { GREKO: 255.30, PREMIUM: 308.70, CPL: 308.70 } },
      { models: [15,16], price: { GREKO: 459.30, PREMIUM: 531.90, CPL: 531.90 } },
      { models: [18,19], price: { GREKO: 548.40, PREMIUM: 598.20, CPL: 598.20 } },
    ],
    price: { GREKO: 278.70, PREMIUM: 334.50, CPL: 334.50 }, // atsarginė reikšmė (nenaudojama, kai priceGroups nurodyta)
    note2: 'FRAGI — visi modeliai su stiklu, kaina jau įskaičiuota į bazinę kainą; stiklo keisti negalima.' },
};

const TIER2_PAGES = { MAGNOLIA: '22–23', BUDLEJA: '24–25', POWOJNIK: '24–25', LUKRECJA: '26–27', EPIMEDIUM: '28–29', ARALIA: '30–31', NOLINA: '30–31', EWODIA: '30–31', JUKA: '32–33', FORSYCJA: '34–35', LAWENDA: '36–37', IRYS: '38–39', DAGLEZJA: '40–41', DEBECJA: '42–43', BERBERYS: '46–47', FLOKS: '46–47', KAMELIA: '50–51', PETUNIA: '52–53', AZALIA: '54–55', HIACYNT: '56–57', FRAGI: '58' };

Object.entries(TIER2).forEach(([key, t]) => {
  const groups = Object.keys(t.price);
  let glass = { mode: 'none' };
  if (t.glassByModel) {
    glass = { mode: 'choice-by-model', table: t.glassByModel };
  } else if (t.glass) {
    glass = { mode: 'choice-flat', matte: t.glass.matte, dark: t.glass.dark, decorativeOnly: [] };
  }
  const basePrice = t.priceGroups
    ? (n, decorCode) => {
        const grp = (decorCode || '').split('_')[0];
        const g = t.priceGroups.find(pg => pg.models.includes(n)) || t.priceGroups[0];
        return g.price[grp] ?? Object.values(g.price)[0];
      }
    : (n, decorCode) => {
        const grp = (decorCode || '').split('_')[0];
        return t.price[grp] ?? Object.values(t.price)[0];
      };
  FAMILIES[key] = {
    label: key, pages: TIER2_PAGES[key] || '22–58', tier: 2, doorTypes: t.doorTypes,
    models: t.models, glazed: t.glazed || [], decorativeGlass: [],
    widths: t.widths,   // siauresnis pločių sąrašas, jei šeima jį turi (pvz. FRAGI)
    basePrice,
    decorOptions: decorsForFamily(key),
    glass,
    reversibleDecorWhitelist: t.reversibleWl ? REVERSIBLE_DECOR_WHITELIST : undefined,
    note: () => t.note2 || (t.glazed && t.glazed.length
      ? 'Duomenys (baziné kaina ir stiklas) išgauti iš katalogo teksto (2 lygis, patikrinta vizualiai kuriems modeliams stiklinimas galimas).'
      : 'Duomenys išgauti iš katalogo teksto (2 lygis) – stiklo priedai šiam modeliui šioje versijoje nemodeliuojami arba nėra (patikrinkite katalogą psl. 22–58).'),
  };
});

const FAMILY_ORDER_TIER2 = ['MAGNOLIA','LUKRECJA','EPIMEDIUM','ARALIA','NOLINA','EWODIA','JUKA','FORSYCJA','LAWENDA','IRYS','DAGLEZJA','DEBECJA','BUDLEJA','POWOJNIK','BERBERYS','FLOKS','KAMELIA','PETUNIA','AZALIA','HIACYNT','FRAGI'];

// Visos aukščiau aprašytos šeimos priklauso STILE rėminių durų linijai (psl. 5–58).
// Dažytos durys (psl. 74–99) registruojamos žemiau, su PAINTED_ prefiksu.
Object.values(FAMILIES).forEach(f => { if (!f.line) f.line = 'STILE'; });

/* ==========================================================================
   DAŽYTOS DURYS — katalogo psl. 74–99 (kataloge „LAKUOTOS").
   Įvesta 2026-09-11, kiekviena šeima patikrinta katalogo vaizde.

   SVARBU: sekcijoje psl. 74–99 yra DVI skirtingos konstrukcijos.
   Čia įvestos tik tos aštuonios, kurios pagamintos STILE technologija —
   joms galioja ta pati logika, kaip esamai STILE linijai (reversinė 127,20,
   PL2112 +15%, klijuotos medienos rėmai 34,20).

   Likusios penkios (BALDUR psl.88, ANUBIS 90, UNO PREMIUM 92, MILDA 96,
   SYLENA 98) yra SKYDINĖS konstrukcijos (vidinis MDF rėmas, dengtas dviem
   HDF plokštėmis) ir turi kitokius priedus: reversinė 93,00 (ne 127,20),
   PL2112 — fiksuoti 51,60 € (ne +15%), vidinis medinis rėmas 16,20 €,
   užpildo tipas (korys / pilna plokštė / perforuota), kitokios stiklo kainos.
   Jos čia NEĮVESTOS — tai atskira užduotis, nes reikia naujų pasirinkimų tipų.

   Septynios pirmosios šeimos naudoja TUOS PAČIUS modelius ir stiklo kainas
   kaip jų STILE atitikmenys (patikrinta pagal katalogą) — todėl `glassKey`
   rodo į esamą glass.js įrašą, o skiriasi tik bazinė kaina.
   ========================================================================== */
const PAINTED_DECORS = decorGroupOptions(['PAINTED'], []);

const PAINTED_FAMILIES = [
  { key: 'WERBENA', pages: '74–75', models: [1,2,3,4,5,6,7,8,9], doorTypes: ['REBATED','FLUSH','REVERSIBLE'],
    glazed: [4,5,6,7,8,9], decorativeGlass: [7,8,9],
    basePrice: (n) => ([4,5,6].includes(n) ? 555.00 : 480.00),
    note: (n) => (n <= 3 ? 'Aklinas modelis, 16 mm MDF panelis su plona įstrižine juostele.'
      : n <= 6 ? 'Stiklinamas modelis, 3 mm HDF panelis klijuojamas ant stiklo.'
        : 'Stiklinamas modelis; galimas relief / point dekoratyvinis stiklas.') },

  { key: 'JASMIN', pages: '76–77', models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'],
    glazed: [1,2,3,4,5,6,7,8], decorativeGlass: [],
    basePrice: () => 507.00, note: () => 'Stiklinamas modelis.' },

  { key: 'AMARYLIS', pages: '78–79', models: [1,2,3,4,5,6,7,8,9], doorTypes: ['REBATED','FLUSH','REVERSIBLE'],
    glazed: [1,2,3,4,5,6,7,8,9], decorativeGlass: [],
    basePrice: () => 479.40, note: () => 'Stiklinamas modelis.' },

  { key: 'PEONIA', pages: '80–81', models: [1,2,3,4,5,6], doorTypes: ['REBATED','FLUSH','REVERSIBLE'],
    glazed: [1,2,3,4,5,6], decorativeGlass: [1,2],
    basePrice: () => 502.80, note: () => 'Stiklinamas modelis.' },

  { key: 'MISKANT', pages: '82–83', models: [1,2,3,4,5,6], doorTypes: ['REBATED','FLUSH','REVERSIBLE'],
    glazed: [1,2,3,4,5,6], decorativeGlass: [],
    basePrice: () => 413.40,
    note: () => 'Juodos linijos (18 mm), dažytos šilkografijos technologija vienoje stiklo pusėje.' },

  { key: 'NEMEZJA', pages: '84–85', models: [4,6,7,8,9,10,11,12,14,15,16], doorTypes: ['REBATED','FLUSH','REVERSIBLE'],
    glazed: [4,7,9,10,11,15], decorativeGlass: [4,7,11,15],
    basePrice: () => 405.00,
    note: (n) => ([4,7,9,10,11,15].includes(n) ? 'Stiklinamas modelis.' : 'Aklinas modelis.') },

  // NEMEZJA 14 pridėtas 2026-09-11 (abiejose linijose) — kataloge jis yra tik
  // didžiojoje nuotraukoje, tinklelyje ne, todėl pirmą kartą buvo praleistas.

  { key: 'LAURENCJA', pages: '86–87', models: [1,2,3,4,5,6], doorTypes: ['REBATED','FLUSH'],
    glazed: [1,2,3,4,5], decorativeGlass: [],
    basePrice: () => 405.00,
    note: (n) => (n === 6 ? 'Aklinas modelis, be stiklo.'
      : 'Stiklo juostelės; VSG 221 priemoka skaičiuojama pagal juostelių skaičių (užsakovo lentelė 2026-09-11).') },

  // TURAN — vienintelė dažytų durų šeima be STILE atitikmens, todėl stiklo
  // rinkinys aprašytas glass.js atskirai.
  { key: 'TURAN', pages: '94–95', models: [1,2,3,4,5,6,7,8], doorTypes: ['REBATED','FLUSH','REVERSIBLE'],
    widths: ['60','70','80N','80','90','100'],   // psl. 95 — tik šeši (auditas 2026-09-15)
    glazed: [1,8], decorativeGlass: [1], glassKey: 'TURAN',
    basePrice: (n) => (n === 8 ? 488.10 : 385.20),
    note: (n) => (n === 7 ? 'Veidrodinis modelis: viena pusė su veidrodžiu, kita — lakuota plokštė. Aversas = veidrodis iš vyrių pusės.'
      : n === 8 ? 'Stiklinamas, pastovus stiklinimo plotis 50 mm; 3 mm HDF panelis klijuojamas ant stiklo.'
        : n === 1 ? 'Stiklinamas modelis; galimas relief / point dekoratyvinis stiklas.'
          : 'Aklinas modelis, frezuoti 16 mm MDF įdėklai.') },
];

/* ==========================================================================
   SKYDINĖS DURYS — katalogo psl. 108–121.
   Įvesta 2026-09-11, po vieną šeimą; pirmoji — BALDUR (psl. 108–109).

   Konstrukcija: vidinis MDF rėmas, dengtas dviem HDF plokštėmis. Tai kita
   technologija nei STILE rėminės, todėl skiriasi ir priedai, ir pločiai.

   SVARBU dėl PL2112: DEKORUOTAS BALDUR (psl. 109) turi „+15% prie varčios
   kainos", o DAŽYTAS BALDUR (psl. 89) — fiksuotus 51,60 €. Ta pati šeima,
   ta pati konstrukcija, skirtinga taisyklė. Čia įvesta dekoruota versija.
   ========================================================================== */
const PANEL_DECORS = decorGroupOptions(['PREMIUM', 'CPL', 'CPL02'], []);

const PANEL_FAMILIES = [
  {
    key: 'BALDUR', pages: '108–109', models: [1, 3, 9],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [1, 3, 9],
    // PREMIUM ir ST CPL — 320,40; CPL 0,2 — 343,50 (patikrinta vaizde)
    basePrice: (n, decorCode) => ((decorCode || '').startsWith('CPL02') ? 343.50 : 320.40),
    // Modeliai, kuriems galimi siaurieji „N" pločiai (60N, 70N, 90N)
    // BALDUR: 80N tik lygiabriaunei/reversinei; 60N/70N/90N dar ir tik
    // modeliams 1 ir 9, ir ne su SOFT briauna (psl. 109, išnašos 6 ir 7)
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'],
                  modelLimited: { widths: ['60N','70N','90N'], models: [1, 9], noSoft: true } },
    reversibleExcludedGroups: ['CPL02'],   // psl. 109
    opts: {},   // BALDUR papildomų priedų (pritraukiklio, įvorių, angos, 110) neturi
    narrowWidthModels: [1, 9],
    // BALDUR 9 užpildo neturi — stiklas įklijuotas per visą plokštumą
    noFillModels: [9],
    // SOFT briauna: tik BALDUR 1, tik dekorui BALTA ST CPL, reikalauja pilnos
    // plokštės užpildo ir negalima pagal PL2112 (psl. 109, išnaša 4)
    softModels: [1], softDecors: ['CPL_WHITE'],
    note: (n) => (n === 9 ? 'Lacobel juodas 4 mm stiklas, įklijuotas iš abiejų pusių ir sulygintas su varčios paviršiumi. Užpildo nėra.'
      : n === 3 ? 'Stiklo vizualus plotis 210 mm. Neprieinamas stumdomose sistemose ir dvivėrėse duryse.'
        : 'Stiklo vizualus plotis 50 mm. Galima SOFT briauna (tik BALTA ST CPL, su pilnos plokštės užpildu, ne PL2112).'),
  },
  {
    key: 'UNO PREMIUM', pages: '110–111', models: [1],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [],                      // stiklo neturi — lygi plokštuma
    basePrice: () => 129.60,         // viena kaina, tik PREMIUM dekorai
    decorGroups: ['PREMIUM'],
    widths: PANEL_WIDTHS.concat(['110']),
    // Visi „N" pločiai — tik lygiabriaunėms ir reversinėms (psl. 111, išnaša 4);
    // modelio apribojimo nėra, nes šeima turi vieną variantą
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'], modelLimited: null },
    // Psl. 111: intarsijų spalvos — šlifuotas plienas, juoda, šluotuotas auksas
    // ir ĄŽUOLAS CLASSIC CPL. Vario ir spalvotųjų serijų šiai šeimai nėra.
    opts: { closer: true, bottomRail: true, vents: true, roundWindow: true,
            width110: true, intarsia: { models: [1], series: ['STEEL', 'BLACK', 'OAK', 'GOLD'] } },
    // Iliuminatorius ir LUX intarsija tarpusavyje nesuderinami (užsakovo
    // patikslinimas 2026-09-18) — žr. engine.js, kur pasirinkus vieną antras atšaukiamas.
    note: () => 'Viena lygi plokštuma be stiklo. Galimos LUX intarsijos (psl. 100–107) arba iliuminatorius.',
  },
  {
    key: 'ALTAMURA', pages: '112–113', models: [1, 2, 3, 4, 5, 6, 7, 8],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [2, 3, 4, 5, 6, 7, 8],   // ALTAMURA 1 — lygi plokštuma be stiklo
    /* Keturios kainų pakopos ir keturios modelių grupės (psl. 113).
       Vienintelė skydinių šeima, turinti ir GREKO, ir CPL 0,7. */
    basePrice: (n, decorCode) => {
      const g = (decorCode || '').split('_')[0];
      const tier = g === 'GREKO' ? 0 : g === 'CPL02' ? 2 : g === 'CPL07' ? 3 : 1;
      const row = n === 1 ? [110.10, 129.60, 162.30, 204.00]
        : n === 2 ? [181.50, 199.50, 227.70, 269.70]
          : [3, 5, 7].includes(n) ? [165.00, 185.10, 213.30, 255.00]
            : [149.70, 171.90, 199.50, 241.20];   // 4, 6, 8
      return row[tier];
    },
    decorGroups: ['GREKO', 'PREMIUM', 'CPL', 'CPL02', 'CPL07'],
    reversibleExcludedGroups: ['CPL02', 'CPL07'],   // psl. 113: „negalima CPL 0,2 ir 0,7"
    widths: PANEL_WIDTHS.concat(['110']),
    // 80N — lygiabriaunei/reversinei; 60N/70N/90N — dar ir tik ALTAMURA 1 (išnašos 5 ir 6)
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'],
                  modelLimited: { widths: ['60N','70N','90N'], models: [1], noSoft: false } },
    // „Įvorės (4 vnt.)" šiai šeimai NEREIKALINGOS (užsakovo patikslinimas
    // 2026-09-18) — tai ventiliacijos pasirinkimas, kuris čia jau įtrauktas per
    // „Nerūdijančio plieno panelis: apatinis su ventiliacija" (žr. steelPanel).
    opts: { closer: true, bottomRail: true, width110: true,
            roundWindow: { models: [1] }, steelPanel: true,
            intarsia: { models: [1] } },   // psl. 113: visos psl. 100–107 versijos
    // Iliuminatorius ir LUX intarsija tarpusavyje nesuderinami (užsakovo
    // patikslinimas 2026-09-18) — žr. engine.js, kur pasirinkus vieną antras atšaukiamas.
    note: (n) => (n === 1 ? 'Lygi plokštuma be stiklo. Galimos LUX intarsijos (psl. 100–107) arba iliuminatorius.'
      : 'Stiklinamas modelis: grūdintas decormat pieno baltumo arba skaidrus; VSG 221 matinis už priemoką.'),
  },
  {
    key: 'ANSEDONIA', pages: '114–115', models: [1,2,3,4,5,6,7,8,9,10,11,12],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    // Stiklinami modeliai — raštas (3 stiklai, 1 stiklas, aklinas) kartojasi 4 kartus
    glazed: [1, 2, 4, 5, 7, 8, 10, 11],
    // Viena kaina visiems modeliams, keturios dekorų pakopos (patikrinta vaizde psl. 115)
    basePrice: (n, decorCode) => {
      const g = (decorCode || '').split('_')[0];
      return g === 'GREKO' ? 154.50 : g === 'CPL02' ? 240.90 : g === 'CPL07' ? 301.20 : 175.80;
    },
    decorGroups: ['GREKO', 'PREMIUM', 'CPL', 'CPL02', 'CPL07'],
    reversibleExcludedGroups: ['CPL02', 'CPL07'],   // psl. 115
    // Siaurųjų 60N/70N/90N ir pločio „110" ši šeima neturi (psl. 115)
    widths: ['60','65','70','75','80N','80','85','90','95','100'],
    widthRules: { flushRevOnly: ['80N'], modelLimited: null },
    opts: { closer: true, bottomRail: true, vents: true },
    note: (n) => ([1, 4, 7, 10].includes(n) ? 'Trys stiklo vienetai; VSG 221 priemoka — 10,50 € už vienetą.'
      : [2, 5, 8, 11].includes(n) ? 'Vienas stiklo vienetas; VSG 221 priemoka — 10,50 € už vienetą.'
        : 'Aklinas modelis, be stiklo.'),
  },
  {
    key: 'LORIENT', pages: '116–117', models: [1,2,3,4,5,6,7,8,9,10,11,12],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [1, 2, 4, 5, 7, 8, 10, 11],
    // Tik DVI kainų pakopos — CPL 0,2 ir 0,7 šiai šeimai kataloge nėra (psl. 117)
    basePrice: (n, decorCode) => ((decorCode || '').startsWith('GREKO') ? 159.90 : 180.90),
    decorGroups: ['GREKO', 'PREMIUM', 'CPL'],
    widths: ['60','65','70','75','80N','80','85','90','95','100'],
    widthRules: { flushRevOnly: ['80N'], modelLimited: null },
    opts: { closer: true, bottomRail: true, vents: true },
    note: (n) => ([1, 4, 7, 10].includes(n) ? 'Stiklinamas modelis; VSG 221 priemoka 30,90 €.'
      : [2, 5, 8, 11].includes(n) ? 'Stiklinamas modelis; VSG 221 priemoka 15,30 €.'
        : 'Aklinas modelis, be stiklo.'),
  },
  {
    key: 'MENTON', pages: '118–119', models: [1,2,3,4,5,6,7,8,9,10,11,12],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [1, 2, 3, 5, 6, 7, 9, 10, 11],
    basePrice: (n, decorCode) => {
      const g = (decorCode || '').split('_')[0];
      return g === 'GREKO' ? 170.40 : g === 'CPL02' ? 255.00 : g === 'CPL07' ? 315.30 : 190.20;
    },
    decorGroups: ['GREKO', 'PREMIUM', 'CPL', 'CPL02', 'CPL07'],
    reversibleExcludedGroups: ['CPL02', 'CPL07'],
    widths: ['60','65','70','75','80N','80','85','90','95','100'],
    widthRules: { flushRevOnly: ['80N'], modelLimited: null },
    opts: { closer: true, bottomRail: true, vents: true },
    note: (n) => ([4, 8, 12].includes(n) ? 'Aklinas modelis, be stiklo.'
      : 'Stiklinamas modelis; VSG 221 kainuojamas už vieną stiklo vienetą.'),
  },
  {
    key: 'SORANO', pages: '120–121', models: [1,2,3,4,5,6,7,8,9,10,11,12],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [1, 2, 4, 5, 6, 7, 9, 10, 11],
    basePrice: (n, decorCode) => {
      const g = (decorCode || '').split('_')[0];
      return g === 'GREKO' ? 191.40 : g === 'CPL02' ? 273.30 : g === 'CPL07' ? 333.30 : 208.20;
    },
    decorGroups: ['GREKO', 'PREMIUM', 'CPL', 'CPL02', 'CPL07'],
    reversibleExcludedGroups: ['CPL02', 'CPL07'],
    widths: ['60','65','70','75','80N','80','85','90','95','100'],
    widthRules: { flushRevOnly: ['80N'], modelLimited: null },
    opts: { closer: true, bottomRail: true, vents: true },
    note: (n) => ([3, 8, 12].includes(n) ? 'Aklinas modelis, be stiklo.'
      : 'Stiklinamas modelis; VSG 221 kainuojamas už vieną stiklo vienetą.'),
  },
];

const FAMILY_ORDER_PANEL = [];
PANEL_FAMILIES.forEach(p => {
  const key = 'PANEL_' + p.key;
  FAMILY_ORDER_PANEL.push(key);
  FAMILIES[key] = {
    line: 'PANEL', isPanel: true,
    label: p.key + ' Skydinė',
    baseLabel: p.key,
    glassKey: p.glassKey || p.key,
    pages: p.pages, doorTypes: p.doorTypes, models: p.models,
    glazed: p.glazed || [], decorativeGlass: [],
    widths: p.widths || PANEL_WIDTHS,
    basePrice: p.basePrice,
    decorOptions: p.decorGroups ? decorGroupOptions(p.decorGroups, []) : PANEL_DECORS,
    glass: { mode: 'from-glass-js' },
    narrowWidthModels: p.narrowWidthModels || [],
    widthRules: p.widthRules || null,
    opts: p.opts || {},
    reversibleExcludedGroups: p.reversibleExcludedGroups || [],
    pl2112Fixed: p.pl2112Fixed || null,
    noFillModels: p.noFillModels || [],
    softModels: p.softModels || [], softDecors: p.softDecors || [],
    note: p.note,
  };
});

/* DAŽYTOS SKYDINĖS — psl. 88–99. Katalogo skyrius „Dažytos durys", bet
   konstrukcija skydinė, todėl šeimos priklauso DAŽYTŲ linijai ir kartu turi
   `isPanel` požymį — iš jo ateina užpildas, vidinis medinis rėmas ir kt.

   Svarbiausias skirtumas nuo dekoruotų skydinių: PL2112 čia yra FIKSUOTI
   51,60 €, o ne +15 % (plg. psl. 89 ir psl. 109 — ta pati BALDUR šeima). */
const PAINTED_PANEL_FAMILIES = [
  {
    key: 'BALDUR', pages: '88–89', models: [1,2,3,4,5,6,7,8],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [1, 3, 5], glassKey: 'BALDUR PAINTED',
    // Kainos pagal modelį (psl. 88, patikrinta vaizde); spalva kainos nekeičia
    basePrice: (n) => (n === 1 ? 459.30 : [3, 5].includes(n) ? 487.20 : 269.70),
    pl2112Fixed: 51.60,
    widths: PANEL_WIDTHS,
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'],
                  modelLimited: { widths: ['60N','70N','90N'], models: [1], noSoft: false } },
    // Apatinė sija ir nuleidžiama tarpinė netaikomos stiklinamiems 1, 3, 5
    opts: { bottomRail: { models: [2, 4, 6, 7, 8] } },
    noFillModels: [],
    note: (n) => ([1, 3, 5].includes(n)
      ? 'Stiklinamas modelis: VSG/ESG 441 saugus stiklas įskaičiuotas (matinis arba juodas). Nuleidžiama tarpinė ir apatinė sija netaikomos.'
      : 'Aklinas modelis.'),
  },
];

PAINTED_PANEL_FAMILIES.push(
  {
    key: 'ANUBIS', pages: '90–91', models: [1, 2, 3, 4, 5],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [],                       // visi modeliai aklini (frezuoti įdubimai)
    basePrice: () => 269.70,
    pl2112Fixed: 51.60,
    widths: ['60','70','80N','80','90','100'],   // auditas 2026-09-15: kataloge tik šeši
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'], modelLimited: null },
    opts: { bottomRail: true },
    note: () => 'Aklinas modelis su frezuotais įdubimais.',
  },
  {
    key: 'UNO PREMIUM', pages: '92–93', models: [1],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [],
    basePrice: () => 241.20,
    pl2112Fixed: 51.60,
    widths: PANEL_WIDTHS.concat(['110']),   // auditas 2026-09-15: turi ir „110"
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'], modelLimited: null },
    opts: { bottomRail: true },
    note: () => 'Viena lygi plokštuma be stiklo ir be frezavimo.',
  },
  {
    key: 'MILDA', pages: '96–97', models: [1, 2, 3, 4, 5],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [],
    basePrice: () => 292.50,
    pl2112Fixed: 51.60,
    widths: ['60','70','80N','80','90','100'],   // auditas 2026-09-15: kataloge tik šeši
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'], modelLimited: null },
    opts: { bottomRail: true },
    note: () => 'Aklinas modelis su dekoratyviniu frezavimu.',
  },
  {
    key: 'SYLENA', pages: '98–99', models: [1, 2, 3, 4, 5, 6, 7, 8],
    doorTypes: ['REBATED', 'FLUSH', 'REVERSIBLE'],
    glazed: [],
    // Kainos pagal modelį (psl. 98, patikrinta vaizde)
    basePrice: (n) => (n <= 5 ? 255.30 : 269.70),
    pl2112Fixed: 51.60,
    widths: ['60','70','80N','80','90','100'],   // auditas 2026-09-15: kataloge tik šeši
    widthRules: { flushRevOnly: ['60N','70N','80N','90N'], modelLimited: null },
    opts: { bottomRail: true },
    note: (n) => (n <= 5 ? 'Aklinas modelis su vertikaliu frezavimu.' : 'Aklinas modelis su horizontaliu frezavimu.'),
  },
);

const FAMILY_ORDER_PAINTED_PANEL = [];
PAINTED_PANEL_FAMILIES.forEach(p => {
  const key = 'PAINTEDPANEL_' + p.key;
  FAMILY_ORDER_PAINTED_PANEL.push(key);
  FAMILIES[key] = {
    line: 'PAINTED', isPanel: true, extrasKey: 'PAINTED_PANEL',
    label: p.key + ' Dažyta skydinė',
    baseLabel: p.key,
    glassKey: p.glassKey || p.key,
    pages: p.pages, doorTypes: p.doorTypes, models: p.models,
    glazed: p.glazed || [], decorativeGlass: [],
    widths: p.widths || PANEL_WIDTHS,
    widthRules: p.widthRules || null,
    basePrice: p.basePrice,
    decorOptions: PAINTED_DECORS,
    glass: { mode: 'from-glass-js' },
    opts: p.opts || {},
    reversibleExcludedGroups: [],
    pl2112Fixed: p.pl2112Fixed || null,
    noFillModels: p.noFillModels || [],
    softModels: [], softDecors: [],
    note: p.note,
  };
});

const FAMILY_ORDER_PAINTED = [];
PAINTED_FAMILIES.forEach(p => {
  const key = 'PAINTED_' + p.key;
  FAMILY_ORDER_PAINTED.push(key);
  FAMILIES[key] = {
    line: 'PAINTED',
    label: p.key + ' Dažyta',      // sąskaitoje ir gamybos lape atskiria nuo STILE
    baseLabel: p.key,              // pavadinimas be linijos (paieškai, rūšiavimui)
    glassKey: p.glassKey || p.key, // 7 šeimos naudoja tą patį stiklo rinkinį kaip STILE
    pages: p.pages, doorTypes: p.doorTypes, models: p.models,
    glazed: p.glazed || [], decorativeGlass: p.decorativeGlass || [],
    widths: p.widths,          // siauresnis sąrašas, jei šeima jį turi (pvz. TURAN)
    basePrice: p.basePrice,
    decorOptions: PAINTED_DECORS,
    glass: { mode: 'from-glass-js' },
    note: p.note,
  };
});


// Šeimos, kurių puslapiai kataloge (59+) yra už STILE rėminių durų ribų
// (STIKLINĖS DURYS, SKYDINĖS DURYS ir kt.) — kitas etapas.
const PENDING_FAMILIES = [
  'STIKLINĖS DURYS (LOFT, GRAF)', 'Dažytos SKYDINĖS (BALDUR, ANUBIS, UNO PREMIUM, MILDA, SYLENA)',
  'SKYDINĖS DURYS (7 šeimos)', 'INTARSIJOS', 'VIDAUS ĮĖJIMO DURYS (kita produkto linija)',
];

/* ==========================================================================
   STUMDOMOSIOS SISTEMOS — SIENINĖ, VIENGUBA (psl. 158), v44 pirmas etapas.
   v45 papildyta (žr. README v46): tunelio tipo stakta + karūna (dabar
   priklauso nuo tunelio, kaip ir normaliose duryse), bėgelio apdailos
   pavadinimai ir dekoro filtravimas, spynos spalva.
   Sąmoningai NEĮTRAUKTA šioje versijoje (kitas etapas):
   - DVIPUSĖ (SP2N) sistema — kataloge JI VISADA reikalauja tunelio tipo
     staktos; nors tunelis dabar realizuotas, SP2N kol kas paliktas kitam
     etapui, kad pakeitimas būtų mažesnis ir lengviau patikrinamas.
   - LOFT/LOFT STANDARD/MAGIC/GRAF stiklo durys, į sieną įstumiamos sistemos
     (psl. 160–166) — visiškai kitos konstrukcijos, atskiras darbas.
   ========================================================================== */
const SLIDING_EXTRAS = {
  // Varčia + aliuminis bėgelis su maskuote ir atmušėju (SP1Nz/SP1Nb, psl. 158).
  // Abu variantai kainuoja vienodai — skiriasi tik ar rezervuota vieta spynai.
  doorVeneer: 159.00, doorPainted: 213.30,
  lockKey: 55.80, lockWC: 95.70,                // kablio užraktas — tik SP1Nz variantui
  handleSet: 23.40,                             // rankenėlė, komplektas (2 vnt.)
  softCloseStd: 46.50, softCloseWide: 80.70,    // lėtintuvas; brangesnis pločiams „90“/„100“
};

/* Bėgelio ilgis pagal plotį — informacinis (gamybos lapui), kainos nekeičia. */
const SLIDING_RAIL_LENGTH = { '60': 150, '70': 150, '80': 180, '90': 200, '100': 210, '110': 230 };
const SLIDING_HANDLE_COLORS = [
  ['CHROME_GLOSS', 'Blizgus chromas'], ['CHROME_SATIN', 'Šlifuotas chromas'],
  ['BRASS_GLOSS', 'Blizgus žalvaris'], ['BLACK_MATTE', 'Matinė juoda'],
];
// Kablio tipo spynos (Raktas ir WC) spalva — tos pačios 4 spalvos kaip
// rankenėlės, nemokamai (užsakovo patikslinimas 2026-09-22).
const SLIDING_LOCK_COLORS = SLIDING_HANDLE_COLORS;

/* Pločiai — fiksuotas sąrašas, NE visas šeimos sąrašas be „N" (užsakovo
   patikslinimas 2026-09-22): sieninė stumdoma sistema siūloma tik šiais
   pločiais, nepriklausomai nuo to, kiek pločių turi pati šeima. */
const SLIDING_WIDTHS = ['60', '70', '80', '90', '100', '110'];

/* Bėgelio apdaila filtruoja Dekoro pasirinkimą (užsakovo patikslinimas
   2026-09-22): „Greko/Premium" apdaila — tik GREKO ir PREMIUM dekorų
   kolekcijos; „Dažyta/CPL" — visos kitos (dažytos, ST CPL, CPL 0,2, CPL 0,7). */
const SLIDING_MATERIAL_GROUPS = {
  VENEER: ['GREKO', 'PREMIUM'],
  PAINTED: ['PAINTED', 'CPL', 'CPL02', 'CPL07'],
};

/* Šeimos, kuriose katalogas leidžia stumdomą sistemą — patikrinta pagal
   kiekvienos šeimos GALIMI SPRENDIMAI eilutę: automatiškai per
   `pdftotext -bbox-layout` visuose 46 šeimų puslapiuose (2026-09-21),
   patvirtinta vaizdu dviem atvejais (WERBENA — pilnas rinkinys su SP1N ir
   SP2N; FRAGI — vienintelė be jokio SP1N/SP2N, tik DD). Numatytoji reikšmė
   pagal liniją: STILE ir SKYDINĖS (PANEL) — leidžiama; PAINTED (dažytos,
   įsk. dažytas skydines) — taip pat leidžiama (SP1N; SP2N dažytoms
   kataloge nesiūlomas — nesvarbu šioje versijoje, nes SP2N dar neįvestas).
   `slidingDouble` saugoma jau dabar (kitai versijai), bet v44 UI jos nenaudoja. */
Object.values(FAMILIES).forEach(f => {
  if (f.slidingSingle === undefined) f.slidingSingle = true;
  if (f.slidingDouble === undefined) f.slidingDouble = f.line !== 'PAINTED';
});
if (FAMILIES.FRAGI) { FAMILIES.FRAGI.slidingSingle = false; FAMILIES.FRAGI.slidingDouble = false; } // psl. 59: GALIMI SPRENDIMAI rodo tik DD
['PANEL_UNO PREMIUM', 'PANEL_ANSEDONIA', 'PANEL_LORIENT', 'PANEL_MENTON', 'PANEL_SORANO'].forEach(k => {
  if (FAMILIES[k]) FAMILIES[k].slidingDouble = false; // psl. 111/115/117/119/121: tik SP1N/SP1C
});

