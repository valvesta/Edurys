import { api } from '../api.js';
import { h, table, badge, fmtMoney, fmtDate, pageHeader, loading, errorBox, formModal, toast } from '../ui.js';

/* Mygtukų tekstai — veiksmai (statusų pavadinimai rodomi ženkliukuose). */
const ACTION_LABEL = {
  SUBMITTED: 'Pateikti', CONFIRMED: 'Patvirtinti', DRAFT: 'Grąžinti taisyti', SENT_TO_MANUFACTURER: 'Išsiųsti gamintojui',
  IN_PRODUCTION: 'Pažymėti: gaminamas', DELIVERED: 'Pažymėti: pristatytas', CANCELLED: 'Atšaukti',
};

const STATUSES = [
  ['', 'Visi statusai'], ['DRAFT', 'Juodraštis'], ['SUBMITTED', 'Pateiktas'], ['CONFIRMED', 'Patvirtintas'],
  ['SENT_TO_MANUFACTURER', 'Išsiųstas gamintojui'], ['IN_PRODUCTION', 'Gaminamas'], ['DELIVERED', 'Pristatytas'], ['CANCELLED', 'Atšauktas'],
];

export async function ordersList(root, ctx) {
  const state = { status: ctx.query.get('status') || '', q: ctx.query.get('q') || '', page: Number(ctx.query.get('page') || 1) };
  const status = h('select', { 'data-role': 'filter-status' }, STATUSES.map(([v, l]) => h('option', { value: v }, l)));
  status.value = state.status;
  const search = h('input', { type: 'search', placeholder: 'Ieškoti: nr., objektas, įmonė', value: state.q, 'data-role': 'filter-search' });
  const apply = () => ctx.navigate(`/uzsakymai?status=${encodeURIComponent(status.value)}&q=${encodeURIComponent(search.value.trim())}`);
  status.addEventListener('change', apply);
  search.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });

  const body = h('div', {}, loading());
  root.append(
    pageHeader('Užsakymai'),
    h('div', { class: 'filters' }, status, search),
    body);

  try {
    const p = new URLSearchParams({ page: state.page, pageSize: 50 });
    if (state.status) p.set('status', state.status);
    if (state.q) p.set('q', state.q);
    const data = await api.get('/orders?' + p);
    const isAdmin = ctx.me.roleLevel >= 30;
    body.replaceChildren(
      table([
        { label: 'Nr.', render: r => h('strong', {}, r.OrderNumber) },
        { label: 'Statusas', render: r => badge(r.StatusCode, r.StatusName) },
        isAdmin ? { label: 'Įmonė', key: 'CompanyName' } : null,
        { label: 'Objektas', render: r => r.CustomerReference || '—' },
        { label: 'Sukūrė', key: 'CreatedByName' },
        { label: 'Gamintojas', key: 'ManufacturerName' },
        { label: 'Suma su PVM', align: 'right', render: r => fmtMoney(r.GrossTotal, r.CurrencyCode) },
        { label: 'Atnaujinta', render: r => fmtDate(r.UpdatedAt) },
      ].filter(Boolean), data.items, {
        onRowClick: r => ctx.navigate('/uzsakymai/' + r.OrderId),
        empty: 'Užsakymų nėra. Nauji užsakymai kuriami konfigūratoriuje.',
      }),
      pager(data.total, state, ctx));
  } catch (e) { body.replaceChildren(errorBox(e)); }
}

function pager(total, state, ctx) {
  const pages = Math.max(1, Math.ceil(total / 50));
  if (pages <= 1) return h('div', { class: 'muted small' }, `Iš viso: ${total}`);
  const go = p => ctx.navigate(`/uzsakymai?status=${encodeURIComponent(state.status)}&q=${encodeURIComponent(state.q)}&page=${p}`);
  return h('div', { class: 'pager' },
    h('button', { class: 'btn', disabled: state.page <= 1, onclick: () => go(state.page - 1) }, '‹ Ankstesni'),
    h('span', {}, `${state.page} / ${pages} (iš viso ${total})`),
    h('button', { class: 'btn', disabled: state.page >= pages, onclick: () => go(state.page + 1) }, 'Kiti ›'));
}

