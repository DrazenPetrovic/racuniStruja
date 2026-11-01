import { useMemo } from 'react';
import { CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Mjesec } from '../types';
import { theme, zonaPoKljucu } from '../theme';
import { cijeliBroj, kratakMjesec, kwh, mjesecGodina } from '../utils/format';
import { Oznaka } from './Kartica';

const MAKS_MJESECI = 12;
const BOJA_OSE = '#6b7280';
const VISINA_GRAFIKA = 210;
const MARGINA = { top: 18, right: 20, left: 0, bottom: 0 };

interface Tacka {
  mjesec: string;
  oznaka: string;
  ukupno: number | null;
  skupa: number | null;
  jeftina: number | null;
}

const sljedeciMjesec = (mjesec: string) => {
  const [godina, broj] = mjesec.split('-').map(Number);
  return broj === 12 ? `${godina + 1}-01-01` : `${godina}-${String(broj + 1).padStart(2, '0')}-01`;
};

// Mjesec bez uvezenog racuna ostaje prazan, da linija ne glumi podatak kojeg nema
const pripremiTacke = (racuni: Mjesec[]): Tacka[] => {
  if (racuni.length === 0) return [];
  const poMjesecu = new Map(racuni.map((r) => [r.mjesec, r]));
  const tacke: Tacka[] = [];
  const zadnji = racuni[racuni.length - 1].mjesec;
  for (let m = racuni[0].mjesec; m <= zadnji; m = sljedeciMjesec(m)) {
    const r = poMjesecu.get(m);
    tacke.push({
      mjesec: m,
      oznaka: kratakMjesec(m),
      ukupno: r?.ukupnoKwh ?? null,
      skupa: r?.vt.kwh ?? null,
      jeftina: r?.mt.kwh ?? null,
    });
  }
  return tacke.slice(-MAKS_MJESECI);
};

function Oblacic({ active, payload, tarife }: { active?: boolean; payload?: { payload: Tacka }[]; tarife?: boolean }) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 tabular-nums">
      <p className="font-semibold mb-1">{mjesecGodina(t.mjesec)}</p>
      {t.ukupno === null && <p>Nema uvezenog računa</p>}
      {t.ukupno !== null && !tarife && <p>{kwh(t.ukupno)}</p>}
      {t.ukupno !== null && tarife && (
        <>
          <p>Skupa: {kwh(t.skupa ?? 0)}</p>
          <p>Jeftina: {kwh(t.jeftina ?? 0)}</p>
        </>
      )}
    </div>
  );
}

// Ispisuju se samo izabrane tacke, ostale otkriva dodir na grafik
const oznakaTacke = (prikazi: (index: number) => boolean, pomak: (index: number) => number) =>
  function OznakaTacke(props: { x?: string | number; y?: string | number; value?: unknown; index?: number }) {
    const index = props.index ?? -1;
    if (props.value === null || props.value === undefined || !prikazi(index)) return null;
    return (
      <text
        x={Number(props.x)}
        y={Number(props.y) + pomak(index)}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#1f2937"
        stroke="#ffffff"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {cijeliBroj(Number(props.value))}
      </text>
    );
  };

const tackaLinije = (boja: string) => ({ r: 4, fill: boja, stroke: '#ffffff', strokeWidth: 2 });
const aktivnaTacka = (boja: string) => ({ r: 6, fill: boja, stroke: '#ffffff', strokeWidth: 2 });

const OsaX = () => (
  <XAxis dataKey="oznaka" tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fontSize: 10, fill: BOJA_OSE }} interval={0} padding={{ left: 8, right: 8 }} />
);

