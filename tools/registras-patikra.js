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

const BUV = `${U}/datasets/gov/rc/jar/buveines/Buveine`;
const TESTS = [
  ['buveinė: pirmi įrašai', `${BUV}?limit(2)`, 30000],
  ['buveinė pagal kodą (MAXIMA LT)', `${BUV}?ja_kodas=123033512`, 30000],
  ['JAR pagal kodą (kontrolė)', `${JA}?ja_kodas=123033512`, 30000],
  ['VMI pagal kodą (ilgesnis laukimas)', `${MM}?ja_kodas=123033512&limit(20)`, 90000],
];

(async () => {
  const out = [];
  for (const [name, url, ms] of TESTS) {
    out.push(`=== ${name}\n${url}`);
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
      const t = await r.text();
      out.push(`HTTP ${r.status}, ${Date.now() - t0} ms\n${t.slice(0, 2500)}`);
    } catch (e) { out.push(`KLAIDA po ${Date.now() - t0} ms: ${e.message} ${e.cause ? '(' + (e.cause.code || e.cause.message) + ')' : ''}`); }
  }
  // VIES (MAXIMA LT PVM kodas viešas: LT230335113)
  try {
    const t0 = Date.now();
    const v = await fetch('https://ec.europa.eu/taxation_customs/vies/rest-api/ms/LT/vat/230335113', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    out.push(`=== VIES\nHTTP ${v.status}, ${Date.now() - t0} ms\n${(await v.text()).slice(0, 1500)}`);
  } catch (e) { out.push(`=== VIES KLAIDA ${e.message} ${e.cause ? '(' + (e.cause.code || e.cause.message) + ')' : ''}`); }

  const file = path.join(os.homedir(), 'Desktop', 'registras2.txt');
  fs.writeFileSync(file, out.join('\n\n'), 'utf8');
  console.log('Įrašyta: ' + file);
})();
