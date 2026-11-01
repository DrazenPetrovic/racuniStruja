import type { Mjesec } from '../types';
import { cijeliBroj, kratakMjesec, kwh, mjesecGodina } from '../utils/format';

const MJESECI = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

const saPredznakom = (vrijednost: number) => `${vrijednost > 0 ? '+' : ''}${cijeliBroj(vrijednost)}`;

// Zadnji uvezeni mjesec i svaki drugi mjesec te godine, naspram istog mjeseca godinu ranije
export function PoredjenjeGodina({ racuni }: { racuni: Mjesec[] }) {
  const zadnji = racuni[racuni.length - 1];
  const ova = zadnji.mjesec.slice(0, 4);
  const prosla = String(Number(ova) - 1);
  const poMjesecu = new Map(racuni.map((r) => [r.mjesec.slice(0, 7), r.ukupnoKwh]));
  const zadnjiBroj = zadnji.mjesec.slice(5, 7);
  const isti = poMjesecu.get(`${prosla}-${zadnjiBroj}`);

  return (
    <div>
      <p className="text-sm text-gray-800 mb-3 tabular-nums">
        {isti !== undefined ? (
          <>
            {mjesecGodina(zadnji.mjesec)}: <span className="font-semibold">{kwh(zadnji.ukupnoKwh)}</span>, a godinu ranije{' '}
            <span className="font-semibold">{kwh(isti)}</span> ({saPredznakom(zadnji.ukupnoKwh - isti)} kWh)
          </>
        ) : (
          `Za ${mjesecGodina(`${prosla}-${zadnjiBroj}-01`).toLowerCase()} još nema uvezenog računa. Uvezi račune iz ${prosla}. godine za poređenje.`
        )}
      </p>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-gray-500">
            <th className="text-left font-normal pb-1 pl-1.5">Mjesec</th>
            <th className="text-right font-normal pb-1">{prosla}</th>
            <th className="text-right font-normal pb-1">{ova}</th>
            <th className="text-right font-normal pb-1 pr-1.5">Razlika</th>
          </tr>
        </thead>
        <tbody>
          {MJESECI.map((m) => {
            const prije = poMjesecu.get(`${prosla}-${m}`);
            const sada = poMjesecu.get(`${ova}-${m}`);
            const razlika = prije !== undefined && sada !== undefined ? sada - prije : null;
            return (
              <tr key={m} className={`border-t border-gray-100 text-gray-900 ${m === zadnjiBroj ? 'bg-gray-100 font-semibold' : ''}`}>
                <td className="py-1.5 pl-1.5">{kratakMjesec(`${ova}-${m}-01`)}</td>
                <td className="text-right py-1.5">{prije !== undefined ? cijeliBroj(prije) : '–'}</td>
                <td className="text-right py-1.5">{sada !== undefined ? cijeliBroj(sada) : '–'}</td>
                <td className="text-right py-1.5 pr-1.5">
                  {razlika !== null ? (
                    <>
                      {saPredznakom(razlika)}
                      {prije ? <span className="block text-xs font-normal text-gray-500">{saPredznakom(Math.round((razlika / prije) * 100))}%</span> : null}
                    </>
                  ) : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
