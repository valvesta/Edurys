# web/ — vaizdo dalis

Čia bus perkeltas dabartinis konfigūratorius (`newdemo`: `index.html`, `styles.css`, `app.js`, `assets/`).

Kitame etape:
- `data.js` / `glass.js` bus nebereikalingi — katalogas bus įkeliamas iš API (`GET /api/catalog/versions/:id`);
- HTML iš `app.js` bus iškeltas į `<template>` blokus `index.html` faile;
- JavaScript elementus ras pagal `data-role="..."` atributus, todėl dizaineris galės laisvai keisti
  klases, išdėstymą ir stilių — tik nelieskite `data-*` atributų.
