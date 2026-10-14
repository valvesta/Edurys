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
  });
  return list;
}

module.exports = {
  port: Number(process.env.PORT || 8080),
  appBaseUrl: req('APP_BASE_URL').replace(/\/+$/, ''),
  authProviders: loadProviders(),
  invitationDays: Number(process.env.INVITATION_DAYS || 7),
  db: {
    server: req('DB_SERVER'),
    database: req('DB_NAME'),
  },
  mail: {
    senderMailbox: process.env.MAIL_SENDER || null,   // pvz. uzsakymai@jupoja.lt (bendra dėžutė)
  },
  isProduction: process.env.NODE_ENV === 'production',
};
