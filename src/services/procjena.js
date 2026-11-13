import { zonaZaPotrosnju } from './racunAnaliza.js';

export const CILJ_KWH = 1500;

const GRANICA_BIJELE = 500;
const GRANICA_PLAVE = 1500;
const MALO_DANA = 5;
const SUMNJIVO_KWH_NA_DAN = 200;
// Kod kratkih razmaka (npr. sat vremena) kWh/dan je previse nemiran da bi upozorenje imalo smisla
const MIN_DANA_ZA_UPOZORENJE = 0.25;
// Dozvoljeno odstupanje sata na telefonu i serveru
const TOLERANCIJA_BUDUCNOSTI = 5 / 1440;

const MINUTA_U_DANU = 1440;
const PROZORI_POREDJENJA = [7, 3, 1];
const MAKS_INTERVALA = 30;
const SATI_SLICNOG_DOBA = 3;

const uDan = (datum) => Date.parse(`${datum}T00:00:00Z`) / 86400000;
const izDana = (dan) => new Date(dan * 86400000).toISOString().slice(0, 10);
const prviUMjesecu = (datum) => `${datum.slice(0, 7)}-01`;
const danaUMjesecu = (prvi) => {
  const [godina, mjesec] = prvi.split('-').map(Number);
  return new Date(Date.UTC(godina, mjesec, 0)).getUTCDate();
};
const zadnjiUMjesecu = (prvi) => `${prvi.slice(0, 7)}-${String(danaUMjesecu(prvi)).padStart(2, '0')}`;
const sljedeciMjesec = (prvi) => izDana(uDan(zadnjiUMjesecu(prvi)) + 1);
const zaokruzi = (broj, decimale = 2) => Number(broj.toFixed(decimale));

// Trenutak ocitanja u danima. Stanje bez vremena (racun, stari unosi) vazi za kraj dana.
export const trenutak = (datum, vrijeme) => {
  if (!vrijeme) return uDan(datum) + 1;
  const [sat, minut] = vrijeme.split(':').map(Number);
  return uDan(datum) + (sat * 60 + minut) / MINUTA_U_DANU;
};
// Zadnji dan cija je potrosnja u stanju. Ocitanje tacno u ponoc pripada prethodnom danu.
const danStanja = (t) => izDana(Math.ceil(t) - 1);
const mjesecStanja = (t) => prviUMjesecu(danStanja(t));
const satUDanu = (t) => (t - Math.floor(t)) * 24;
const saTrenutkom = (o) => ({ ...o, vrijeme: o.vrijeme ?? null, t: trenutak(o.datum, o.vrijeme) });

// Cijene, mrezarina po kWh i fiksni dio sa racuna. Zone se dijele na tarife srazmjerno potrosnji, kao na racunu.
export const cjenovnikIzRacuna = (racun) => ({
  zone: racun.zone,
  vtMrezaPoKwh: racun.vt.kwh > 0 ? racun.vtMrezaKm / racun.vt.kwh : 0,
  mtMrezaPoKwh: racun.mt.kwh > 0 ? racun.mtMrezaKm / racun.mt.kwh : 0,
  fiksnoKm: racun.fiksnoKm,
  pdvStopa: racun.pdvStopa,
});

export const obracunajIznos = (vt, mt, c) => {
  const ukupno = vt + mt;
  if (ukupno <= 0) return zaokruzi(c.fiksnoKm * (1 + c.pdvStopa / 100));
  const udioVt = vt / ukupno;
  const kolicine = {
    bijela: Math.min(ukupno, GRANICA_BIJELE),
    plava: Math.max(0, Math.min(ukupno, GRANICA_PLAVE) - GRANICA_BIJELE),
    crvena: Math.max(0, ukupno - GRANICA_PLAVE),
  };
  const energija = Object.entries(kolicine).reduce(
    (zbir, [zona, kwh]) => zbir + kwh * (udioVt * c.zone.vt[zona].cijena + (1 - udioVt) * c.zone.mt[zona].cijena),
    0,
  );
  const mreza = vt * c.vtMrezaPoKwh + mt * c.mtMrezaPoKwh;
  return zaokruzi((energija + mreza + c.fiksnoKm) * (1 + c.pdvStopa / 100));
};

