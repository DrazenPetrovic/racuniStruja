import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Trash2 } from 'lucide-react';
import type { Procjena, StanjeProcjene } from '../types';
import { theme, zonaPoKljucu } from '../theme';
import { obrisiOcitanje, sacuvajOcitanje, ucitajProcjenu } from '../utils/api';
import { cijeliBroj, datumIspis, km, kwh, mjesecGodina } from '../utils/format';
import { Kartica, Oznaka, ZonaMjeseca } from './Kartica';

const SKALA_KWH = 2000;

const danasLokalno = () => {
  const sada = new Date();
  const mj = String(sada.getMonth() + 1).padStart(2, '0');
  const dan = String(sada.getDate()).padStart(2, '0');
  return `${sada.getFullYear()}-${mj}-${dan}`;
};

// Prihvata "9111", "9.111" i "9111,5"
const parsirajStanje = (tekst: string) => {
  const t = tekst.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t.replace(',', '.'));
};

function TrakaCilja({ p }: { p: Procjena }) {
  const skala = Math.max(SKALA_KWH, p.projekcija.kwh);
  const pozicija = (kolicina: number) => `${Math.min(100, (kolicina / skala) * 100)}%`;
  const boja = zonaPoKljucu(p.projekcija.zona).boja;
  return (
    <div>
      <div
        className="relative h-3 rounded-full bg-gray-100 overflow-hidden"
        role="img"
        aria-label={`Dosad ${kwh(p.dosad.kwh)}, procjena ${kwh(p.projekcija.kwh)}, cilj ${kwh(p.cilj)}`}
      >
        <div className="absolute inset-y-0 left-0 opacity-30" style={{ width: pozicija(p.projekcija.kwh), backgroundColor: boja }} />
        <div className="absolute inset-y-0 left-0" style={{ width: pozicija(p.dosad.kwh), backgroundColor: boja }} />
        <div className="absolute inset-y-0 w-0.5" style={{ left: pozicija(p.cilj), backgroundColor: zonaPoKljucu('crvena').boja }} />
      </div>
      <div className="relative h-4 mt-0.5 text-[10px] text-gray-600 tabular-nums">
        <span className="absolute -translate-x-1/2" style={{ left: pozicija(p.cilj) }}>cilj {cijeliBroj(p.cilj)}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">Puna boja je potrošeno dosad, a svijetla procjena do kraja mjeseca.</p>
    </div>
  );
}

