# Katalogo paketas

Gamintojo katalogas į duomenų bazę keliauja vienu JSON failu — „paketu" (`db/catalog/*.bundle.json`).

## Kaip ERKADO pateko į paketą

1. `catalog-sources/erkado/2026-I/` — tikslios dabartinio konfigūratoriaus `data.js`, `glass.js`, `engine.js` kopijos.
2. `db/tools/extract-erkado.js` jas įkelia, apskaičiuoja visas funkcijomis aprašytas kainas ir sudeda į lenteles.
   Jei kas nors dviprasmiška (pvz. dviejų tos pačios grupės dekorų kaina skiriasi), skriptas sustoja.
3. `db/tools/verify-catalog.js` **nepriklausomai** iš naujo kviečia originalias funkcijas ir lygina:
   7 524 bazinių kainų patikros, 1 093 stiklo variantai, 128 rankenų apdailos, 49 taisyklių rinkiniai.
4. `db/tools/import-catalog.js` įkelia paketą per `admin.Catalog_ImportVersion`, iškart eksportuoja atgal
   ir vėl lygina su originalu. Jei bent viena reikšmė nesutampa — juodraštis ištrinamas.

## Turinys

| Raktas | Lentelė | Kas |
|---|---|---|
| `lines` | `catalog.ProductLine` | Produktų linijos (STILE, Dažytos, Skydinės) |
| `doorTypes` | `catalog.DoorType` | Varčių tipai |
| `decorGroups`, `decors` | `catalog.DecorGroup`, `catalog.Decor` | Dekorai |
| `widths` | `catalog.Width` | Pločiai |
| `families` | `catalog.Family` | Šeimos; specifinės taisyklės — `rulesJson` |
| `familyDoorTypes`, `familyWidths`, `familyDecors` | `catalog.Family*` | Kas kuriai šeimai galima |
| `models` | `catalog.Model` | Modeliai su pastabomis |
| `basePrices` | `catalog.ModelBasePrice` | Bazinė kaina: šeima × modelis × dekorų grupė |
| `glassOptions` | `catalog.GlassOption` | Stiklo variantai ir priemokos |
| `handles`, `handleFinishes` | `catalog.Handle*` | Rankenos, apdailos, plokštelės |
| `datasets` | `catalog.RuleDataset` | Kitos taisyklės (staktos, priedai, spynos...) — tikslios kopijos |

## Naujas gamintojas ar nauja kaina

- **Kainos pasikeitė** → nauja katalogo versija (pvz. `2027-I`): naujas paketas, importas, paskelbimas.
  Senoji versija tampa RETIRED, bet jau sudaryti užsakymai lieka su savo kainomis.
- **Naujas gamintojas** → jam rašomas savas ištraukimo skriptas (arba importas iš jo kainoraščio Excel),
  kuris sukuria tokios pat struktūros paketą. Lentelės ir procedūros nesikeičia.
