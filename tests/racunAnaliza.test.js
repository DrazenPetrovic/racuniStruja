import test from 'node:test';
import assert from 'node:assert/strict';
import { dopuniMjesece } from '../src/services/racunAnaliza.js';

const zona = (kwh, cijena = 0.1) => ({ kwh, cijena, iznos: Number((kwh * cijena).toFixed(2)) });

// Dijeli potrosnju na zone po granicama 500 i 1.500, a sve ide u skupu tarifu
const mjesec = (id, datum, kwh) => ({
  id,
  mjesec: datum,
  brojRacuna: `R${id}`,
  zone: {
    vt: {
      bijela: zona(Math.min(kwh, 500)),
      plava: zona(Math.max(0, Math.min(kwh, 1500) - 500)),
      crvena: zona(Math.max(0, kwh - 1500)),
    },
    mt: { bijela: zona(0), plava: zona(0), crvena: zona(0) },
  },
  vtMrezaKm: 0,
  mtMrezaKm: 0,
  fiksnoKm: 10,
  pdvStopa: 17,
  pdvKm: 0,
  ukupnoKm: 100,
});

const julStvarni = {
  ...mjesec(1, '2026-07-01', 0),
  zone: {
    vt: { bijela: { kwh: 238, cijena: 0.0813, iznos: 19.35 }, plava: { kwh: 165, cijena: 0.1277, iznos: 21.07 }, crvena: zona(0) },
    mt: { bijela: { kwh: 262, cijena: 0.0406, iznos: 10.64 }, plava: { kwh: 182, cijena: 0.0638, iznos: 11.61 }, crvena: zona(0) },
  },
  vtMrezaKm: 32.24,
  mtMrezaKm: 17.93,
  fiksnoKm: 13.99,
  ukupnoKm: 148.39,
};

test('zona se odredjuje po ukupnoj mjesecnoj potrosnji, na samim granicama', () => {
  const zonaZa = (kwh) => dopuniMjesece([mjesec(1, '2026-07-01', kwh)]).racuni[0];
  assert.equal(zonaZa(500).zona, 'bijela');
  assert.equal(zonaZa(501).zona, 'plava');
  assert.equal(zonaZa(1500).zona, 'plava');
  assert.equal(zonaZa(1501).zona, 'crvena');
  assert.equal(zonaZa(847).doSljedeceZone, 653);
  assert.equal(zonaZa(2000).doSljedeceZone, null);
});

test('zbir po zonama i prava cijena za stvarni julski racun', () => {
  const [r] = dopuniMjesece([julStvarni]).racuni;
  assert.equal(r.ukupnoKwh, 847);
  assert.deepEqual(r.zoneKwh, { bijela: 500, plava: 347, crvena: 0 });
  assert.equal(r.vt.pravaCijena, 0.2109);
  assert.equal(r.mt.pravaCijena, 0.1059);
  assert.equal(r.fiksnoSaPdv, 16.37);
});

test('grijanje je potrosnja iznad prosjeka jun-septembar, samo u oktobru-maju', () => {
  const { racuni, osnovnaPotrosnja, sezone } = dopuniMjesece([
    mjesec(1, '2026-01-01', 2700),
    mjesec(2, '2026-06-01', 600),
    mjesec(3, '2026-07-01', 800),
    mjesec(4, '2026-05-01', 650),
    mjesec(5, '2026-10-01', 1300),
  ]);
  assert.equal(osnovnaPotrosnja, 700);
  assert.deepEqual(racuni.map((r) => r.grijanjeKwh), [2000, 0, null, null, 600]);
  assert.deepEqual(sezone.map((s) => [s.naziv, s.ukupnoKwh, s.grijanjeKwh]), [
    ['2026/27', 1300, 600],
    ['2025/26', 3350, 2000],
  ]);
});

test('bez mjeseci jun-septembar grijanje se ne procjenjuje', () => {
  const { racuni, osnovnaPotrosnja, sezone } = dopuniMjesece([mjesec(1, '2026-01-01', 2700)]);
  assert.equal(osnovnaPotrosnja, null);
  assert.equal(racuni[0].grijanjeKwh, null);
  assert.equal(sezone[0].grijanjeKwh, null);
});

test('mjeseci se vracaju hronoloski bez obzira na redoslijed uvoza', () => {
  const { racuni } = dopuniMjesece([mjesec(2, '2026-08-01', 100), mjesec(1, '2026-07-01', 100)]);
  assert.deepEqual(racuni.map((r) => r.id), [1, 2]);
});
