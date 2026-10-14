'use strict';
/* Nuotraukų leidimas (SAS): tik skaityti, tik konteineris, tik HTTPS, 2 val. */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_BASE_URL = 'https://durys.example';
process.env.DB_SERVER = 'x.database.windows.net';
process.env.DB_NAME = 'x';
process.env.AUTH_PROVIDERS = JSON.stringify([{ name: 't', issuer: 'https://login.microsoftonline.com/t/v2.0',
  jwksUri: 'https://login.microsoftonline.com/t/discovery/v2.0/keys', audience: 'api' }]);
process.env.MEDIA_ACCOUNT = 'edurysfoto';

const { BlobServiceClient } = require('@azure/storage-blob');
let keyRequests = 0;
BlobServiceClient.prototype.getUserDelegationKey = async function (startsOn, expiresOn) {
  keyRequests++;
  return {
    signedObjectId: '94591af0-ba45-41fe-9bf2-75b939a8493b', signedTenantId: '93fb58f1-13db-4382-b5fa-2bb86e1406f1',
    signedStartsOn: startsOn, signedExpiresOn: expiresOn, signedService: 'b', signedVersion: '2025-01-05',
    value: Buffer.alloc(32, 7).toString('base64'),
  };
};

const { mediaConfig } = require('../src/media');

test('leidimas: tik skaityti, konteineris, HTTPS, ~2 val.', async () => {
  const c = await mediaConfig();
  assert.equal(c.baseUrl, 'https://edurysfoto.blob.core.windows.net/images');
  const q = new URLSearchParams(c.query);
  assert.equal(q.get('sp'), 'r', 'tik skaitymas');
  assert.equal(q.get('sr'), 'c', 'konteinerio lygis');
  assert.equal(q.get('spr'), 'https', 'tik HTTPS');
  assert.equal(q.get('skoid'), '94591af0-ba45-41fe-9bf2-75b939a8493b', 'naudotojo delegavimo raktas');
  assert.ok(q.get('sig'), 'parašas');
  const hours = (new Date(q.get('se')) - Date.now()) / 3600e3;
  assert.ok(hours > 1.9 && hours <= 2.01, 'galioja ~2 val.: ' + hours);
});

test('leidimas pakartotinai naudojamas, raktas neprašomas kiekvieną kartą', async () => {
  const a = await mediaConfig();
  const b = await mediaConfig();
  assert.equal(a.query, b.query);
  assert.equal(keyRequests, 1);
});
