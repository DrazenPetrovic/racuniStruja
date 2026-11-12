import { useMemo } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { IntervalPotrosnje, Kretanje, Procjena } from '../types';
import { theme, zonaPoKljucu } from '../theme';
import { cijeliBroj, decimalni, kwh, mjesecGodina, trenutakKratko } from '../utils/format';
import { Kartica, Oznaka } from './Kartica';

const BOJA_OSE = '#6b7280';
const BOJA_MREZE = '#eceaf0';
const VISINA_GRAFIKA = 220;
// 5 dana sa unosom ujutro i uvece; vise stubova je preusko za procente na telefonu
const MAKS_STUBOVA = 10;
const MAKS_REDOVA = 10;
// Promjena manja od ovoga se prikazuje kao "isto"
const PRAG_PROMJENE = 5;

// ---------- Promjena u procentima ----------

export function Promjena({ procenat, kratko = false }: { procenat: number | null; kratko?: boolean }) {
  if (procenat === null) return <span className="text-gray-500">–</span>;
  if (Math.abs(procenat) < PRAG_PROMJENE) {
    return (
      <span className="inline-flex items-center gap-0.5 text-gray-700">
        <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {kratko ? 'isto' : 'približno isto'}
      </span>
    );
  }
  const vise = procenat > 0;
  const Ikona = vise ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${vise ? 'text-red-800' : 'text-green-800'}`}>
      <Ikona className="w-3.5 h-3.5 shrink-0" aria-hidden />
      {vise ? '+' : '−'}{decimalni(Math.abs(procenat), 0)}%{!kratko && (vise ? ' više' : ' manje')}
    </span>
  );
}

// ---------- Tok mjeseca: potroseno i procjena poslije svakog unosa ----------

interface RedToka {
  dan: number;
  oznaka: string;
  potroseno?: number;
  procjena?: number | null;
  kraj?: number;
}

function OblacicToka({ active, payload }: { active?: boolean; payload?: { payload: RedToka }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 tabular-nums">
      <p className="font-semibold mb-1">{r.oznaka}</p>
      {r.potroseno !== undefined && <p>Potrošeno: {kwh(r.potroseno)}</p>}
      {r.procjena !== undefined && r.procjena !== null && <p>Procjena za mjesec: {kwh(r.procjena)}</p>}
      {r.potroseno === undefined && r.kraj !== undefined && <p>Procjena za kraj mjeseca: {kwh(r.kraj)}</p>}
    </div>
  );
}

const oznakaVrijednosti = (prikazi: (index: number) => boolean, pomak: number) =>
  function OznakaVrijednosti(props: { x?: string | number; y?: string | number; value?: unknown; index?: number }) {
    if (props.value === null || props.value === undefined || !prikazi(props.index ?? -1)) return null;
    return (
      <text
        x={Number(props.x)}
        y={Number(props.y) + pomak}
        textAnchor="end"
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

export function GrafikTokMjeseca({ p }: { p: Procjena }) {
  const redovi = useMemo<RedToka[]>(() => {
    const r: RedToka[] = [{ dan: 0, oznaka: `Početak (${mjesecGodina(p.mjesec).toLowerCase()})`, potroseno: 0 }];
    p.tok.forEach((t, i) => {
      const zadnji = i === p.tok.length - 1;
      r.push({
        dan: t.dan,
        oznaka: trenutakKratko(t.datum, t.vrijeme),
        potroseno: t.potroseno,
        procjena: t.procjena,
        ...(zadnji ? { kraj: t.potroseno } : {}),
      });
    });
    if (p.dana < p.uMjesecu) {
      r.push({ dan: p.uMjesecu, oznaka: `Kraj mjeseca (${p.uMjesecu}.)`, kraj: p.projekcija.kwh });
    }
    return r;
  }, [p]);

  const najveci = Math.max(p.cilj, p.projekcija.kwh, ...p.tok.map((t) => t.procjena ?? 0));
  const koraci = Array.from({ length: Math.ceil(najveci / 500) + 1 }, (_, i) => i * 500);
  const daniOse = [0, 5, 10, 15, 20, 25, p.uMjesecu];
  const zadnjiIndex = redovi.length - 1;
  const indexZadnjeProcjene = redovi.reduce((z, r, i) => (r.procjena !== undefined && r.procjena !== null ? i : z), -1);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Tok mjeseca i procjena (kWh)</h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1">
        <Oznaka boja={theme.ukupno} tekst="Potrošeno" />
        <Oznaka boja={theme.primary} tekst="Procjena za mjesec" />
      </div>
      <div style={{ height: VISINA_GRAFIKA }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={redovi} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={BOJA_MREZE} />
            <XAxis
              dataKey="dan"
              type="number"
              domain={[0, p.uMjesecu]}
              ticks={daniOse}
              tickFormatter={(v: number) => (v === 0 ? '1.' : `${v}.`)}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              tick={{ fontSize: 10, fill: BOJA_OSE }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: BOJA_OSE }} tickFormatter={cijeliBroj} width={38} ticks={koraci} domain={[0, koraci[koraci.length - 1]]} />
            <Tooltip content={<OblacicToka />} cursor={{ stroke: '#9ca3af' }} />
            <ReferenceLine y={500} stroke="#6b7280" strokeDasharray="4 3" />
            <ReferenceLine y={p.cilj} stroke={zonaPoKljucu('crvena').boja} strokeWidth={1.5} />
            <Line dataKey="kraj" stroke={theme.ukupno} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} connectNulls isAnimationActive={false}>
              <LabelList dataKey="kraj" content={oznakaVrijednosti((i) => i === zadnjiIndex && p.dana < p.uMjesecu, -10)} />
            </Line>
            <Line dataKey="procjena" stroke={theme.primary} strokeWidth={2} dot={{ r: 4, fill: theme.primary, stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false}>
              <LabelList dataKey="procjena" content={oznakaVrijednosti((i) => i === indexZadnjeProcjene, -10)} />
            </Line>
            <Line dataKey="potroseno" stroke={theme.ukupno} strokeWidth={2} dot={{ r: 4, fill: theme.ukupno, stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Isprekidana linija je nastavak trenutnog tempa do kraja mjeseca. Ljubičaste tačke pokazuju šta je procjena govorila poslije svakog unosa.
        Crvena linija je cilj ({cijeliBroj(p.cilj)} kWh).
      </p>
    </div>
  );
}

// ---------- Prosjek po unosima ----------

interface Stub extends IntervalPotrosnje {
  oznaka: string;
  udioVt: number;
  udioMt: number;
}

// Procenat se upisuje u sam dio stuba, samo kad je dio dovoljno visok da se procita
const MIN_VISINA_ZA_PROCENAT = 14;

const procenatUStubu = (kljuc: 'udioVt' | 'udioMt', stubovi: Stub[]) =>
  function ProcenatUStubu(props: { x?: string | number; y?: string | number; width?: string | number; height?: string | number; index?: number }) {
    const s = stubovi[props.index ?? -1];
    const visina = Number(props.height);
    if (!s || !(visina >= MIN_VISINA_ZA_PROCENAT)) return null;
    return (
      <text
        x={Number(props.x) + Number(props.width) / 2}
        y={Number(props.y) + visina / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#ffffff"
      >
        {s[kljuc]}%
      </text>
    );
  };

function OblacicIntervala({ active, payload }: { active?: boolean; payload?: { payload: Stub }[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 tabular-nums">
      <p className="font-semibold mb-1">
        {trenutakKratko(s.od.datum, s.od.vrijeme)} – {trenutakKratko(s.do.datum, s.do.vrijeme)}
      </p>
      <p>{decimalni(s.kwh)} kWh za {decimalni(s.sati)} h</p>
      <p>Prosjek: {decimalni(s.kwhNaDan)} kWh/dan</p>
      <p>Skupa: {decimalni(s.vtNaDan)} kWh/dan ({s.udioVt}%)</p>
      <p>Jeftina: {decimalni(s.mtNaDan)} kWh/dan ({s.udioMt}%)</p>
    </div>
  );
}

function GrafikIntervala({ intervali }: { intervali: IntervalPotrosnje[] }) {
  const stubovi = useMemo<Stub[]>(
    () =>
      intervali.slice(-MAKS_STUBOVA).map((iv) => {
        // Zaokruzuje se samo skupa, da zbir uvijek bude tacno 100%
        const udioVt = iv.kwh > 0 ? Math.round((iv.vt / iv.kwh) * 100) : 0;
        return {
          ...iv,
          oznaka: trenutakKratko(iv.do.datum, iv.do.vrijeme),
          udioVt,
          udioMt: iv.kwh > 0 ? 100 - udioVt : 0,
        };
      }),
    [intervali],
  );
  const zadnjiIndex = stubovi.length - 1;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Prosjek između unosa (kWh/dan)</h3>
      <div className="flex gap-4 mb-1">
        <Oznaka boja={theme.skupa} tekst="Skupa" />
        <Oznaka boja={theme.jeftina} tekst="Jeftina" />
      </div>
      <div style={{ height: VISINA_GRAFIKA }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stubovi} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="12%">
            <CartesianGrid vertical={false} stroke={BOJA_MREZE} />
            <XAxis
              dataKey="oznaka"
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              tick={{ fontSize: 9, fill: BOJA_OSE }}
              interval="preserveStartEnd"
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: BOJA_OSE }} tickFormatter={cijeliBroj} width={38} allowDecimals={false} />
            <Tooltip content={<OblacicIntervala />} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="mtNaDan" stackId="t" fill={theme.jeftina} stroke="#ffffff" strokeWidth={1} isAnimationActive={false}>
              <LabelList dataKey="udioMt" content={procenatUStubu('udioMt', stubovi)} />
            </Bar>
            <Bar dataKey="vtNaDan" stackId="t" fill={theme.skupa} stroke="#ffffff" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="udioVt" content={procenatUStubu('udioVt', stubovi)} />
              <LabelList
                dataKey="kwhNaDan"
                content={(props: { x?: string | number; y?: string | number; width?: string | number; value?: unknown; index?: number }) =>
                  props.index === zadnjiIndex ? (
                    <text x={Number(props.x) + Number(props.width) / 2} y={Number(props.y) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1f2937">
                      {decimalni(Number(props.value))}
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Svaki stub je razmak između dva unosa, preračunat na 24 sata. Unos ujutro pokazuje noć, a unos uveče dan.
        Procenti u stubu su udio skupe i jeftine u potrošnji tog razmaka (zajedno 100%). Kad je dio stuba premali za broj, procenat je u oblačiću na dodir.
      </p>
    </div>
  );
}

// ---------- Kartica kretanja ----------

function Sazetak({ k }: { k: Kretanje }) {
  const pr = k.poredjenje;
  if (!pr) {
    return <p className="text-sm text-gray-600">Za poređenje sa ranijim danima potrebno je još očitanja.</p>;
  }
  const period = pr.dana === 1 ? 'Zadnja 24 sata' : pr.dana < 5 ? `Zadnja ${pr.dana} dana` : `Zadnjih ${pr.dana} dana`;
  const ranije = pr.dana === 1 ? '24 sata prije' : `${pr.dana} dana prije`;
  return (
    <div>
      <p className="text-xs text-gray-500">{period}</p>
      <div className="flex items-baseline justify-between gap-2 tabular-nums">
        <span className="text-2xl font-bold text-gray-900">{kwh(pr.sada.kwh)}</span>
        <span className="text-sm"><Promjena procenat={pr.promjena} /></span>
      </div>
      <p className="text-sm text-gray-700 tabular-nums">
        {decimalni(pr.sada.kwhNaDan)} kWh/dan, a {ranije} {decimalni(pr.prije.kwhNaDan)} kWh/dan ({kwh(pr.prije.kwh)})
      </p>
    </div>
  );
}

function TabelaIntervala({ intervali }: { intervali: IntervalPotrosnje[] }) {
  const redovi = [...intervali].reverse().slice(0, MAKS_REDOVA);
  return (
    <div>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-gray-500">
            <th className="text-left font-normal pb-1">Do unosa</th>
            <th className="text-right font-normal pb-1">kWh</th>
            <th className="text-right font-normal pb-1">kWh/dan</th>
            <th className="text-right font-normal pb-1">Promjena*</th>
          </tr>
        </thead>
        <tbody>
          {redovi.map((iv) => (
            <tr key={`${iv.do.datum} ${iv.do.vrijeme}`} className="border-t border-gray-100 text-gray-900 align-top">
              <td className="py-1.5">
                {trenutakKratko(iv.do.datum, iv.do.vrijeme)}
                <span className="block text-xs text-gray-500">od {trenutakKratko(iv.od.datum, iv.od.vrijeme)}</span>
              </td>
              <td className="text-right py-1.5">
                {decimalni(iv.kwh)}
                <span className="block text-xs text-gray-500">{decimalni(iv.sati)} h</span>
              </td>
              <td className="text-right py-1.5 font-semibold">{decimalni(iv.kwhNaDan)}</td>
              <td className="text-right py-1.5 text-xs">
                <Promjena procenat={iv.poredjenje?.promjena ?? null} kratko />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">
        * U odnosu na prethodni sličan razmak (jutro sa jutrom, veče sa večeri), jer se noć i dan troše različito.
      </p>
    </div>
  );
}

export function KretanjeKartica({ k }: { k: Kretanje }) {
  return (
    <Kartica naslov="Kretanje potrošnje">
      <Sazetak k={k} />
      {k.intervali.length > 0 && (
        <>
          <div className="border-t border-gray-100 mt-3 pt-3">
            <GrafikIntervala intervali={k.intervali} />
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3">
            <TabelaIntervala intervali={k.intervali} />
          </div>
        </>
      )}
    </Kartica>
  );
}
