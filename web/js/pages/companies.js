import { api } from '../api.js';
import { h, table, badge, fmtDate, pageHeader, loading, errorBox, confirmModal, formModal, toast } from '../ui.js';

export async function companies(root, ctx) {
  const body = h('div', {}, loading());
  root.append(pageHeader('Įmonės',
    h('button', { class: 'btn btn-primary', 'data-role': 'new-company', onclick: () => createCompany(ctx) }, '+ Nauja įmonė')), body);
  try {
    const rows = await api.get('/admin/companies');
    body.replaceChildren(table([
      { label: 'Įmonė', render: r => h('div', {}, h('strong', {}, r.Name), h('div', { class: 'muted small' }, 'Kodas ', r.CompanyCode, r.VatCode ? ' · PVM ' + r.VatCode : '')) },
      { label: 'Kontaktai', render: r => h('div', { class: 'small' }, r.Email || '—', r.Phone ? h('div', {}, r.Phone) : null) },
      { label: 'Aktyvūs naudotojai', align: 'right', key: 'ActiveUsers' },
      { label: 'Užsakymai', align: 'right', key: 'OrderCount' },
      { label: 'Statusas', render: r => badge(r.Status, r.Status === 'ACTIVE' ? 'Aktyvi' : 'Sustabdyta') },
      { label: 'Sukurta', render: r => fmtDate(r.CreatedAt) },
      { label: '', render: r => h('div', { class: 'row-actions' },
        h('a', { class: 'btn', href: '/naudotojai?companyId=' + r.CompanyId, 'data-link': '', onclick: e => e.stopPropagation() }, 'Naudotojai'),
        h('button', { class: r.Status === 'ACTIVE' ? 'btn btn-danger' : 'btn', onclick: e => { e.stopPropagation(); toggle(r, ctx); } },
          r.Status === 'ACTIVE' ? 'Sustabdyti' : 'Aktyvuoti')) },
    ], rows, { empty: 'Įmonių dar nėra. Sukurkite mygtuku „+ Nauja įmonė“ arba patvirtinkite prisijungimo užklausą.' }));
  } catch (e) { body.replaceChildren(errorBox(e)); }
}

async function toggle(r, ctx) {
  const suspend = r.Status === 'ACTIVE';
  const ok = await confirmModal(suspend ? `Sustabdyti ${r.Name}?` : `Aktyvuoti ${r.Name}?`,
    suspend ? 'Visi šios įmonės naudotojai nebegalės prisijungti, kol įmonė vėl nebus aktyvuota. Duomenys neištrinami.'
      : 'Įmonės naudotojai vėl galės prisijungti.',
    suspend ? 'Sustabdyti' : 'Aktyvuoti', suspend);
  if (!ok) return;
  try {
    await api.post(`/admin/companies/${r.CompanyId}/status`, { status: suspend ? 'SUSPENDED' : 'ACTIVE', revision: r.Revision });
    toast('Išsaugota.');
    ctx.reload();
  } catch (e) { toast(e.message, 'bad'); }
}

async function createCompany(ctx) {
  const v = await formModal({
    title: 'Nauja įmonė',
    intro: 'Sukūrus įmonę, jos darbuotojus pakvieskite skiltyje „Naudotojai“ (mygtukas „Naudotojai“ prie įmonės).',
    fields: [
      { name: 'name', label: 'Pavadinimas', required: true, maxlength: 200, placeholder: 'UAB …' },
      { name: 'companyCode', label: 'Įmonės kodas', required: true, maxlength: 50 },
      { name: 'vatCode', label: 'PVM mokėtojo kodas', maxlength: 50, placeholder: 'LT…' },
      { name: 'address', label: 'Adresas', maxlength: 400 },
      { name: 'phone', label: 'Telefonas', maxlength: 50 },
      { name: 'email', label: 'El. paštas', type: 'email', maxlength: 320 },
    ],
    submitLabel: 'Sukurti',
  });
  if (!v) return;
  try {
    await api.post('/admin/companies', {
      name: v.name, companyCode: v.companyCode, vatCode: v.vatCode || null,
      address: v.address || null, phone: v.phone || null, email: v.email || null,
    });
    toast('Įmonė sukurta.');
    ctx.reload();
  } catch (e) { toast(e.message, 'bad'); }
}
