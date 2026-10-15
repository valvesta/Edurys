'use strict';
/* Testai be duomenų bazės: šablonų saugumas, klaidų atvaizdavimas,
   procedūrų pavadinimų apsauga. */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_BASE_URL = 'https://durys.example';
process.env.DB_SERVER = 'x.database.windows.net';
process.env.DB_NAME = 'x';
process.env.AUTH_PROVIDERS = JSON.stringify([{ name: 't', issuer: 'https://login.microsoftonline.com/t/v2.0',
  jwksUri: 'https://login.microsoftonline.com/t/discovery/v2.0/keys', audience: 'api' }]);

const { render } = require('../src/worker/templates');
const { toHttpError, callProcedure } = require('../src/db');

test('šablonai išvalo HTML iš naudotojo duomenų', () => {
  const { html } = render('ACCESS_REQUEST_NEW', { companyName: '<script>alert(1)</script>', companyCode: '1', contactName: 'a', contactEmail: 'b' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('visi DB naudojami šablonai egzistuoja', () => {
  for (const t of ['TEST', 'ACCESS_REQUEST_RECEIVED', 'ACCESS_REQUEST_NEW', 'ACCESS_REQUEST_REJECTED', 'ACCESS_APPROVED_INVITATION',
    'USER_INVITATION', 'ORDER_STATUS_CHANGED', 'ORDER_SUBMITTED', 'ORDER_TO_MANUFACTURER']) {
    assert.ok(render(t, {}).subject.length > 0, t);
  }
});

test('SQL verslo klaidos paverčiamos HTTP kodais', () => {
  assert.equal(toHttpError({ number: 51001, message: 'x' }).status, 403);
  assert.equal(toHttpError({ number: 51005, message: 'x' }).status, 409);
  assert.equal(toHttpError({ number: 51007, message: 'x' }).status, 429);
  assert.equal(toHttpError({ number: 547, message: 'FK' }), null);
});

test('leidžiamos tik api.* procedūros', async () => {
  await assert.rejects(callProcedure('admin.Catalog_ImportVersion'), /Neleistinas/);
  await assert.rejects(callProcedure('api.Order_Get; DROP TABLE x'), /Neleistinas/);
  await assert.rejects(callProcedure('sys.sp_executesql'), /Neleistinas/);
});
