/* Prisijungimas per Microsoft (MSAL). Slaptažodžių programa nemato —
   naudotojas jungiasi Microsoft puslapyje, programa gauna tik žetoną. */

let pca = null;
let account = null;
let cfg = null;

export async function initAuth() {
  const r = await fetch('/api/public/config');
  cfg = await r.json();
  if (!cfg.clientId || !cfg.authority) {
    throw new Error('Prisijungimas dar nesukonfigūruotas (trūksta WEB_CLIENT_ID App Service nustatymuose).');
  }
  if (!window.msal) throw new Error('Nepavyko įkelti Microsoft prisijungimo bibliotekos.');
  pca = new window.msal.PublicClientApplication({
    auth: {
      clientId: cfg.clientId,
      authority: cfg.authority,
      redirectUri: location.origin + '/',
      postLogoutRedirectUri: location.origin + '/',
      navigateToLoginRequestUrl: false,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await pca.initialize();
  const res = await pca.handleRedirectPromise();
  account = (res && res.account) || pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
  if (account) pca.setActiveAccount(account);
  return { account, returnPath: res && res.state ? res.state : null };
}

export function login(returnPath) {
  return pca.loginRedirect({ scopes: [cfg.scope], state: returnPath || location.pathname, prompt: 'select_account' });
}

export function logout() {
  return pca.logoutRedirect({ account });
}

export async function getToken() {
  const req = { scopes: [cfg.scope], account };
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
