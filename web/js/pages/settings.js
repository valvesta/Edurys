import { api } from '../api.js';
import { h, table, badge, fmtDate, pageHeader, loading, errorBox, formModal, toast } from '../ui.js';

const VERSION_STATUS = { DRAFT: 'Juodraštis', PUBLISHED: 'Galioja', RETIRED: 'Nebegalioja' };
const EMAIL_STATUS = { PENDING: 'Laukia', SENDING: 'Siunčiamas', SENT: 'Išsiųstas', FAILED: 'Nepavyko' };

export async function settings(root, ctx) {
  const isGlobal = ctx.me.roleLevel >= 40;
  const sBody = h('div', {}, loading());
  const cBody = h('div', {}, loading());
  root.append(...[pageHeader('Nustatymai'),
    h('h2', {}, 'Sistema'), isGlobal ? null : h('p', { class: 'muted' }, 'Keisti gali tik globalus administratorius.'), sBody,
    h('h2', {}, 'Gamintojai ir katalogai'), cBody].filter(Boolean));

  try {
    const rows = await api.get('/admin/settings');
    sBody.replaceChildren(table([
      { label: 'Nustatymas', render: r => h('div', {}, h('strong', {}, r.SettingKey), h('div', { class: 'muted small' }, r.Description)) },
      { label: 'Reikšmė', render: r => r.SettingValue || h('span', { class: 'muted' }, 'nenustatyta') },
      { label: 'Atnaujinta', render: r => fmtDate(r.UpdatedAt) },
      { label: '', render: r => isGlobal ? h('button', { class: 'btn', onclick: () => editSetting(r, ctx) }, 'Keisti') : '' },
    ], rows));
  } catch (e) { sBody.replaceChildren(errorBox(e)); }

  try {
    const rows = await api.get('/admin/catalog-versions');
    cBody.replaceChildren(table([
      { label: 'Gamintojas', render: r => h('div', {}, h('strong', {}, r.ManufacturerName),
        h('div', { class: 'muted small' }, 'Užsakymai siunčiami: ', r.ManufacturerOrderEmail || 'nenustatyta')) },
      { label: 'Katalogas', render: r => h('div', {}, r.Name, h('div', { class: 'muted small' }, r.Code)) },
      { label: 'Statusas', render: r => badge(r.Status, VERSION_STATUS[r.Status]) },
      { label: 'Šeimos / modeliai', align: 'right', render: r => `${r.Families} / ${r.Models}` },
      { label: 'Užsakymai', align: 'right', key: 'Orders' },
      { label: 'Paskelbta', render: r => fmtDate(r.PublishedAt) },
      { label: '', render: r => h('button', { class: 'btn', onclick: () => editManufacturerEmail(r, ctx) }, 'Užsakymų el. paštas') },
    ], rows));
  } catch (e) { cBody.replaceChildren(errorBox(e)); }
}

async function editSetting(r, ctx) {
  const v = await formModal({ title: r.SettingKey, intro: r.Description,
    fields: [{ name: 'value', label: 'Reikšmė', value: r.SettingValue || '', maxlength: 1000 }] });
  if (!v) return;
  try { await api.put('/admin/settings/' + r.SettingKey, { value: v.value || null }); toast('Išsaugota.'); ctx.reload(); }
  catch (e) { toast(e.message, 'bad'); }
}

async function editManufacturerEmail(r, ctx) {
  const v = await formModal({ title: `${r.ManufacturerName}: užsakymų el. paštas`,
    intro: 'Pakeitus užsakymo statusą į „Išsiųstas gamintojui", užsakymas bus išsiųstas šiuo adresu.',
    fields: [{ name: 'email', label: 'El. paštas', type: 'email', value: r.ManufacturerOrderEmail || '', maxlength: 320 }] });
  if (!v) return;
  try { await api.put(`/admin/manufacturers/${r.ManufacturerId}/order-email`, { email: v.email || null }); toast('Išsaugota.'); ctx.reload(); }
  catch (e) { toast(e.message, 'bad'); }
}

export async function emails(root, ctx) {
  const status = ctx.query.get('status') || '';
  const tabs = h('div', { class: 'tabs' }, [['', 'Visi'], ['PENDING', 'Laukia'], ['FAILED', 'Nepavykę'], ['SENT', 'Išsiųsti']]
    .map(([v, l]) => h('a', { href: '/laiskai?status=' + v, 'data-link': '', class: v === status ? 'tab active' : 'tab' }, l)));
  const body = h('div', {}, loading());
  root.append(pageHeader('Laiškai'),
    h('p', { class: 'muted' }, 'Sistemos siunčiami laiškai. Kol nesukonfigūruotas paštas, laiškai kaupiami eilėje ir bus išsiųsti vėliau.'),
    tabs, body);
  try {
    const rows = await api.get('/admin/emails' + (status ? '?status=' + status : ''));
    body.replaceChildren(table([
      { label: 'Sukurta', render: r => fmtDate(r.CreatedAt) },
      { label: 'Šablonas', key: 'TemplateCode' },
      { label: 'Gavėjas', key: 'ToAddress' },
      { label: 'Susiję', render: r => r.RelatedEntity ? `${r.RelatedEntity} #${r.RelatedId}` : '—' },
      { label: 'Statusas', render: r => h('div', {}, badge(r.Status, EMAIL_STATUS[r.Status]),
        r.LastError ? h('div', { class: 'muted small clip' }, r.LastError) : null) },
      { label: 'Išsiųsta', render: r => fmtDate(r.SentAt) },
      { label: '', render: r => r.Status === 'FAILED' ? h('button', { class: 'btn', onclick: async () => {
        try { await api.post(`/admin/emails/${r.EmailId}/retry`); toast('Bus bandoma iš naujo.'); ctx.reload(); } catch (e) { toast(e.message, 'bad'); }
      } }, 'Kartoti') : '' },
    ], rows, { empty: 'Laiškų nėra.' }));
  } catch (e) { body.replaceChildren(errorBox(e)); }
}

export async function audit(root) {
  const body = h('div', {}, loading());
  root.append(pageHeader('Veiksmų žurnalas'), h('p', { class: 'muted' }, 'Paskutiniai 300 įrašų. Žurnalo pakeisti ar ištrinti neįmanoma.'), body);
  try {
    const rows = await api.get('/admin/audit');
    body.replaceChildren(table([
      { label: 'Laikas', render: r => fmtDate(r.OccurredAt) },
      { label: 'Kas', render: r => r.ActorEmail || h('span', { class: 'muted' }, 'sistema') },
      { label: 'Veiksmas', key: 'Action' },
      { label: 'Objektas', render: r => `${r.EntityType} ${r.EntityId || ''}` },
      { label: 'Detalės', render: r => r.DetailsJson ? h('code', { class: 'clip' }, r.DetailsJson) : '—' },
    ], rows));
  } catch (e) { body.replaceChildren(errorBox(e)); }
}
