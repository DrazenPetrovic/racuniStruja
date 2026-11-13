import test from 'node:test';
import assert from 'node:assert/strict';
import { cjenovnikIzRacuna, kretanjePotrosnje, obracunajIznos, procijeni, provjeriOcitanje, zadnjePoznatoStanje } from '../src/services/procjena.js';

const zoneJul = {
  vt: {
    bijela: { kwh: 238, cijena: 0.0813, iznos: 19.35 },
    plava: { kwh: 165, cijena: 0.1277, iznos: 21.07 },
    crvena: { kwh: 0, cijena: 0.2425, iznos: 0 },
  },
  mt: {
    bijela: { kwh: 262, cijena: 0.0406, iznos: 10.64 },
    plava: { kwh: 182, cijena: 0.0638, iznos: 11.61 },
    crvena: { kwh: 0, cijena: 0.1212, iznos: 0 },
  },
};

// Stvarni podaci sa racuna za jul 2026, a ostali mjeseci imaju iste cijene
const racun = (mjesec, ukupnoKwh, brojilo) => ({
  mjesec,
  ukupnoKwh,
  zone: zoneJul,
  vt: { kwh: 403 },
  mt: { kwh: 444 },
  vtMrezaKm: 32.24,
  mtMrezaKm: 17.93,
  fiksnoKm: 13.99,
  pdvStopa: 17,
  brojilo,
});

const septembar = racun('2026-09-01', 556, { datum: '2026-09-30', vt: 8565, mt: 9111 });
const oktobar = racun('2026-10-01', 1200, { datum: '2026-10-31', vt: 9165, mt: 9711 });

test('obracun ponavlja stvarni iznos julskog racuna sa PDV-om', () => {
  const km = obracunajIznos(403, 444, cjenovnikIzRacuna(racun('2026-07-01', 847, null)));
  assert.ok(Math.abs(km - 148.39) <= 0.02, `dobijeno ${km}`);
});

test('crvena zona se naplacuje samo za kWh preko 1.500', () => {
  const c = cjenovnikIzRacuna(racun('2026-07-01', 847, null));
  const na1500 = obracunajIznos(750, 750, c);
  const na1600 = obracunajIznos(800, 800, c);
  const energijaZa100 = 100 * (0.5 * 0.2425 + 0.5 * 0.1212);
  const mrezaZa100 = 50 * (32.24 / 403) + 50 * (17.93 / 444);
  assert.ok(Math.abs(na1600 - na1500 - (energijaZa100 + mrezaZa100) * 1.17) < 0.02);
});

test('stanje 1.11. a zadnje poznato 30.09. se dijeli na oktobar i novembar', () => {
  const p = procijeni([septembar], [{ id: 1, datum: '2026-11-01', vt: 9365, mt: 9911 }]);
  assert.equal(p.mjesec, '2026-11-01');
  assert.equal(p.tacanPocetak, false);
  assert.equal(p.gruba, true);
  assert.deepEqual(p.raspon, { dana: 32, kwh: 1600 });
  assert.equal(p.prije.length, 1);
  assert.equal(p.prije[0].mjesec, '2026-10-01');
  assert.equal(p.prije[0].dana, 31);
  assert.equal(p.prije[0].cijeliMjesec, true);
  assert.equal(p.prije[0].kwh, 1550);
  assert.equal(p.dosad.kwh, 50);
  assert.equal(p.dana, 1);
  assert.equal(p.projekcija.kwh, 1500);
});

test('sa uvezenim racunom za prethodni mjesec pocetak je tacan', () => {
  const p = procijeni([septembar, oktobar], [{ id: 1, datum: '2026-11-15', vt: 9565, mt: 10011 }]);
  assert.equal(p.tacanPocetak, true);
  assert.equal(p.gruba, false);
  assert.deepEqual(p.prije, []);
  assert.equal(p.dosad.kwh, 700);
  assert.equal(p.dosad.vt, 400);
  assert.equal(p.dosad.mt, 300);
  assert.equal(p.projekcija.kwh, 1400);
  assert.equal(p.ispodCilja, true);
  assert.equal(p.kwhNaDan, 46.7);
  assert.equal(p.dozvoljenoNaDan, 53.3);
  assert.equal(p.datumPrelaska, null);
});

test('prekoracenje cilja daje datum prelaska 1.500 kWh', () => {
  const p = procijeni([septembar, oktobar], [{ id: 1, datum: '2026-11-10', vt: 9665, mt: 10211 }]);
  assert.equal(p.dosad.kwh, 1000);
  assert.equal(p.projekcija.kwh, 3000);
  assert.equal(p.ispodCilja, false);
  assert.equal(p.projekcija.zona, 'crvena');
  assert.equal(p.datumPrelaska, '2026-11-15');
});

