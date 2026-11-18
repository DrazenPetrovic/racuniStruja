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
  brojBrojila: string | null;
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
  hladjenjeKwh: number | null;
}

export interface Sezona {
  naziv: string;
  brojMjeseci: number;
  ukupnoKwh: number;
  grijanjeKwh: number | null;
  ukupnoKm: number;
}

export interface Ljeto {
  naziv: string;
  brojMjeseci: number;
  ukupnoKwh: number;
  hladjenjeKwh: number | null;
  ukupnoKm: number;
}

export interface Evidencija {
  racuni: Mjesec[];
  osnovnaPotrosnja: number | null;
  osnovnaZimi: number | null;
  sezone: Sezona[];
  ljeta: Ljeto[];
}

export interface Ocitanje {
  id: number;
  datum: string;
  vrijeme: string | null;
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
  vrijemeOcitanja: string | null;
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
  tok: TackaToka[];
}

export interface TackaToka {
  datum: string;
  vrijeme: string | null;
  dan: number;
  potroseno: number;
  procjena: number | null;
}

export interface Trenutak {
  datum: string;
  vrijeme: string | null;
}

export interface IntervalPotrosnje {
  od: Trenutak;
  do: Trenutak;
  izRacuna: boolean;
  sati: number;
  kwh: number;
  vt: number;
  mt: number;
  kwhNaDan: number;
  vtNaDan: number;
  mtNaDan: number;
  poredjenje: { od: Trenutak; do: Trenutak; slican: boolean; kwhNaDan: number; promjena: number | null } | null;
}

export interface Kretanje {
  intervali: IntervalPotrosnje[];
  poredjenje: {
    dana: number;
    sada: { kwh: number; kwhNaDan: number };
    prije: { kwh: number; kwhNaDan: number };
    promjena: number | null;
  } | null;
}

// Stanje poslano Elektrokrajini i stanje koje je za taj period stiglo na racunu
export interface PoslanoStanje {
  id: number;
  poslano: string; // "YYYY-MM-DD HH:MM"
  vt: number;
  mt: number;
  primalac: string;
  status: 'isto' | 'razlika' | 'ceka';
  racun: {
    id: number;
    mjesec: string;
    datum: string;
    vt: number;
    mt: number;
    razlikaVt: number;
    razlikaMt: number;
  } | null;
}

// Razmak (racun za mjesec ili razmak izmedju dva unosa) podijeljen na pumpu i ostatak kuce
export interface RazmakPumpe {
  mjesec: string | null;
  od: Trenutak;
  do: Trenutak;
  izRacuna: boolean;
  dana: number;
  temperatura: number;
  kwh: number;
  pumpaKwh: number;
  kucaKwh: number;
  ocekivanoKwh: number;
}

export interface ProcjenaPumpe {
  greska?: string;
  model?: {
    kucaNaDan: number;
    grijanjePoStepenu: number;
    hladjenjePoStepenu: number | null;
    bazaGrijanja: number;
    bazaHladjenja: number;
    tacnost: number | null;
    brojRazmaka: number;
    od: Trenutak;
    do: Trenutak;
  };
  period?: { od: Trenutak; do: Trenutak; dana: number; kwh: number; pumpaKwh: number; kucaKwh: number } | null;
  mjeseci?: RazmakPumpe[];
  razmaci?: RazmakPumpe[];
}

export interface StanjeProcjene {
  pumpa?: ProcjenaPumpe | null;
  ocitanja: Ocitanje[];
  poslana: PoslanoStanje[];
  zadnjePoznato: { datum: string; vrijeme: string | null; vt: number; mt: number; izRacuna: boolean } | null;
  procjena: Procjena | null;
  kretanje: Kretanje | null;
  upozorenja?: string[];
  slanje?: {
    podeseno: boolean;
    dozvoljeno: boolean;
    period: { od: number; do: number };
    primalac: string | null;
    brojBrojila: string | null;
  };
}

export interface RezultatUvoza {
  naziv: string;
  uspjeh: boolean;
  poruka: string;
  detalji?: string[];
}
