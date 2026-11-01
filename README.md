# racuniStruja

Android aplikacija (Capacitor + React) sa backendom na karpas.app (Express + MySQL) za praćenje
računa Elektroprivrede RS. Iz PDF računa izvlači potrošnju po skupoj (AVT) i jeftinoj (AMT) struji,
zone bijela / plava / crvena sa cijenama i procjenu potrošnje za grijanje po mjesecima.

Aplikacija je lična i nezavisna od ostalih sistema: ima vlastitu bazu (`racuni_struja`) i jednog
korisnika, čije je korisničko ime i hash lozinke u `.env` fajlu (`npm run lozinka`).

## Kako radi uvoz

1. Aplikacija šalje PDF na `POST /api/racuni`.
2. [racunParser.js](src/services/racunParser.js) čita tekst po koordinatama na strani.
3. `provjeriRacun` provjerava zbirove (brojilo, zone, količina x cijena, PDV, saldo).
   Ako se bilo šta ne slaže, račun se odbija i korisnik dobija opis greške.
4. Podaci se čuvaju u tabeli `potrosnja` (jedan red po mjesecu), a sam PDF se ne čuva.


## Lokalni razvoj

```powershell
npm install
copy .env.example .env   # popuni vrijednosti, hash lozinke daje: npm run lozinka
npm run dev:server       # API na http://localhost:3010
npm run dev              # frontend na http://localhost:5173
```

## Testovi

```powershell
npm test
```

Testovi parsera koriste prave račune iz foldera `uzorci/` (`ERS račun 7-2026.pdf` itd.).
Taj folder nije u gitu jer računi sadrže lične podatke. Bez njega se ti testovi preskaču.

## Server i APK

- Postavljanje na karpas.app: [nginx-struja.conf](nginx-struja.conf)
- Tabela u bazi: [docs/schema.sql](docs/schema.sql)
- Pravljenje APK-a: [koraci_za_APK.md](koraci_za_APK.md)
