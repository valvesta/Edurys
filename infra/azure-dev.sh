#!/usr/bin/env bash
# ==========================================================================
#  Durų sistemos DEV aplinkos sukūrimas Azure'e.
#
#  Kur paleisti: Azure portalas -> Cloud Shell (Bash). Prieš tai įsitikinkite,
#  kad pasirinkta teisinga prenumerata:  az account show
#
#  Paleidimas:
#     curl -fsSL https://raw.githubusercontent.com/valvesta/Edurys/main/infra/azure-dev.sh -o azure-dev.sh
#     bash azure-dev.sh
#  (jei repozitorija privati — įkelkite failą per Cloud Shell „Upload")
#
#  Ką sukuria (resursų grupėje rg-durys-dev):
#     - Log Analytics + Application Insights (žurnalai, klaidos)
#     - Azure SQL serveris (TIK Microsoft Entra prisijungimas, be slaptažodžių)
#       ir duomenų bazė „durys" (Serverless, automatiškai užmiega)
#     - App Service (Linux, Node 22) su Managed Identity, tik HTTPS, TLS 1.2
#     - Key Vault (RBAC)
#     - Entra programų registracijos: durys-api-dev ir durys-web-dev
#     - GitHub diegimo tapatybė (OIDC — be slaptažodžių) repozitorijai valvesta/Edurys
#     - DB naudotojus: programai (teises suteiks diegimas: tik app_api)
#       ir diegimui (db_owner — TIK dev aplinkoje)
#
#  Skriptas nieko netrina. Kartoti galima — esami resursai paliekami.
# ==========================================================================
set -euo pipefail

