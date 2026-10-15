'use strict';
/* Konfigūracija TIK iš aplinkos kintamųjų (Azure App Service nustatymai,
   paslaptys — per Key Vault nuorodas). Jokių slaptažodžių kode ar faile.
   Trūkstant privalomo kintamojo, programa nepasileidžia. */

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Trūksta aplinkos kintamojo ${name}`);
  return v;
}

/* AUTH_PROVIDERS — JSON masyvas su leidžiamais prisijungimo tiekėjais, pvz.:
   [
     { "name": "staff",   "issuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
       "jwksUri": "https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys",
       "audience": "<api-client-id>" },
     { "name": "clients", "issuer": "https://<ext-tenant-id>.ciamlogin.com/<ext-tenant-id>/v2.0",
       "jwksUri": "https://<ext-subdomain>.ciamlogin.com/<ext-tenant-id>/discovery/v2.0/keys",
       "audience": "<api-client-id-in-external-tenant>" }
   ]
   Kiti žetonai (kitų nuomininkų, kitos auditorijos) atmetami. */
function loadProviders() {
  const raw = req('AUTH_PROVIDERS');
  let list;
  try { list = JSON.parse(raw); } catch (e) { throw new Error('AUTH_PROVIDERS nėra teisingas JSON'); }
  if (!Array.isArray(list) || list.length === 0) throw new Error('AUTH_PROVIDERS turi būti netuščias masyvas');
  list.forEach(p => {
    ['name', 'issuer', 'jwksUri', 'audience'].forEach(k => {
      if (!p[k]) throw new Error(`AUTH_PROVIDERS: trūksta „${k}"`);
    });
    if (!/^https:\/\//.test(p.issuer) || !/^https:\/\//.test(p.jwksUri)) throw new Error('AUTH_PROVIDERS: adresai turi būti https');
    if (p.authority && !/^https:\/\/[a-z0-9-]+\.ciamlogin\.com\/$/i.test(p.authority)) throw new Error('AUTH_PROVIDERS: authority turi būti https://<vardas>.ciamlogin.com/');
    if (p.clientId && !/^[0-9a-f-]{36}$/i.test(p.clientId)) throw new Error('AUTH_PROVIDERS: clientId turi būti GUID');
  });
  return list;
}

/* Naršyklės prisijungimo nustatymai (viešai matomi — tai ne paslaptys).
   Nuomininkas ir API leidimas išvedami iš pirmojo (darbuotojų) tiekėjo. */
function webAuth(providers) {
  const staff = providers[0];
  const m = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i.exec(staff.issuer);
  const list = [{
    name: staff.name, kind: 'staff', label: 'Darbuotojams (Microsoft 365)',
    clientId: process.env.WEB_CLIENT_ID || null,
    authority: m ? `https://login.microsoftonline.com/${m[1]}` : null,
    scope: `api://${staff.audience}/access_as_user`,
  }];
  // Klientų prisijungimas (Entra External ID) — jei nurodyta authority ir clientId
  providers.slice(1).filter(p => p.authority && p.clientId).forEach(p => list.push({
    name: p.name, kind: 'clients', label: 'Klientams (kodas el. paštu)',
    clientId: p.clientId, authority: p.authority, scope: `api://${p.audience}/access_as_user`,
  }));
  // Senesniems naršyklės failams — darbuotojų nustatymai ir viršutiniame lygyje
  return { ...list[0], providers: list };
}
const authProviders = loadProviders();

function mediaAccount() {
  const v = process.env.MEDIA_ACCOUNT;
  if (!v) return null;
  if (!/^[a-z0-9]{3,24}$/.test(v)) throw new Error('MEDIA_ACCOUNT: saugyklos vardas — 3–24 mažosios raidės ar skaičiai');
  return v;
}
function mediaContainer() {
  const v = process.env.MEDIA_CONTAINER || 'images';
  if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,62}$/.test(v)) throw new Error('MEDIA_CONTAINER: neteisingas konteinerio vardas');
  return v;
}

module.exports = {
  port: Number(process.env.PORT || 8080),
  appBaseUrl: req('APP_BASE_URL').replace(/\/+$/, ''),
  authProviders,
  webAuth: webAuth(authProviders),
  invitationDays: Number(process.env.INVITATION_DAYS || 7),
  db: {
    server: req('DB_SERVER'),
    database: req('DB_NAME'),
  },
  mail: {
    senderMailbox: process.env.MAIL_SENDER || null,   // pvz. uzsakymai@jupoja.lt (bendra dėžutė)
  },
  /* Nuotraukos: Azure saugyklos (Storage Account) vardas ir konteineris.
     MEDIA_DEV_DIR — tik kūrimo aplinkai (produkcijoje ignoruojamas). */
  media: {
    account: mediaAccount(),
    container: mediaContainer(),
    devDir: process.env.NODE_ENV !== 'production' ? (process.env.MEDIA_DEV_DIR || null) : null,
  },
  isProduction: process.env.NODE_ENV === 'production',
};
