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

## Nuotraukos

- Saugykla privati: anoniminė prieiga ir prieigos raktai **išjungti**, tik TLS 1.2+.
- Programa savo tapatybe (Managed Identity, *Storage Blob Data Reader*) gauna naudotojo delegavimo raktą
  ir pasirašo **tik skaitymo** leidimą (SAS) konteineriui `images`, galiojantį 2 val., tik HTTPS.
  Leidimas be sąrašo, rašymo ar trynimo teisių.
- Leidimą gauna tik prisijungę naudotojai (`GET /api/media/config`); naršyklė jį atnaujina prieš pasibaigiant.
- Naršyklės saugumo politika (CSP) leidžia paveikslėlius tik iš sistemos ir šios saugyklos.

## Konfigūratorius

- Naršyklė siunčia tik pasirinkimus; kainas, PVM ir sumas apskaičiuoja serveris ir DB.
  Naršyklės rodoma suma tik palyginama — nesutapus, pateikti neleidžiama.
- Kainų variklio failai tiekiami iš serverio (tie patys, kurie skaičiuoja kainas), tik išvardyti failai.
- HTML viduje jokio vykdomo kodo (CSP `script-src 'self'`); naudotojų tekstai įterpiami išvalyti (`esc()`).

## Vieši registrai (įmonės duomenų pagalba)

- Serveris (ne naršyklė) kreipiasi į Registrų centro atvirus duomenis (data.gov.lt) ir ES VIES — tik skaitymas,
  siunčiamas tik įmonės ar PVM kodas, patikrintas pagal formatą (9 / 9–12 skaitmenų).
- Tik administratoriams, ribojama 30 užklausų per minutę; atsakymai laikomi atmintyje 1 val.
- Duomenys tik pasiūlomi formoje — įmonė sukuriama tik administratoriui patvirtinus.
