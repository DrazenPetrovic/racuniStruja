import type { Mjesec } from '../types';
import { ZONE, zonaPoKljucu } from '../theme';
import { cijeliBroj, kratakMjesecGodina } from '../utils/format';

interface TabelaMjeseciProps {
  racuni: Mjesec[];
  onOtvoriMjesec: (id: number) => void;
}

// kWh po zonama za svaki mjesec, najnoviji prvi
export function TabelaMjeseci({ racuni, onOtvoriMjesec }: TabelaMjeseciProps) {
  const zbir = (izaberi: (m: Mjesec) => number) => racuni.reduce((z, m) => z + izaberi(m), 0);

  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-xs text-gray-500">
          <th className="text-left font-normal pb-1 pl-1.5">Mjesec</th>
          {ZONE.map((z) => (
            <th key={z.kljuc} className="text-right font-normal pb-1 px-1.5">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.boja }} aria-hidden />
                {z.naziv}
              </span>
            </th>
          ))}
          <th className="text-right font-normal pb-1 px-1.5">Ukupno</th>
        </tr>
      </thead>
      <tbody>
        {[...racuni].reverse().map((m) => {
          // Boja reda je najvisa zona koju je mjesec dostigao
          const obojen = m.zona !== 'bijela';
          return (
            <tr
              key={m.id}
              className={obojen ? 'border-t-2 border-white text-white font-medium' : 'border-t border-gray-100 text-gray-900'}
              style={obojen ? { backgroundColor: zonaPoKljucu(m.zona).boja } : undefined}
            >
              <td className="py-0 pl-1.5">
                <button
                  type="button"
                  onClick={() => onOtvoriMjesec(m.id)}
                  className={`py-2 pr-2 text-left underline underline-offset-2 whitespace-nowrap ${obojen ? 'decoration-white/60' : 'decoration-gray-300'}`}
                >
                  {kratakMjesecGodina(m.mjesec)}
                </button>
              </td>
              {ZONE.map((z) => (
                <td key={z.kljuc} className={`text-right px-1.5 ${!obojen && m.zoneKwh[z.kljuc] === 0 ? 'text-gray-400' : ''}`}>
                  {cijeliBroj(m.zoneKwh[z.kljuc])}
                </td>
              ))}
              <td className="text-right font-semibold px-1.5">{cijeliBroj(m.ukupnoKwh)}</td>
            </tr>
          );
        })}
        {racuni.length > 1 && (
          <tr className="border-t border-gray-300 font-semibold text-gray-900">
            <td className="py-2 pl-1.5">Zbir</td>
            {ZONE.map((z) => (
              <td key={z.kljuc} className="text-right px-1.5">{cijeliBroj(zbir((m) => m.zoneKwh[z.kljuc]))}</td>
            ))}
            <td className="text-right px-1.5">{cijeliBroj(zbir((m) => m.ukupnoKwh))}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
