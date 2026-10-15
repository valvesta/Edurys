/* Programos pradžia: prisijungimas, meniu, puslapių maršrutai. */
import { initAuth, login, logout, authProviders } from './auth.js';
import { api } from './api.js';
import { h, toast, errorBox } from './ui.js';
import { ordersList, orderDetail } from './pages/orders.js';
import { accessRequests } from './pages/requests.js';
import { companies } from './pages/companies.js';
import { users } from './pages/users.js';
import { settings, emails, audit } from './pages/settings.js';
import { publicRequest } from './pages/public.js';

const app = document.getElementById('app');

/* Puslapiai: adresas, pavadinimas meniu, minimalus rolės lygis, piešimo funkcija. */
const ROUTES = [
  { path: /^\/uzsakymai\/(\d+)$/, keys: ['id'], level: 10, render: orderDetail },
  { path: /^\/uzsakymai$/, nav: 'Užsakymai', href: '/uzsakymai', level: 10, render: ordersList },
  { path: /^\/uzklausos$/, nav: 'Įmonių užklausos', href: '/uzklausos', level: 30, render: accessRequests },
  { path: /^\/imones$/, nav: 'Įmonės', href: '/imones', level: 30, render: companies },
  { path: /^\/naudotojai$/, nav: 'Naudotojai', href: '/naudotojai', level: 20, render: users },
  { path: /^\/laiskai$/, nav: 'Laiškai', href: '/laiskai', level: 30, render: emails },
  { path: /^\/nustatymai$/, nav: 'Nustatymai', href: '/nustatymai', level: 30, render: settings },
  { path: /^\/auditas$/, nav: 'Veiksmų žurnalas', href: '/auditas', level: 40, render: audit },
];

let me = null;
let content = null;
let nav = null;

async function start() {
  const path = location.pathname;

  // Vieša forma — be prisijungimo
  if (path === '/prisijungimo-uzklausa') { publicRequest(app); return; }

  // Kvietimo nuoroda: žetonas (po #) išsaugomas iki prisijungimo pabaigos
  if (path === '/kvietimas' && location.hash.length > 20 && !location.hash.includes('code=')) {
    sessionStorage.setItem('inviteToken', location.hash.slice(1));
    history.replaceState(null, '', '/kvietimas');
  }

  let auth;
  try { auth = await initAuth(); } catch (e) { app.replaceChildren(h('div', { class: 'public-card' }, errorBox(e))); return; }
  if (!auth.account) { renderLogin(); return; }

  const inviteToken = sessionStorage.getItem('inviteToken');
  if (inviteToken) {
    sessionStorage.removeItem('inviteToken');
    try {
      await api.post('/invitations/accept', { token: inviteToken });
      toast('Kvietimas priimtas. Sveiki prisijungę!');
    } catch (e) {
      app.replaceChildren(h('div', { class: 'public-card' }, h('h1', {}, 'Nepavyko priimti kvietimo'), errorBox(e),
        h('button', { class: 'btn', onclick: () => logout() }, 'Atsijungti ir bandyti kita paskyra')));
      return;
    }
  }

  try {
    me = await api.get('/me');
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      app.replaceChildren(h('div', { class: 'public-card' },
        h('h1', {}, e.code === 'NOT_LINKED' ? 'Paskyra nerasta' : 'Prieiga uždrausta'),
        h('p', {}, e.code === 'NOT_LINKED'
          ? 'Prisijungėte sėkmingai, bet ši Microsoft paskyra dar nesusieta su sistema. Prisijungti galima tik gavus kvietimą el. paštu.'
          : e.message),
        h('div', { class: 'modal-actions' },
          h('a', { class: 'btn', href: '/prisijungimo-uzklausa' }, 'Įmonės prisijungimo užklausa'),
          h('button', { class: 'btn btn-primary', onclick: () => logout() }, 'Atsijungti'))));
      return;
    }
    app.replaceChildren(h('div', { class: 'public-card' }, errorBox(e)));
    return;
  }

  // Grįžus po prisijungimo į konfigūratorių (atskiras puslapis) — atidarome jį
  if (auth.returnPath && /^\/konfiguratorius(\/|$)/.test(auth.returnPath)) { location.replace(auth.returnPath); return; }

  renderShell();
  const target = auth.returnPath && auth.returnPath !== '/kvietimas' ? auth.returnPath : path;
  navigate(target === '/' || target === '/kvietimas' ? '/uzsakymai' : target, true);
}