// Sva poznata stanja brojila, po vremenu. U istom trenutku racun ima prednost pred rucnim unosom.
const sviOslonci = (racuni, rucna) => {
  const poTrenutku = new Map(
    rucna.map((o) => {
      const s = saTrenutkom(o);
      return [s.t, { datum: s.datum, vrijeme: s.vrijeme, t: s.t, vt: s.vt, mt: s.mt, izRacuna: false }];
    }),
  );
  for (const r of racuni) {
    if (r.brojilo?.datum && r.brojilo.vt !== null && r.brojilo.vt !== undefined && r.brojilo.mt !== null && r.brojilo.mt !== undefined) {
      const t = trenutak(r.brojilo.datum, null);
      poTrenutku.set(t, { datum: r.brojilo.datum, vrijeme: null, t, vt: r.brojilo.vt, mt: r.brojilo.mt, izRacuna: true });
    }
  }
  return [...poTrenutku.values()].sort((a, b) => a.t - b.t);
};

const bezTrenutka = ({ t: _t, ...o }) => o;

export const zadnjePoznatoStanje = (racuni, rucna) => {
  const oslonci = sviOslonci(racuni, rucna);
  const zadnji = oslonci[oslonci.length - 1];
  return zadnji ? bezTrenutka(zadnji) : null;
};

const opisTrenutka = (o) => (o.vrijeme ? `${o.datum} u ${o.vrijeme}` : o.datum);

// sada: "YYYY-MM-DD" ili "YYYY-MM-DD HH:MM"
export const provjeriOcitanje = (novo, racuni, rucna, sada) => {
  const tNovo = trenutak(novo.datum, novo.vrijeme);
  const tSada = sada.length > 10 ? trenutak(sada.slice(0, 10), sada.slice(11, 16)) : trenutak(sada, null);
  if (tNovo > tSada + TOLERANCIJA_BUDUCNOSTI) return { greska: 'Vrijeme očitanja ne može biti u budućnosti.' };
  if (racuni.some((r) => r.mjesec === mjesecStanja(tNovo))) {
    return { greska: 'Za taj mjesec već postoji uvezen račun, pa procjena nije potrebna.' };
  }

  const ostali = sviOslonci(racuni, rucna.filter((o) => trenutak(o.datum, o.vrijeme) !== tNovo));
  if (ostali.some((o) => o.t === tNovo)) return { greska: 'Za taj trenutak već postoji stanje sa računa.' };
  const prije = [...ostali].reverse().find((o) => o.t < tNovo);
  const poslije = ostali.find((o) => o.t > tNovo);

  for (const [naziv, kljuc] of [['skupe', 'vt'], ['jeftine', 'mt']]) {
    if (prije && novo[kljuc] < prije[kljuc]) {
      return { greska: `Stanje ${naziv} struje je manje od stanja ${opisTrenutka(prije)} (${prije[kljuc]}). Provjeri da nisi zamijenio skupu i jeftinu.` };
    }
    if (poslije && novo[kljuc] > poslije[kljuc]) {
      return { greska: `Stanje ${naziv} struje je veće od kasnijeg stanja ${opisTrenutka(poslije)} (${poslije[kljuc]}).` };
    }
  }

  const upozorenja = [];
  if (prije) {
    const dana = tNovo - prije.t;
    const kwhNaDan = (novo.vt - prije.vt + (novo.mt - prije.mt)) / dana;
    if (dana >= MIN_DANA_ZA_UPOZORENJE && kwhNaDan > SUMNJIVO_KWH_NA_DAN) {
      upozorenja.push(`Ovo je ${Math.round(kwhNaDan)} kWh na dan od ${opisTrenutka(prije)}, što je neobično mnogo. Provjeri unos.`);
    }
  }
  return { upozorenja };
};

