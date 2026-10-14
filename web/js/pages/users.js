import { api } from '../api.js';
import { h, table, badge, fmtDate, pageHeader, loading, errorBox, formModal, confirmModal, toast } from '../ui.js';

const STATUS_NAME = { ACTIVE: 'Aktyvus', INVITED: 'Pakviestas', DISABLED: 'Išjungtas' };
const ROLES = [
  ['GLOBAL_ADMIN', 'Globalus administratorius', 40], ['ADMIN', 'Administratorius', 30],
  ['COMPANY_REP', 'Įmonės atstovas', 20], ['USER', 'Naudotojas', 10],
];

export async function users(root, ctx) {
  const companyId = ctx.query.get('companyId') || '';
  const isAdmin = ctx.me.roleLevel >= 30;
  const body = h('div', {}, loading());
  root.append(pageHeader(isAdmin ? 'Naudotojai' : `${ctx.me.companyName}: naudotojai`,
    h('button', { class: 'btn btn-primary', 'data-role': 'invite-user', onclick: () => invite(ctx, companyId) }, '+ Pakviesti naudotoją')), body);
  try {
    const rows = await api.get('/users' + (companyId ? '?companyId=' + encodeURIComponent(companyId) : ''));
    body.replaceChildren(...[
      companyId ? h('p', {}, 'Rodoma tik vienos įmonės naudotojai. ', h('a', { href: '/naudotojai', 'data-link': '' }, 'Rodyti visus')) : null,
      table([
        { label: 'Vardas', render: r => h('div', {}, h('strong', {}, r.DisplayName || '—'), h('div', { class: 'muted small' }, r.Email)) },
        { label: 'Rolė', key: 'RoleName' },
        isAdmin ? { label: 'Įmonė', render: r => r.CompanyName || h('span', { class: 'muted' }, 'Vidinis') } : null,
        { label: 'Statusas', render: r => badge(r.Status, STATUS_NAME[r.Status]) },
        { label: 'Paskutinis prisijungimas', render: r => fmtDate(r.LastLoginAt) },
        { label: '', render: r => r.UserId === ctx.me.userId ? h('span', { class: 'muted small' }, 'Tai jūs') : !canManage(ctx.me, r) ? '' : h('div', { class: 'row-actions' },
          r.Status === 'INVITED' ? h('button', { class: 'btn', onclick: () => resend(r) }, 'Siųsti kvietimą iš naujo') : null,
          r.Status !== 'DISABLED'
            ? h('button', { class: 'btn btn-danger', onclick: () => setStatus(r, 'DISABLED', ctx) }, 'Išjungti')
            : h('button', { class: 'btn', onclick: () => setStatus(r, 'ACTIVE', ctx) }, 'Įjungti')) },
      ].filter(Boolean), rows, { empty: 'Naudotojų nėra.' })].filter(Boolean));
  } catch (e) { body.replaceChildren(errorBox(e)); }
}

const LEVEL = Object.fromEntries(ROLES.map(([c, , l]) => [c, l]));
/* Tas pats principas kaip DB: valdyti galima tik žemesnio lygio naudotojus (globalus — visus). */
const canManage = (me, r) => me.roleLevel === 40 || (LEVEL[r.RoleCode] || 0) < me.roleLevel;

async function invite(ctx, presetCompanyId) {
  const lvl = ctx.me.roleLevel;
  const roles = ROLES.filter(([, , l]) => lvl === 40 || (lvl === 30 && l < 30) || (lvl === 20 && l === 10));
  const fields = [
    { name: 'email', label: 'El. paštas', type: 'email', required: true, maxlength: 320 },
    { name: 'displayName', label: 'Vardas, pavardė', maxlength: 200 },
    { name: 'role', label: 'Rolė', type: 'select', required: true, options: roles.map(([v, l]) => ({ value: v, label: l })), value: roles[roles.length - 1][0] },
  ];
  if (lvl >= 30) {
    const companies = await api.get('/admin/companies');
    fields.push({ name: 'companyId', label: 'Įmonė (įmonės atstovui ir naudotojui)', type: 'select',
      options: [{ value: '', label: '— vidinis (administratoriams) —' }].concat(
        companies.filter(c => c.Status === 'ACTIVE').map(c => ({ value: String(c.CompanyId), label: `${c.Name} (${c.CompanyCode})` }))),
      value: presetCompanyId || '' });
  }
  const v = await formModal({
    title: 'Pakviesti naudotoją',
    intro: 'Naudotojas gaus laišką su nuoroda. Prisijungs savo Microsoft paskyra arba el. paštu su vienkartiniu kodu; el. paštas turi sutapti su nurodytu čia.',
    fields, submitLabel: 'Siųsti kvietimą',
  });
  if (!v) return;
  try {
    await api.post('/users/invite', { email: v.email, displayName: v.displayName || null, role: v.role,
      companyId: v.companyId ? Number(v.companyId) : null });
    toast('Kvietimas išsiųstas.');
    ctx.reload();
  } catch (e) { toast(e.message, 'bad'); }
}

async function resend(r) {
  try { await api.post(`/users/${r.UserId}/resend-invitation`); toast('Naujas kvietimas išsiųstas.'); }
  catch (e) { toast(e.message, 'bad'); }
}

async function setStatus(r, status, ctx) {
  const off = status === 'DISABLED';
  const ok = await confirmModal(off ? `Išjungti ${r.DisplayName || r.Email}?` : `Įjungti ${r.DisplayName || r.Email}?`,
    off ? 'Naudotojas nebegalės prisijungti. Jo užsakymai ir istorija išlieka.' : 'Naudotojas vėl galės prisijungti.',
    off ? 'Išjungti' : 'Įjungti', off);
  if (!ok) return;
  try {
    await api.post(`/users/${r.UserId}/status`, { status, revision: r.Revision });
    toast('Išsaugota.');
    ctx.reload();
  } catch (e) { toast(e.message, 'bad'); }
}