test('ranije rucno ocitanje u mjesecu popravlja pocetak mjeseca', () => {
  const p = procijeni([septembar], [
    { id: 1, datum: '2026-11-01', vt: 9365, mt: 9911 },
    { id: 2, datum: '2026-11-11', vt: 9565, mt: 10111 },
  ]);
  assert.equal(p.prije[0].kwh, 1550);
  assert.equal(p.dosad.kwh, 450);
  assert.equal(p.dana, 11);
  assert.equal(p.tacanPocetak, false);
});

test('ocitanje iz mjeseca koji je dobio racun se vise ne procjenjuje', () => {
  assert.equal(procijeni([septembar, oktobar], [{ id: 1, datum: '2026-10-20', vt: 8900, mt: 9400 }]), null);
});

test('zadnji poznati je rucni unos ako je noviji od racuna', () => {
  assert.equal(zadnjePoznatoStanje([septembar], []).datum, '2026-09-30');
  assert.equal(zadnjePoznatoStanje([septembar], [{ id: 1, datum: '2026-11-01', vt: 9365, mt: 9911 }]).izRacuna, false);
});

test('bez poznatog stanja prije mjeseca trazi se pocetak', () => {
  const bezBrojila = racun('2026-09-01', 556, { datum: null, vt: null, mt: null });
  const p = procijeni([bezBrojila], [{ id: 1, datum: '2026-11-01', vt: 9365, mt: 9911 }]);
  assert.equal(p.nedostajePocetak, true);
});

test('validacija unosa', () => {
  const r = [septembar];
  const danas = '2026-11-02';
  assert.deepEqual(provjeriOcitanje({ datum: '2026-11-01', vt: 9365, mt: 9911 }, r, [], danas), { upozorenja: [] });
  assert.match(provjeriOcitanje({ datum: '2026-11-03', vt: 9365, mt: 9911 }, r, [], danas).greska, /budućnosti/);
  assert.match(provjeriOcitanje({ datum: '2026-09-15', vt: 8400, mt: 9000 }, r, [], danas).greska, /već postoji uvezen račun/);
  assert.match(provjeriOcitanje({ datum: '2026-11-01', vt: 8000, mt: 9911 }, r, [], danas).greska, /skupe struje je manje/);
  assert.match(
    provjeriOcitanje({ datum: '2026-10-20', vt: 9500, mt: 9200 }, r, [{ id: 1, datum: '2026-11-01', vt: 9365, mt: 9911 }], danas).greska,
    /veće od kasnijeg/,
  );
  assert.match(provjeriOcitanje({ datum: '2026-10-01', vt: 8965, mt: 9111 }, r, [], danas).upozorenja[0], /400 kWh na dan/);
});

test('ponovni unos za isti dan ne smeta validaciji', () => {
  const rucna = [{ id: 1, datum: '2026-11-01', vt: 9365, mt: 9911 }];
  assert.deepEqual(provjeriOcitanje({ datum: '2026-11-01', vt: 9300, mt: 9900 }, [septembar], rucna, '2026-11-02'), { upozorenja: [] });
});

test('jutro i vece istog dana su dva odvojena unosa sa tacnim dijelom dana', () => {
  const rucna = [
    { id: 1, datum: '2026-11-10', vrijeme: '07:00', vt: 9365, mt: 10011 },
    { id: 2, datum: '2026-11-10', vrijeme: '19:00', vt: 9385, mt: 10011 },
  ];
  const p = procijeni([septembar, oktobar], rucna);
  // 31.10. u ponoc do 10.11. u 19:00 je 9,79 dana
  assert.equal(p.dana, 9.79);
  assert.equal(p.vrijemeOcitanja, '19:00');
  assert.equal(p.dosad.kwh, 520);
  assert.equal(p.tok.length, 2);
  assert.equal(p.tok[0].potroseno, 500);
  assert.equal(p.tok[1].potroseno, 520);
  assert.equal(p.tok[0].procjena, Math.round((500 / (9 + 7 / 24)) * 30));
  assert.equal(p.tok[1].procjena, p.projekcija.kwh);
});

test('ocitanje u ponoc prvog dana zatvara prethodni mjesec', () => {
  const p = procijeni([septembar], [
    { id: 1, datum: '2026-11-01', vrijeme: '00:00', vt: 9165, mt: 9711 },
    { id: 2, datum: '2026-11-11', vrijeme: '00:00', vt: 9365, mt: 9911 },
  ]);
  assert.equal(p.mjesec, '2026-11-01');
  assert.equal(p.tacanPocetak, true);
  assert.equal(p.dana, 10);
  assert.equal(p.dosad.kwh, 400);
});

