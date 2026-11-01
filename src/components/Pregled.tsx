import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Evidencija } from '../types';
import { km, kwh, mjesecGodina } from '../utils/format';
import { Kartica, MjeracZona, TabelaTarifa, TabelaZona, ZonaMjeseca } from './Kartica';
import { GrafikTarife, GrafikUkupno } from './PotrosnjaGrafik';
import { TabelaMjeseci } from './TabelaMjeseci';
import { PoredjenjeGodina } from './PoredjenjeGodina';

interface PregledProps {
  evidencija: Evidencija;
  onOtvoriMjesec: (id: number) => void;
}

export function Pregled({ evidencija, onOtvoriMjesec }: PregledProps) {
  const { racuni, osnovnaPotrosnja, sezone } = evidencija;
  const zadnji = racuni[racuni.length - 1];
  const prethodni = racuni[racuni.length - 2];

  const poGodinama = useMemo(() => {
    const godine = [...new Set(racuni.map((r) => r.mjesec.slice(0, 4)))].sort().reverse();
    return godine.map((godina) => {
      const mjeseci = racuni.filter((r) => r.mjesec.startsWith(godina));
      return {
        godina,
        brojMjeseci: mjeseci.length,
        uCrvenoj: mjeseci.filter((m) => m.zona === 'crvena').length,
        kwh: mjeseci.reduce((z, m) => z + m.ukupnoKwh, 0),
        skupa: mjeseci.reduce((z, m) => z + m.vt.kwh, 0),
        jeftina: mjeseci.reduce((z, m) => z + m.mt.kwh, 0),
        km: mjeseci.reduce((z, m) => z + m.ukupnoKm, 0),
      };
    });
  }, [racuni]);

  const razlikaKwh = prethodni ? zadnji.ukupnoKwh - prethodni.ukupnoKwh : null;

  return (
    <div className="space-y-3">
      <Kartica>
        <GrafikUkupno racuni={racuni} />
      </Kartica>

      <Kartica>
        <GrafikTarife racuni={racuni} />
      </Kartica>

      <Kartica naslov="kWh po zonama">
        <TabelaMjeseci racuni={racuni} onOtvoriMjesec={onOtvoriMjesec} />
      </Kartica>

      <Kartica naslov="Poređenje sa prošlom godinom (kWh)">
        <PoredjenjeGodina racuni={racuni} />
      </Kartica>

      <Kartica naslov="Grijanje (toplotna pumpa)">
        {sezone.length > 0 && (
          <table className="w-full text-sm tabular-nums mb-2">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left font-normal pb-1">Sezona</th>
                <th className="text-right font-normal pb-1">Ukupno</th>
                <th className="text-right font-normal pb-1">Grijanje ≈</th>
                <th className="text-right font-normal pb-1">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {sezone.map((s) => (
                <tr key={s.naziv} className="border-t border-gray-100 text-gray-900">
                  <td className="py-1.5">
                    {s.naziv}
                    <span className="block text-xs text-gray-500">{s.brojMjeseci} mj.</span>
                  </td>
                  <td className="text-right py-1.5">{kwh(s.ukupnoKwh)}</td>
                  <td className="text-right py-1.5 font-semibold">{s.grijanjeKwh !== null ? kwh(s.grijanjeKwh) : '–'}</td>
                  <td className="text-right py-1.5">{km(s.ukupnoKm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sezone.length === 0 && (
          <p className="text-sm text-gray-700 mb-2">Još nema uvezenih mjeseci sa grijanjem (oktobar–maj).</p>
        )}
        <p className="text-xs text-gray-500">
          {osnovnaPotrosnja !== null
            ? `Procjena: potrošnja od oktobra do maja iznad osnovne potrošnje od ${kwh(osnovnaPotrosnja)} (prosjek uvezenih mjeseci jun–septembar). Račun ne odvaja toplotnu pumpu.`
            : 'Procjena traži bar jedan uvezen mjesec jun–septembar, kao osnovnu potrošnju bez grijanja. Račun ne odvaja toplotnu pumpu.'}
        </p>
      </Kartica>

      <Kartica naslov="Po godinama">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left font-normal pb-1">Godina</th>
              <th className="text-right font-normal pb-1">Potrošnja</th>
              <th className="text-right font-normal pb-1">U crvenoj</th>
              <th className="text-right font-normal pb-1">Iznos</th>
            </tr>
          </thead>
          <tbody>
            {poGodinama.map((g) => (
              <tr key={g.godina} className="border-t border-gray-100 text-gray-900">
                <td className="py-1.5">
                  {g.godina}
                  <span className="block text-xs text-gray-500">{g.brojMjeseci} mj.</span>
                </td>
                <td className="text-right py-1.5">
                  <span className="font-semibold">{kwh(g.kwh)}</span>
                  <span className="block text-xs text-gray-500">
                    skupa {kwh(g.skupa)}
                  </span>
                  <span className="block text-xs text-gray-500">
                    jeftina {kwh(g.jeftina)}
                  </span>
                </td>
                <td className="text-right py-1.5">{g.uCrvenoj} mj.</td>
                <td className="text-right py-1.5 font-semibold">{km(g.km)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kartica>

      <Kartica>
        <button type="button" onClick={() => onOtvoriMjesec(zadnji.id)} className="w-full text-left">
          <span className="flex items-center justify-between text-xs text-gray-500">
            Zadnji mjesec: {mjesecGodina(zadnji.mjesec)}
            <ChevronRight className="w-4 h-4" aria-hidden />
          </span>
          <span className="flex items-baseline justify-between mt-1 gap-2 tabular-nums">
            <span className="text-3xl font-bold text-gray-900">{kwh(zadnji.ukupnoKwh)}</span>
            <span className="text-lg font-semibold text-gray-800">{km(zadnji.ukupnoKm)}</span>
          </span>
          {razlikaKwh !== null && (
            <span className="block text-xs text-gray-600 mt-0.5 tabular-nums">
              {razlikaKwh > 0 ? '+' : ''}{kwh(razlikaKwh)} u odnosu na {mjesecGodina(prethodni.mjesec).toLowerCase()}
            </span>
          )}
          <span className="block mt-2">
            <ZonaMjeseca zona={zadnji.zona} />
          </span>
        </button>
        <div className="mt-3">
          <MjeracZona mjesec={zadnji} />
        </div>
        <div className="mt-3">
          <TabelaZona mjesec={zadnji} />
        </div>
        <div className="mt-3">
          <TabelaTarifa mjesec={zadnji} />
        </div>
      </Kartica>
    </div>
  );
}