function RezultatProcjene({ p }: { p: Procjena }) {
  const prijeTekst = p.prije.map((m) => `${mjesecGodina(m.mjesec).toLowerCase()} ≈ ${kwh(m.kwh)}`).join(', ');

  return (
    <div className="space-y-3">
      {!p.tacanPocetak && (
        <div className="flex gap-2 bg-amber-50 text-amber-900 rounded-xl px-3 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <p>
            Zadnje poznato stanje prije ovog mjeseca je od {datumIspis(p.pocetak.datum)} Od tada je potrošeno {kwh(p.raspon.kwh)} za {p.raspon.dana} dana.
            {' '}Podijeljeno je ravnomjerno po danima: {prijeTekst} i {mjesecGodina(p.mjesec).toLowerCase()} ≈ {kwh(p.dosad.kwh)}.
            {' '}Tačan početak mjeseca dobijaš kad uvezeš račun za prethodni mjesec.
          </p>
        </div>
      )}
      {p.tacanPocetak && p.gruba && (
        <div className="flex gap-2 bg-gray-100 text-gray-800 rounded-xl px-3 py-2.5 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <p>Mjesec je tek počeo, pa je procjena gruba. Biće tačnija sa svakim novim očitanjem.</p>
        </div>
      )}

      <Kartica naslov={`${mjesecGodina(p.mjesec)}, stanje na ${datumIspis(p.datumOcitanja)}`}>
        <p className="text-xs text-gray-500">Potrošeno dosad ({p.dana}. od {p.uMjesecu} dana)</p>
        <div className="flex items-baseline justify-between gap-2 tabular-nums">
          <span className="text-3xl font-bold text-gray-900">{p.tacanPocetak ? '' : '≈ '}{kwh(p.dosad.kwh)}</span>
          <span className="text-lg font-semibold text-gray-800">{km(p.dosad.km)}</span>
        </div>
        <div className="flex gap-4 mt-1 tabular-nums">
          <Oznaka boja={theme.skupa} tekst={`Skupa ${kwh(p.dosad.vt)}`} />
          <Oznaka boja={theme.jeftina} tekst={`Jeftina ${kwh(p.dosad.mt)}`} />
        </div>
        <p className="text-xs text-gray-500 mt-1">Iznos je sa PDV-om i uključuje cijeli fiksni dio računa.</p>

        <div className="border-t border-gray-100 mt-3 pt-3">
          <p className="text-xs text-gray-500">Procjena za cijeli mjesec{p.gruba ? ' (gruba)' : ''}</p>
          <div className="flex items-baseline justify-between gap-2 tabular-nums">
            <span className="text-2xl font-bold text-gray-900">≈ {kwh(p.projekcija.kwh)}</span>
            <span className="text-lg font-semibold text-gray-800">≈ {km(p.projekcija.km)}</span>
          </div>
          <p className="mt-1"><ZonaMjeseca zona={p.projekcija.zona} /></p>
        </div>

        <div className="mt-3">
          <TrakaCilja p={p} />
        </div>
      </Kartica>

      <Kartica naslov={`Cilj: ispod ${kwh(p.cilj)}`}>
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${p.ispodCilja ? 'text-green-800' : 'text-red-800'}`}>
          {p.ispodCilja ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> : <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />}
          {p.ispodCilja
            ? `Ovim tempom ostaješ ${kwh(p.cilj - p.projekcija.kwh)} ispod cilja`
            : `Ovim tempom prelaziš cilj za ${kwh(p.projekcija.kwh - p.cilj)}`}
        </p>
        <dl className="text-sm tabular-nums mt-2 space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Trenutni prosjek</dt>
            <dd className="font-semibold text-gray-900">{p.kwhNaDan.toLocaleString('de-DE')} kWh/dan</dd>
          </div>
          {p.dozvoljenoNaDan !== null && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">Do kraja mjeseca smiješ</dt>
              <dd className="font-semibold text-gray-900">{p.dozvoljenoNaDan.toLocaleString('de-DE')} kWh/dan</dd>
            </div>
          )}
          {p.datumPrelaska && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">1.500 kWh stiže oko</dt>
              <dd className="font-semibold text-gray-900">{datumIspis(p.datumPrelaska)}</dd>
            </div>
          )}
          {p.prosleGodineKwh !== null && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">Isti mjesec prošle godine</dt>
              <dd className="font-semibold text-gray-900">{kwh(p.prosleGodineKwh)}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-gray-500 mt-2">
          Procjena pretpostavlja isti dnevni tempo do kraja mjeseca, pa hladniji dani mogu povećati potrošnju.
        </p>
      </Kartica>

      {p.prije.length > 0 && (
        <Kartica naslov="Mjeseci bez uvezenog računa (procjena)">
          <ul className="text-sm tabular-nums space-y-1">
            {p.prije.map((m) => (
              <li key={m.mjesec} className="flex justify-between gap-3">
                <span className="text-gray-700">
                  {mjesecGodina(m.mjesec)}
                  {!m.cijeliMjesec && <span className="block text-xs text-gray-500">zadnjih {m.dana} dana</span>}
                </span>
                <span className="text-right text-gray-900">
                  <span className="font-semibold">≈ {kwh(m.kwh)}</span>
                  {m.cijeliMjesec && <span className="block text-xs text-gray-500">≈ {km(m.km)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Kartica>
      )}
    </div>
  );
}

export function ProcjenaPotrosnje() {
  const [stanje, setStanje] = useState<StanjeProcjene | null>(null);
  const [datum, setDatum] = useState(danasLokalno);
  const [skupa, setSkupa] = useState('');
  const [jeftina, setJeftina] = useState('');
  const [greska, setGreska] = useState('');
  const [upozorenja, setUpozorenja] = useState<string[]>([]);
  const [zauzeto, setZauzeto] = useState(false);

  useEffect(() => {
    ucitajProcjenu()
      .then(setStanje)
      .catch((err: Error) => setGreska(err.message));
  }, []);

  const posalji = async (e: React.FormEvent) => {
    e.preventDefault();
    const vt = parsirajStanje(skupa);
    const mt = parsirajStanje(jeftina);
    if (!Number.isFinite(vt) || !Number.isFinite(mt)) {
      setGreska('Unesi oba stanja kao brojeve.');
      return;
    }
    setZauzeto(true);
    setGreska('');
    setUpozorenja([]);
    try {
      const novo = await sacuvajOcitanje({ datum, vt, mt });
      setStanje(novo);
      setUpozorenja(novo.upozorenja ?? []);
      setSkupa('');
      setJeftina('');
    } catch (err) {
      setGreska(err instanceof Error ? err.message : 'Greška pri upisu');
    } finally {
      setZauzeto(false);
    }
  };

  const obrisi = async (id: number, datumOcitanja: string) => {
    if (!window.confirm(`Obrisati očitanje od ${datumIspis(datumOcitanja)}?`)) return;
    setGreska('');
    try {
      setStanje(await obrisiOcitanje(id));
    } catch (err) {
      setGreska(err instanceof Error ? err.message : 'Greška pri brisanju');
    }
  };

  const poljeKlase = 'w-full px-3 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#785E9E] tabular-nums';
  const z = stanje?.zadnjePoznato;

  return (
    <div className="space-y-3">
      <Kartica naslov="Stanje sa brojila">
        <form onSubmit={posalji} className="space-y-3">
          <div>
            <label htmlFor="datum" className="block text-sm font-medium text-gray-700 mb-1">Datum očitanja</label>
            <input id="datum" type="date" value={datum} max={danasLokalno()} onChange={(e) => setDatum(e.target.value)} className={poljeKlase} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="skupa" className="block text-sm font-medium text-gray-700 mb-1">Skupa (AVT)</label>
              <input id="skupa" type="text" inputMode="decimal" autoComplete="off" value={skupa} onChange={(e) => setSkupa(e.target.value)} className={poljeKlase} required />
            </div>
            <div>
              <label htmlFor="jeftina" className="block text-sm font-medium text-gray-700 mb-1">Jeftina (AMT)</label>
              <input id="jeftina" type="text" inputMode="decimal" autoComplete="off" value={jeftina} onChange={(e) => setJeftina(e.target.value)} className={poljeKlase} required />
            </div>
          </div>
          {z && (
            <p className="text-xs text-gray-500 tabular-nums">
              Zadnje poznato ({datumIspis(z.datum)}): skupa {cijeliBroj(z.vt)}, jeftina {cijeliBroj(z.mt)}
            </p>
          )}
          {greska && <p className="bg-red-50 text-red-800 rounded-xl px-3 py-2.5 text-sm">{greska}</p>}
          {upozorenja.map((u) => (
            <p key={u} className="bg-amber-50 text-amber-900 rounded-xl px-3 py-2.5 text-sm">{u}</p>
          ))}
          <button
            type="submit"
            disabled={zauzeto}
            className="w-full text-white font-semibold py-3 rounded-xl disabled:opacity-60 active:opacity-80"
            style={{ backgroundColor: theme.primary }}
          >
            {zauzeto ? 'Računam...' : 'Izračunaj procjenu'}
          </button>
        </form>
      </Kartica>

      {stanje?.procjena?.nedostajePocetak && (
        <p className="bg-amber-50 text-amber-900 rounded-xl px-3 py-2.5 text-sm">
          Nema poznatog stanja brojila prije {mjesecGodina(stanje.procjena.mjesec).toLowerCase()}. Uvezi račun za prethodni mjesec.
        </p>
      )}
      {stanje?.procjena && !stanje.procjena.nedostajePocetak && <RezultatProcjene p={stanje.procjena} />}

      {stanje && stanje.ocitanja.length > 0 && (
        <Kartica naslov="Upisana očitanja">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left font-normal pb-1">Datum</th>
                <th className="text-right font-normal pb-1">Skupa</th>
                <th className="text-right font-normal pb-1">Jeftina</th>
                <th className="w-9 pb-1"><span className="sr-only">Brisanje</span></th>
              </tr>
            </thead>
            <tbody>
              {stanje.ocitanja.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 text-gray-900">
                  <td>{datumIspis(o.datum)}</td>
                  <td className="text-right">{cijeliBroj(o.vt)}</td>
                  <td className="text-right">{cijeliBroj(o.mt)}</td>
                  <td className="text-right">
                    <button type="button" onClick={() => obrisi(o.id, o.datum)} aria-label={`Obriši očitanje od ${datumIspis(o.datum)}`} className="p-2 -mr-2 text-gray-500">
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kartica>
      )}
    </div>
  );
}
