'use strict';
/* ==========================================================================
   Vienkartinė patikra: kaip atsako viešieji registrai (data.gov.lt, VIES).
   Nieko nekeičia — tik skaito viešus duomenis ir įrašo atsakymus į failą
   registras2.txt (darbalaukyje), kad pagal juos būtų tiksliai sujungti laukai.

   Paleidimas:  node tools/registras-patikra.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const os = require('os');

const U = 'https://get.data.gov.lt';
const JA = `${U}/datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo`;
const MM = `${U}/datasets/gov/vmi/mm_registras/MokesciuMoketojas`;
const q = s => encodeURIComponent(s);

const TESTS = [
  ['buveines sąrašas', `${U}/datasets/gov/rc/jar/buveines/:ns`],
  ['formos/statusai sąrašas', `${U}/datasets/gov/rc/jar/formos_statusai/:ns`],
  ['JAR pagal kodą (MAXIMA LT)', `${JA}?ja_kodas=123033512`],
  ['JAR pagal kodą kaip tekstą', `${JA}?ja_kodas="123033512"`],
  ['VMI pagal kodą', `${MM}?ja_kodas=123033512&limit(20)`],
  ['paieška A contains', `${JA}?ja_pavadinimas.contains(${q('"Maxima"')})&limit(5)`],
  ['paieška B contains()', `${JA}?contains(ja_pavadinimas,${q('"Maxima"')})&limit(5)`],
  ['paieška C lower', `${JA}?ja_pavadinimas.lower().contains(${q('"maxima"')})&limit(5)`],
  ['paieška D mažosios', `${JA}?ja_pavadinimas.contains(${q('"maxima"')})&limit(5)`],
  ['paieška E startswith', `${JA}?ja_pavadinimas.startswith(${q('"UAB \\"MAXIMA')})&limit(5)`],
  ['paieška F lietuviškos raidės', `${JA}?ja_pavadinimas.contains(${q('"Žalgiris"')})&limit(3)`],
];

(async () => {
  const out = [];
  for (const [name, url] of TESTS) {
    out.push(`=== ${name}\n${url}`);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      const t = await r.text();
      out.push(`HTTP ${r.status}\n${t.slice(0, 2500)}`);
    } catch (e) { out.push('KLAIDA ' + e.message); }
  }
  // VIES su PVM kodu, rastu VMI duomenyse
  try {
    const r = await (await fetch(`${MM}?ja_kodas=123033512&limit(20)`, { headers: { Accept: 'application/json' } })).json();
    const row = (r._data || []).find(x => x.pvm_kodas && !x.pvm_isregistruota);
    if (row) {
      const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/LT/vat/${row.pvm_kodas}`;
      const v = await fetch(url, { headers: { Accept: 'application/json' } });
      out.push(`=== VIES ${row.pvm_kodas}\nHTTP ${v.status}\n${(await v.text()).slice(0, 1500)}`);
    } else out.push('=== VIES: PVM kodas VMI duomenyse nerastas');
  } catch (e) { out.push('=== VIES KLAIDA ' + e.message); }

  const file = path.join(os.homedir(), 'Desktop', 'registras2.txt');
  fs.writeFileSync(file, out.join('\n\n'), 'utf8');
  console.log('Įrašyta: ' + file);
})();
