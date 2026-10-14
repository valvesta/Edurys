'use strict';
/* ==========================================================================
   Prisijungimas (Microsoft Entra ID ir Entra External ID).

   Naršyklė prisijungia per Microsoft (MSAL) ir siunčia „access token"
   antraštėje Authorization: Bearer ... . Čia:
     1. Patikrinamas žetono parašas pagal Microsoft viešuosius raktus (JWKS),
        išdavėjas (iss), auditorija (aud) ir galiojimas (exp/nbf).
     2. Naudotojas identifikuojamas pagal (iss, oid) — ne pagal el. paštą.
     3. api.User_ResolveLogin grąžina vidinį naudotoją ir jo rolę.
   Slaptažodžių sistema niekada nemato ir nesaugo.
   ========================================================================== */
const { createRemoteJWKSet, jwtVerify, decodeJwt } = require('jose');
const config = require('./config');
const { sql, callProcedure } = require('./db');

const providers = config.authProviders.map(p => ({ ...p, jwks: createRemoteJWKSet(new URL(p.jwksUri)) }));

async function verifyToken(token) {
  let unverified;
  try { unverified = decodeJwt(token); } catch (e) { return null; }
  const provider = providers.find(p => p.issuer === unverified.iss);
  if (!provider) return null;
  try {
    const { payload } = await jwtVerify(token, provider.jwks, {
      issuer: provider.issuer,
      audience: provider.audience,
      algorithms: ['RS256'],
      clockTolerance: 60,
    });
    const subject = payload.oid || payload.sub;
    if (!subject) return null;
    return {
      provider: provider.name,
      issuer: payload.iss,
      subject,
      email: (payload.email || payload.preferred_username || '').toLowerCase() || null,
      name: payload.name || null,
    };
  } catch (e) {
    return null;
  }
}

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(h);
  return m ? m[1] : null;
}

/* Reikalauja galiojančio žetono; req.identity — Microsoft tapatybė. */
async function requireIdentity(req, res, next) {
  const token = bearer(req);
  const identity = token && await verifyToken(token);
  if (!identity) return res.status(401).json({ error: 'Reikia prisijungti.' });
  req.identity = identity;
  next();
}

/* Reikalauja, kad tapatybė būtų susieta su aktyviu sistemos naudotoju. */
async function requireUser(req, res, next) {
  await requireIdentity(req, res, async () => {
    try {
      const r = await callProcedure('api.User_ResolveLogin', {
        Issuer: [sql.NVarChar(400), req.identity.issuer],
        Subject: [sql.NVarChar(200), req.identity.subject],
      });
      const row = r.recordset[0];
      if (row.LoginResult === 'NOT_LINKED') return res.status(403).json({ error: 'Paskyra nerasta. Prisijungimui reikalingas kvietimas.', code: 'NOT_LINKED' });
      if (row.LoginResult !== 'OK') return res.status(403).json({ error: 'Paskyra išjungta.', code: row.LoginResult });
      req.user = row;
      next();
    } catch (e) { next(e); }
  });
}

function requireLevel(minLevel) {
  return (req, res, next) => {
    if (!req.user || req.user.RoleLevel < minLevel) return res.status(403).json({ error: 'Neturite teisės.' });
    next();
  };
}

module.exports = { requireIdentity, requireUser, requireLevel, verifyToken };