const zaTarife = (vt, mt, cjenovnik) => {
  const kwh = vt + mt;
  return {
    kwh: Math.round(kwh),
    vt: Math.round(vt),
    mt: Math.round(mt),
    km: obracunajIznos(vt, mt, cjenovnik),
    zona: zonaZaPotrosnju(kwh).zona,
  };
};

// Racun se pravi po kalendarskom mjesecu, a stanje od kraja prethodnog mjeseca cesto nije poznato.
// Tada se potrosnja izmedju dva poznata stanja dijeli ravnomjerno po vremenu.
const procijeniDo = (racuni, rucna) => {
  if (racuni.length === 0) return null;

  const saRacunom = new Set(racuni.map((r) => r.mjesec));
  const otvorena = rucna
    .map(saTrenutkom)
    .filter((o) => !saRacunom.has(mjesecStanja(o.t)))
    .sort((a, b) => a.t - b.t);
  const zadnje = otvorena[otvorena.length - 1];
  if (!zadnje) return null;

  const prvi = mjesecStanja(zadnje.t);
  const tPocetka = uDan(prvi);
  const oslonci = sviOslonci(racuni, rucna);
  const pocetni = [...oslonci].reverse().find((o) => o.t <= tPocetka);
  if (!pocetni) return { mjesec: prvi, nedostajePocetak: true };

  const prviUTekucem = oslonci.find((o) => o.t > tPocetka);
  const tacanPocetak = pocetni.t === tPocetka;
  const danaRaspona = prviUTekucem.t - pocetni.t;
  const udioPrije = (tPocetka - pocetni.t) / danaRaspona;
  const startVt = pocetni.vt + (prviUTekucem.vt - pocetni.vt) * udioPrije;
  const startMt = pocetni.mt + (prviUTekucem.mt - pocetni.mt) * udioPrije;

  const cjenovnik = cjenovnikIzRacuna(racuni[racuni.length - 1]);
  const dana = zadnje.t - tPocetka;
  const uMjesecu = danaUMjesecu(prvi);
  const dosadVt = zadnje.vt - startVt;
  const dosadMt = zadnje.mt - startMt;
  const dosadKwh = dosadVt + dosadMt;
  const kwhNaDan = dosadKwh / dana;

  const prije = [];
  if (!tacanPocetak) {
    const vtNaDan = (prviUTekucem.vt - pocetni.vt) / danaRaspona;
    const mtNaDan = (prviUTekucem.mt - pocetni.mt) / danaRaspona;
    for (let m = prviUMjesecu(izDana(Math.floor(pocetni.t))); m < prvi; m = sljedeciMjesec(m)) {
      const danaMjeseca = uDan(sljedeciMjesec(m)) - Math.max(uDan(m), pocetni.t);
      prije.push({
        mjesec: m,
        dana: zaokruzi(danaMjeseca, 1),
        cijeliMjesec: danaMjeseca === danaUMjesecu(m),
        ...zaTarife(vtNaDan * danaMjeseca, mtNaDan * danaMjeseca, cjenovnik),
      });
    }
  }

  const projekcija = zaTarife((dosadVt / dana) * uMjesecu, (dosadMt / dana) * uMjesecu, cjenovnik);
  const preostaloDana = uMjesecu - dana;
  const danPrelaska = kwhNaDan > 0 ? Math.ceil(CILJ_KWH / kwhNaDan) : null;
  const prosle = racuni.find((r) => r.mjesec === `${Number(prvi.slice(0, 4)) - 1}${prvi.slice(4)}`);

  return {
    mjesec: prvi,
    datumOcitanja: zadnje.datum,
    vrijemeOcitanja: zadnje.vrijeme,
    dana: zaokruzi(dana, 2),
    uMjesecu,
    cilj: CILJ_KWH,
    dosad: zaTarife(dosadVt, dosadMt, cjenovnik),
    projekcija,
    ispodCilja: projekcija.kwh <= CILJ_KWH,
    kwhNaDan: zaokruzi(kwhNaDan, 1),
    dozvoljenoNaDan: preostaloDana > 0 && dosadKwh < CILJ_KWH ? zaokruzi((CILJ_KWH - dosadKwh) / preostaloDana, 1) : null,
    datumPrelaska: danPrelaska !== null && danPrelaska <= uMjesecu && dosadKwh < CILJ_KWH
      ? `${prvi.slice(0, 8)}${String(danPrelaska).padStart(2, '0')}`
      : null,
    prosleGodineKwh: prosle?.ukupnoKwh ?? null,
    tacanPocetak,
    pocetak: { datum: pocetni.datum, izRacuna: pocetni.izRacuna },
    pocetnoStanje: { vt: zaokruzi(startVt), mt: zaokruzi(startMt) },
    raspon: { dana: zaokruzi(zadnje.t - pocetni.t, 1), kwh: Math.round(zadnje.vt - pocetni.vt + (zadnje.mt - pocetni.mt)) },
    prije,
    gruba: !tacanPocetak || dana < MALO_DANA,
  };
};

