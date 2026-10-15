/* Bendri vaizdo elementai. Visas tekstas įterpiamas kaip tekstas (ne HTML),
   todėl naudotojų įvesti duomenys negali įterpti kodo. */

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const fmtMoney = (n, cur) => new Intl.NumberFormat('lt-LT', { style: 'currency', currency: cur || 'EUR' }).format(Number(n || 0));
export const fmtDate = d => (d ? new Date(d).toLocaleString('lt-LT', { timeZone: 'Europe/Vilnius', dateStyle: 'short', timeStyle: 'short' }) : '—');

const KIND = {
  DRAFT: 'muted', SUBMITTED: 'info', CONFIRMED: 'info', SENT_TO_MANUFACTURER: 'accent', IN_PRODUCTION: 'warn',
  DELIVERED: 'ok', CANCELLED: 'bad', PENDING: 'warn', APPROVED: 'ok', REJECTED: 'bad', ACTIVE: 'ok',
  INVITED: 'info', DISABLED: 'muted', SUSPENDED: 'muted', SENT: 'ok', FAILED: 'bad', SENDING: 'info',
  PUBLISHED: 'ok', RETIRED: 'muted',
};
export const badge = (code, text) => h('span', { class: `badge badge-${KIND[code] || 'muted'}` }, text || code);

export function table(columns, rows, opts = {}) {
  if (!rows.length) return h('div', { class: 'empty' }, opts.empty || 'Įrašų nėra.');
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, columns.map(c => h('th', { class: c.align === 'right' ? 'num' : '' }, c.label)))),
      h('tbody', {}, rows.map(r => h('tr', {
        class: opts.onRowClick ? 'clickable' : '',
        onclick: opts.onRowClick ? () => opts.onRowClick(r) : null,
      }, columns.map(c => h('td', { class: c.align === 'right' ? 'num' : '' }, c.render ? c.render(r) : (r[c.key] ?? '—'))))))));
}

export function toast(message, kind = 'ok') {
  const t = h('div', { class: `toast toast-${kind}` }, message);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 8000 : 4000);
}

export function errorBox(err) {
  return h('div', { class: 'alert alert-bad' }, err && err.message ? err.message : String(err));
}

export const loading = () => h('div', { class: 'loading' }, 'Kraunama…');

/* Modalinis langas su forma. Grąžina įvestas reikšmes arba null (atšaukta). */
export function formModal({ title, intro, fields, submitLabel = 'Išsaugoti', danger = false }) {
  return new Promise(resolve => {
    const inputs = {};
    const body = h('div', { class: 'form' },
      intro ? h('p', { class: 'muted' }, intro) : null,
      fields.map(f => {
        let input;
        if (f.type === 'select') {
          input = h('select', { name: f.name, required: f.required }, f.options.map(o => h('option', { value: o.value }, o.label)));
          if (f.value !== undefined) input.value = f.value;
        } else if (f.type === 'textarea') {
          input = h('textarea', { name: f.name, rows: 3, required: f.required, maxlength: f.maxlength });
          input.value = f.value || '';
        } else {
          input = h('input', { name: f.name, type: f.type || 'text', required: f.required, maxlength: f.maxlength, placeholder: f.placeholder });
          input.value = f.value || '';
        }
        inputs[f.name] = input;
        // Neprivalomas mygtukas šalia lauko (pvz. „Ieškoti registre“) ir pranešimo eilutė po juo
        if (f.action) {
          const note = h('small', { class: 'field-note', 'data-role': 'note-' + f.name });
          const setNote = (text, kind) => { note.textContent = text || ''; note.className = 'field-note' + (kind ? ' note-' + kind : ''); };
          const btn = h('button', { type: 'button', class: 'btn', 'data-role': 'action-' + f.name }, f.action.label);
          btn.addEventListener('click', async () => {
            btn.disabled = true; setNote('Ieškoma…');
            try { await f.action.run(inputs, setNote); } catch (e) { setNote(e.message, 'bad'); } finally { btn.disabled = false; }
          });
          return h('div', { class: 'field' }, h('span', {}, f.label, f.required ? ' *' : ''),
            h('div', { class: 'field-row' }, input, btn), note, f.hint ? h('small', {}, f.hint) : null);
        }
        return h('label', { class: 'field' }, h('span', {}, f.label, f.required ? ' *' : ''), input, f.hint ? h('small', {}, f.hint) : null);
      }));
    const form = h('form', { class: 'modal', onsubmit: e => {
      e.preventDefault();
      const values = {};
      for (const [k, el] of Object.entries(inputs)) values[k] = el.value.trim();
      close(values);
    } },
    h('h2', {}, title), body,
    h('div', { class: 'modal-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => close(null) }, 'Atšaukti'),
      h('button', { type: 'submit', class: danger ? 'btn btn-danger' : 'btn btn-primary' }, submitLabel)));
    const overlay = h('div', { class: 'overlay', onclick: e => { if (e.target === overlay) close(null); } }, form);
    function close(v) { overlay.remove(); document.removeEventListener('keydown', esc); resolve(v); }
    function esc(e) { if (e.key === 'Escape') close(null); }
    document.addEventListener('keydown', esc);
    document.body.append(overlay);
    const first = form.querySelector('input,select,textarea');
    if (first) first.focus();
  });
}

export const confirmModal = (title, text, submitLabel = 'Patvirtinti', danger = false) =>
  formModal({ title, intro: text, fields: [], submitLabel, danger }).then(v => v !== null);

/* Mygtukas, kuris paspaudus užsiblokuoja, kol baigiasi veiksmas, ir parodo klaidą. */
export function actionButton(label, fn, cls = 'btn') {
  const b = h('button', { class: cls, type: 'button' }, label);
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await fn(); } catch (e) { toast(e.message, 'bad'); } finally { b.disabled = false; }
  });
  return b;
}

export const pageHeader = (title, ...actions) => h('div', { class: 'page-head' }, h('h1', {}, title), h('div', { class: 'page-actions' }, actions));
