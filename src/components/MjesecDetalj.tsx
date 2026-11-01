import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import type { Mjesec, ZoneTarife } from '../types';
import { theme, ZONE } from '../theme';
import { obrisiMjesec } from '../utils/api';
import { cijena, cijeliBroj, km, kwh, mjesecGodina } from '../utils/format';
import { Kartica, MjeracZona, Oznaka, TabelaTarifa, ZonaMjeseca } from './Kartica';

interface MjesecDetaljProps {
  mjesec: Mjesec;
  onNazad: () => void;
  onObrisan: () => void;
}

function ZoneTarife({ naziv, boja, zone }: { naziv: string; boja: string; zone: ZoneTarife }) {
  const ukupnoKwh = ZONE.reduce((z, { kljuc }) => z + zone[kljuc].kwh, 0);
  const ukupnoIznos = ZONE.reduce((z, { kljuc }) => z + zone[kljuc].iznos, 0);
  return (
    <div>
      <Oznaka boja={boja} tekst={naziv} />
      <table className="w-full mt-1 text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-gray-500">
            <th className="text-left font-normal py-1">Zona</th>
            <th className="text-right font-normal py-1">kWh</th>
            <th className="text-right font-normal py-1">KM/kWh</th>
            <th className="text-right font-normal py-1">Iznos</th>
          </tr>
        </thead>
        <tbody>
          {ZONE.map(({ kljuc, naziv: nazivZone, boja: bojaZone }) => (
            <tr key={kljuc} className={`border-t border-gray-100 ${zone[kljuc].kwh === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
              <td className="py-1.5"><Oznaka boja={bojaZone} tekst={nazivZone} /></td>
              <td className="text-right py-1.5">{cijeliBroj(zone[kljuc].kwh)}</td>
              <td className="text-right py-1.5">{cijena(zone[kljuc].cijena)}</td>
              <td className="text-right py-1.5">{km(zone[kljuc].iznos)}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-200 font-semibold text-gray-900">
            <td className="py-1.5">Ukupno</td>
            <td className="text-right py-1.5">{cijeliBroj(ukupnoKwh)}</td>
            <td />
            <td className="text-right py-1.5">{km(ukupnoIznos)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Red({ oznaka, vrijednost, jako }: { oznaka: string; vrijednost: string; jako?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${jako ? 'font-semibold text-gray-900 border-t border-gray-200 mt-1 pt-2' : ''}`}>
      <dt className={jako ? '' : 'text-gray-600'}>{oznaka}</dt>
      <dd className="text-gray-900 text-right">{vrijednost}</dd>
    </div>
  );
}

export function MjesecDetalj({ mjesec: m, onNazad, onObrisan }: MjesecDetaljProps) {
  const [brisanje, setBrisanje] = useState(false);
  const [greska, setGreska] = useState('');

  const obrisi = async () => {
    if (!window.confirm(`Obrisati ${mjesecGodina(m.mjesec).toLowerCase()}? PDF možeš ponovo uvesti.`)) return;
    setBrisanje(true);
    setGreska('');
    try {
      await obrisiMjesec(m.id);
      onObrisan();
    } catch (err) {
      setGreska(err instanceof Error ? err.message : 'Greška pri brisanju');
      setBrisanje(false);
    }
  };

  return (
    <div>
      <header className="sigurno-gore sticky top-0 z-10 text-white" style={{ backgroundColor: theme.primary }}>
        <div className="flex items-center gap-2 px-2 h-14">
          <button type="button" onClick={onNazad} aria-label="Nazad" className="p-2 rounded-full active:bg-white/20">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-semibold text-lg">{mjesecGodina(m.mjesec)}</h1>
        </div>
      </header>

      <main className="p-3 space-y-3 max-w-xl mx-auto sigurno-dolje">
        <Kartica>
          <div className="flex items-baseline justify-between gap-2 tabular-nums">
            <span className="text-3xl font-bold text-gray-900">{kwh(m.ukupnoKwh)}</span>
            <span className="text-lg font-semibold text-gray-800">{km(m.ukupnoKm)}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1 tabular-nums">
            Prosječno sa svim troškovima: {cijena(m.prosjekKmKwh)} KM/kWh
          </p>
          <p className="mt-2"><ZonaMjeseca zona={m.zona} /></p>
          <div className="mt-3">
            <MjeracZona mjesec={m} />
          </div>
          {m.grijanjeKwh !== null && (
            <p className="text-sm text-gray-800 mt-3 tabular-nums">
              Grijanje (procjena): <span className="font-semibold">{kwh(m.grijanjeKwh)}</span>
            </p>
          )}
        </Kartica>

        <Kartica naslov="Skupa i jeftina struja">
          <TabelaTarifa mjesec={m} />
        </Kartica>

        <Kartica naslov="kWh i cijene energije po zonama">
          <div className="space-y-4">
            <ZoneTarife naziv="Skupa struja (AVT)" boja={theme.skupa} zone={m.zone.vt} />
            <ZoneTarife naziv="Jeftina struja (AMT)" boja={theme.jeftina} zone={m.zone.mt} />
          </div>
        </Kartica>

        <Kartica naslov="Od čega se sastoji iznos">
          <dl className="text-sm tabular-nums">
            <Red oznaka="Energija" vrijednost={km(m.vt.energija + m.mt.energija)} />
            <Red oznaka="Mrežarina i OIEE po kWh" vrijednost={km(m.vtMrezaKm + m.mtMrezaKm)} />
            <Red oznaka="Fiksni dio" vrijednost={km(m.fiksnoKm)} />
            <Red oznaka={`PDV ${cijeliBroj(m.pdvStopa)}%`} vrijednost={km(m.pdvKm)} />
            <Red oznaka="Ukupno" vrijednost={km(m.ukupnoKm)} jako />
          </dl>
          <p className="text-xs text-gray-500 mt-2 break-all">Račun br. {m.brojRacuna}</p>
        </Kartica>

        {greska && <p className="bg-red-50 text-red-800 rounded-xl px-4 py-3 text-sm">{greska}</p>}

        <button
          type="button"
          onClick={obrisi}
          disabled={brisanje}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" aria-hidden />
          {brisanje ? 'Brisanje...' : 'Obriši mjesec iz evidencije'}
        </button>
      </main>
    </div>
  );
}
