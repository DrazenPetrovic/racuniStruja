import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Parser radi po koordinatama teksta, a ne po redoslijedu iz PDF-a:
// PDF drzi tekst izmijesan (npr. iznosi prije oznaka kolona).

export class RacunParseError extends Error {
  constructor(message, detalji = []) {
    super(message);
    this.name = 'RacunParseError';
    this.detalji = detalji;
  }
}

// x koordinata granice lijeve i desne kolone u donjem dijelu racuna
const GRANICA_KOLONA = 335;
const TOLERANCIJA_REDA = 1.5;
const TOLERANCIJA_KM = 0.02;

// ERS u nekim tekstovima mijesa latinicna i cirilicna slova istog izgleda
const LATINICA_U_CIRILICU = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х',
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у',
};

const normalizuj = (tekst) => tekst.replace(/[ABCEHKMOPTXaceopxy]/g, (s) => LATINICA_U_CIRILICU[s]);

const JE_BROJ = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:,\d+)?$/;

// "7.496,00" -> 7496, "1.355" -> 1355
export const parsirajBroj = (tekst) => Number(tekst.replace(/\./g, '').replace(',', '.'));

const parsirajDatum = (tekst) => {
  const [dan, mjesec, godina] = tekst.split('.');
  return `${godina}-${mjesec}-${dan}`;
};

const grupisiURedove = (stavke) => {
  const redovi = [];
  const poVisini = [...stavke].sort((a, b) => b.y - a.y);
  for (const stavka of poVisini) {
    const zadnji = redovi[redovi.length - 1];
    if (zadnji && zadnji.y - stavka.y <= TOLERANCIJA_REDA) {
      zadnji.stavke.push(stavka);
    } else {
      redovi.push({ y: stavka.y, stavke: [stavka] });
    }
  }
  return redovi.map(({ stavke: s }) => {
    const celije = s.sort((a, b) => a.x - b.x);
    return {
      tekst: normalizuj(celije.map((c) => c.str).join(' ')),
      sirovo: celije.map((c) => c.str).join(' '),
      celije: celije.map((c) => normalizuj(c.str)),
      brojevi: celije.filter((c) => JE_BROJ.test(c.str)).map((c) => parsirajBroj(c.str)),
    };
  });
};

const izvuciStavke = async (buffer) => {
  let dokument;
  try {
    dokument = await getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      verbosity: 0,
    }).promise;
  } catch {
    throw new RacunParseError('Fajl nije ispravan PDF ili je zaštićen lozinkom');
  }
  try {
    const strana = await dokument.getPage(1);
    const sadrzaj = await strana.getTextContent();
    return sadrzaj.items
      .filter((i) => i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str.trim() }));
  } finally {
    await dokument.destroy();
  }
};

const uzmiTekst = (redovi, regex, naziv) => {
  for (const red of redovi) {
    const pogodak = red.tekst.match(regex);
    if (pogodak) return pogodak;
  }
  throw new RacunParseError(`Na računu nije pronađeno polje: ${naziv}`);
};

const uzmiBrojeve = (redovi, regex, koliko, naziv) => {
  const red = redovi.find((r) => regex.test(r.tekst) && r.brojevi.length === koliko);
  if (!red) throw new RacunParseError(`Na računu nije pronađen red: ${naziv}`);
  return red.brojevi;
};

// Red tabele sa oznakom tarife u prvoj celiji (АВТ / АМТ / ОС)
const uzmiRedTarife = (redovi, oznaka, koliko, naziv) => {
  const red = redovi.find((r) => r.celije[0] === oznaka && r.brojevi.length === koliko);
  if (!red) throw new RacunParseError(`Na računu nije pronađen red: ${naziv}`);
  return red.brojevi;
};

const citajBrojilo = (redovi, oznaka) => {
  const [staro, novo, utroseno, zaduzenje, zaObracun] = uzmiRedTarife(redovi, oznaka, 5, `stanje brojila ${oznaka}`);
  return { staro, novo, utroseno, zaduzenje, zaObracun };
};

const citajObracun = (redovi, oznaka) => {
  const [kwh, energija, prenosCijena, prenos, distribucijaCijena, distribucija, oieeCijena, oiee] =
    uzmiRedTarife(redovi, oznaka, 8, `obračun ${oznaka}`);
  return { kwh, energija, prenosCijena, prenos, distribucijaCijena, distribucija, oieeCijena, oiee };
};

