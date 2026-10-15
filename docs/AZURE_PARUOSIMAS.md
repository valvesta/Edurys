# Azure paruošimas

Šiame dokumente aprašyta, ką reikia sukurti Azure'e ir kaip tai sukonfigūruoti saugiai.
Viską darykite **du kartus**: `dev` (bandymams) ir `prod` (tikriems klientams).
Pavadinimuose žemiau `<env>` = `dev` arba `prod`.

## 1. Resursų grupės

| Pavadinimas | Paskirtis |
|---|---|
| `rg-durys-dev` | Bandomoji aplinka |
| `rg-durys-prod` | Produkcija |

Regionas: **West Europe** arba **North Europe** (duomenys lieka ES).

## 2. Azure SQL Database

- Serveris `sql-durys-<env>`, duomenų bazė `durys`.
- Kaina: pradžiai užtenka **General Purpose, Serverless, 1 vCore** (dev gali automatiškai „užmigti").
- **Authentication: Microsoft Entra-only.** SQL slaptažodžių prisijungimą išjunkite visiškai.
  Serverio Entra administratorius — **grupė** (pvz. `sg-durys-sql-admins`), ne vienas žmogus.
- **Tinklas:** „Public network access" — *Disabled*, prieiga per **Private Endpoint** iš App Service VNet.
  Jei pradžioje privatus tinklas per sudėtingas — *Selected networks* ir tik App Service išeinantys IP;
  „Allow Azure services" **neįjunkite** (tai atveria serverį visiems Azure klientams).
- **Microsoft Defender for SQL** — įjungti.
- **Auditing** — įjungti, rašyti į Log Analytics.
- **Backup:** PITR 35 dienos, prod — ir Long-term retention (pvz. 12 savaičių, 12 mėnesių).
- Duomenų bazės **collation** — palikti numatytą `SQL_Latin1_General_CP1_CI_AS` (sistema tam pritaikyta).

## 3. App Service (API + vaizdas)

- App Service Plan `asp-durys-<env>` (Linux, B1 dev / P0v3 prod), Web App `app-durys-<env>`, Node 22.
- **System-assigned Managed Identity** — įjungti.
- **HTTPS only**, minimalus TLS 1.2, FTP — išjungti.
- VNet integracija (jei SQL per Private Endpoint).
- Aplinkos kintamieji (Configuration → Application settings):

| Kintamasis | Pavyzdys |
|---|---|
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | `https://durys.jupoja.lt` |
| `DB_SERVER` | `sql-durys-prod.database.windows.net` |
| `DB_NAME` | `durys` |
| `AUTH_PROVIDERS` | JSON, žr. `api/src/config.js` |
| `MAIL_SENDER` | `uzsakymai@jupoja.lt` |

Slaptažodžių čia **nėra** — prie SQL ir pašto jungiamasi per Managed Identity.

### Teisės duomenų bazėje programai

Prisijungus prie DB kaip Entra administratoriui, vieną kartą:

```sql
CREATE USER [app-durys-prod] FROM EXTERNAL PROVIDER;
ALTER ROLE app_api ADD MEMBER [app-durys-prod];
-- NIEKO daugiau: jokio db_datareader / db_datawriter / db_owner.
```

## 4. Prisijungimas

### Darbuotojai (administratoriai) — jūsų Microsoft 365 nuomininkas
- Entra ID → App registrations → `durys-api` (Expose an API, scope `access_as_user`)
  ir `durys-web` (SPA, redirect `https://durys.jupoja.lt/`).
- Rekomenduojama: **Conditional Access** su MFA administratoriams.

### Klientai — Microsoft Entra External ID (atskiras „external" nuomininkas)
- Sukurti External ID nuomininką (pvz. `durysklientai`).
- User flow: **Email one-time passcode** + **Microsoft account** (+ jei norite — Google).
  Taip prisijungti galės visi: ir turintys Microsoft 365, ir neturintys.
- Tame nuomininke taip pat registruoti `durys-api` ir `durys-web`.
- Žetone įtraukti `email` teiginį (optional claim) — jis naudojamas kvietimo patikrinimui.
- Savarankiška registracija **išjungta**: paskyra sukuriama tik per kvietimą (tai užtikrina mūsų DB logika).

`AUTH_PROVIDERS` turi abu tiekėjus (darbuotojų ir klientų). Bet kurio kito nuomininko žetonai atmetami.

## 5. Paštas

Laiškus siunčia pati programa (kartu su API) per **Microsoft Graph** iš vienos bendros dėžutės.
Dėžutė nurodoma sistemoje: **Nustatymai → MAIL_SENDER** (keičia tik globalus administratorius).
Kol ji tuščia, laiškai tik kaupiami eilėje.

Programai leidžiama siųsti **tik iš grupės „Sistemos siuntėjai“ narių** — per Exchange Online
*RBAC for Applications* (be Entra Graph teisės visoms dėžutėms). Sistema siunčia iš vienos dėžutės
(MAIL_SENDER); grupė nustato, kurias galima pasirinkti. Naują dėžutę leisti = įdėti ją į grupę
(Microsoft 365 administravimo centre, be PowerShell).

1. Microsoft 365 administravimo centre: **Teams & groups → Active teams & groups → Add a group →
   Mail-enabled security**, pavadinimas `Sistemos siuntejai`.
2. Bendra dėžutė (Shared mailbox, licencijos nereikia iki 50 GB) — įdėti į grupę kaip narį.
3. Entra → **Enterprise applications** → *Application type: Managed Identities* → `edurys`:
   **Application ID** = `9176aebf-adcc-4a65-a281-0be6593e0929` (Object ID = `94591af0-ba45-41fe-9bf2-75b939a8493b`).
4. PowerShell (vieną kartą):
   ```powershell
   Install-Module ExchangeOnlineManagement -Scope CurrentUser   # jei dar nėra
   Connect-ExchangeOnline
   $app = "9176aebf-adcc-4a65-a281-0be6593e0929"
   $g = Get-DistributionGroup "Sistemos siuntejai"
   New-ServicePrincipal -AppId $app -ObjectId 94591af0-ba45-41fe-9bf2-75b939a8493b -DisplayName "edurys"
   New-ManagementScope -Name "edurys-siuntejai" -RecipientRestrictionFilter "MemberOfGroup -eq '$($g.DistinguishedName)'"
   New-ManagementRoleAssignment -App $app -Role "Application Mail.Send" -CustomResourceScope "edurys-siuntejai"
   ```
5. Patikra (po 30 min.–2 val.): `Test-ServicePrincipalAuthorization -Identity $app -Resource <dėžutė>` — `InScope: True`.
6. Sistemoje: Nustatymai → `MAIL_SENDER` = dėžutė → „Siųsti bandomąjį laišką sau“.

Atlikta 2026-10-15 (1–4 žingsniai, išskyrus dėžutę).

**Nauja siuntimo dėžutė vėliau:** admin.exchange.microsoft.com → Recipients → Groups →
„Sistemos siuntejai“ → Members → Add (arba `Add-DistributionGroupMember "Sistemos siuntejai" -Member <dėžutė>`),
tada 5–6 žingsniai. Sistema pati į grupę įtraukti negali — specialiai.

Jei laiškas pažymėtas „Nepavyko“ su *403 / ErrorAccessDenied* — dėžutė ne grupėje arba leidimas dar neįsigaliojo.

## 6. Kiti servisai

| Servisas | Kam |
|---|---|
| **Key Vault** `kv-durys-<env>` | Paslaptims, jei kada prireiks (pvz. trečiųjų šalių API raktai). RBAC režimas. |
| **Application Insights** + **Log Analytics** | Klaidos, užklausų žurnalai, SQL auditas. |
| **Storage Account** (Blob) `edurysfoto` | Durų nuotraukos, konteineris `images`, aplankas pagal gamintoją (`erkado/`). Anoniminė prieiga ir raktai išjungti. Programai — rolė *Storage Blob Data Reader* (Managed Identity); App Service nustatymas `MEDIA_ACCOUNT=edurysfoto` (konteineris pagal nutylėjimą `images`, kitaip — `MEDIA_CONTAINER`). Nuotraukas įkelti: `az storage blob upload-batch --account-name edurysfoto --destination images --destination-path erkado --source <aplankas> --auth-mode login` (reikia rolės *Storage Blob Data Contributor*). |
| **Front Door + WAF** (vėliau) | Apsauga nuo atakų, kai sistema bus vieša. |

## 7. Diegimas iš GitHub

- GitHub Actions jungiasi prie Azure per **OIDC (federated credentials)** — jokių slaptažodžių GitHub'e.
- Diegimo tapatybė (atskira App registration / User-assigned identity):
  - App Service — *Website Contributor* tik `app-durys-<env>`;
  - DB — narys `app_admin_tools` rolėje ir teisė vykdyti migracijas (dev: `db_owner`; prod — tik per patvirtinimą).
- GitHub **Environments**: `dev` diegiama automatiškai, `prod` — tik paspaudus patvirtinimą.

## 8. Ko reikia iš jūsų dabar

1. **GitHub repozitorija** — prijunkite ją prie šios sesijos, įkelsiu projektą.
2. **Azure prenumerata** ir resursų grupės `rg-durys-dev` (pradžiai užtenka dev).
3. Sprendimas dėl **domeno** (pvz. `durys.jupoja.lt`).
4. **Bendros pašto dėžutės** adresas laiškams siųsti.
5. **SQL slaptažodžių neperduokite** — jų sistema nenaudoja.
