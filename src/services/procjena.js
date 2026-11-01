import { zonaZaPotrosnju } from './racunAnaliza.js';

export const CILJ_KWH = 1500;

const GRANICA_BIJELE = 500;
const GRANICA_PLAVE = 1500;
const MALO_DANA = 5;
const SUMNJIVO_KWH_NA_DAN = 200;

const uDan = (datum) => Date.parse(`${datum}T00:00:00Z`) / 86400000;
const izDana = (dan) => new Date(dan * 86400000).toISOString().slice(0, 10);
const danaIzmedju = (od, doDatuma) => uDan(doDatuma) - uDan(od);
const prviUMjesecu = (datum) => `${datum.slice(0, 7)}-01`;
const danaUMjesecu = (prvi) => {
  const [godina, mjesec] = prvi.split('-').map(Number);
  return new Date(Date.UTC(godina, mjesec, 0)).getUTCDate();
};
const zadnjiUMjesecu = (prvi) => `${prvi.slice(0, 7)}-${String(danaUMjesecu(prvi)).padStart(2, '0')}`;
const sljedeciMjesec = (prvi) => izDana(uDan(zadnjiUMjesecu(prvi)) + 1);
const zaokruzi = (broj, decimale = 2) => Number(broj.toFixed(decimale));

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

// Sva poznata stanja brojila. Na isti dan racun ima prednost pred rucnim unosom.
const sviOslonci = (racuni, rucna) => {
  const poDatumu = new Map(rucna.map((o) => [o.datum, { datum: o.datum, vt: o.vt, mt: o.mt, izRacuna: false }]));
  for (const r of racuni) {
    if (r.brojilo?.datum && r.brojilo.vt !== null && r.brojilo.vt !== undefined && r.brojilo.mt !== null && r.brojilo.mt !== undefined) {
      poDatumu.set(r.brojilo.datum, { datum: r.brojilo.datum, vt: r.brojilo.vt, mt: r.brojilo.mt, izRacuna: true });
    }
  }
  return [...poDatumu.values()].sort((a, b) => a.datum.localeCompare(b.datum));
};

export const zadnjePoznatoStanje = (racuni, rucna) => {
  const oslonci = sviOslonci(racuni, rucna);
  return oslonci[oslonci.length - 1] ?? null;
};

export const provjeriOcitanje = (novo, racuni, rucna, danas) => {
  if (novo.datum > danas) return { greska: 'Datum očitanja ne može biti u budućnosti.' };
  const mjesec = prviUMjesecu(novo.datum);
  if (racuni.some((r) => r.mjesec === mjesec)) {
    return { greska: 'Za taj mjesec već postoji uvezen račun, pa procjena nije potrebna.' };
  }

  const ostali = sviOslonci(racuni, rucna.filter((o) => o.datum !== novo.datum));
  const prije = [...ostali].reverse().find((o) => o.datum < novo.datum);
  const poslije = ostali.find((o) => o.datum > novo.datum);
  const naIstiDan = ostali.find((o) => o.datum === novo.datum);
  if (naIstiDan) return { greska: 'Za taj dan već postoji stanje sa računa.' };

  for (const [naziv, kljuc] of [['skupe', 'vt'], ['jeftine', 'mt']]) {
    if (prije && novo[kljuc] < prije[kljuc]) {
      return { greska: `Stanje ${naziv} struje je manje od stanja na dan ${prije.datum} (${prije[kljuc]}). Provjeri da nisi zamijenio skupu i jeftinu.` };
    }
    if (poslije && novo[kljuc] > poslije[kljuc]) {
      return { greska: `Stanje ${naziv} struje je veće od kasnijeg stanja na dan ${poslije.datum} (${poslije[kljuc]}).` };
    }
  }

  const upozorenja = [];
  if (prije) {
    const dana = danaIzmedju(prije.datum, novo.datum);
    const kwhNaDan = (novo.vt - prije.vt + (novo.mt - prije.mt)) / dana;
    if (kwhNaDan > SUMNJIVO_KWH_NA_DAN) {
      upozorenja.push(`Ovo je ${Math.round(kwhNaDan)} kWh na dan od ${prije.datum}, što je neobično mnogo. Provjeri unos.`);
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
// Tada se potrosnja izmedju dva poznata stanja dijeli ravnomjerno po danima.
export const procijeni = (racuni, rucna) => {
  if (racuni.length === 0) return null;

  const saRacunom = new Set(racuni.map((r) => r.mjesec));
  const otvorena = rucna
    .filter((o) => !saRacunom.has(prviUMjesecu(o.datum)))
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const zadnje = otvorena[otvorena.length - 1];
  if (!zadnje) return null;

  const prvi = prviUMjesecu(zadnje.datum);
  const krajPrethodnog = izDana(uDan(prvi) - 1);
  const oslonci = sviOslonci(racuni, rucna);
  const doPocetka = oslonci.filter((o) => o.datum <= krajPrethodnog);
  const pocetni = doPocetka[doPocetka.length - 1];
  if (!pocetni) return { mjesec: prvi, nedostajePocetak: true };

  const prviUTekucem = oslonci.find((o) => o.datum >= prvi);
  const tacanPocetak = pocetni.datum === krajPrethodnog;
  const danaRaspona = danaIzmedju(pocetni.datum, prviUTekucem.datum);
  const udioPrije = danaIzmedju(pocetni.datum, krajPrethodnog) / danaRaspona;
  const startVt = pocetni.vt + (prviUTekucem.vt - pocetni.vt) * udioPrije;
  const startMt = pocetni.mt + (prviUTekucem.mt - pocetni.mt) * udioPrije;

  const cjenovnik = cjenovnikIzRacuna(racuni[racuni.length - 1]);
  const dana = Number(zadnje.datum.slice(8));
  const uMjesecu = danaUMjesecu(prvi);
  const dosadVt = zadnje.vt - startVt;
  const dosadMt = zadnje.mt - startMt;
  const dosadKwh = dosadVt + dosadMt;
  const kwhNaDan = dosadKwh / dana;

  const prije = [];
  if (!tacanPocetak) {
    const vtNaDan = (prviUTekucem.vt - pocetni.vt) / danaRaspona;
    const mtNaDan = (prviUTekucem.mt - pocetni.mt) / danaRaspona;
    for (let m = prviUMjesecu(izDana(uDan(pocetni.datum) + 1)); m < prvi; m = sljedeciMjesec(m)) {
      const od = m > pocetni.datum ? uDan(m) - 1 : uDan(pocetni.datum);
      const danaMjeseca = uDan(zadnjiUMjesecu(m)) - od;
      prije.push({
        mjesec: m,
        dana: danaMjeseca,
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
    dana,
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
    raspon: { dana: danaIzmedju(pocetni.datum, zadnje.datum), kwh: Math.round(zadnje.vt - pocetni.vt + (zadnje.mt - pocetni.mt)) },
    prije,
    gruba: !tacanPocetak || dana < MALO_DANA,
  };
};
