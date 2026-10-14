/* Vieši puslapiai (be prisijungimo): įmonės prisijungimo užklausa. */
import { publicApi } from '../api.js';
import { h } from '../ui.js';

export function publicRequest(root) {
  const fields = [
    ['companyName', 'Įmonės pavadinimas', true, 200],
    ['companyCode', 'Įmonės kodas', true, 50],
    ['vatCode', 'PVM mokėtojo kodas', false, 50],
    ['address', 'Adresas', false, 400],
    ['contactName', 'Kontaktinis asmuo (vardas, pavardė)', true, 200],
    ['contactEmail', 'El. paštas', true, 320, 'email'],
    ['contactPhone', 'Telefonas', false, 50, 'tel'],
  ];
  const inputs = {};
  const msg = h('textarea', { name: 'message', rows: 4, maxlength: 2000 });
  const status = h('div', { 'data-role': 'form-status' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Siųsti užklausą');

  const form = h('form', { class: 'form public-form', onsubmit: async e => {
    e.preventDefault();
    submit.disabled = true;
    status.replaceChildren();
    const body = { message: msg.value.trim() || null };
    for (const [k, el] of Object.entries(inputs)) body[k] = el.value.trim() || null;
    try {
      await publicApi.post('/public/access-requests', body);
      root.replaceChildren(h('div', { class: 'public-card' },
        h('h1', {}, 'Ačiū! Užklausa gauta.'),
        h('p', {}, `Patvirtinimą išsiuntėme adresu ${body.contactEmail}. Kai administratorius peržiūrės užklausą, gausite laišką su prisijungimo nuoroda.`)));
    } catch (err) {
      status.replaceChildren(h('div', { class: 'alert alert-bad' }, err.message));
      submit.disabled = false;
    }
  } },
  fields.map(([name, label, req, max, type]) => {
    const el = h('input', { name, type: type || 'text', required: req, maxlength: max });
    inputs[name] = el;
    return h('label', { class: 'field' }, h('span', {}, label, req ? ' *' : ''), el);
  }),
  h('label', { class: 'field' }, h('span', {}, 'Žinutė'), msg),
  status,
  h('div', { class: 'modal-actions' }, submit));

  root.replaceChildren(h('div', { class: 'public-card' },
    h('h1', {}, 'Prisijungimo užklausa'),
    h('p', { class: 'muted' }, 'Užpildykite formą, ir mes susisieksime. Patvirtinus užklausą, kontaktinis asmuo gaus kvietimą prisijungti prie durų užsakymų sistemos.'),
    form));
}
