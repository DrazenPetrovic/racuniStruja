// Procjena koliko trosi toplotna pumpa, a koliko ostatak kuce, iz stanja brojila i vanjske temperature.
//
// Model za svaki razmak izmedju dva poznata stanja:
//   kWh = kuca * dana + grijanje * stepen-dani hladnoce + hladjenje * stepen-dani vrucine
// Stepen-dani hladnoce su zbir (baza - temperatura) po satima kad je napolju hladnije od baze,
// a vrucine obrnuto. Kuca (bojler, rasvjeta, uredjaji) je isti broj kWh svaki dan.
// Baze se biraju same: one sa kojima model najbolje pogadja izmjerenu potrosnju.

const BAZE_GRIJANJA = [12, 13, 14, 15, 16, 17, 18];
const BAZE_HLADJENJA = [20, 21, 22, 23, 24, 25, 26];
// Kraci razmaci su previse nemirni (dan i noc se jako razlikuju)
const MIN_DANA_RAZMAKA = 0.5;
// Razmak u kom fali vise od ovoliko sati temperature se preskace
const MAKS_UDIO_BEZ_TEMPERATURE = 0.1;
const MIN_RAZMAKA = 6;
const MAKS_PRIKAZ = 14;

const zaokruzi = (broj, decimale = 1) => Number(broj.toFixed(decimale));

const uDan = (datum) => Date.parse(`${datum}T00:00:00Z`) / 86400000;
const sljedeciMjesec = (prvi) => {
  const [g, m] = prvi.split('-').map(Number);
  return new Date(Date.UTC(g, m, 1)).toISOString().slice(0, 10);
};

// Racun je kalendarski mjesec. Stanja koja je korisnik upisao koriste se tek poslije zadnjeg racuna,
// jer je period prije toga vec tacno pokriven racunima.
export const razmaciPotrosnje = (racuni, oslonci) => {
  const mjeseci = [...racuni]
    .sort((a, b) => a.mjesec.localeCompare(b.mjesec))
    .map((r) => {
      const kraj = sljedeciMjesec(r.mjesec);
      return {
        mjesec: r.mjesec.slice(0, 7),
        od: { datum: r.mjesec, vrijeme: null },
        do: { datum: kraj, vrijeme: null },
        izRacuna: true,
        ta: uDan(r.mjesec),
        tb: uDan(kraj),
        kwh: r.ukupnoKwh,
      };
    });
  const krajRacuna = mjeseci.length ? mjeseci[mjeseci.length - 1].tb : -Infinity;
  const poslije = oslonci.filter((o) => o.t >= krajRacuna - 1e-9);
  const unosi = [];
  for (let i = 1; i < poslije.length; i += 1) {
    const a = poslije[i - 1];
    const b = poslije[i];
    unosi.push({
      mjesec: null,
      od: { datum: a.datum, vrijeme: a.vrijeme },
      do: { datum: b.datum, vrijeme: b.vrijeme },
      izRacuna: false,
      ta: a.t,
      tb: b.t,
      kwh: b.vt - a.vt + (b.mt - a.mt),
    });
  }
  return [...mjeseci, ...unosi];
};

// Sati razmaka sa temperaturom i dijelom sata koji pripada razmaku
const satiRazmaka = (ta, tb, temperatura) => {
  const od = ta * 24;
  const doS = tb * 24;
  const sati = [];
  let bez = 0;
  for (let h = Math.floor(od); h < doS; h += 1) {
    const dio = Math.min(doS, h + 1) - Math.max(od, h);
    if (dio <= 0) continue;
    const t = temperatura.get(h);
    if (t === undefined) bez += dio;
    else sati.push({ dio, t });
  }
  return { sati, bez };
};

const stepenDani = (sati, baza, znak) =>
  sati.reduce((z, { dio, t }) => z + (dio / 24) * Math.max(0, znak * (baza - t)), 0);

