/* ==========================================================================
   Šeimų eiliškumas šoniniam meniu.

   Senajame konfigūratoriuje data.js turėjo atskirus sąrašus (FAMILY_ORDER,
   FAMILY_ORDER_TIER2 ir kt.). Dabar katalogas ateina iš duomenų bazės —
   bootstrap.js sukuria FAMILIES ta tvarka, kokia nurodyta kataloge
   (SortOrder), o šie sąrašai išvedami iš jo pagal liniją ir požymius.
   Kad tvarka sutampa su originalu, tikrina tools/ui-test.
   ========================================================================== */
(function () {
  'use strict';
  const keys = Object.keys(FAMILIES);
  const of = pred => keys.filter(k => pred(FAMILIES[k]));
  window.FAMILY_ORDER = of(f => f.line === 'STILE' && f.tier !== 2);
  window.FAMILY_ORDER_TIER2 = of(f => f.line === 'STILE' && f.tier === 2);
  window.FAMILY_ORDER_PAINTED = of(f => f.line === 'PAINTED' && !f.isPanel);
  window.FAMILY_ORDER_PAINTED_PANEL = of(f => f.line === 'PAINTED' && f.isPanel);
  window.FAMILY_ORDER_PANEL = of(f => f.line === 'PANEL');
  const listed = new Set([].concat(FAMILY_ORDER, FAMILY_ORDER_TIER2, FAMILY_ORDER_PAINTED, FAMILY_ORDER_PAINTED_PANEL, FAMILY_ORDER_PANEL));
  const missing = keys.filter(k => !listed.has(k));
  if (missing.length) throw new Error('Šeimos be linijos: ' + missing.join(', '));
})();
