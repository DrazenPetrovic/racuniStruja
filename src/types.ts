export type NazivZone = 'bijela' | 'plava' | 'crvena';

export interface Zona {
  kwh: number;
  cijena: number;
  iznos: number;
}

export type ZoneTarife = Record<NazivZone, Zona>;

export interface Tarifa {
  kwh: number;
  udio: number;
  energija: number;
  pravaCijena: number;
}

export interface Mjesec {
  id: number;
  mjesec: string;
  brojRacuna: string;
  zone: { vt: ZoneTarife; mt: ZoneTarife };
  vtMrezaKm: number;
  mtMrezaKm: number;
  fiksnoKm: number;
  pdvStopa: number;
  pdvKm: number;
  ukupnoKm: number;
  brojilo: { datum: string | null; vt: number | null; mt: number | null };
  ukupnoKwh: number;
  zona: NazivZone;
  doSljedeceZone: number | null;
  zoneKwh: Record<NazivZone, number>;
  vt: Tarifa;
  mt: Tarifa;
  fiksnoSaPdv: number;
  prosjekKmKwh: number;
  grijanjeKwh: number | null;
}

export interface Sezona {
  naziv: string;
  brojMjeseci: number;
  ukupnoKwh: number;
  grijanjeKwh: number | null;
  ukupnoKm: number;
}

export interface Evidencija {
  racuni: Mjesec[];
  osnovnaPotrosnja: number | null;
  sezone: Sezona[];
}

export interface Ocitanje {
  id: number;
  datum: string;
  vt: number;
  mt: number;
}

export interface ProcjenaKwh {
  kwh: number;
  vt: number;
  mt: number;
  km: number;
  zona: NazivZone;
}

export interface MjesecPrije extends ProcjenaKwh {
  mjesec: string;
  dana: number;
  cijeliMjesec: boolean;
}

export interface Procjena {
  mjesec: string;
  nedostajePocetak?: boolean;
  datumOcitanja: string;
  dana: number;
  uMjesecu: number;
  cilj: number;
  dosad: ProcjenaKwh;
  projekcija: ProcjenaKwh;
  ispodCilja: boolean;
  kwhNaDan: number;
  dozvoljenoNaDan: number | null;
  datumPrelaska: string | null;
  prosleGodineKwh: number | null;
  tacanPocetak: boolean;
  pocetak: { datum: string; izRacuna: boolean };
  raspon: { dana: number; kwh: number };
  prije: MjesecPrije[];
  gruba: boolean;
}

export interface StanjeProcjene {
  ocitanja: Ocitanje[];
  zadnjePoznato: { datum: string; vt: number; mt: number; izRacuna: boolean } | null;
  procjena: Procjena | null;
  upozorenja?: string[];
}

export interface RezultatUvoza {
  naziv: string;
  uspjeh: boolean;
  poruka: string;
  detalji?: string[];
}
