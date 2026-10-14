# Architektūra

```
Naršyklė (web/)  ──HTTPS + Microsoft žetonas──▶  API (api/, Node.js)  ──Managed Identity──▶  Azure SQL
   vaizdas, HTML/CSS                              tikrina žetoną,                          lentelės + procedūros
   engine.js (peržiūrai)                          kviečia TIK api.* procedūras             (visa verslo logika ir teisės)
                                                  laiškų procesas ──Graph──▶ Office 365 paštas
```

## Sluoksniai

| Sluoksnis | Kas jame | Kas gali keisti |
|---|---|---|
| `web/` | HTML, CSS, šablonai, nuotraukos | Dizaineris — nekeičiant `data-*` atributų ir API |
| `api/` | Prisijungimas, įvesties patikra, procedūrų kvietimas, laiškai | Programuotojas |
| `db/migrations/` | Lentelės, apribojimai, procedūros, teisės | Tik naujomis migracijomis |
| `db/catalog/` + `catalog-sources/` | Gamintojų katalogai | Importuojant naują versiją |

## Duomenų bazės schemos

| Schema | Turinys |
|---|---|
| `iam` | Rolės, naudotojai, prisijungimo būdai, kvietimai |
| `org` | Įmonės, prisijungimo užklausos |
| `catalog` | Gamintojai, katalogų versijos, šeimos, modeliai, dekorai, kainos, taisyklės |
| `sales` | Užsakymai, eilutės, statusai, statusų istorija |
| `notify` | Laiškų eilė, sistemos nustatymai |
| `audit` | Veiksmų žurnalas (tik pildomas) |
| `api` | Procedūros programai — **vienintelis** programos priėjimas |
| `admin` | Procedūros diegimui (katalogų importas, pirmasis administratorius) |

## Rolių medis

```
GLOBAL_ADMIN (40)   kuria administratorius, nustatymai, auditas
  └─ ADMIN (30)     tvirtina įmones, valdo užsakymus ir katalogus
       └─ COMPANY_REP (20)   savo įmonės naudotojai ir užsakymai
            └─ USER (10)     savo užsakymai
```

## Įmonės prisijungimas

1. Įmonė pildo viešą formą → `org.AccessRequest` (PENDING), laiškai įmonei ir administratoriams.
2. Administratorius patvirtina → sukuriama įmonė, kontaktinis asmuo tampa `COMPANY_REP` (INVITED), išsiunčiamas kvietimas.
3. Asmuo paspaudžia nuorodą, prisijungia per Microsoft (savo įmonės paskyra, Microsoft paskyra arba el. paštas + kodas).
4. Sistema patikrina, kad el. paštas sutampa su kvietimu, susieja prisijungimą → paskyra ACTIVE.
5. Atstovas toliau pats kviečia savo įmonės naudotojus.

## Užsakymo statusai

```
DRAFT ──▶ SUBMITTED ──▶ CONFIRMED ──▶ SENT_TO_MANUFACTURER ──▶ IN_PRODUCTION ──▶ DELIVERED
  │           │  ▲            │                 │
  │           │  └─ grąžinta taisyti (su priežastimi)
  ▼           ▼               ▼                 ▼
CANCELLED  CANCELLED      CANCELLED         CANCELLED      (admin atšaukimas — tik su priežastimi)
```

Perėjimai ir kas juos gali atlikti — lentelė `sales.OrderStatusTransition`.
Pakeisti eigą = nauja migracija, kuri papildo šią lentelę (kodo keisti nereikia).

## Istorija

- `sales.Order`, `sales.OrderLine`, `org.Company`, `iam.User` — *temporal* lentelės: kiekviena ankstesnė eilutės būsena išsaugoma automatiškai.
  Pvz. „kaip atrodė užsakymas vakar 14:00": `SELECT * FROM sales.[Order] FOR SYSTEM_TIME AS OF '2026-10-13T11:00'`.
- `sales.OrderStatusHistory` ir `audit.AuditLog` — tik pildomos, keisti ar trinti neleidžia trigeriai.
- Užsakymai netrinami; katalogų versijos po paskelbimo nekeičiamos.
