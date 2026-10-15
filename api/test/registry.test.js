'use strict';
/* Registrų pagalba: atsakymų apdorojimas pagal TIKRUS 2026-10-15 atsakymus. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { lookupCompany, checkVat } = require('../src/registry');

const respond = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });
const JAR_MAXIMA = { _data: [{ _type: 'datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo', ja_kodas: 123033512, ja_pavadinimas: 'MAXIMA LT, UAB',
  pilnas_adresas: null, adresas: null, reg_data: '1995-03-17', isreg_data: null, stat_data: '2020-11-17' }] };

test('JAR: pavadinimas ir datos pagal kodą', async () => {
  const r = await lookupCompany('123033512', respond(JAR_MAXIMA));
  assert.deepEqual(r, { companyCode: '123033512', name: 'MAXIMA LT, UAB', address: null, registeredOn: '1995-03-17',
    deregisteredOn: null, source: 'Juridinių asmenų registras (data.gov.lt)' });
});

test('JAR: nerasta -> null; kitas kodas atsakyme nepriimamas', async () => {
  assert.equal(await lookupCompany('111111111', respond({ _data: [] })), null);
  assert.equal(await lookupCompany('222222222', respond(JAR_MAXIMA)), null);
});

test('JAR: neteisingas kodas atmetamas be užklausos; nepasiekiamas registras — aiški klaida', async () => {
  assert.throws(() => lookupCompany('12345', respond(JAR_MAXIMA)), /9 skaitmenys/);
  assert.throws(() => lookupCompany('123033512&x=1', respond(JAR_MAXIMA)), /9 skaitmenys/);
  await assert.rejects(lookupCompany('333333333', respond({}, 503)), /nepasiekiamas/);
  await assert.rejects(lookupCompany('444444444', async () => { throw new Error('timeout'); }), /nepasiekiamas/);
});

test('VIES: galiojantis kodas, „N/A“ adresas nerodomas', async () => {
  const r = await checkVat('lt 230335113', respond({ isValid: true, userError: 'VALID', name: 'MAXIMA LT, UAB', address: 'N/A' }));
  assert.deepEqual(r, { vatCode: 'LT230335113', valid: true, name: 'MAXIMA LT, UAB', address: null, source: 'VIES' });
  const bad = await checkVat('100001919', respond({ isValid: false, userError: 'INVALID', name: '---', address: '---' }));
  assert.equal(bad.valid, false);
  assert.equal(bad.name, null);
  await assert.rejects(checkVat('100001918', respond({ isValid: false, userError: 'MS_UNAVAILABLE' })), /nepasiekiamas/);
  assert.throws(() => checkVat('LT12', respond({})), /9 arba 12/);
});
