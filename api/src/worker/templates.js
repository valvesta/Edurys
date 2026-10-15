'use strict';
/* Laiškų šablonai. Visi duomenys iš PayloadJson HTML-išvalomi (esc), todėl
   naudotojo įvestas tekstas (pvz. įmonės pavadinimas) negali įterpti kodo. */

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, cur) => new Intl.NumberFormat('lt-LT', { style: 'currency', currency: cur || 'EUR' }).format(Number(n || 0));
const date = d => (d ? new Date(d).toLocaleString('lt-LT', { timeZone: 'Europe/Vilnius' }) : '');

function layout(title, body) {
  return `<!doctype html><html lang="lt"><body style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222;max-width:640px">
<h2 style="font-size:18px">${esc(title)}</h2>${body}
<p style="color:#888;font-size:12px;margin-top:32px">Šis laiškas išsiųstas automatiškai. Į jį atsakyti nereikia.</p></body></html>`;
}

const templates = {
  ACCESS_REQUEST_RECEIVED: p => ({
    subject: 'Jūsų prisijungimo užklausa gauta',
    html: layout('Užklausa gauta', `<p>Sveiki, ${esc(p.contactName)},</p>
<p>gavome įmonės <b>${esc(p.companyName)}</b> prisijungimo užklausą. Kai administratorius ją peržiūrės, gausite laišką su tolimesniais žingsniais.</p>`),
  }),
  ACCESS_REQUEST_NEW: p => ({
    subject: `Nauja prisijungimo užklausa: ${p.companyName}`,
    html: layout('Nauja įmonės užklausa', `<p>Įmonė: <b>${esc(p.companyName)}</b> (kodas ${esc(p.companyCode)})<br>
Kontaktinis asmuo: ${esc(p.contactName)}, ${esc(p.contactEmail)}</p><p>Peržiūrėkite ją administravimo skiltyje.</p>`),
  }),
  ACCESS_REQUEST_REJECTED: p => ({
    subject: 'Dėl jūsų prisijungimo užklausos',
    html: layout('Užklausa nepatvirtinta', `<p>Sveiki, ${esc(p.contactName)},</p>
<p>įmonės <b>${esc(p.companyName)}</b> prisijungimo užklausa nepatvirtinta.</p><p>Priežastis: ${esc(p.reason)}</p>`),
  }),
  ACCESS_APPROVED_INVITATION: p => ({
    subject: 'Jūsų įmonės prisijungimas patvirtintas',
    html: layout('Prisijungimas patvirtintas', `<p>Sveiki, ${esc(p.displayName)},</p>
<p>įmonė <b>${esc(p.companyName)}</b> patvirtinta, o jūs paskirtas įmonės atstovu.</p>
<p><a href="${esc(p.inviteUrl)}">Aktyvuoti paskyrą</a> (nuoroda galioja iki ${esc(date(p.expiresAt))}).</p>
<p>Atidarę nuorodą spauskite „Klientams (kodas el. paštu)“ ir įveskite šį el. pašto adresą — atsiųsime vienkartinį kodą. Slaptažodžio nereikia.</p>`),
  }),
  USER_INVITATION: p => ({
    subject: 'Kvietimas prisijungti',
    html: layout('Kvietimas prisijungti', `<p>Sveiki${p.displayName ? ', ' + esc(p.displayName) : ''},</p>
<p>${esc(p.invitedBy || 'Administratorius')} kviečia jus prisijungti${p.companyName ? ' kaip įmonės <b>' + esc(p.companyName) + '</b> narį' : ''} (rolė: ${esc(p.roleName)}).</p>
<p><a href="${esc(p.inviteUrl)}">Priimti kvietimą</a> (galioja iki ${esc(date(p.expiresAt))}).</p>
${p.companyName ? '<p>Atidarę nuorodą spauskite „Klientams (kodas el. paštu)“ ir įveskite šį el. pašto adresą — atsiųsime vienkartinį kodą. Slaptažodžio nereikia.</p>' : '<p>Atidarę nuorodą spauskite „Darbuotojams (Microsoft 365)“.</p>'}`),
  }),
  ORDER_STATUS_CHANGED: p => ({
    subject: `Užsakymas ${p.orderNumber}: ${p.toStatusName}`,
    html: layout(`Užsakymo ${p.orderNumber} būsena pasikeitė`, `<p>Nauja būsena: <b>${esc(p.toStatusName)}</b></p>
${p.comment ? `<p>Komentaras: ${esc(p.comment)}</p>` : ''}<p>Suma su PVM: ${esc(money(p.grossTotal, p.currencyCode))}</p>`),
  }),
  ORDER_SUBMITTED: p => ({
    subject: `Pateiktas užsakymas ${p.orderNumber} (${p.companyName})`,
    html: layout('Pateiktas naujas užsakymas', `<p>Įmonė: <b>${esc(p.companyName)}</b><br>Užsakymas: ${esc(p.orderNumber)}
${p.customerReference ? '<br>Objektas: ' + esc(p.customerReference) : ''}<br>Suma su PVM: ${esc(money(p.grossTotal, p.currencyCode))}</p>`),
  }),
  ORDER_TO_MANUFACTURER: p => {
    const o = p.order || {};
    const rows = (p.lines || []).map(l => `<tr><td>${esc(l.lineNumber)}</td><td>${esc(l.description)}</td>
<td style="text-align:right">${esc(l.quantity)}</td><td style="text-align:right">${esc(money(l.lineNetTotal, o.currencyCode))}</td></tr>`).join('');
    return {
      subject: `Užsakymas ${o.orderNumber}`,
      html: layout(`Užsakymas ${o.orderNumber}`, `<p>Užsakovas: <b>${esc(o.companyName)}</b>${o.customerReference ? '<br>Objektas: ' + esc(o.customerReference) : ''}</p>
<table cellpadding="6" style="border-collapse:collapse" border="1"><tr><th>Nr.</th><th>Aprašymas</th><th>Kiekis</th><th>Suma be PVM</th></tr>${rows}</table>
<p>Iš viso be PVM: <b>${esc(money(o.netTotal, o.currencyCode))}</b></p>`),
    };
  },
};

function render(templateCode, payload) {
  const t = templates[templateCode];
  if (!t) throw new Error(`Nežinomas laiško šablonas: ${templateCode}`);
  return t(payload || {});
}

module.exports = { render, templates, esc };
