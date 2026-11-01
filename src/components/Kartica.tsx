import type { ReactNode } from 'react';
import type { Mjesec, NazivZone } from '../types';
import { theme, ZONE, zonaPoKljucu } from '../theme';
import { cijena, cijeliBroj, kwh, procenat } from '../utils/format';

export function Kartica({ naslov, children }: { naslov?: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      {naslov && <h2 className="text-sm font-semibold text-gray-800 mb-3">{naslov}</h2>}
      {children}
    </section>
  );
}

export function Oznaka({ boja, tekst }: { boja: string; tekst: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: boja }} aria-hidden />
      {tekst}
    </span>
  );
}

export function ZonaMjeseca({ zona }: { zona: NazivZone }) {
  const { naziv, boja } = zonaPoKljucu(zona);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: boja }} aria-hidden />
      {naziv} zona
    </span>
  );
}

const PORUKA_DO_SLJEDECE: Record<NazivZone, string> = {
  bijela: 'do plave zone',
  plava: 'do crvene zone',
  crvena: '',
};

const SKALA_KWH = 2000;

// Traka potrosnje sa granicama zona na 500 i 1.500 kWh
export function MjeracZona({ mjesec }: { mjesec: Mjesec }) {
  const skala = Math.max(SKALA_KWH, mjesec.ukupnoKwh);
  const granice = [500, 1500];
  return (
    <div>
      <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden flex gap-px" role="img" aria-label={`Potrošnja ${kwh(mjesec.ukupnoKwh)}`}>
        {ZONE.map((z) => (
          <div key={z.kljuc} style={{ width: `${(mjesec.zoneKwh[z.kljuc] / skala) * 100}%`, backgroundColor: z.boja }} />
        ))}
      </div>
      <div className="relative h-4 mt-0.5 text-[10px] text-gray-500 tabular-nums">
        {granice.map((g) => (
          <span key={g} className="absolute -translate-x-1/2" style={{ left: `${(g / skala) * 100}%` }}>
            {cijeliBroj(g)}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-1 tabular-nums">
        {mjesec.doSljedeceZone !== null
          ? `Još ${kwh(mjesec.doSljedeceZone)} ${PORUKA_DO_SLJEDECE[mjesec.zona]}`
          : `${kwh(mjesec.zoneKwh.crvena)} u najskupljoj zoni`}
      </p>
    </div>
  );
}

// kWh u svakoj zoni i cijena energije po tarifi
export function TabelaZona({ mjesec }: { mjesec: Mjesec }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-xs text-gray-500">
          <th className="text-left font-normal py-1">Zona</th>
          <th className="text-right font-normal py-1">kWh</th>
          <th className="text-right font-normal py-1">Skupa KM/kWh</th>
          <th className="text-right font-normal py-1">Jeftina KM/kWh</th>
        </tr>
      </thead>
      <tbody>
        {ZONE.map((z) => (
          <tr key={z.kljuc} className={`border-t border-gray-100 ${mjesec.zoneKwh[z.kljuc] === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
            <td className="py-1.5">
              <Oznaka boja={z.boja} tekst={z.naziv} />
              <span className="block text-xs text-gray-500">{z.opseg}</span>
            </td>
            <td className="text-right py-1.5 font-semibold">{cijeliBroj(mjesec.zoneKwh[z.kljuc])}</td>
            <td className="text-right py-1.5">{cijena(mjesec.zone.vt[z.kljuc].cijena)}</td>
            <td className="text-right py-1.5">{cijena(mjesec.zone.mt[z.kljuc].cijena)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaTarifa({ mjesec }: { mjesec: Mjesec }) {
  const redovi = [
    { naziv: 'Skupa', boja: theme.skupa, tarifa: mjesec.vt },
    { naziv: 'Jeftina', boja: theme.jeftina, tarifa: mjesec.mt },
  ];
  return (
    <div>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-gray-500">
            <th className="text-left font-normal pb-1">Tarifa</th>
            <th className="text-right font-normal pb-1">Potrošnja</th>
            <th className="text-right font-normal pb-1">Prava cijena*</th>
          </tr>
        </thead>
        <tbody>
          {redovi.map((r) => (
            <tr key={r.naziv}>
              <td className="py-1"><Oznaka boja={r.boja} tekst={r.naziv} /></td>
              <td className="text-right py-1">
                <span className="font-semibold text-gray-900">{kwh(r.tarifa.kwh)}</span>
                <span className="block text-xs text-gray-500">{procenat(r.tarifa.udio)}</span>
              </td>
              <td className="text-right py-1 font-semibold text-gray-900">{cijena(r.tarifa.pravaCijena)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">
        * KM za jedan kWh: energija, mrežarina i OIEE sa PDV-om, bez fiksnog dijela računa.
      </p>
    </div>
  );
}