// Procjena za tekuci mjesec, plus tok: kako je rasla potrosnja i sta je procjena govorila poslije svakog unosa.
export const procijeni = (racuni, rucna) => {
  const p = procijeniDo(racuni, rucna);
  if (!p || p.nedostajePocetak) return p;

  const start = p.pocetnoStanje.vt + p.pocetnoStanje.mt;
  const tPocetka = uDan(p.mjesec);
  const uMjesecu = rucna
    .map(saTrenutkom)
    .filter((o) => mjesecStanja(o.t) === p.mjesec)
    .sort((a, b) => a.t - b.t);

  const tok = uMjesecu.map((o) => {
    const tada = procijeniDo(racuni, rucna.filter((x) => trenutak(x.datum, x.vrijeme) <= o.t));
    const vazi = tada && !tada.nedostajePocetak && tada.mjesec === p.mjesec;
    return {
      datum: o.datum,
      vrijeme: o.vrijeme,
      dan: zaokruzi(o.t - tPocetka, 3),
      potroseno: Math.round(o.vt + o.mt - start),
      procjena: vazi ? tada.projekcija.kwh : null,
    };
  });

  return { ...p, tok };
};

// Ukupno stanje (skupa + jeftina) u bilo kom trenutku, ravnomjerno izmedju dva poznata stanja
const stanjeU = (oslonci, t) => {
  for (let i = 1; i < oslonci.length; i += 1) {
    const a = oslonci[i - 1];
    const b = oslonci[i];
    if (t >= a.t && t <= b.t) {
      const udio = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return { ukupno: a.vt + a.mt + (b.vt + b.mt - a.vt - a.mt) * udio, najduziRaspon: b.t - a.t };
    }
  }
  return null;
};

// Najduzi razmak izmedju poznatih stanja koji zahvata period [od, do]
const najduziRasponU = (oslonci, od, doT) => {
  let najduzi = 0;
  for (let i = 1; i < oslonci.length; i += 1) {
    const a = oslonci[i - 1];
    const b = oslonci[i];
    if (b.t > od && a.t < doT) najduzi = Math.max(najduzi, b.t - a.t);
  }
  return najduzi;
};

const procenatPromjene = (sada, prije) => (prije > 0 ? zaokruzi(((sada - prije) / prije) * 100, 1) : null);

const razlikaSati = (a, b) => {
  const r = Math.abs(a - b);
  return Math.min(r, 24 - r);
};

// Razmak od skoro cijelog dana vec obuhvata i dan i noc, pa mu doba dana nije bitno
const DANA_BEZ_DOBA_DANA = 0.75;

