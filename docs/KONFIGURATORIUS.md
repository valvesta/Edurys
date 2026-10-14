# Konfigūratorius sistemoje

Adresas: `/konfiguratorius/` (naujas užsakymas), `/konfiguratorius/?uzsakymas=123` (tęsti juodraštį).
Iš užsakymų sąrašo — mygtukas **„+ Naujas užsakymas“**; juodraščio kortelėje — **„Tęsti konfigūratoriuje“**.

## Failai (`web/konfiguratorius/`)

| Failas | Kas jame | Kas keičia |
|---|---|---|
| `styles.css` | Visa išvaizda: spalvos (`:root` kintamieji), šriftai, išdėstymas | **dizaineris** |
| `index.html` | Puslapio karkasas (juosta, skydeliai, langai) | dizaineris (nekeičiant `id`) |
| `templates.js` | HTML dalys, iš kurių piešiamos parinktys, kortelės, būsena | dizaineris (nekeičiant `data-*`) |
| `app.js` | Logika: pasirinkimai, kainų rodymas, užsakymo pozicijos, saugojimas | programuotojas |
| `prodsheet.js` | Gamybos lapas (spausdinamas) | programuotojas |
| `katalogas.js` | Šeimų eiliškumas meniu (iš katalogo DB) | — |
| `boot.js` | Prisijungimas, katalogo ir užsakymo įkėlimas, saugojimas serveryje | programuotojas |

Kainų variklis naršyklei tiekiamas iš `api/src/engines/erkado/` (`/engine/erkado/*.js`) —
**tie patys failai**, kurie skaičiuoja kainas serveryje.

### Taisyklės dizaineriui

- Nekeiskite elementų `id` ir atributų `data-attr`, `data-value`, `data-toggle`, `data-on`, `data-off`,
  `data-select`, `data-key`, `data-n`, `data-line`, `data-decor-group`, `data-idx`, `data-copy`,
  `data-edit`, `data-fallback`, `data-retry` — pagal juos programa atpažįsta paspaudimus.
- Tekstus į HTML įterpkite per `esc()` (žr. `templates.js`).
- Puslapyje negalima naudoti `onclick="…"` ar `<script>` HTML viduje — saugumo politika (CSP) jų nevykdo.

## Kaip saugomas užsakymas

1. Kol nėra pozicijų — užsakymas DB nekuriamas.
2. Įtraukus pirmą poziciją, sukuriamas **juodraštis** (administratorius pirma pasirenka įmonę),
   adrese atsiranda `?uzsakymas=…`.
3. Kiekvienas pakeitimas (įtraukta, atnaujinta, pašalinta pozicija, objektas, pastabos) iškart
   išsaugomas. Serveriui siunčiami **tik pasirinkimai** — kainas jis apskaičiuoja pats.
4. Serverio sumos palyginamos su rodomomis. Jei skiriasi bent centu — būsena „Sumos nesutampa“,
   pateikti neleidžiama.
5. Visi įrašymai vyksta paeiliui su versijos (Revision) patikra: jei užsakymą tuo metu pakeitė
   kitas langas ar naudotojas, rodoma klaida, niekas neperrašoma.
6. **„Pateikti užsakymą“** — statusas „Pateiktas“, toliau užsakymą tvarko administratorius.

Pardavėjo / kliento rekvizitai (spausdinamai sąskaitai) sistemoje **nesaugomi** — tai pažymėta skydeliuose.

## Pakeitimai, palyginti su originaliu newdemo (v53)

| Kas | Anksčiau | Dabar |
|---|---|---|
| Katalogas | `data.js`, `glass.js` failai | iš duomenų bazės (paskelbta versija) |
| Užsakymo numeris | rankomis (E + data) | suteikia sistema (pvz. 2026-000012) |
| Siuntimas | `mailto:` / `.eml`, PDF prisegti rankomis | pateikimas sistemoje (laiškai — iš sistemos) |
| PVM | `round2(suma × 0,21)` — ~0,2 % atvejų 1 ct per mažai | sveikais centais, kaip DB (buhalterinis apvalinimas) |
| Pozicijos suma su PVM | vieneto kaina × kiekis | ta pati, kuri įrašoma DB (iš sąskaitos eilučių) |
| „Redaguoti“ | pozicija iškart pašalinama | keičiama toje pačioje vietoje; galima atšaukti |
| Kaina be dekoro | vienos (nežinomos) grupės kaina | „nuo“ — mažiausia; išskaidymas — pasirinkus dekorą |
| Šeimos nuotrauka antraštėje | pasirinkus šeimą iškart išvaloma (klaida) | rodoma |
| Pozicijos mygtukai | atrodė kaip tekstas (CSS klaida) | mygtukai |
| Kiekis | be ribos | 1–1000 (kaip DB) |
| Nuotraukos | `assets/` aplanke | privati Azure saugykla (žr. SAUGUMAS.md) |

## Patikra

`tools/ui-test/` (CI paleidžia automatiškai):

- `equivalence.js` — naujas konfigūratorius ir **originalas** atidaromi naršyklėje ir vienodai
  „spaudinėjami“ (šimtai scenarijų, tūkstančiai veiksmų). Po kiekvieno žingsnio lyginamas visas turinys:
  meniu, modeliai, visos parinktys, kainos išskaidymas, pozicijos, sąskaita, gamybos lapas.
  Sąmoningi pakeitimai (lentelė aukščiau) pritaikomi originalui prieš lyginant — taip įrodoma,
  kad **kitkas nepasikeitė**.
- `e2e.js` — naršyklė → tikras API (tikras kainų variklis) → DB imitacija: kūrimas, redagavimas,
  šalinimas, sumų sutapimas, perkrovimas, pateikimas, administratoriaus įmonės pasirinkimas, CSP.

```bash
cd api && npm ci && cd ../tools/ui-test && npm ci && npx playwright install chromium
node equivalence.js 150      # scenarijų skaičius
node e2e.js
```
