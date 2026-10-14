# Azure DEV aplinkos paleidimas — žingsnis po žingsnio

Visas darbas užtrunka apie 15 minučių. Slaptažodžių niekam perduoti nereikia.

## 1. Paleiskite skriptą Azure Cloud Shell

1. Atidarykite https://portal.azure.com ir viršuje paspauskite **Cloud Shell** piktogramą (`>_`), pasirinkite **Bash**.
2. Patikrinkite prenumeratą: `az account show --query name`
   (jei ne ta: `az account set --subscription "<pavadinimas>"`).
3. Įkelkite failą `infra/azure-dev.sh` (Cloud Shell meniu **Manage files → Upload**) ir paleiskite:
   ```bash
   bash azure-dev.sh
   ```
4. Skriptas paklaus, ar tęsti su šia prenumerata — atsakykite `t`.
5. Pabaigoje bus išvestas sąrašas „Šias reikšmes reikia įrašyti GitHub'e" (tai ne slaptažodžiai).

## 2. Įrašykite reikšmes GitHub'e

1. https://github.com/valvesta/Edurys/settings/environments → **New environment** → pavadinimas `dev` → **Configure environment**.
2. Skiltyje **Environment variables** → **Add environment variable** — kiekvienai iš 9 eilučių
   (pvz. vardas `AZURE_CLIENT_ID`, reikšmė — iš skripto išvesties).
3. **Actions** → **Deploy dev** → **Run workflow**. Po kelių minučių sistema veiks Azure'e.

Reikalingos teisės: prenumeratoje — *Owner* (arba *Contributor* + *User Access Administrator*),
Entra ID — teisė kurti programų registracijas (numatytai turi visi naudotojai, nebent išjungta).

## 3. Kas vyks toliau automatiškai

Kai GitHub'e bus įrašyti kintamieji, kiekvienas sėkmingas pakeitimas `main` šakoje:
1. įvykdys naujas DB migracijas;
2. suteiks programai **tik** `app_api` teises (ir patikrins, kad kitų neturi);
3. sukurs jus pirmuoju globaliu administratoriumi;
4. įkels ERKADO katalogą su pilna patikra (tik pirmą kartą);
5. įdiegs programą ir patikrins, kad ji atsako.

## 4. Vėliau (ne dabar)

| Kas | Kada |
|---|---|
| **Klientų prisijungimas (Entra External ID)** — atskiras nuomininkas klientams | Kai bus naudotojo sąsaja |
| **Paštas** — bendra dėžutė + Exchange teisė siųsti tik iš jos | Kai norėsite, kad eitų laiškai |
| **SQL administratorius — grupė**, ne vienas žmogus | Prieš produkciją |
| **Privatus tinklas (Private Endpoint)** SQL serveriui | Prieš produkciją |
| **PROD aplinka** — tas pats skriptas su `ENV_NAME=prod` ir patvirtinimu prieš diegimą | Prieš paleidžiant klientams |

### Paštas (kai prireiks)

Exchange Online PowerShell (administratorius):

```powershell
Connect-ExchangeOnline
# 1) programos tapatybė (App Service Managed Identity) — AppId ir ObjectId rodo:
#    az ad sp show --id <principalId> --query "{appId:appId, id:id}"
New-ServicePrincipal -AppId <appId> -ObjectId <objectId> -DisplayName "app-durys-dev"
# 2) leidžiama siųsti TIK iš vienos dėžutės
New-ManagementScope -Name "durys-siuntejas" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'uzsakymai@jupoja.lt'"
New-ManagementRoleAssignment -App <objectId> -Role "Application Mail.Send" -CustomResourceScope "durys-siuntejas"
```

Tada App Service nustatymuose `MAIL_SENDER = uzsakymai@jupoja.lt`.
