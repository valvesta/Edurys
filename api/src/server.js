'use strict';
const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const config = require('./config');
const { toHttpError } = require('./db');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);                 // Azure App Service / Front Door — tikras kliento IP
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'connect-src': ["'self'", 'https://login.microsoftonline.com', 'https://*.ciamlogin.com'],
      // MSAL tylus žetono atnaujinimas vyksta paslėptame iframe
      'frame-src': ["'self'", 'https://login.microsoftonline.com', 'https://*.ciamlogin.com'],
      'frame-ancestors': ["'none'"],
      // nuotraukos — iš privačios saugyklos su laikinu leidimu (media.js)
      'img-src': ["'self'", 'data:'].concat(config.media.account ? [`https://${config.media.account}.blob.core.windows.net`] : []),
    },
  },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(express.json({ limit: '1mb' }));

// Kiekviena užklausa gauna ID — jis rodomas klaidos atveju ir žurnale
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use('/api', routes);

// Naršyklės dalis (vaizdas) — statiniai failai iš ../web.
// index.html niekada nekešuojamas, kad po atnaujinimo naudotojai iškart gautų naują versiją.
const WEB_DIR = path.join(__dirname, '..', '..', 'web');
const CONFIGURATOR_DIR = path.join(WEB_DIR, 'konfiguratorius') + path.sep;
const noCache = res => res.setHeader('Cache-Control', 'no-cache');
app.use(express.static(WEB_DIR, {
  index: 'index.html', maxAge: '1h',
  // HTML ir konfigūratoriaus failai visada tikrinami (ETag), kad po
  // atnaujinimo naršyklė negautų senų ir naujų failų mišinio.
  setHeaders: (res, file) => { if (file.endsWith('.html') || file.startsWith(CONFIGURATOR_DIR)) noCache(res); },
}));

/* Kainų variklis naršyklei — TIE PATYS failai, kurie skaičiuoja kainas
   serveryje (api/src/engines/<gamintojas>). Tiekiami tik išvardyti failai. */
const ENGINE_FILES = { erkado: ['bootstrap.js', 'helpers.js', 'engine.js'] };
app.get('/engine/:maker/:file', (req, res, next) => {
  const files = ENGINE_FILES[req.params.maker];
  if (!files || !files.includes(req.params.file)) return next();
  noCache(res);
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'engines', req.params.maker, req.params.file));
});

// Nuotraukos iš vietinio aplanko — tik kūrimo aplinkoje (žr. config.media.devDir)
if (config.media.devDir) app.use('/dev-media', express.static(config.media.devDir, { fallthrough: false }));
// Puslapių adresai (/uzsakymai, /kvietimas ir t. t.) — visi atidaro tą pačią programą
app.get(/^\/(?!api\/|healthz)[a-z0-9\-\/]*$/i, (req, res) => { noCache(res); res.sendFile(path.join(WEB_DIR, 'index.html')); });

// Klaidų apdorojimas: DB verslo klaidos -> aiškus pranešimas; kitos -> bendras
app.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
  const mapped = toHttpError(err);
  if (mapped) return res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Neteisingas JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Užklausa per didelė.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.status === 501) return res.status(501).json({ error: err.message });
  console.error(JSON.stringify({ level: 'error', requestId: req.id, path: req.path, message: err.message, stack: err.stack }));
  res.status(500).json({ error: 'Vidinė klaida. Nurodykite šį kodą administratoriui: ' + req.id });
});

app.listen(config.port, () => console.log(`API klausosi ${config.port} prievado`));
