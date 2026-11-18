const GRANICA_BIJELE = 500;
const GRANICA_PLAVE = 1500;

// Toplotna pumpa grije od oktobra do maja, a od juna do septembra hladi.
// Sanitarnu vodu ne grije (zaseban bojler), pa je kuca bez pumpe najbliza septembru,
// kad nema ni grijanja ni vecih vrucina.
const MJESECI_GRIJANJA = [10, 11, 12, 1, 2, 3, 4, 5];
const MJESECI_HLADJENJA = [6, 7, 8, 9];
const MJESECI_BEZ_PUMPE = [9];
// Zimi kuca i bez pumpe trosi vise: bojler grije hladniju vodu, a duze gori svjetlo
const ZIMSKI_DODATAK_KWH = 60;

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

// Racun ne odvaja toplotnu pumpu od ostale potrosnje, pa su grijanje i hladjenje procjena:
// potrosnja iznad osnovne potrosnje kuce. Osnova je prosjek septembara, a bez septembra
// najmanji ljetni mjesec (u njemu je hladjenja najmanje).
const izracunajOsnovnu = (mjeseci) => {
  const bezPumpe = mjeseci.filter((m) => MJESECI_BEZ_PUMPE.includes(brojMjeseca(m.mjesec)));
  if (bezPumpe.length > 0) {
    return Math.round(bezPumpe.reduce((z, m) => z + m.ukupnoKwh, 0) / bezPumpe.length);
  }
  const ljetni = mjeseci.filter((m) => MJESECI_HLADJENJA.includes(brojMjeseca(m.mjesec)));
  return ljetni.length > 0 ? Math.min(...ljetni.map((m) => m.ukupnoKwh)) : null;
};

const iznadOsnove = (kwh, osnova) => (osnova === null ? null : Math.max(0, kwh - osnova));

// Ljeto se vodi po godini: "2026" za jun-septembar 2026
const sabiranjePoPeriodu = (mjeseci, uPeriodu, naziv, kljuc) => {
  const periodi = new Map();
  for (const m of mjeseci.filter((r) => uPeriodu(brojMjeseca(r.mjesec)))) {
    const ime = naziv(m.mjesec);
    const s = periodi.get(ime) ?? { naziv: ime, brojMjeseci: 0, ukupnoKwh: 0, [kljuc]: null, ukupnoKm: 0 };
    s.brojMjeseci += 1;
    s.ukupnoKwh += m.ukupnoKwh;
    s.ukupnoKm = zaokruzi(s.ukupnoKm + m.ukupnoKm, 2);
    if (m[kljuc] !== null) s[kljuc] = (s[kljuc] ?? 0) + m[kljuc];
    periodi.set(ime, s);
  }
  return [...periodi.values()].reverse();
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
  const osnovnaZimi = osnovnaPotrosnja === null ? null : osnovnaPotrosnja + ZIMSKI_DODATAK_KWH;

  const racuni = saZbirom.map((m) => {
    const stopa = m.pdvStopa / 100;
    const broj = brojMjeseca(m.mjesec);
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
      grijanjeKwh: MJESECI_GRIJANJA.includes(broj) ? iznadOsnove(m.ukupnoKwh, osnovnaZimi) : null,
      hladjenjeKwh: MJESECI_HLADJENJA.includes(broj) ? iznadOsnove(m.ukupnoKwh, osnovnaPotrosnja) : null,
    };
  });

  const sezone = sabiranjePoPeriodu(racuni, (b) => MJESECI_GRIJANJA.includes(b), nazivSezone, 'grijanjeKwh');
  const ljeta = sabiranjePoPeriodu(racuni, (b) => MJESECI_HLADJENJA.includes(b), (mjesec) => mjesec.slice(0, 4), 'hladjenjeKwh');

  return { racuni, osnovnaPotrosnja, osnovnaZimi, sezone, ljeta };
};
