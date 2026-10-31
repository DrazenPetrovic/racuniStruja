# racuniStruja

Jednostavna aplikacija za spremanje PDF računa za struju i praćenje stvarne potrošnje u kWh.

## Pokretanje

Otvorite `index.html` u modernom pregledniku. Ako preglednik ograničava lokalnu pohranu za `file://` stranice, pokrenite lokalni web-poslužitelj iz ove mape, primjerice:

```sh
python3 -m http.server 8000
```

Zatim otvorite <http://localhost:8000>.

## Korištenje

Na svakom računu unesite početak i kraj obračunskog razdoblja, potrošnju u kWh i iznos, pa priložite PDF. Vrijednosti se unose ručno s računa; PDF se sprema uz zapis i može se otvoriti iz arhive. Zbroj potrošnje i iznosa, graf zadnjih šest računa te arhiva osvježavaju se nakon spremanja.

Računi se pohranjuju u lokalnu bazu podataka preglednika na ovom uređaju. Aplikacija ne šalje podatke na poslužitelj. Brisanjem podataka preglednika mogu se ukloniti spremljeni računi.
