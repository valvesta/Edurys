'use strict';
/* ==========================================================================
   Nuotraukos (Azure Blob Storage).

   Saugykla privati: anoniminė prieiga ir prieigos raktai išjungti.
   Programa savo tapatybe (Managed Identity, rolė „Storage Blob Data Reader“)
   gauna laikiną naudotojo delegavimo raktą ir iš jo pasirašo TIK SKAITYMO
   leidimą (SAS) vienam konteineriui, galiojantį 2 valandas. Šį leidimą gauna
   tik prisijungę naudotojai (GET /api/media/config), o naršyklė nuotraukas
   ima tiesiai iš saugyklos.

   - Jokių slaptažodžių ar raktų konfigūracijoje.
   - Leidimas: tik skaityti (r), tik HTTPS, tik konteineris MEDIA_CONTAINER.
   - Sąrašo (list), rašymo ar trynimo teisių leidimas nesuteikia.

   Kūrimo aplinkai (ne produkcijai) galima nurodyti MEDIA_DEV_DIR — tada
   nuotraukos tiekiamos iš vietinio aplanko adresu /dev-media.
   ========================================================================== */
const {
  BlobServiceClient, ContainerSASPermissions, SASProtocol, generateBlobSASQueryParameters,
} = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const config = require('./config');

const SAS_HOURS = 2;          // leidimo galiojimas
const RENEW_BEFORE_MIN = 30;  // naujas leidimas išduodamas likus 30 min.
const KEY_HOURS = 24;         // delegavimo rakto galiojimas (iki 7 d. leidžiama)

let client = null;
let keyCache = null;   // { key, expiresOn }
let sasCache = null;   // { query, expiresOn }

function service() {
  if (!client) {
    client = new BlobServiceClient(`https://${config.media.account}.blob.core.windows.net`, new DefaultAzureCredential());
  }
  return client;
}

async function delegationKey(now) {
  if (keyCache && keyCache.expiresOn - now > SAS_HOURS * 3600e3 + 60e3) return keyCache.key;
  const startsOn = new Date(now - 5 * 60e3);
  const expiresOn = new Date(now + KEY_HOURS * 3600e3);
  const key = await service().getUserDelegationKey(startsOn, expiresOn);
  keyCache = { key, expiresOn: expiresOn.getTime() };
  return key;
}

async function readSas() {
  const now = Date.now();
  if (sasCache && sasCache.expiresOn - now > RENEW_BEFORE_MIN * 60e3) return sasCache;
  const key = await delegationKey(now);
  const expiresOn = new Date(now + SAS_HOURS * 3600e3);
  const query = generateBlobSASQueryParameters({
    containerName: config.media.container,
    permissions: ContainerSASPermissions.parse('r'),
    startsOn: new Date(now - 5 * 60e3),       // laikrodžių neatitikimui
    expiresOn,
    protocol: SASProtocol.Https,
  }, key, config.media.account).toString();
  sasCache = { query, expiresOn: expiresOn.getTime() };
  return sasCache;
}

/* Naršyklei: kur imti nuotraukas. baseUrl — konteinerio adresas,
   query — leidimas, kurį reikia pridėti prie kiekvieno failo adreso. */
async function mediaConfig() {
  if (config.media.account) {
    const sas = await readSas();
    return {
      baseUrl: `https://${config.media.account}.blob.core.windows.net/${config.media.container}`,
      query: sas.query,
      expiresOn: new Date(sas.expiresOn).toISOString(),
    };
  }
  if (config.media.devDir) return { baseUrl: '/dev-media', query: '', expiresOn: null };
  return { baseUrl: null, query: '', expiresOn: null };
}

module.exports = { mediaConfig };
