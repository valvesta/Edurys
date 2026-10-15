/* Prisijungimas per Microsoft (MSAL). Slaptažodžių programa nemato —
   naudotojas jungiasi Microsoft puslapyje, programa gauna tik žetoną.

   Du prisijungimo būdai (jei sukonfigūruoti serveryje):
   - darbuotojams — jūsų organizacijos Microsoft 365;
   - klientams — Microsoft Entra External ID (vienkartinis kodas el. paštu).
   Pasirinktas būdas įsimenamas, kad grįžus iš Microsoft būtų tęsiama ta pačia
   konfigūracija. Klientų prisijungimas išlieka ir uždarius naršyklę
   (localStorage), darbuotojų — tik iki skirtuko uždarymo (sessionStorage). */

const CHOICE_KEY = 'authProvider';
let pca = null;
let account = null;
let provider = null;
let providers = [];

const store = {
  get: () => { try { return localStorage.getItem(CHOICE_KEY); } catch (e) { return null; } },
  set: v => { try { v ? localStorage.setItem(CHOICE_KEY, v) : localStorage.removeItem(CHOICE_KEY); } catch (e) { /* nieko */ } },
};

function makeClient(p) {
  return new window.msal.PublicClientApplication({
    auth: {
      clientId: p.clientId,
      authority: p.authority,
      knownAuthorities: p.kind === 'clients' ? [new URL(p.authority).host] : undefined,
      redirectUri: location.origin + '/',
      postLogoutRedirectUri: location.origin + '/',
      navigateToLoginRequestUrl: false,
    },
    cache: { cacheLocation: p.kind === 'clients' ? 'localStorage' : 'sessionStorage' },
  });
}

export async function initAuth() {
  const r = await fetch('/api/public/config');
  const cfg = await r.json();
  providers = (cfg.providers || [{ ...cfg, name: 'staff', kind: 'staff', label: 'Prisijungti su Microsoft' }])
    .filter(p => p.clientId && p.authority);
  if (!providers.length) {
    throw new Error('Prisijungimas dar nesukonfigūruotas (trūksta WEB_CLIENT_ID App Service nustatymuose).');
  }
  if (!window.msal) throw new Error('Nepavyko įkelti Microsoft prisijungimo bibliotekos.');

  provider = providers.find(p => p.name === store.get()) || null;
  if (!provider) return { account: null, returnPath: null, providers };

  let res;
  try {
    pca = makeClient(provider);
    await pca.initialize();
    res = await pca.handleRedirectPromise();
  } catch (e) {
    // Nepavykus pasirinktam būdui — pamirštame pasirinkimą, kad būtų galima rinktis kitą
    store.set(null);
    const err = new Error(`Prisijungti būdu „${provider.label}“ nepavyko (${e.errorCode || e.message}). Perkraukite puslapį ir pasirinkite dar kartą.`);
    err.cause = e;
    provider = null; pca = null;
    throw err;
  }
  account = (res && res.account) || pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
  if (account) pca.setActiveAccount(account);
  return { account, returnPath: res && res.state ? res.state : null, providers, provider };
}

/* Prisijungimas pasirinktu būdu (name iš providers). */
export async function login(returnPath, name) {
  const p = providers.find(x => x.name === name) || provider || providers[0];
  store.set(p.name);
  if (!pca || provider !== p) { provider = p; pca = makeClient(p); await pca.initialize(); }
  return pca.loginRedirect({
    scopes: [p.scope], state: returnPath || location.pathname,
    prompt: p.kind === 'clients' ? 'login' : 'select_account',
  });
}

export function logout() {
  store.set(null);
  return pca.logoutRedirect({ account });
}

export async function getToken() {
  const req = { scopes: [provider.scope], account };
  try {
    return (await pca.acquireTokenSilent(req)).accessToken;
  } catch (e) {
    if (e instanceof window.msal.InteractionRequiredAuthError) {
      await pca.acquireTokenRedirect({ ...req, state: location.pathname });
    }
    throw e;
  }
}

export function currentAccount() { return account; }
export function authProviders() { return providers; }
