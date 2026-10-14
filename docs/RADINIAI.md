# Radiniai perkeliant duomenis (2026-10-14)

Perkeliant ERKADO duomenis į SQL, viskas buvo palyginta automatiškai. Duomenys perkelti **tiksliai tokie,
kokie yra dabartiniame konfigūratoriuje** — nieko netaisiau savo nuožiūra. Žemiau — vietos, kurias verta patikrinti.

## 1. PVM apvalinimas naršyklėje kartais 1 ct mažesnis

Dabartinis `app.js` PVM skaičiuoja slankiojo kablelio skaičiais: `round2(net * 0.21)`.
Kai tiksli PVM suma baigiasi lygiai pusę cento (pvz. 21,50 € × 21 % = 4,515 €), dėl kompiuterinio skaičių
vaizdavimo gaunama **4,51**, nors teisingai turi būti **4,52**.
Patikrinus visas sumas nuo 0,01 iki 2 000,00 €, taip nutinka **375 atvejais iš 200 000** (~0,2 %).

Naujoje sistemoje PVM skaičiuoja SQL tiksliu dešimtainiu tipu — rezultatas visada teisingas.
**Rekomendacija:** pataisyti ir `app.js` (skaičiuoti centais, sveikaisiais skaičiais), kad peržiūroje rodoma suma sutaptų su užsakymo suma.

## 2. Stiklo kainos, kurias verta patikrinti kataloge

Konfigūratorius stiklo kainas ima iš `glass.js`. `data.js` šeimose yra senesni stiklo laukai (`glass`, `glazed`),
kurių variklis **nenaudoja**. Dauguma skirtumų paaiškinami tuo, kad `data.js` saugo kainą už vieną stiklą,
o `glass.js` — galutinę. Bet trys vietos atrodo įtartinai:

| Šeima, modelis | `glass.js` (naudojama) | `data.js` (nenaudojama) | Pastaba |
|---|---|---|---|
| FORSYCJA 2, VSG juodas | **75,00** | 77,10 | Tokia pati matinė kaina (56,40) kitur visada turi 77,10 juodą (pvz. HIACYNT 2, 5) |
| NEMEZJA 15, VSG matinis / juodas | **205,20 / 342,60** | 102,60 / 171,30 | Lygiai dvigubai — gal dvipusis? |
| PEONIA 2, VSG matinis | **87,00** | nėra (null) | `data.js` rodo, kad matinio varianto nėra |

Nenaudojami laukai išsaugoti kiekvienos šeimos `rulesJson.legacyUnused`, kad nieko nepamestume.

## 3. Kas dar nėra SQL lentelėse

Staktų lentelės, priedai, spynos, ventiliacija, stumdomos sistemos ir kt. (49 rinkiniai) saugomi
`catalog.RuleDataset` kaip **tikslios JSON kopijos** su kontrolinėmis sumomis. Tai sąmoningas sprendimas pirmam etapui:
kiekvienas gamintojas šias taisykles turi savaip, ir jas normalizuoti verta tada, kai prisidės antras gamintojas
ir paaiškės, kas bendra.