// Slicna duzina, a kod kratkih razmaka i isti dio dana (jutro na jutro, vece na vece)
const slicanInterval = (a, b) => {
  if (Math.abs(a.dana - b.dana) > Math.max(0.25, b.dana * 0.5)) return false;
  if (b.dana >= DANA_BEZ_DOBA_DANA) return true;
  return razlikaSati(a.krajSat, b.krajSat) <= SATI_SLICNOG_DOBA;
};

// Kako se potrosnja mijenja izmedju unosa i da li je zadnjih dana veca ili manja nego ranije
export const kretanjePotrosnje = (racuni, rucna) => {
  const oslonci = sviOslonci(racuni, rucna);
  if (oslonci.length < 2) return null;

  const svi = [];
  for (let i = 1; i < oslonci.length; i += 1) {
    const a = oslonci[i - 1];
    const b = oslonci[i];
    const dana = b.t - a.t;
    const vt = b.vt - a.vt;
    const mt = b.mt - a.mt;
    svi.push({
      od: { datum: a.datum, vrijeme: a.vrijeme },
      do: { datum: b.datum, vrijeme: b.vrijeme },
      izRacuna: b.izRacuna,
      dana,
      krajSat: satUDanu(b.t),
      kwh: vt + mt,
      vt,
      mt,
    });
  }

  const intervali = svi.map((iv, j) => {
    // Kad nema slicnog razmaka, poredi se sa prethodnim, da svaki unos ima poredjenje
    const nadjeniSlicni = svi.slice(0, j).reverse().find((x) => slicanInterval(x, iv));
    const slicni = nadjeniSlicni ?? (j > 0 ? svi[j - 1] : null);
    const kwhNaDan = iv.kwh / iv.dana;
    return {
      od: iv.od,
      do: iv.do,
      izRacuna: iv.izRacuna,
      sati: zaokruzi(iv.dana * 24, 1),
      kwh: zaokruzi(iv.kwh, 1),
      vt: zaokruzi(iv.vt, 1),
      mt: zaokruzi(iv.mt, 1),
      kwhNaDan: zaokruzi(kwhNaDan, 1),
      vtNaDan: zaokruzi(iv.vt / iv.dana, 1),
      mtNaDan: zaokruzi(iv.mt / iv.dana, 1),
      poredjenje: slicni
        ? {
            od: slicni.od,
            do: slicni.do,
            slican: Boolean(nadjeniSlicni),
            kwhNaDan: zaokruzi(slicni.kwh / slicni.dana, 1),
            promjena: procenatPromjene(kwhNaDan, slicni.kwh / slicni.dana),
          }
        : null,
    };
  });

  // Prozor od N dana prema N dana prije njega. Razmak izmedju ocitanja smije biti najvise
  // duplo duzi od prozora, inace bi poredjenje bilo samo prosjek mjesecnog racuna.
  const zadnji = oslonci[oslonci.length - 1].t;
  let poredjenje = null;
  for (const n of PROZORI_POREDJENJA) {
    const sada = stanjeU(oslonci, zadnji);
    const sredina = stanjeU(oslonci, zadnji - n);
    const pocetak = stanjeU(oslonci, zadnji - 2 * n);
    if (!sada || !sredina || !pocetak) continue;
    if (najduziRasponU(oslonci, zadnji - 2 * n, zadnji) > 2 * n) continue;
    const kwhSada = sada.ukupno - sredina.ukupno;
    const kwhPrije = sredina.ukupno - pocetak.ukupno;
    poredjenje = {
      dana: n,
      sada: { kwh: Math.round(kwhSada), kwhNaDan: zaokruzi(kwhSada / n, 1) },
      prije: { kwh: Math.round(kwhPrije), kwhNaDan: zaokruzi(kwhPrije / n, 1) },
      promjena: procenatPromjene(kwhSada, kwhPrije),
    };
    break;
  }

  return {
    intervali: intervali.filter((iv) => !iv.izRacuna).slice(-MAKS_INTERVALA),
    poredjenje,
  };
};
