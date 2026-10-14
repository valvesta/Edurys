/* ==========================================================================
   ERKADO pagalbinės funkcijos, kurias naudoja engine.js.
   NUKOPIJUOTOS PAŽODŽIUI iš catalog-sources/erkado/2026-I/data.js —
   testas (api/test/pricing-parity.test.js) tikrina, kad tekstas sutampa.
   Rankomis NEKEISTI: pasikeitus originalui, sugeneruokite iš naujo.
   ========================================================================== */

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

function lineExtras(lineKey) {
  return { ...SHARED_EXTRAS, ...(LINE_EXTRAS[lineKey] || LINE_EXTRAS.STILE) };
}

function lockIsMagnetic(lockCode) {
  return (lockCode || '').startsWith('MAG_');
}

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

function handlePlateChoiceOrder(lock) {
  const k = lockKind(lock);
  if (k === 'WB') return ['CYL', 'WC', 'NONE'];
  if (k === 'WC') return ['WC', 'NONE', 'CYL'];
  return ['NONE', 'CYL', 'WC']; // BSR
}

