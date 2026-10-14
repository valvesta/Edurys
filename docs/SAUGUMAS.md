# Saugumo priemonės

## Duomenų bazė
- Programos tapatybė yra tik rolėje `app_api`: **vienintelė teisė — vykdyti `api.*` procedūras**.
  Tiesioginiai `SELECT/INSERT/UPDATE/DELETE` į lenteles aiškiai uždrausti (`DENY`). Tai tikrinama automatiniu testu.
- Procedūrose nėra dinaminio SQL; visi parametrai tipizuoti → SQL injekcija neįmanoma.
- Teisės tikrinamos **pačioje DB** (kas ką mato ir gali keisti), ne tik API.
- Optimistinis lygiagretumas (`Revision`): du žmonės negali netyčia perrašyti vienas kito pakeitimų.
- Paskelbtų katalogų, statusų istorijos ir audito pakeisti neįmanoma (trigeriai).
- Prisijungimas tik per Microsoft Entra, SQL slaptažodžių nėra.

## Prisijungimas
- Slaptažodžių sistema nesaugo — juos tvarko Microsoft (MFA, slaptažodžio atkūrimas ir kt.).
- Žetonai tikrinami: parašas, išdavėjas (tik du leidžiami nuomininkai), auditorija, galiojimas.
- Naudotojas identifikuojamas pagal nekintamą `oid`, ne pagal el. paštą.
- Kvietimai: DB saugo tik žetono SHA-256; nuoroda galioja ribotai; priimant tikrinama, kad el. paštas sutampa;
  kvietimo laiško turinys ištrinamas iš eilės iškart po išsiuntimo.
- Paskutinio globalaus administratoriaus išjungti neįmanoma.

## API
- HTTPS, HSTS, griežta Content-Security-Policy, `frame-ancestors 'none'`.
- Viešai formai — užklausų ribojimas (API ir DB lygiu).
- Klaidų detalės naudotojui nerodomos — tik užklausos ID, pagal kurį randamas įrašas žurnale.
- Kainas skaičiuoja serveris; naršyklės atsiųstos kainos nepriimamos.

## Paštas
- Graph `Mail.Send` apribota viena bendra dėžute (Exchange RBAC for Applications).
- Visi duomenys laiškų šablonuose HTML-išvalomi.