export function GrafikUkupno({ racuni }: { racuni: Mjesec[] }) {
  const tacke = useMemo(() => pripremiTacke(racuni), [racuni]);

  const vrijednosti = tacke.map((t) => t.ukupno ?? 0);
  const najveci = Math.max(...vrijednosti);
  const zadnjiIndex = tacke.length - 1;
  // Grafik pokazuje najvise 12 mjeseci, pa je ovo najveca potrosnja u toj godini dana
  const najvecaTacka = tacke.find((t) => t.ukupno !== null && t.ukupno === najveci);

  // Skala ide u koracima od 500, da granice zona budu na samoj skali
  const koraci = Array.from({ length: Math.ceil(Math.max(1500, najveci) / 500) + 1 }, (_, i) => i * 500);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Ukupna potrošnja po mjesecima (kWh)</h2>
      <div style={{ height: VISINA_GRAFIKA }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tacke} margin={MARGINA}>
            <CartesianGrid vertical={false} stroke="#eceaf0" />
            {OsaX()}
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: BOJA_OSE }} tickFormatter={cijeliBroj} width={38} ticks={koraci} domain={[0, koraci[koraci.length - 1]]} />
            <Tooltip content={<Oblacic />} cursor={{ stroke: '#9ca3af' }} />
            <ReferenceLine y={500} stroke="#6b7280" strokeDasharray="4 3" />
            <ReferenceLine y={1500} stroke={zonaPoKljucu('crvena').boja} strokeWidth={1.5} />
            {najvecaTacka && <ReferenceLine x={najvecaTacka.oznaka} stroke={theme.ukupno} strokeWidth={1.5} />}
            <Line dataKey="ukupno" stroke={theme.ukupno} strokeWidth={2} dot={tackaLinije(theme.ukupno)} activeDot={aktivnaTacka(theme.ukupno)} connectNulls={false} isAnimationActive={false}>
              <LabelList
                dataKey="ukupno"
                content={oznakaTacke((i) => i === zadnjiIndex || vrijednosti[i] === najveci, () => -10)}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
      {najvecaTacka?.ukupno && (
        <p className="text-sm text-gray-800 mt-1 tabular-nums">
          Najveća potrošnja: <span className="font-semibold">{mjesecGodina(najvecaTacka.mjesec)}, {kwh(najvecaTacka.ukupno)}</span>
        </p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        Crvena linija je početak crvene zone (1.500 kWh), a isprekidana početak plave (500 kWh).
      </p>
      {racuni.length > MAKS_MJESECI && (
        <p className="text-xs text-gray-500 mt-1">Prikazano zadnjih {MAKS_MJESECI} mjeseci.</p>
      )}
    </div>
  );
}

export function GrafikTarife({ racuni }: { racuni: Mjesec[] }) {
  const tacke = useMemo(() => pripremiTacke(racuni), [racuni]);

  const zadnjiIndex = tacke.length - 1;
  const zadnja = tacke[zadnjiIndex];
  // Na zadnjoj tacki je veca vrijednost iznad linije, a manja ispod, da se oznake ne preklope
  const skupaVeca = (zadnja?.skupa ?? 0) >= (zadnja?.jeftina ?? 0);
  const samoZadnji = (i: number) => i === zadnjiIndex;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Skupa i jeftina struja po mjesecima (kWh)</h2>
      <div className="flex gap-4 mb-1">
        <Oznaka boja={theme.skupa} tekst="Skupa" />
        <Oznaka boja={theme.jeftina} tekst="Jeftina" />
      </div>
      <div style={{ height: VISINA_GRAFIKA }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tacke} margin={MARGINA}>
            <CartesianGrid vertical={false} stroke="#eceaf0" />
            {OsaX()}
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: BOJA_OSE }} tickFormatter={cijeliBroj} width={38} allowDecimals={false} />
            <Tooltip content={<Oblacic tarife />} cursor={{ stroke: '#9ca3af' }} />
            <Line dataKey="skupa" stroke={theme.skupa} strokeWidth={2} dot={tackaLinije(theme.skupa)} activeDot={aktivnaTacka(theme.skupa)} connectNulls={false} isAnimationActive={false}>
              <LabelList dataKey="skupa" content={oznakaTacke(samoZadnji, () => (skupaVeca ? -10 : 18))} />
            </Line>
            <Line dataKey="jeftina" stroke={theme.jeftina} strokeWidth={2} dot={tackaLinije(theme.jeftina)} activeDot={aktivnaTacka(theme.jeftina)} connectNulls={false} isAnimationActive={false}>
              <LabelList dataKey="jeftina" content={oznakaTacke(samoZadnji, () => (skupaVeca ? 18 : -10))} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