// Rjesava A x = y (Gauss), ili null ako sistem nema jedno rjesenje
const rijesi = (A, y) => {
  const n = y.length;
  const m = A.map((red, i) => [...red, y[i]]);
  for (let k = 0; k < n; k += 1) {
    let p = k;
    for (let i = k + 1; i < n; i += 1) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    if (Math.abs(m[p][k]) < 1e-9) return null;
    [m[k], m[p]] = [m[p], m[k]];
    for (let i = k + 1; i < n; i += 1) {
      const f = m[i][k] / m[k][k];
      for (let j = k; j <= n; j += 1) m[i][j] -= f * m[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let s = m[i][n];
    for (let j = i + 1; j < n; j += 1) s -= m[i][j] * x[j];
    x[i] = s / m[i][i];
  }
  return x;
};

// Najmanji kvadrati, a duzi razmak nosi vise (greska po danu se racuna jednako)
const prilagodi = (razmaci, kolone) => {
  const n = kolone.length;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const y = new Array(n).fill(0);
  for (const r of razmaci) {
    const x = kolone.map((k) => r[k]);
    for (let i = 0; i < n; i += 1) {
      y[i] += (x[i] * r.kwh) / r.dana;
      for (let j = 0; j < n; j += 1) A[i][j] += (x[i] * x[j]) / r.dana;
    }
  }
  const b = rijesi(A, y);
  if (!b) return null;
  const koef = Object.fromEntries(kolone.map((k, i) => [k, b[i]]));
  const greska = razmaci.reduce((z, r) => {
    const procjena = kolone.reduce((s, k) => s + koef[k] * r[k], 0);
    return z + (r.kwh - procjena) ** 2 / r.dana;
  }, 0);
  return { koef, greska };
};

// razmaci: iz razmaciPotrosnje; temperatura: Map(sat od 1970 -> °C)
export const procijeniPumpu = (sviRazmaci, temperatura) => {
  const svi = [];
  for (const r of sviRazmaci) {
    const dana = r.tb - r.ta;
    if (dana < MIN_DANA_RAZMAKA) continue;
    const { sati, bez } = satiRazmaka(r.ta, r.tb, temperatura);
    if (bez > dana * 24 * MAKS_UDIO_BEZ_TEMPERATURE || sati.length === 0) continue;
    const ukupnoSati = sati.reduce((z, s) => z + s.dio, 0);
    svi.push({
      ...r,
      dana,
      sati,
      temperatura: sati.reduce((z, s) => z + s.dio * s.t, 0) / ukupnoSati,
    });
  }
  if (svi.length < MIN_RAZMAKA) {
    return { greska: 'Još nema dovoljno očitanja sa poznatom temperaturom za procjenu.' };
  }

  let najbolji = null;
  for (const bg of BAZE_GRIJANJA) {
    for (const bh of BAZE_HLADJENJA) {
      const razmaci = svi.map((r) => ({
        ...r,
        kuca: r.dana,
        grijanje: stepenDani(r.sati, bg, 1),
        hladjenje: stepenDani(r.sati, bh, -1),
      }));
      // Bez ljetnih vrucina u podacima hladjenje se ne moze procijeniti, pa se izostavlja
      let fit = razmaci.some((r) => r.hladjenje > 0) ? prilagodi(razmaci, ['kuca', 'grijanje', 'hladjenje']) : null;
      if (!fit || fit.koef.hladjenje < 0) {
        fit = prilagodi(razmaci, ['kuca', 'grijanje']);
        if (fit) fit.koef.hladjenje = 0;
      }
      if (!fit || fit.koef.kuca <= 0 || fit.koef.grijanje <= 0) continue;
      if (!najbolji || fit.greska < najbolji.greska) najbolji = { ...fit, bg, bh, razmaci };
    }
  }
  if (!najbolji) {
    return { greska: 'Iz dosadašnjih podataka se ne vidi veza potrošnje i temperature.' };
  }

  const { koef, bg, bh, razmaci } = najbolji;
  const ukupnoDana = razmaci.reduce((z, r) => z + r.dana, 0);
  const prosjek = razmaci.reduce((z, r) => z + r.kwh, 0) / ukupnoDana;
  const rasipanje = razmaci.reduce((z, r) => z + r.dana * (r.kwh / r.dana - prosjek) ** 2, 0);

  // Izmjerena potrosnja se dijeli u omjeru koji daje model, pa zbir uvijek odgovara brojilu
  const podijeli = (r) => {
    const kuca = koef.kuca * r.dana;
    const pumpa = koef.grijanje * r.grijanje + koef.hladjenje * r.hladjenje;
    const udioPumpe = kuca + pumpa > 0 ? pumpa / (kuca + pumpa) : 0;
    return {
      mjesec: r.mjesec,
      od: r.od,
      do: r.do,
      izRacuna: r.izRacuna,
      dana: zaokruzi(r.dana, 2),
      temperatura: zaokruzi(r.temperatura),
      kwh: zaokruzi(r.kwh),
      pumpaKwh: zaokruzi(r.kwh * udioPumpe),
      kucaKwh: zaokruzi(r.kwh * (1 - udioPumpe)),
      ocekivanoKwh: zaokruzi(kuca + pumpa),
    };
  };
  const podijeljeni = razmaci.map(podijeli);

  // Od zadnjeg racuna do zadnjeg unosa
  const odRacuna = podijeljeni.filter((r) => !r.izRacuna);
  const period = odRacuna.length
    ? {
        od: odRacuna[0].od,
        do: odRacuna[odRacuna.length - 1].do,
        dana: zaokruzi(odRacuna.reduce((z, r) => z + r.dana, 0), 2),
        kwh: zaokruzi(odRacuna.reduce((z, r) => z + r.kwh, 0)),
        pumpaKwh: zaokruzi(odRacuna.reduce((z, r) => z + r.pumpaKwh, 0)),
        kucaKwh: zaokruzi(odRacuna.reduce((z, r) => z + r.kucaKwh, 0)),
      }
    : null;

  return {
    model: {
      kucaNaDan: zaokruzi(koef.kuca),
      grijanjePoStepenu: zaokruzi(koef.grijanje, 2),
      hladjenjePoStepenu: koef.hladjenje > 0 ? zaokruzi(koef.hladjenje, 2) : null,
      bazaGrijanja: bg,
      bazaHladjenja: bh,
      tacnost: rasipanje > 0 ? Math.round(Math.max(0, 1 - najbolji.greska / rasipanje) * 100) : null,
      brojRazmaka: razmaci.length,
      od: podijeljeni[0].od,
      do: podijeljeni[podijeljeni.length - 1].do,
    },
    period,
    mjeseci: podijeljeni.filter((r) => r.izRacuna),
    razmaci: odRacuna.slice(-MAKS_PRIKAZ),
  };
};
