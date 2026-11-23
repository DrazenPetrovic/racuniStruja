import test from 'node:test';
import assert from 'node:assert/strict';
import { procijeniPumpu, razmaciPotrosnje } from '../src/services/pumpa.js';
import { trenutak } from '../src/services/procjena.js';

const sat = (datum) => Math.round(trenutak(datum, '00:00') * 24);

// Svaki mjesec ima stalnu temperaturu, a potrosnja je tacno kuca + pumpa po modelu
const KUCA = 17;
const PO_STEPENU = 5;
const BAZA = 15;
const TEMPERATURE = [20, 12, 7, 3, 1, 5, 9, 13, 18, 20, 20, 19];

const podaci = () => {
  const temperatura = new Map();
  const racuni = TEMPERATURE.map((t, i) => {
    const mjesec = `2026-${String(i + 1).padStart(2, '0')}-01`;
    const dana = new Date(Date.UTC(2026, i + 1, 0)).getUTCDate();
    for (let h = 0; h < dana * 24; h += 1) temperatura.set(sat(mjesec) + h, t);
    return { mjesec, ukupnoKwh: dana * (KUCA + PO_STEPENU * Math.max(0, BAZA - t)) };
  });
  return { racuni, temperatura };
};

test('model iz racuna i temperature pronalazi kucu i potrosnju pumpe po stepenu', () => {
  const { racuni, temperatura } = podaci();
  const p = procijeniPumpu(razmaciPotrosnje(racuni, []), temperatura);
  assert.equal(p.model.kucaNaDan, KUCA);
  assert.equal(p.model.grijanjePoStepenu, PO_STEPENU);
  assert.equal(p.model.bazaGrijanja, BAZA);
  assert.equal(p.model.tacnost, 100);
  const april = p.mjeseci[3]; // 30 dana na 3 °C
  assert.equal(april.kucaKwh, 30 * KUCA);
  assert.equal(april.pumpaKwh, 30 * PO_STEPENU * (BAZA - 3));
});

test('unosi prije kraja zadnjeg racuna se ne broje dva puta', () => {
  const { racuni, temperatura } = podaci();
  const unos = (datum, vrijeme, vt) => ({ datum, vrijeme, t: trenutak(datum, vrijeme), vt, mt: 0, izRacuna: false });
  const razmaci = razmaciPotrosnje(racuni, [
    unos('2026-06-10', '20:00', 100),
    { ...unos('2026-12-31', null, 1000), izRacuna: true },
    unos('2027-01-01', '20:00', 1050),
    unos('2027-01-02', '20:00', 1110),
  ]);
  const unosi = razmaci.filter((r) => !r.izRacuna);
  assert.deepEqual(unosi.map((r) => [r.od.datum, r.do.datum, r.kwh]), [
    ['2026-12-31', '2027-01-01', 50],
    ['2027-01-01', '2027-01-02', 60],
  ]);
});

test('bez dovoljno podataka nema procjene', () => {
  const { racuni, temperatura } = podaci();
  const p = procijeniPumpu(razmaciPotrosnje(racuni.slice(0, 3), []), temperatura);
  assert.ok(p.greska);
});

test('topao dan ne daje pumpi 0 kad je izmjereno vise od stalne potrosnje kuce', () => {
  const { racuni, temperatura } = podaci();
  // Dan poslije zadnjeg racuna na 20 °C (model ne ocekuje grijanje), a izmjereno 37 kWh
  const dec31 = { datum: '2026-12-31', vrijeme: null, t: trenutak('2026-12-31', null), vt: 1000, mt: 0, izRacuna: true };
  const unos = (datum, vt) => ({ datum, vrijeme: '20:00', t: trenutak(datum, '20:00'), vt, mt: 0, izRacuna: false });
  for (let h = 0; h < 72; h += 1) temperatura.set(sat('2027-01-01') + h, 20);
  const p = procijeniPumpu(razmaciPotrosnje(racuni, [dec31, unos('2027-01-01', 1010), unos('2027-01-02', 1047)]), temperatura);
  const topao = p.razmaci[p.razmaci.length - 1];
  assert.equal(topao.kwh, 37);
  // Kuca ostaje na svojoj stalnoj potrosnji (~17), a ostatak je pumpa
  assert.ok(Math.abs(topao.kucaKwh - p.model.kucaNaDan * topao.dana) < 0.2, `kuca ${topao.kucaKwh}`);
  assert.ok(topao.pumpaKwh > 15, `pumpa ${topao.pumpaKwh}`);
  assert.ok(Math.abs(topao.pumpaKwh + topao.kucaKwh - 37) < 0.11);
  // Manje od stalne potrosnje kuce: sve je kuca, pumpa 0
  const kratki = p.razmaci[0];
  assert.equal(kratki.pumpaKwh, 0);
  assert.equal(kratki.kucaKwh, kratki.kwh);
});
