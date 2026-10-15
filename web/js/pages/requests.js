import { api } from '../api.js';
import { h, table, badge, fmtDate, pageHeader, loading, errorBox, formModal, toast, showInviteLink } from '../ui.js';

const FILTERS = [['PENDING', 'Laukia'], ['APPROVED', 'Patvirtintos'], ['REJECTED', 'Atmestos'], ['', 'Visos']];
const STATUS_NAME = { PENDING: 'Laukia', APPROVED: 'Patvirtinta', REJECTED: 'Atmesta' };

export async function accessRequests(root, ctx) {
  const status = ctx.query.has('status') ? ctx.query.get('status') : 'PENDING';
  const tabs = h('div', { class: 'tabs' }, FILTERS.map(([v, l]) => h('a', {
    href: '/uzklausos?status=' + v, 'data-link': '', class: v === status ? 'tab active' : 'tab',
  }, l)));
  const body = h('div', {}, loading());
  root.append(pageHeader('Įmonių prisijungimo užklausos',
    h('a', { class: 'btn', href: '/prisijungimo-uzklausa', target: '_blank' }, 'Vieša užklausos forma ↗')), tabs, body);

  try {
    const rows = await api.get('/admin/access-requests' + (status ? '?status=' + status : ''));
    body.replaceChildren(table([
      { label: 'Gauta', render: r => fmtDate(r.SubmittedAt) },
      { label: 'Įmonė', render: r => h('div', {}, h('strong', {}, r.CompanyName), h('div', { class: 'muted small' }, 'Kodas ', r.CompanyCode, r.VatCode ? ' · PVM ' + r.VatCode : '')) },
      { label: 'Kontaktas', render: r => h('div', {}, r.ContactName, h('div', { class: 'muted small' }, r.ContactEmail, r.ContactPhone ? ' · ' + r.ContactPhone : '')) },
      { label: 'Žinutė', render: r => r.Message ? h('div', { class: 'clip' }, r.Message) : '—' },
      { label: 'Statusas', render: r => h('div', {}, badge(r.Status, STATUS_NAME[r.Status]),
        r.ReviewNote ? h('div', { class: 'muted small' }, r.ReviewNote) : null) },
      { label: '', render: r => r.Status !== 'PENDING' ? '' : h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-primary', onclick: e => { e.stopPropagation(); approve(r, ctx); } }, 'Patvirtinti'),
        h('button', { class: 'btn', onclick: e => { e.stopPropagation(); reject(r, ctx); } }, 'Atmesti')) },
    ], rows, { empty: status === 'PENDING' ? 'Naujų užklausų nėra.' : 'Įrašų nėra.' }));
  } catch (e) { body.replaceChildren(errorBox(e)); }
}

async function approve(r, ctx) {
  const v = await formModal({
    title: `Patvirtinti: ${r.CompanyName}`,
    intro: `Bus sukurta įmonė, o ${r.ContactName} (${r.ContactEmail}) gaus kvietimą kaip įmonės atstovas.`,
    fields: [{ name: 'note', label: 'Pastaba (vidinė)', type: 'textarea', maxlength: 1000 }],
    submitLabel: 'Patvirtinti ir pakviesti',
  });
  if (!v) return;
  try {
    const x = await api.post(`/admin/access-requests/${r.AccessRequestId}/approve`, { note: v.note || null });
    if (x.inviteUrl) await showInviteLink(x.inviteUrl); else toast('Įmonė sukurta, kvietimas išsiųstas.');
    ctx.reload();
  } catch (e) { toast(e.message, 'bad'); }
}

async function reject(r, ctx) {
  const v = await formModal({
    title: `Atmesti: ${r.CompanyName}`,
    intro: 'Priežastis bus išsiųsta kontaktiniam asmeniui el. paštu.',
    fields: [{ name: 'note', label: 'Priežastis', type: 'textarea', required: true, maxlength: 1000 }],
    submitLabel: 'Atmesti', danger: true,
  });
  if (!v) return;
  try {
    await api.post(`/admin/access-requests/${r.AccessRequestId}/reject`, { note: v.note });
    toast('Užklausa atmesta.');
    ctx.reload();
  } catch (e) { toast(e.message, 'bad'); }
}