const citajZone = (redovi) => {
  const kolicine = redovi.filter((r) => r.tekst.includes('Количина (kWh)') && r.brojevi.length === 4);
  const cijene = redovi.filter((r) => r.tekst.includes('Цијена (КМ/kWh)') && r.brojevi.length === 3);
  const iznosi = redovi.filter((r) => r.tekst.includes('Износ (КМ)') && r.brojevi.length === 4);
  if (kolicine.length !== 3 || cijene.length !== 2 || iznosi.length !== 2) {
    throw new RacunParseError('Na računu nije pronađena tabela bijela / plava / crvena zona');
  }
  const tarifa = (i) => {
    const zona = (z) => ({ kwh: kolicine[i].brojevi[z], cijena: cijene[i].brojevi[z], iznos: iznosi[i].brojevi[z] });
    return {
      bijela: zona(0),
      plava: zona(1),
      crvena: zona(2),
      ukupnoKwh: kolicine[i].brojevi[3],
      ukupnoIznos: iznosi[i].brojevi[3],
    };
  };
  return { vt: tarifa(0), mt: tarifa(1) };
};

const blizu = (a, b, tolerancija = TOLERANCIJA_KM) => Math.abs(a - b) <= tolerancija;

// Racun se odbija ako se bilo koji zbir ne slaze - bolje greska nego pogresni podaci u istoriji
export const provjeriRacun = (r) => {
  const greske = [];
  const provjeri = (uslov, opis) => {
    if (!uslov) greske.push(opis);
  };

  for (const [t, naziv] of [['vt', 'skupa'], ['mt', 'jeftina']]) {
    const b = r.brojilo[t];
    const o = r.obracun[t];
    const z = r.zone[t];
    provjeri(blizu(b.novo - b.staro, b.utroseno), `brojilo (${naziv}): novo - staro != utrošeno`);
    provjeri(blizu(b.utroseno + b.zaduzenje, b.zaObracun), `brojilo (${naziv}): utrošeno + zaduženje != za obračun`);
    provjeri(blizu(b.zaObracun, o.kwh), `${naziv}: kWh u brojilu i obračunu se razlikuju`);
    provjeri(blizu(z.bijela.kwh + z.plava.kwh + z.crvena.kwh, o.kwh), `${naziv}: zbir zona != kWh za obračun`);
    provjeri(blizu(z.bijela.iznos + z.plava.iznos + z.crvena.iznos, o.energija), `${naziv}: zbir iznosa zona != energija`);
    for (const zona of ['bijela', 'plava', 'crvena']) {
      provjeri(blizu(z[zona].kwh * z[zona].cijena, z[zona].iznos), `${naziv}/${zona}: količina x cijena != iznos`);
    }
  }

  const { vt, mt, snaga, ukupno } = r.obracun;
  provjeri(blizu(vt.energija + mt.energija, ukupno.energija), 'zbir energije');
  provjeri(blizu(vt.prenos + mt.prenos + snaga.prenos, ukupno.prenos), 'zbir prenosne mrežarine');
  provjeri(blizu(vt.distribucija + mt.distribucija + snaga.distribucija, ukupno.distribucija), 'zbir distributivne mrežarine');
  provjeri(blizu(vt.oiee + mt.oiee, ukupno.oiee), 'zbir OIEE');
  provjeri(blizu(ukupno.energija + ukupno.prenos + ukupno.distribucija + ukupno.oiee, ukupno.sve), 'zbir stavki obračuna');

  const i = r.iznosi;
  provjeri(blizu(ukupno.sve + i.snabdijevanje + i.zajednicka, i.bezPdv), 'iznos bez PDV-a');
  provjeri(blizu(i.bezPdv * (i.pdvStopa / 100), i.pdv), 'obračun PDV-a');
  provjeri(blizu(i.bezPdv + i.pdv, i.saPdv), 'iznos sa PDV-om');
  provjeri(blizu(i.saPdv + i.kamata, i.ukupno), 'ukupan iznos računa');

  const s = r.saldo;
  provjeri(blizu(s.prethodni + s.korekcije + s.uplate + i.ukupno, s.zakljucni), 'završni saldo');

  return greske;
};

