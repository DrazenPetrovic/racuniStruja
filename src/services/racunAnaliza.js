const GRANICA_BIJELE = 500;
const GRANICA_PLAVE = 1500;

// Toplotna pumpa grije od oktobra do maja. Jun-septembar daju osnovnu potrosnju kuce.
const MJESECI_GRIJANJA = [10, 11, 12, 1, 2, 3, 4, 5];

const zaokruzi = (broj, decimale = 4) => Number(broj.toFixed(decimale));

const brojMjeseca = (mjesec) => Number(mjesec.slice(5, 7));

const tarifa = (zone, mreza, stopa, ukupnoKwh) => {
  const kwh = zone.bijela.kwh + zone.plava.kwh + zone.crvena.kwh;
  const energija = zone.bijela.iznos + zone.plava.iznos + zone.crvena.iznos;
  return {
    kwh,
    udio: ukupnoKwh > 0 ? zaokruzi((kwh / ukupnoKwh) * 100, 2) : 0,
    energija: zaokruzi(energija, 2),
    // Prava cijena jednog kWh: energija + mrezarina + OIEE, sa PDV-om
    pravaCijena: kwh > 0 ? zaokruzi(((energija + mreza) * (1 + stopa)) / kwh) : 0,
  };
};

export const zonaZaPotrosnju = (kwh) => {
  if (kwh <= GRANICA_BIJELE) return { zona: 'bijela', doSljedeceZone: GRANICA_BIJELE - kwh };
  if (kwh <= GRANICA_PLAVE) return { zona: 'plava', doSljedeceZone: GRANICA_PLAVE - kwh };
  return { zona: 'crvena', doSljedeceZone: null };
};

// "2025/26" za oktobar 2025 - maj 2026
const nazivSezone = (mjesec) => {
  const godina = Number(mjesec.slice(0, 4));
  const pocetak = brojMjeseca(mjesec) >= 10 ? godina : godina - 1;
  return `${pocetak}/${String(pocetak + 1).slice(2)}`;
};

// Racun ne odvaja toplotnu pumpu od ostale potrosnje, pa je grijanje procjena:
// potrosnja u mjesecima grijanja iznad prosjeka mjeseci bez grijanja
const izracunajOsnovnu = (mjeseci) => {
  const bezGrijanja = mjeseci.filter((m) => !MJESECI_GRIJANJA.includes(brojMjeseca(m.mjesec)));
  if (bezGrijanja.length === 0) return null;
  const zbir = bezGrijanja.reduce((z, m) => z + m.ukupnoKwh, 0);
  return Math.round(zbir / bezGrijanja.length);
};

// Prima mjesece iz baze, vraca ih od najstarijeg ka najnovijem sa izvedenim podacima
export const dopuniMjesece = (redovi) => {
  const sortirani = [...redovi].sort((a, b) => a.mjesec.localeCompare(b.mjesec));

  const saZbirom = sortirani.map((m) => ({
    ...m,
    ukupnoKwh:
      m.zone.vt.bijela.kwh + m.zone.vt.plava.kwh + m.zone.vt.crvena.kwh +
      m.zone.mt.bijela.kwh + m.zone.mt.plava.kwh + m.zone.mt.crvena.kwh,
  }));

  const osnovnaPotrosnja = izracunajOsnovnu(saZbirom);

  const racuni = saZbirom.map((m) => {
    const stopa = m.pdvStopa / 100;
    const uSezoni = MJESECI_GRIJANJA.includes(brojMjeseca(m.mjesec));
    return {
      ...m,
      ...zonaZaPotrosnju(m.ukupnoKwh),
      zoneKwh: {
        bijela: m.zone.vt.bijela.kwh + m.zone.mt.bijela.kwh,
        plava: m.zone.vt.plava.kwh + m.zone.mt.plava.kwh,
        crvena: m.zone.vt.crvena.kwh + m.zone.mt.crvena.kwh,
      },
      vt: tarifa(m.zone.vt, m.vtMrezaKm, stopa, m.ukupnoKwh),
      mt: tarifa(m.zone.mt, m.mtMrezaKm, stopa, m.ukupnoKwh),
      fiksnoSaPdv: zaokruzi(m.fiksnoKm * (1 + stopa), 2),
      prosjekKmKwh: m.ukupnoKwh > 0 ? zaokruzi(m.ukupnoKm / m.ukupnoKwh) : 0,
      grijanjeKwh: uSezoni && osnovnaPotrosnja !== null ? Math.max(0, m.ukupnoKwh - osnovnaPotrosnja) : null,
    };
  });

  const sezone = new Map();
  for (const m of racuni.filter((r) => MJESECI_GRIJANJA.includes(brojMjeseca(r.mjesec)))) {
    const naziv = nazivSezone(m.mjesec);
    const s = sezone.get(naziv) ?? { naziv, brojMjeseci: 0, ukupnoKwh: 0, grijanjeKwh: null, ukupnoKm: 0 };
    s.brojMjeseci += 1;
    s.ukupnoKwh += m.ukupnoKwh;
    s.ukupnoKm = zaokruzi(s.ukupnoKm + m.ukupnoKm, 2);
    if (m.grijanjeKwh !== null) s.grijanjeKwh = (s.grijanjeKwh ?? 0) + m.grijanjeKwh;
    sezone.set(naziv, s);
  }

  return { racuni, osnovnaPotrosnja, sezone: [...sezone.values()].reverse() };
};
