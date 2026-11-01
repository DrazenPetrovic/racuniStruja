import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parsirajRacun, parsirajBroj, provjeriRacun, RacunParseError } from '../src/services/racunParser.js';

// Pravi PDF-ovi nisu u gitu (licni podaci). Staviti ih u uzorci/ kao "ERS račun M-2026.pdf".
const uzorak = (mjesec) => new URL(`../uzorci/ERS račun ${mjesec}-2026.pdf`, import.meta.url);

const OCEKIVANO = [
  {
    mjesec: 7,
    vt: 403, mt: 444, ukupno: 148.78, saPdv: 148.39, kamata: 0.39, uplate: -297.53,
    vtBijela: { kwh: 238, cijena: 0.0813, iznos: 19.35 },
    vtPlava: { kwh: 165, cijena: 0.1277, iznos: 21.07 },
    mtBijela: { kwh: 262, cijena: 0.0406, iznos: 10.64 },
    mtPlava: { kwh: 182, cijena: 0.0638, iznos: 11.61 },
  },
  {
    mjesec: 8,
    vt: 396, mt: 262, ukupno: 122.79, saPdv: 122.79, kamata: 0, uplate: -148.78,
    vtBijela: { kwh: 301, cijena: 0.0813, iznos: 24.47 },
    vtPlava: { kwh: 95, cijena: 0.1277, iznos: 12.13 },
    mtBijela: { kwh: 199, cijena: 0.0406, iznos: 8.08 },
    mtPlava: { kwh: 63, cijena: 0.0638, iznos: 4.02 },
  },
  {
    mjesec: 9,
    vt: 270, mt: 286, ukupno: 96.69, saPdv: 96.69, kamata: 0, uplate: -122.79,
    vtBijela: { kwh: 243, cijena: 0.0813, iznos: 19.76 },
    vtPlava: { kwh: 27, cijena: 0.1277, iznos: 3.45 },
    mtBijela: { kwh: 257, cijena: 0.0406, iznos: 10.43 },
    mtPlava: { kwh: 29, cijena: 0.0638, iznos: 1.85 },
  },
];

for (const o of OCEKIVANO) {
  test(`racun ${o.mjesec}/2026 se tacno parsira`, { skip: !existsSync(uzorak(o.mjesec)) }, async () => {
    const r = await parsirajRacun(readFileSync(uzorak(o.mjesec)));
    assert.equal(r.obracun.vt.kwh, o.vt);
    assert.equal(r.obracun.mt.kwh, o.mt);
    assert.equal(r.iznosi.ukupno, o.ukupno);
    assert.equal(r.iznosi.saPdv, o.saPdv);
    assert.equal(r.iznosi.kamata, o.kamata);
    assert.equal(r.saldo.uplate, o.uplate);
    assert.deepEqual(r.zone.vt.bijela, o.vtBijela);
    assert.deepEqual(r.zone.vt.plava, o.vtPlava);
    assert.deepEqual(r.zone.mt.bijela, o.mtBijela);
    assert.deepEqual(r.zone.mt.plava, o.mtPlava);
    assert.equal(r.zone.vt.crvena.kwh, 0);
    assert.equal(r.periodOd.slice(5, 7), String(o.mjesec).padStart(2, '0'));
    assert.equal(r.rokPlacanja.slice(8), '25');
  });
}

test('racun 6/2026 koji nije koristen pri pisanju parsera prolazi sve provjere zbira', { skip: !existsSync(uzorak(6)) }, async () => {
  const r = await parsirajRacun(readFileSync(uzorak(6)));
  assert.equal(r.periodDo, '2026-06-30');
  assert.deepEqual(provjeriRacun(r), []);
});

const OCEKIVANO_BROJILO = [
  [6, '2026-06-30', 7496, 8119],
  [7, '2026-07-31', 7899, 8563],
  [8, '2026-08-31', 8295, 8825],
  [9, '2026-09-30', 8565, 9111],
];

for (const [mjesec, datum, vt, mt] of OCEKIVANO_BROJILO) {
  test(`stanje brojila na racunu ${mjesec}/2026`, { skip: !existsSync(uzorak(mjesec)) }, async () => {
    const r = await parsirajRacun(readFileSync(uzorak(mjesec)));
    assert.equal(r.datumOcitanja, datum);
    assert.equal(r.brojilo.vt.novo, vt);
    assert.equal(r.brojilo.mt.novo, mt);
  });
}

test('provjera odbija racun ciji se zbir ne slaze', { skip: !existsSync(uzorak(9)) }, async () => {
  const r = await parsirajRacun(readFileSync(uzorak(9)));
  r.zone.vt.bijela.kwh += 10;
  assert.ok(provjeriRacun(r).length > 0);
});

test('fajl koji nije PDF se odbija', async () => {
  await assert.rejects(parsirajRacun(Buffer.from('ovo nije pdf')), RacunParseError);
});

test('brojevi sa separatorom hiljada', () => {
  assert.equal(parsirajBroj('7.496,00'), 7496);
  assert.equal(parsirajBroj('1.355'), 1355);
  assert.equal(parsirajBroj('-297,53'), -297.53);
  assert.equal(parsirajBroj('0,0813'), 0.0813);
});
