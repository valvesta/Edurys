'use strict';
/* ==========================================================================
   Laiškų siuntimas.

   Veikia kartu su programa (server.js paleidžia startWorker), arba atskirai:
   npm run worker. Išjungti: aplinkos kintamasis EMAIL_WORKER=off.

   Siuntėjo dėžutė — nustatymas MAIL_SENDER (Nustatymai, keičia globalus
   administratorius); jei nenurodyta — App Service nustatymas MAIL_SENDER.
   Kol dėžutė nenurodyta, laiškai tik kaupiami eilėje (nesiunčiami).

   Siunčiama per Microsoft Graph programos tapatybe (Managed Identity), kuriai
   suteikta Graph teisė Mail.Send, Exchange'e APRIBOTA tik ta dėžute
   (RBAC for Applications) — žr. docs/AZURE_PARUOSIMAS.md.
   ========================================================================== */
const os = require('os');
const { DefaultAzureCredential } = require('@azure/identity');
const config = require('../config');
const { sql, callProcedure } = require('../db');
const { render } = require('./templates');

const WORKER_ID = `${os.hostname()}-${process.pid}`;
const credential = new DefaultAzureCredential();

let senderCache = { at: 0, value: null };
async function currentSender() {
  if (Date.now() - senderCache.at < 60000) return senderCache.value;
  const r = await callProcedure('api.Email_GetSender', {});
  const v = (r.recordset[0] && r.recordset[0].Sender) || config.mail.senderMailbox || null;
  senderCache = { at: Date.now(), value: v };
  return v;
}

async function sendViaGraph(sender, to, subject, html) {
  const { token } = await credential.getToken('https://graph.microsoft.com/.default');
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { subject, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: to } }] },
      saveToSentItems: true,
    }),
  });
  if (res.status !== 202) throw new Error(`Graph ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.headers.get('request-id');
}

async function tick() {
  const sender = await currentSender();
  if (!sender) return 0;                 // paštas neprijungtas — laiškai lieka eilėje
  const r = await callProcedure('api.Email_ClaimBatch', {
    WorkerId: [sql.NVarChar(100), WORKER_ID], BatchSize: [sql.Int, 10], LeaseSeconds: [sql.Int, 120],
  });
  for (const e of r.recordset) {
    try {
      const { subject, html } = render(e.TemplateCode, e.PayloadJson ? JSON.parse(e.PayloadJson) : {});
      const id = await sendViaGraph(sender, e.ToAddress, subject, html);
      await callProcedure('api.Email_MarkSent', {
        EmailId: [sql.BigInt, e.EmailId], WorkerId: [sql.NVarChar(100), WORKER_ID], ProviderMessageId: [sql.NVarChar(200), id],
      });
    } catch (err) {
      console.error(JSON.stringify({ level: 'warn', emailId: e.EmailId, message: err.message }));
      await callProcedure('api.Email_MarkFailed', {
        EmailId: [sql.BigInt, e.EmailId], WorkerId: [sql.NVarChar(100), WORKER_ID], Error: [sql.NVarChar(2000), err.message],
      });
    }
  }
  return r.recordset.length;
}

async function loop() {
  for (;;) {
    let n = 0;
    try { n = await tick(); } catch (e) { console.error(JSON.stringify({ level: 'error', message: e.message })); }
    await new Promise(r => setTimeout(r, n > 0 ? 1000 : 15000));
  }
}

let started = false;
function startWorker() {
  if (started || process.env.EMAIL_WORKER === 'off') return;
  started = true;
  setTimeout(loop, 5000);                 // po programos paleidimo
}

if (require.main === module) loop();
module.exports = { tick, startWorker };
