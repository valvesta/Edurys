# Durų konfigūratorius — platforma

Durų užsakymų sistema įmonėms: katalogai (pradžioje ERKADO, vėliau ir kiti gamintojai),
konfigūratorius, užsakymai su istorija ir statusais, laiškai, prisijungimas per Microsoft.

## Struktūra

```
platforma/
├─ db/
│  ├─ migrations/        SQL migracijos V001…V009 (lentelės, teisės, procedūros)
│  ├─ catalog/           Katalogų paketai (ERKADO 2026-I)
│  ├─ tools/             Migracijos, katalogo ištraukimas, importas ir patikra
│  └─ tests/             Pilnas scenarijaus testas prieš tikrą SQL Server
├─ api/                  Node.js API (prisijungimas, procedūrų kvietimas, laiškai)
├─ web/                  Vaizdas (čia perkelsime dabartinį newdemo)
├─ catalog-sources/      Originalūs ERKADO duomenų failai (iš newdemo)
├─ docs/                 Architektūra, Azure paruošimas, saugumas, radiniai
└─ .github/workflows/    Automatinė patikra (CI)
```

## Pagrindiniai principai

1. **Programa duomenis pasiekia tik per `api.*` procedūras.** DB rolė `app_api` jokių kitų teisių neturi.
2. **Teisės tikrinamos duomenų bazėje** — kas ką mato ir gali keisti.
3. **Niekas netrinama**: užsakymų, įmonių, naudotojų istorija saugoma automatiškai (*temporal* lentelės).
4. **Kainų versijos**: paskelbto katalogo pakeisti negalima; nauji kainoraščiai — naujos versijos.
5. **Pinigai** — tik `decimal`, PVM apvalinamas tiksliai.
6. **Slaptažodžių nėra**: prisijungimas per Microsoft, prie SQL ir pašto — per Managed Identity.

## Paleidimas

```bash
# katalogo paketas iš šaltinių ir patikra (nereikia DB)
node db/tools/extract-erkado.js
node db/tools/verify-catalog.js

# su duomenų baze (DB_SERVER, DB_NAME, DB_AUTH — žr. db/tools/lib/connect.js)
cd db && npm ci
npm run migrate
npm run import:erkado:publish
npm test
```

Pirmasis globalus administratorius sukuriamas vieną kartą (po pirmo prisijungimo, kai žinomas jūsų `oid`):

```sql
EXEC admin.Bootstrap_GlobalAdmin @Email = N'vardas@jupoja.lt', @DisplayName = N'Vardas Pavardė',
     @Issuer = N'https://login.microsoftonline.com/<tenant-id>/v2.0', @Subject = N'<jūsų oid>';
```

## Būsena

| Dalis | Būsena |
|---|---|
| DB schema, teisės, procedūros | ✅ paruošta, testuojama CI |
| ERKADO katalogo perkėlimas | ✅ patikrinta: visos kainos sutampa su originalu |
| Įmonių užklausos, kvietimai, rolės | ✅ |
| Užsakymai, statusai, istorija, laiškų eilė | ✅ |
| API karkasas | ✅ (be kainų skaičiavimo serveryje) |
| Kainų skaičiavimas serveryje (engine.js + DB) | ⏳ kitas etapas |
| Vaizdo perkėlimas į `web/`, šablonų atskyrimas | ⏳ kitas etapas |
| Diegimas į Azure | ⏳ kai bus sukurti resursai (žr. `docs/AZURE_PARUOSIMAS.md`) |
