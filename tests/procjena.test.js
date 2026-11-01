import test from 'node:test';
import assert from 'node:assert/strict';
import { cjenovnikIzRacuna, obracunajIznos, procijeni, provjeriOcitanje, zadnjePoznatoStanje } from '../src/services/procjena.js';

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
