'use strict';
/* ==========================================================================
   Laiškų siuntimo procesas (paleidžiamas atskirai: npm run worker,
   arba kaip Azure WebJob / Container App).

   Siunčia per Microsoft Graph iš bendros pašto dėžutės (MAIL_SENDER).
   Programos tapatybė (Managed Identity) turi Graph teisę Mail.Send, kuri
   Exchange'e APRIBOTA tik ta viena dėžute (Application Access Policy /
   RBAC for Applications) — žr. docs/AZURE_PARUOSIMAS.md.
   ========================================================================== */
const os = require('os');
const { DefaultAzureCredential } = require('@azure/identity');
const config = require('../config');
const { sql, callProcedure } = require('../db');
const { render } = require('./templates');

const WORKER_ID = `${os.hostname()}-${process.pid}`;
const credential = new DefaultAzureCredential();

async function sendViaGraph(to, subject, html) {
  if (!config.mail.senderMailbox) throw new Error('Nenustatytas MAIL_SENDER');
  const { token } = await credential.getToken('https://graph.microsoft.com/.default');
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mail.senderMailbox)}/sendMail`, {
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
  const r = await callProcedure('api.Email_ClaimBatch', {
    WorkerId: [sql.NVarChar(100), WORKER_ID], BatchSize: [sql.Int, 10], LeaseSeconds: [sql.Int, 120],
  });
  for (const e of r.recordset) {
    try {
      const { subject, html } = render(e.TemplateCode, e.PayloadJson ? JSON.parse(e.PayloadJson) : {});
      const id = await sendViaGraph(e.ToAddress, subject, html);
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

if (require.main === module) loop();
module.exports = { tick };