test('validacija vremena: buducnost u toku dana i isti trenutak', () => {
  const sada = '2026-11-02 08:00';
  assert.match(provjeriOcitanje({ datum: '2026-11-02', vrijeme: '09:00', vt: 9365, mt: 9911 }, [septembar], [], sada).greska, /budućnosti/);
  assert.deepEqual(provjeriOcitanje({ datum: '2026-11-02', vrijeme: '07:55', vt: 9365, mt: 9911 }, [septembar], [], sada), { upozorenja: [] });
  const rucna = [{ id: 1, datum: '2026-11-02', vrijeme: '07:00', vt: 9365, mt: 9911 }];
  assert.match(
    provjeriOcitanje({ datum: '2026-11-02', vrijeme: '07:30', vt: 9300, mt: 9911 }, [septembar], rucna, sada).greska,
    /manje od stanja 2026-11-02 u 07:00/,
  );
  assert.deepEqual(provjeriOcitanje({ datum: '2026-11-02', vrijeme: '07:00', vt: 9300, mt: 9900 }, [septembar], rucna, sada), { upozorenja: [] });
});

test('kratak razmak ne daje upozorenje o sumnjivo velikoj potrosnji', () => {
  const rucna = [{ id: 1, datum: '2026-11-02', vrijeme: '07:00', vt: 9365, mt: 9911 }];
  const r = provjeriOcitanje({ datum: '2026-11-02', vrijeme: '08:00', vt: 9375, mt: 9911 }, [septembar], rucna, '2026-11-02 09:00');
  assert.deepEqual(r.upozorenja, []);
});

test('kretanje poredi jutro sa jutrom i vece sa vecerom', () => {
  const rucna = [
    { id: 1, datum: '2026-11-10', vrijeme: '07:00', vt: 9300, mt: 9900 },
    { id: 2, datum: '2026-11-10', vrijeme: '19:00', vt: 9320, mt: 9900 },
    { id: 3, datum: '2026-11-11', vrijeme: '07:00', vt: 9320, mt: 9930 },
    { id: 4, datum: '2026-11-11', vrijeme: '19:00', vt: 9350, mt: 9930 },
  ];
  const k = kretanjePotrosnje([septembar, oktobar], rucna);
  assert.equal(k.intervali.length, 4);
  const [, dan1, noc, dan2] = k.intervali;
  assert.equal(dan1.sati, 12);
  assert.equal(dan1.kwhNaDan, 40);
  assert.equal(noc.kwhNaDan, 60);
  assert.equal(noc.mt, 30);
  assert.equal(dan2.kwhNaDan, 60);
  assert.equal(dan2.poredjenje.kwhNaDan, 40);
  assert.equal(dan2.poredjenje.promjena, 50);
  assert.equal(dan2.poredjenje.slican, true);
  // Za noc nema ranije noci, pa se poredi sa prethodnim danom
  assert.equal(noc.poredjenje.slican, false);
  assert.equal(noc.poredjenje.promjena, 50);
});

test('nepravilni razmaci (stari unosi bez vremena) ipak dobijaju poredjenje', () => {
  // Stvarni unosi iz novembra 2026: 06., 10. i 11. bez vremena, 12. u 19:42
  const oktobarStvarni = racun('2026-10-01', 1177, { datum: '2026-10-31', vt: 9049, mt: 9804 });
  const k = kretanjePotrosnje([septembar, oktobarStvarni], [
    { id: 2, datum: '2026-11-06', vrijeme: null, vt: 9234, mt: 10012 },
    { id: 3, datum: '2026-11-10', vrijeme: null, vt: 9317.12, mt: 10163.62 },
    { id: 4, datum: '2026-11-11', vrijeme: null, vt: 9333.56, mt: 10178.11 },
    { id: 5, datum: '2026-11-12', vrijeme: '19:42', vt: 9363, mt: 10193 },
  ]);
  const zadnji = k.intervali[k.intervali.length - 1];
  assert.equal(zadnji.poredjenje.slican, true);
  assert.equal(zadnji.poredjenje.kwhNaDan, 30.9);
  assert.ok(k.intervali.every((iv, i) => i === 0 || iv.poredjenje !== null));
  assert.notEqual(k.poredjenje, null);
});

test('kretanje: zadnjih 7 dana prema 7 dana prije', () => {
  const rucna = [
    { id: 1, datum: '2026-11-07', vrijeme: '20:00', vt: 9300, mt: 9900 },
    { id: 2, datum: '2026-11-14', vrijeme: '20:00', vt: 9500, mt: 10000 },
    { id: 3, datum: '2026-11-21', vrijeme: '20:00', vt: 9700, mt: 10200 },
  ];
  const k = kretanjePotrosnje([septembar, oktobar], rucna);
  assert.equal(k.poredjenje.dana, 7);
  assert.equal(k.poredjenje.sada.kwh, 400);
  assert.equal(k.poredjenje.prije.kwh, 300);
  assert.equal(k.poredjenje.promjena, 33.3);
});

test('kretanje bez dovoljno ocitanja ne izmislja poredjenje', () => {
  const k = kretanjePotrosnje([septembar, oktobar], [{ id: 1, datum: '2026-11-10', vrijeme: '07:00', vt: 9300, mt: 9900 }]);
  assert.equal(k.intervali.length, 1);
  assert.equal(k.poredjenje, null);
});
