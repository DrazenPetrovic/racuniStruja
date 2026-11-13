import test from 'node:test';
import assert from 'node:assert/strict';
import { uporediPoslana } from '../src/services/poslanaStanja.js';

const racun = (id, mjesec, datum, vt, mt) => ({ id, mjesec, brojilo: { datum, vt, mt } });
const racuni = [
  racun(1, '2026-09-01', '2026-09-30', 8565, 9111),
  racun(2, '2026-10-01', '2026-10-31', 8900, 9500),
];
const poslano = (poslanoU, vt, mt) => ({ id: 1, poslano: poslanoU, vt, mt, primalac: 'x@y.ba' });

test('poslano stanje koje je stiglo na racunu je isto', () => {
  const [p] = uporediPoslana([poslano('2026-09-29 18:00:00', 8565, 9111)], racuni);
  assert.equal(p.status, 'isto');
  assert.equal(p.racun.mjesec, '2026-09-01');
});

test('razlika izmedju poslanog i stanja na racunu', () => {
  const [p] = uporediPoslana([poslano('2026-11-02 09:00:00', 8890, 9500)], racuni);
  assert.equal(p.status, 'razlika');
  assert.equal(p.racun.mjesec, '2026-10-01');
  assert.equal(p.racun.razlikaVt, 10);
  assert.equal(p.racun.razlikaMt, 0);
});

test('stanje se vezuje za najblizi datum ocitanja', () => {
  const [p] = uporediPoslana([poslano('2026-10-28 10:00:00', 8890, 9490)], racuni);
  assert.equal(p.racun.mjesec, '2026-10-01');
});

test('bez racuna za taj period stanje ceka', () => {
  const [p] = uporediPoslana([poslano('2026-11-29 10:00:00', 9200, 9800)], racuni);
  assert.equal(p.status, 'ceka');
  assert.equal(p.racun, null);
});

test('mala razlika od zaokruzivanja se smatra istim stanjem', () => {
  const [p] = uporediPoslana([poslano('2026-09-30 20:00:00', 8564.6, 9111.4)], racuni);
  assert.equal(p.status, 'isto');
});