export async function orderDetail(root, ctx) {
  const id = ctx.params.id;
  root.append(loading());
  let data;
  try { data = await api.get('/orders/' + encodeURIComponent(id)); } catch (e) { root.replaceChildren(errorBox(e)); return; }
  const o = data.order;

  const actions = data.allowedTransitions.map(t => h('button', {
    class: t.ToStatus === 'CANCELLED' ? 'btn btn-danger' : t.ToStatus === 'DRAFT' ? 'btn' : 'btn btn-primary',
    'data-role': 'status-' + t.ToStatus,
    onclick: async () => {
      const v = await formModal({
        title: `${ACTION_LABEL[t.ToStatus] || t.ToStatusName}: užsakymas ${o.OrderNumber}`,
        intro: `Užsakymas ${o.OrderNumber} bus pažymėtas „${t.ToStatusName}".`,
        fields: [{ name: 'comment', label: 'Komentaras', type: 'textarea', required: !!t.RequiresComment, maxlength: 1000,
          hint: t.RequiresComment ? 'Šiam veiksmui būtina nurodyti priežastį.' : 'Neprivaloma. Bus matoma istorijoje.' }],
        submitLabel: ACTION_LABEL[t.ToStatus] || t.ToStatusName, danger: t.ToStatus === 'CANCELLED',
      });
      if (!v) return;
      try {
        await api.post(`/orders/${o.OrderId}/status`, { status: t.ToStatus, revision: o.Revision, comment: v.comment || null });
        toast('Statusas pakeistas.');
        ctx.reload();
      } catch (e) { toast(e.message, 'bad'); }
    },
  }, ACTION_LABEL[t.ToStatus] || t.ToStatusName));

  root.replaceChildren(...[
    h('a', { href: '/uzsakymai', class: 'back', 'data-link': '' }, '← Užsakymai'),
    pageHeader(`Užsakymas ${o.OrderNumber}`, actions),
    h('div', { class: 'cards' },
      card('Statusas', badge(o.StatusCode, o.StatusName)),
      card('Įmonė', o.CompanyName),
      card('Objektas', o.CustomerReference || '—'),
      card('Gamintojas', `${o.ManufacturerName} (katalogas ${o.CatalogVersionCode})`),
      card('Sukūrė', `${o.CreatedByName || o.CreatedByEmail}, ${fmtDate(o.CreatedAt)}`),
      card('Pateiktas', fmtDate(o.SubmittedAt))),
    o.Notes ? h('div', { class: 'notes' }, h('strong', {}, 'Pastabos: '), o.Notes) : null,
    h('h2', {}, 'Eilutės'),
    table([
      { label: '#', key: 'LineNumber' },
      { label: 'Aprašymas', render: l => h('div', {}, h('div', {}, l.Description), lineBreakdown(l)) },
      { label: 'Kiekis', align: 'right', key: 'Quantity' },
      { label: 'Be PVM', align: 'right', render: l => fmtMoney(l.LineNetTotal, o.CurrencyCode) },
      { label: 'PVM', align: 'right', render: l => fmtMoney(l.LineVatTotal, o.CurrencyCode) },
      { label: 'Su PVM', align: 'right', render: l => fmtMoney(l.LineGrossTotal, o.CurrencyCode) },
    ], data.lines, { empty: 'Eilučių dar nėra.' }),
    h('div', { class: 'totals', 'data-role': 'order-totals' },
      h('div', {}, h('span', {}, 'Suma be PVM'), h('strong', {}, fmtMoney(o.NetTotal, o.CurrencyCode))),
      h('div', {}, h('span', {}, `PVM ${Math.round(o.VatRate * 100)} %`), h('strong', {}, fmtMoney(o.VatTotal, o.CurrencyCode))),
      h('div', { class: 'grand' }, h('span', {}, 'Iš viso'), h('strong', {}, fmtMoney(o.GrossTotal, o.CurrencyCode)))),
    h('h2', {}, 'Istorija'),
    h('ol', { class: 'timeline' }, data.history.map(x => h('li', {},
      h('div', {}, badge(x.ToStatus, x.ToStatusName), ' ', h('span', { class: 'muted' }, fmtDate(x.ChangedAt), ' · ', x.ChangedBy || '')),
      x.Comment ? h('div', { class: 'comment' }, x.Comment) : null)))].filter(Boolean));
}

function card(label, value) {
  return h('div', { class: 'card' }, h('div', { class: 'card-label' }, label), h('div', { class: 'card-value' }, value));
}

function lineBreakdown(l) {
  const rows = Array.isArray(l.priceBreakdown) ? l.priceBreakdown : [];
  if (!rows.length) return null;
  return h('details', { class: 'breakdown' }, h('summary', {}, 'Kainos išskaidymas'),
    h('ul', {}, rows.map(r => h('li', {}, h('span', {}, r.desc), h('strong', {}, fmtMoney(r.sum))))));
}
