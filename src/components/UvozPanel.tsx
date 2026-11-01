import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Info, Loader2, X } from 'lucide-react';
import type { RezultatUvoza } from '../types';
import { theme } from '../theme';
import { ApiGreska, uveziRacun } from '../utils/api';
import { mjesecGodina } from '../utils/format';

interface UvozPanelProps {
  onZatvori: () => void;
  onUvezeno: () => void;
}

export function UvozPanel({ onZatvori, onUvezeno }: UvozPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uToku, setUToku] = useState<string | null>(null);
  const [rezultati, setRezultati] = useState<RezultatUvoza[]>([]);
  const [dodano, setDodano] = useState(false);

  const obradiFajlove = async (fajlovi: FileList | null) => {
    if (!fajlovi || fajlovi.length === 0) return;
    const lista = Array.from(fajlovi);
    setRezultati([]);

    for (const fajl of lista) {
      setUToku(fajl.name);
      try {
        const odgovor = await uveziRacun(fajl);
        const novi = odgovor.status === 'dodan';
        if (novi) setDodano(true);
        setRezultati((r) => [
          ...r,
          {
            naziv: fajl.name,
            uspjeh: true,
            poruka: `${mjesecGodina(odgovor.mjesec)}: ${novi ? 'uvezen' : 'već je bio uvezen'}`,
          },
        ]);
      } catch (err) {
        setRezultati((r) => [
          ...r,
          {
            naziv: fajl.name,
            uspjeh: false,
            poruka: err instanceof Error ? err.message : 'Greška pri uvozu',
            detalji: err instanceof ApiGreska ? err.detalji : [],
          },
        ]);
      }
    }

    setUToku(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const zatvori = () => {
    if (dodano) onUvezeno();
    onZatvori();
  };

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 sigurno-dolje max-h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Uvoz računa</h2>
          <button type="button" onClick={zatvori} aria-label="Zatvori" disabled={uToku !== null} className="p-2 -mr-2 text-gray-600 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Izaberi jedan ili više PDF računa Elektroprivrede RS. Za svaki mjesec se čuva jedan račun.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => obradiFajlove(e.target.files)}
        />
        <button
          type="button"
          disabled={uToku !== null}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl disabled:opacity-60 active:opacity-80"
          style={{ backgroundColor: theme.primary }}
        >
          {uToku ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <FileUp className="w-5 h-5" aria-hidden />}
          {uToku ? 'Uvoz u toku...' : 'Izaberi PDF'}
        </button>
        {uToku && <p className="text-xs text-gray-500 mt-2 truncate">{uToku}</p>}

        {rezultati.length > 0 && (
          <ul className="mt-4 space-y-2">
            {rezultati.map((r, i) => (
              <li key={`${r.naziv}-${i}`} className={`rounded-xl px-3 py-2 text-sm ${r.uspjeh ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}>
                <span className="flex items-start gap-2">
                  {r.uspjeh ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
                  <span className="min-w-0">
                    <span className="block font-medium">{r.poruka}</span>
                    {!r.uspjeh && <span className="block text-xs truncate">{r.naziv}</span>}
                    {r.detalji?.map((d) => <span key={d} className="block text-xs mt-0.5">{d}</span>)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {rezultati.length > 0 && !uToku && (
          <button type="button" onClick={zatvori} className="w-full mt-4 py-3 rounded-xl font-semibold bg-gray-100 text-gray-800 active:bg-gray-200">
            Gotovo
          </button>
        )}

        {rezultati.length === 0 && !uToku && (
          <p className="flex items-start gap-2 text-xs text-gray-500 mt-4">
            <Info className="w-4 h-4 shrink-0" aria-hidden />
            Sa PDF-a se čuvaju samo kWh, cijene i iznosi, a sam fajl se ne čuva.
          </p>
        )}
      </div>
    </div>
  );
}