function renderLogin() {
  const inviting = !!sessionStorage.getItem('inviteToken');
  app.replaceChildren(h('div', { class: 'public-card login' },
    h('div', { class: 'brand-big' }, 'Durų užsakymai'),
    h('p', { class: 'muted' }, inviting
      ? 'Jus pakvietė prisijungti. Prisijunkite tuo el. paštu, kuriuo gavote kvietimą.'
      : 'Pasirinkite, kaip prisijungti.'),
    loginButtons(location.pathname),
    h('p', { class: 'muted small' }, 'Dar neturite prieigos? ', h('a', { href: '/prisijungimo-uzklausa' }, 'Pateikite įmonės prisijungimo užklausą'))));
}

/* Prisijungimo mygtukai: klientams (kodas el. paštu) — pirmas, darbuotojams — antras. */
export function loginButtons(returnPath) {
  const list = authProviders().slice().sort((a, b) => (a.kind === 'clients' ? -1 : 0) - (b.kind === 'clients' ? -1 : 0));
  return h('div', { class: 'login-buttons' }, list.map((p, i) => h('button', {
    class: i === 0 ? 'btn btn-primary btn-lg' : 'btn btn-lg', 'data-role': 'login-' + p.kind,
    onclick: () => login(returnPath, p.name).catch(e => toast('Prisijungti nepavyko: ' + (e.errorCode || e.message), 'bad')),
  }, list.length === 1 ? 'Prisijungti su Microsoft' : p.label)),
  list.some(p => p.kind === 'clients') ? h('p', { class: 'muted small' }, 'Klientams: įveskite el. paštą — atsiųsime vienkartinį kodą. Slaptažodžio nereikia.') : null);
}

function renderShell() {
  nav = h('nav', { class: 'nav', 'data-role': 'nav' });
  content = h('main', { class: 'content', 'data-role': 'content' });
  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '/uzsakymai', 'data-link': '' }, 'Durų užsakymai'),
      h('div', { class: 'user' },
        h('div', {}, h('strong', {}, me.displayName || me.email), h('div', { class: 'muted small' }, me.roleName, me.companyName ? ' · ' + me.companyName : '')),
        h('button', { class: 'btn', 'data-role': 'logout', onclick: () => logout() }, 'Atsijungti'))),
    h('div', { class: 'layout' }, nav, content));

  // Vidinės nuorodos be puslapio perkrovimo
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-link]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank') return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });
  window.addEventListener('popstate', () => render());
}

function navigate(url, replace) {
  if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
  render();
}

function render() {
  const path = location.pathname;
  const allowed = ROUTES.filter(r => me.roleLevel >= r.level);
  nav.replaceChildren(...allowed.filter(r => r.nav).map(r => h('a', {
    href: r.href, 'data-link': '', class: path.startsWith(r.href) ? 'active' : '',
  }, r.nav)));

  const route = allowed.find(r => r.path.test(path));
  content.replaceChildren();
  window.scrollTo(0, 0);
  if (!route) {
    content.append(h('h1', {}, 'Puslapis nerastas'), h('a', { href: '/uzsakymai', 'data-link': '' }, 'Į užsakymus'));
    return;
  }
  const m = route.path.exec(path);
  const params = {};
  (route.keys || []).forEach((k, i) => { params[k] = m[i + 1]; });
  const ctx = { me, params, query: new URLSearchParams(location.search), navigate: u => navigate(u), reload: () => render() };
  Promise.resolve(route.render(content, ctx)).catch(e => content.replaceChildren(errorBox(e)));
}

start();
