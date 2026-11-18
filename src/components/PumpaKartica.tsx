import type { ProcjenaPumpe, RazmakPumpe } from '../types';
import { theme } from '../theme';
import { decimalni, kratakMjesecGodina, kwh, trenutakKratko } from '../utils/format';
import { Kartica, Oznaka } from './Kartica';

const udio = (dio: number, ukupno: number) => (ukupno > 0 ? Math.round((dio / ukupno) * 100) : 0);

function TrakaPodjele({ pumpa, kuca }: { pumpa: number; kuca: number }) {
  const p = udio(pumpa, pumpa + kuca);
  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100" role="img" aria-label={`Pumpa ${p}%, kuća ${100 - p}%`}>
      <div style={{ width: `${p}%`, backgroundColor: theme.pumpa }} />
      <div style={{ width: `${100 - p}%`, backgroundColor: theme.kuca }} />
    </div>
  );
}

function TabelaRazmaka({ redovi, prvaKolona, oznaka, poDanu }: { redovi: RazmakPumpe[]; prvaKolona: string; oznaka: (r: RazmakPumpe) => string; poDanu: boolean }) {
  const vrijednost = (r: RazmakPumpe, kolicina: number) => (poDanu ? decimalni(kolicina / r.dana) : decimalni(kolicina, 0));
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-xs text-gray-500">
          <th className="text-left font-normal pb-1">{prvaKolona}</th>
          <th className="text-right font-normal pb-1">°C</th>
          <th className="text-right font-normal pb-1">{poDanu ? 'kWh/dan' : 'kWh'}</th>
          <th className="text-right font-normal pb-1">Pumpa</th>
          <th className="text-right font-normal pb-1">Kuća</th>
        </tr>
      </thead>
      <tbody>
        {[...redovi].reverse().map((r) => (
          <tr key={`${r.od.datum} ${r.od.vrijeme} ${r.do.datum}`} className="border-t border-gray-100 text-gray-900 align-top">
            <td className="py-1.5">{oznaka(r)}</td>
            <td className="text-right py-1.5">{decimalni(r.temperatura)}</td>
            <td className="text-right py-1.5">{vrijednost(r, r.kwh)}</td>
            <td className="text-right py-1.5 font-semibold">
              {vrijednost(r, r.pumpaKwh)}
              <span className="block text-xs font-normal text-gray-500">{udio(r.pumpaKwh, r.kwh)}%</span>
            </td>
            <td className="text-right py-1.5">{vrijednost(r, r.kucaKwh)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PumpaKartica({ p }: { p: ProcjenaPumpe }) {
  if (p.greska || !p.model) {
    return (
      <Kartica naslov="Toplotna pumpa i kuća">
        <p className="text-sm text-gray-700">{p.greska ?? 'Procjena trenutno nije dostupna.'}</p>
      </Kartica>
    );
  }

  const m = p.model;
  const pumpaNa = (t: number) => Math.max(0, m.grijanjePoStepenu * (m.bazaGrijanja - t));

  return (
    <Kartica naslov="Toplotna pumpa i kuća (po temperaturi)">
      {p.period && (
        <div>
          <p className="text-xs text-gray-500">
            Od {trenutakKratko(p.period.od.datum, p.period.od.vrijeme)} do {trenutakKratko(p.period.do.datum, p.period.do.vrijeme)} ({decimalni(p.period.dana)} dana)
          </p>
          <div className="grid grid-cols-2 gap-3 mt-1 tabular-nums">
            <div>
              <Oznaka boja={theme.pumpa} tekst="Pumpa ≈" />
              <p className="text-2xl font-bold text-gray-900">{kwh(p.period.pumpaKwh)}</p>
              <p className="text-xs text-gray-600">
                {udio(p.period.pumpaKwh, p.period.kwh)}% · {decimalni(p.period.pumpaKwh / p.period.dana)} kWh/dan
              </p>
            </div>
            <div>
              <Oznaka boja={theme.kuca} tekst="Kuća ≈" />
              <p className="text-2xl font-bold text-gray-900">{kwh(p.period.kucaKwh)}</p>
              <p className="text-xs text-gray-600">
                {udio(p.period.kucaKwh, p.period.kwh)}% · {decimalni(p.period.kucaKwh / p.period.dana)} kWh/dan
              </p>
            </div>
          </div>
          <div className="mt-2">
            <TrakaPodjele pumpa={p.period.pumpaKwh} kuca={p.period.kucaKwh} />
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 mt-3 pt-3 text-sm text-gray-800 space-y-1 tabular-nums">
        <p>
          Kuća bez pumpe (bojler, rasvjeta, uređaji): oko <span className="font-semibold">{decimalni(m.kucaNaDan)} kWh/dan</span>.
        </p>
        <p>
          Pumpa troši oko <span className="font-semibold">{decimalni(m.grijanjePoStepenu)} kWh</span> za svaki stepen ispod {m.bazaGrijanja} °C,
          računato za cijeli dan. Kad je napolju prosječno 5 °C to je oko {decimalni(pumpaNa(5), 0)} kWh/dan, na 0 °C oko {decimalni(pumpaNa(0), 0)},
          a na −5 °C oko {decimalni(pumpaNa(-5), 0)} kWh/dan.
        </p>
        {m.hladjenjePoStepenu !== null && (
          <p>
            Hlađenje: oko {decimalni(m.hladjenjePoStepenu)} kWh za svaki stepen iznad {m.bazaHladjenja} °C, za cijeli dan.
          </p>
        )}
      </div>

      {p.razmaci && p.razmaci.length > 0 && (
        <div className="border-t border-gray-100 mt-3 pt-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Između unosa (kWh/dan)</h3>
          <TabelaRazmaka redovi={p.razmaci} prvaKolona="Do unosa" oznaka={(r) => trenutakKratko(r.do.datum, r.do.vrijeme)} poDanu />
        </div>
      )}

      {p.mjeseci && p.mjeseci.length > 0 && (
        <div className="border-t border-gray-100 mt-3 pt-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Po računima (kWh za mjesec)</h3>
          <TabelaRazmaka redovi={p.mjeseci} prvaKolona="Mjesec" oznaka={(r) => kratakMjesecGodina(r.od.datum)} poDanu={false} />
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        Procjena poredi potrošnju sa satnom temperaturom u Banjoj Luci (Open-Meteo): koliko potrošnja raste kad je hladnije,
        to je pumpa, a dio koji ne zavisi od temperature je kuća. Izmjerena potrošnja se dijeli u tom omjeru, pa pumpa i kuća
        zajedno uvijek daju stanje brojila. Naglo veća potrošnja kuće (pranje, pećnica) zato se dijelom pripiše i pumpi.
        {m.tacnost !== null && ` Model objašnjava ${m.tacnost}% razlika u potrošnji iz ${m.brojRazmaka} razmaka (${trenutakKratko(m.od.datum, m.od.vrijeme)}${m.od.datum.slice(0, 4)}. – ${trenutakKratko(m.do.datum, m.do.vrijeme)}).`}
      </p>
    </Kartica>
  );
}