LOCATION="${LOCATION:-westeurope}"
ENV_NAME="dev"
PREFIX="${PREFIX:-durys}"
GH_REPO="${GH_REPO:-valvesta/Edurys}"
RG="rg-${PREFIX}-${ENV_NAME}"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mKLAIDA: %s\033[0m\n' "$*" >&2; exit 1; }

az config set extension.use_dynamic_install=yes_without_prompt >/dev/null 2>&1 || true

say "Prenumerata ir prisijungęs naudotojas"
SUB_ID=$(az account show --query id -o tsv)
SUB_NAME=$(az account show --query name -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
ME_OID=$(az ad signed-in-user show --query id -o tsv)
ME_UPN=$(az ad signed-in-user show --query userPrincipalName -o tsv)
ME_MAIL=$(az ad signed-in-user show --query mail -o tsv 2>/dev/null || true)
if [ -z "$ME_MAIL" ] || [ "$ME_MAIL" = "None" ]; then ME_MAIL="$ME_UPN"; fi
echo "    Prenumerata: $SUB_NAME ($SUB_ID)"
echo "    Naudotojas:  $ME_UPN"
read -r -p "    Tęsti su šia prenumerata? [t/N] " ans
[[ "$ans" =~ ^[tTyY]$ ]] || die "Nutraukta. Pasirinkite prenumeratą: az account set --subscription <ID>"

# Unikali pabaiga vardams (SQL serverio, App Service ir Key Vault vardai turi būti unikalūs visame Azure).
# Saugoma resursų grupės žymoje, kad pakartotinis paleidimas naudotų tą pačią.
if az group show -n "$RG" >/dev/null 2>&1; then
  SUFFIX=$(az group show -n "$RG" --query "tags.suffix" -o tsv)
fi
if [ -z "${SUFFIX:-}" ] || [ "$SUFFIX" = "None" ]; then SUFFIX=$(openssl rand -hex 3); fi

SQL_SERVER="sql-${PREFIX}-${ENV_NAME}-${SUFFIX}"
SQL_DB="durys"
PLAN="asp-${PREFIX}-${ENV_NAME}"
APP="app-${PREFIX}-${ENV_NAME}-${SUFFIX}"
LAW="log-${PREFIX}-${ENV_NAME}"
APPI="appi-${PREFIX}-${ENV_NAME}"
KV="kv-${PREFIX}-${ENV_NAME}-${SUFFIX}"
DEPLOY_NAME="gh-${PREFIX}-deploy-${ENV_NAME}"
APP_URL="https://${APP}.azurewebsites.net"

say "Resursų grupė $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" --tags app=durys env="$ENV_NAME" suffix="$SUFFIX" -o none
ok "sukurta"

say "Žurnalai: Log Analytics + Application Insights"
az monitor log-analytics workspace show -g "$RG" -n "$LAW" -o none 2>/dev/null \
  || az monitor log-analytics workspace create -g "$RG" -n "$LAW" -l "$LOCATION" --retention-time 30 -o none
LAW_ID=$(az monitor log-analytics workspace show -g "$RG" -n "$LAW" --query id -o tsv)
az monitor app-insights component show -g "$RG" -a "$APPI" -o none 2>/dev/null \
  || az monitor app-insights component create -g "$RG" -a "$APPI" -l "$LOCATION" --workspace "$LAW_ID" -o none
APPI_CONN=$(az monitor app-insights component show -g "$RG" -a "$APPI" --query connectionString -o tsv)
ok "$LAW, $APPI"

say "Azure SQL serveris $SQL_SERVER (tik Entra prisijungimas)"
if ! az sql server show -g "$RG" -n "$SQL_SERVER" -o none 2>/dev/null; then
  az sql server create -g "$RG" -n "$SQL_SERVER" -l "$LOCATION" \
    --enable-ad-only-auth \
    --external-admin-principal-type User \
    --external-admin-name "$ME_UPN" \
    --external-admin-sid "$ME_OID" \
    --minimal-tls-version 1.2 -o none
fi
ok "Entra administratorius: $ME_UPN (vėliau rekomenduojama pakeisti į grupę)"

say "Duomenų bazė $SQL_DB (General Purpose Serverless, 1 vCore, užmiega po 1 val.)"
if ! az sql db show -g "$RG" -s "$SQL_SERVER" -n "$SQL_DB" -o none 2>/dev/null; then
  az sql db create -g "$RG" -s "$SQL_SERVER" -n "$SQL_DB" \
    --edition GeneralPurpose --compute-model Serverless --family Gen5 --capacity 1 \
    --auto-pause-delay 60 --min-capacity 0.5 --backup-storage-redundancy Local -o none
fi
ok "sukurta"

say "SQL auditas -> Log Analytics"
az sql server audit-policy update -g "$RG" -n "$SQL_SERVER" --state Enabled \
  --log-analytics-target-state Enabled --log-analytics-workspace-resource-id "$LAW_ID" -o none
ok "įjungtas"

say "App Service $APP (Linux, Node 22, Managed Identity)"
az appservice plan show -g "$RG" -n "$PLAN" -o none 2>/dev/null \
  || az appservice plan create -g "$RG" -n "$PLAN" -l "$LOCATION" --is-linux --sku B1 -o none
az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null \
  || az webapp create -g "$RG" -p "$PLAN" -n "$APP" --runtime "NODE:22-lts" -o none
az webapp identity assign -g "$RG" -n "$APP" -o none
APP_MI_OID=$(az webapp identity show -g "$RG" -n "$APP" --query principalId -o tsv)
az webapp update -g "$RG" -n "$APP" --https-only true -o none
az webapp config set -g "$RG" -n "$APP" --min-tls-version 1.2 --ftps-state Disabled --http20-enabled true \
  --always-on true --startup-file "node api/src/server.js" -o none
ok "$APP_URL"

say "Key Vault $KV (RBAC)"
az keyvault show -g "$RG" -n "$KV" -o none 2>/dev/null \
  || az keyvault create -g "$RG" -n "$KV" -l "$LOCATION" --enable-rbac-authorization true -o none
KV_ID=$(az keyvault show -g "$RG" -n "$KV" --query id -o tsv)
az role assignment create --assignee-object-id "$APP_MI_OID" --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" --scope "$KV_ID" -o none 2>/dev/null || true
ok "programa gali skaityti paslaptis (rašyti — ne)"

say "Prisijungimas darbuotojams: Entra programų registracijos"
API_APP_ID=$(az ad app list --display-name "durys-api-${ENV_NAME}" --query "[0].appId" -o tsv)
if [ -z "$API_APP_ID" ]; then
  API_APP_ID=$(az ad app create --display-name "durys-api-${ENV_NAME}" --sign-in-audience AzureADMyOrg --query appId -o tsv)
  API_OBJ=$(az ad app show --id "$API_APP_ID" --query id -o tsv)
  SCOPE_ID=$(cat /proc/sys/kernel/random/uuid)
  az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/${API_OBJ}" \
    --headers "Content-Type=application/json" --body "{
      \"identifierUris\": [\"api://${API_APP_ID}\"],
      \"api\": { \"requestedAccessTokenVersion\": 2, \"oauth2PermissionScopes\": [{
        \"id\": \"${SCOPE_ID}\", \"type\": \"User\", \"isEnabled\": true, \"value\": \"access_as_user\",
        \"adminConsentDisplayName\": \"Durų sistema\", \"adminConsentDescription\": \"Prieiga prie durų užsakymų sistemos\",
        \"userConsentDisplayName\": \"Durų sistema\", \"userConsentDescription\": \"Prieiga prie durų užsakymų sistemos\" }] },
      \"optionalClaims\": { \"accessToken\": [ { \"name\": \"email\", \"essential\": false } ] }
    }"
  az ad sp create --id "$API_APP_ID" -o none
fi
SCOPE_ID=$(az ad app show --id "$API_APP_ID" --query "api.oauth2PermissionScopes[0].id" -o tsv)
WEB_APP_ID=$(az ad app list --display-name "durys-web-${ENV_NAME}" --query "[0].appId" -o tsv)
if [ -z "$WEB_APP_ID" ]; then
  WEB_APP_ID=$(az ad app create --display-name "durys-web-${ENV_NAME}" --sign-in-audience AzureADMyOrg --query appId -o tsv)
  WEB_OBJ=$(az ad app show --id "$WEB_APP_ID" --query id -o tsv)
  az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/${WEB_OBJ}" \
    --headers "Content-Type=application/json" --body "{
      \"spa\": { \"redirectUris\": [\"${APP_URL}/\", \"http://localhost:8080/\"] },
      \"requiredResourceAccess\": [ { \"resourceAppId\": \"${API_APP_ID}\",
        \"resourceAccess\": [ { \"id\": \"${SCOPE_ID}\", \"type\": \"Scope\" } ] } ]
    }"
  az ad sp create --id "$WEB_APP_ID" -o none
fi
ok "durys-api-${ENV_NAME}: $API_APP_ID"
ok "durys-web-${ENV_NAME}: $WEB_APP_ID"

say "App Service nustatymai (be slaptažodžių)"
AUTH_PROVIDERS="[{\"name\":\"staff\",\"issuer\":\"https://login.microsoftonline.com/${TENANT_ID}/v2.0\",\"jwksUri\":\"https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys\",\"audience\":\"${API_APP_ID}\"}]"
SETTINGS_FILE=$(mktemp)
python3 - "$SETTINGS_FILE" <<PY
import json, sys
s = {
  "NODE_ENV": "production",
  "APP_BASE_URL": "${APP_URL}",
  "DB_SERVER": "${SQL_SERVER}.database.windows.net",
  "DB_NAME": "${SQL_DB}",
  "AUTH_PROVIDERS": json.dumps(json.loads('''${AUTH_PROVIDERS}''')),
  "WEB_CLIENT_ID": "${WEB_APP_ID}",
  "API_SCOPE": "api://${API_APP_ID}/access_as_user",
  "TENANT_ID": "${TENANT_ID}",
  "APPLICATIONINSIGHTS_CONNECTION_STRING": "${APPI_CONN}",
  "SCM_DO_BUILD_DURING_DEPLOYMENT": "false",
  "WEBSITE_RUN_FROM_PACKAGE": "1",
}
json.dump([{"name": k, "value": v, "slotSetting": False} for k, v in s.items()], open(sys.argv[1], "w"))
PY
az webapp config appsettings set -g "$RG" -n "$APP" --settings "@${SETTINGS_FILE}" -o none
rm -f "$SETTINGS_FILE"
ok "nustatyta"

say "SQL ugniasienė: tik App Service išeinantys IP (be Allow Azure services)"
for ip in $(az webapp show -g "$RG" -n "$APP" --query possibleOutboundIpAddresses -o tsv | tr ',' ' '); do
  az sql server firewall-rule create -g "$RG" -s "$SQL_SERVER" -n "app-${ip//./-}" \
    --start-ip-address "$ip" --end-ip-address "$ip" -o none
done
ok "App Service IP leidžiami"

say "GitHub diegimo tapatybė (OIDC, be slaptažodžių)"
DEPLOY_APP_ID=$(az ad app list --display-name "$DEPLOY_NAME" --query "[0].appId" -o tsv)
if [ -z "$DEPLOY_APP_ID" ]; then
  DEPLOY_APP_ID=$(az ad app create --display-name "$DEPLOY_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)
  az ad sp create --id "$DEPLOY_APP_ID" -o none
  az ad app federated-credential create --id "$DEPLOY_APP_ID" --parameters "{
    \"name\": \"github-${ENV_NAME}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GH_REPO}:environment:${ENV_NAME}\",
    \"audiences\": [\"api://AzureADTokenExchange\"] }" -o none
fi
DEPLOY_SP_OID=$(az ad sp show --id "$DEPLOY_APP_ID" --query id -o tsv)
APP_ID_RES=$(az webapp show -g "$RG" -n "$APP" --query id -o tsv)
SQL_ID_RES=$(az sql server show -g "$RG" -n "$SQL_SERVER" --query id -o tsv)
az role assignment create --assignee-object-id "$DEPLOY_SP_OID" --assignee-principal-type ServicePrincipal \
  --role "Website Contributor" --scope "$APP_ID_RES" -o none 2>/dev/null || true
# Tik tam, kad diegimo metu galėtų laikinai atidaryti ugniasienę savo IP adresui
az role assignment create --assignee-object-id "$DEPLOY_SP_OID" --assignee-principal-type ServicePrincipal \
  --role "SQL Server Contributor" --scope "$SQL_ID_RES" -o none 2>/dev/null || true
ok "$DEPLOY_NAME: $DEPLOY_APP_ID (tik šiai App Service ir SQL serveriui)"

say "DB naudotojai (jungiamasi kaip $ME_UPN)"
MY_IP=$(curl -fsS https://api.ipify.org)
az sql server firewall-rule create -g "$RG" -s "$SQL_SERVER" -n "cloudshell-tmp" \
  --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" -o none
trap 'az sql server firewall-rule delete -g "$RG" -s "$SQL_SERVER" -n cloudshell-tmp -o none 2>/dev/null || true' EXIT
TOKEN=$(az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv)
WORK=$(mktemp -d)
( cd "$WORK" && npm init -y >/dev/null && npm install --silent --no-audit --no-fund mssql@11 >/dev/null )
cat > "$WORK/users.js" <<'JS'
const sql = require('mssql');
(async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.SQL_SERVER_FQDN, database: process.env.SQL_DB_NAME,
    authentication: { type: 'azure-active-directory-access-token', options: { token: process.env.SQL_TOKEN } },
    options: { encrypt: true }, connectionTimeout: 120000, requestTimeout: 120000,
  }).connect();
  const ensure = async (name, extra) => {
    if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error('netinkamas vardas ' + name);
    await pool.request().batch(`IF USER_ID(N'${name}') IS NULL CREATE USER [${name}] FROM EXTERNAL PROVIDER; ${extra || ''}`);
    console.log('    ✓ DB naudotojas ' + name);
  };
  await ensure(process.env.APP_NAME);                       // teises (app_api) suteiks diegimas
  await ensure(process.env.DEPLOY_NAME, `IF IS_ROLEMEMBER('db_owner', N'${process.env.DEPLOY_NAME}') = 0 ALTER ROLE db_owner ADD MEMBER [${process.env.DEPLOY_NAME}];`);
  await pool.close();
})().catch(e => { console.error('KLAIDA: ' + e.message); process.exit(1); });
JS
( cd "$WORK" && SQL_TOKEN="$TOKEN" SQL_SERVER_FQDN="${SQL_SERVER}.database.windows.net" SQL_DB_NAME="$SQL_DB" \
  APP_NAME="$APP" DEPLOY_NAME="$DEPLOY_NAME" node users.js )
rm -rf "$WORK"

say "PARUOŠTA. Šias reikšmes reikia įrašyti GitHub'e"
cat <<OUT

  GitHub -> valvesta/Edurys -> Settings -> Environments -> „dev" -> Environment variables:

    AZURE_CLIENT_ID        = ${DEPLOY_APP_ID}
    AZURE_TENANT_ID        = ${TENANT_ID}
    AZURE_SUBSCRIPTION_ID  = ${SUB_ID}
    AZURE_RG               = ${RG}
    AZURE_WEBAPP           = ${APP}
    AZURE_SQL_SERVER       = ${SQL_SERVER}
    AZURE_SQL_DB           = ${SQL_DB}
    BOOTSTRAP_ADMIN_EMAIL  = ${ME_MAIL}
    BOOTSTRAP_ADMIN_OID    = ${ME_OID}

  (Tai ne slaptažodžiai — galite juos tiesiog nukopijuoti Claude, jis įrašys pats.)

  Sistemos adresas: ${APP_URL}
OUT
