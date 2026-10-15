'use strict';
/* Registrų pagalba: atsakymų apdorojimas pagal TIKRUS 2026-10-15 atsakymus. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { lookupCompany, checkVat, vatCandidate, suggestVat } = require('../src/registry');

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

test('PVM kodo spėjimas iš įmonės kodo (tikras pavyzdys MAXIMA LT)', () => {
  assert.equal(vatCandidate('123033512'), '230335113');
  assert.equal(vatCandidate('12345'), null);
  for (const c of ['110000291', '147629339', '304051696', '999999999']) assert.match(vatCandidate(c), /^\d{9}$/);
});

test('PVM pasiūlomas tik kai VIES patvirtina ir pavadinimas sutampa', async () => {
  const vies = (name, valid = true) => respond({ isValid: valid, userError: valid ? 'VALID' : 'INVALID', name, address: 'N/A' });
  assert.equal(await suggestVat('123033512', 'MAXIMA LT, UAB', vies('MAXIMA LT, UAB')), 'LT230335113');
  assert.equal(await suggestVat('110000291', 'UAB A', vies('UAB B')), null, 'kitas pavadinimas');
  assert.equal(await suggestVat('110000292', 'UAB A', vies('UAB A', false)), null, 'negalioja');
  assert.equal(await suggestVat('110000293', 'UAB A', async () => { throw new Error('x'); }), null, 'VIES nepasiekiamas');
});
