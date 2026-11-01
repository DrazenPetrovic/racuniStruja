import { ChevronRight, Flame } from 'lucide-react';
import type { Mjesec } from '../types';
import { theme } from '../theme';
import { km, kwh, mjesecGodina } from '../utils/format';
import { ZonaMjeseca } from './Kartica';

interface MjeseciListaProps {
  racuni: Mjesec[];
  onOtvoriMjesec: (id: number) => void;
}

export function MjeseciLista({ racuni, onOtvoriMjesec }: MjeseciListaProps) {
  return (
    <ul className="space-y-2">
      {[...racuni].reverse().map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onOtvoriMjesec(r.id)}
            className="w-full bg-white rounded-2xl shadow-sm p-4 text-left active:bg-gray-50"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold text-gray-900">{mjesecGodina(r.mjesec)}</span>
              <span className="flex items-center gap-1 font-semibold text-gray-900 tabular-nums">
                {kwh(r.ukupnoKwh)}
                <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden />
              </span>
            </span>
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-sm text-gray-700 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.skupa }} aria-hidden />
                Skupa {kwh(r.vt.kwh)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.jeftina }} aria-hidden />
                Jeftina {kwh(r.mt.kwh)}
              </span>
            </span>
            <span className="flex items-center justify-between gap-2 mt-2">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ZonaMjeseca zona={r.zona} />
                {r.grijanjeKwh !== null && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-700 tabular-nums">
                    <Flame className="w-3.5 h-3.5" aria-hidden />
                    grijanje ≈ {kwh(r.grijanjeKwh)}
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-700 tabular-nums shrink-0">{km(r.ukupnoKm)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
