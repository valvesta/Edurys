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
      'frame-ancestors': ["'none'"],
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

// Naršyklės dalis (vaizdas) — statiniai failai iš ../web
app.use(express.static(path.join(__dirname, '..', '..', 'web'), { index: 'index.html', maxAge: '1h' }));

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