export const parsirajRedove = (stavke) => {
  const sifra = stavke.find((s) => normalizuj(s.str).startsWith('Рачун број:'));
  if (!sifra) throw new RacunParseError('Ovo ne izgleda kao račun Elektroprivrede RS (ERS)');

  const sredina = stavke.find((s) => normalizuj(s.str).startsWith('Енергија, мрежарина и ОИЕЕ'));
  if (!sredina) throw new RacunParseError('Na računu nije pronađen obračun za mjerno mjesto');

  // Gornji dio je tabela preko cijele strane, donji ima dvije nezavisne kolone
  const granicaY = sredina.y - 5;
  const gore = grupisiURedove(stavke.filter((s) => s.y >= granicaY));
  const doljeLijevo = grupisiURedove(stavke.filter((s) => s.y < granicaY && s.x < GRANICA_KOLONA));
  const doljeDesno = grupisiURedove(stavke.filter((s) => s.y < granicaY && s.x >= GRANICA_KOLONA));

  const brojRacuna = uzmiTekst(gore, /Рачун број:\s*([\d-]+)/, 'broj računa')[1];
  const period = uzmiTekst(gore, /Рачун за период:\s*(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{4})/, 'period');
  const eic = gore.map((r) => r.sirovo.match(/\b\d{2}[A-Z][0-9A-Z]{13}\b/)?.[0]).find(Boolean);
  if (!eic) throw new RacunParseError('Na računu nije pronađen EIC kod');

  const [ukupnoEnergija, ukupnoPrenos, ukupnoDistribucija, ukupnoOiee, ukupnoSve] =
    uzmiBrojeve(gore, /^Енергија, мрежарина и ОИЕЕ/, 5, 'zbir obračuna');
  const [snagaKw, snagaPrenosCijena, snagaPrenos, snagaDistCijena, snagaDist] = uzmiRedTarife(gore, 'ОС', 5, 'obračunska snaga');

  const iznos = (regex, naziv) => uzmiBrojeve(doljeDesno, regex, 1, naziv)[0];

  const racun = {
    brojRacuna,
    sifraKupca: brojRacuna.split('-').pop(),
    eic,
    brojBrojila: gore.map((r) => r.tekst.match(/^(\d{6,})\s+\d+,\d+$/)?.[1]).find(Boolean) ?? null,
    periodOd: `${period[5]}-${period[2]}-${period[1]}`,
    periodDo: `${period[5]}-${period[4]}-${period[3]}`,
    datumIzdavanja: parsirajDatum(uzmiTekst(gore, /Датум издавања рачуна:\s*(\d{2}\.\d{2}\.\d{4})/, 'datum izdavanja')[1]),
    rokPlacanja: parsirajDatum(uzmiTekst(gore, /Рок за плаћање рачуна:\s*(\d{2}\.\d{2}\.\d{4})/, 'rok plaćanja')[1]),
    datumOcitanja: parsirajDatum(uzmiTekst(gore, /^\d{2}\.\d{2}\.\d{4}\.?\s+(\d{2}\.\d{2}\.\d{4})/, 'datum očitanja brojila')[1]),
    brojilo: { vt: citajBrojilo(gore, 'АВТ'), mt: citajBrojilo(gore, 'АМТ') },
    obracun: {
      vt: citajObracun(gore, 'АВТ'),
      mt: citajObracun(gore, 'АМТ'),
      snaga: {
        kw: snagaKw,
        prenosCijena: snagaPrenosCijena,
        prenos: snagaPrenos,
        distribucijaCijena: snagaDistCijena,
        distribucija: snagaDist,
      },
      ukupno: {
        energija: ukupnoEnergija,
        prenos: ukupnoPrenos,
        distribucija: ukupnoDistribucija,
        oiee: ukupnoOiee,
        sve: ukupnoSve,
      },
    },
    zone: citajZone(doljeLijevo),
    iznosi: {
      snabdijevanje: iznos(/^3\. Накнада за услугу снабдијевања/, 'naknada za snabdijevanje'),
      zajednicka: iznos(/^4\. Заједничка потрошња/, 'zajednička potrošnja'),
      bezPdv: iznos(/^Износ без ПДВ-а/, 'iznos bez PDV-a'),
      pdvStopa: Number(uzmiTekst(doljeDesno, /^ПДВ (\d+)%/, 'stopa PDV-a')[1]),
      pdv: iznos(/^ПДВ \d+%/, 'PDV'),
      saPdv: iznos(/^Износ са ПДВ-ом/, 'iznos sa PDV-om'),
      kamata: iznos(/^Затезна камата/, 'zatezna kamata'),
      ukupno: iznos(/^УКУПАН ИЗНОС РАЧУНА/, 'ukupan iznos'),
    },
    saldo: {
      prethodni: iznos(/^Претходни салдо/, 'prethodni saldo'),
      korekcije: iznos(/^Корекције/, 'korekcije'),
      uplate: iznos(/^Уплате/, 'uplate'),
      zakljucni: iznos(/^Закључни салдо/, 'završni saldo'),
    },
  };

  const greske = provjeriRacun(racun);
  if (greske.length > 0) {
    throw new RacunParseError('Podaci sa računa se ne slažu, račun nije uvezen', greske);
  }
  return racun;
};

export const parsirajRacun = async (buffer) => parsirajRedove(await izvuciStavke(buffer));
