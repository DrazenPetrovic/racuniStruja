import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Send, Trash2 } from 'lucide-react';
import type { Procjena, StanjeProcjene } from '../types';
import { theme, zonaPoKljucu } from '../theme';
import { obrisiOcitanje, posaljiStanjeEmailom, sacuvajOcitanje, ucitajProcjenu } from '../utils/api';
import { cijeliBroj, datumIspis, decimalni, km, kwh, mjesecGodina } from '../utils/format';
import { Kartica, Oznaka, ZonaMjeseca } from './Kartica';
import { GrafikTokMjeseca, KretanjeKartica } from './KretanjePotrosnje';

const SKALA_KWH = 2000;

// Polje za jednu tarifu u njenoj boji, sa zadnjim poznatim stanjem ispod
function PoljeTarife({ id, naziv, oznaka, boja, vrijednost, promijeni, zadnje }: {
  id: string;
  naziv: string;
  oznaka: string;
  boja: string;
  vrijednost: string;
  promijeni: (v: string) => void;
  zadnje?: number;
}) {
  return (
    <div className="rounded-xl p-2.5 border-l-4" style={{ borderColor: boja, backgroundColor: `${boja}14` }}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-1">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: boja }} aria-hidden />
        {naziv} <span className="font-normal text-gray-600">({oznaka})</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={vrijednost}
        onChange={(e) => promijeni(e.target.value)}
        className="w-full px-3 py-2.5 text-base bg-white border-2 rounded-xl focus:outline-none tabular-nums"
        style={{ borderColor: boja }}
        aria-describedby={zadnje !== undefined ? `${id}-zadnje` : undefined}
        required
      />
      {zadnje !== undefined && (
        <p id={`${id}-zadnje`} className="text-xs text-gray-600 mt-1 tabular-nums">
          Zadnje: <span className="font-semibold text-gray-900">{cijeliBroj(zadnje)}</span>
        </p>
      )}
    </div>
  );
}

const datumIVrijeme = (datum: string, vrijeme: string | null) => (vrijeme ? `${datumIspis(datum)} u ${vrijeme}` : datumIspis(datum));

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

const ZVANICNI_PRIMALAC = 'callcentar@elektrokrajina.com';

// Salje zadnje upisano ocitanje Elektrokrajini, uz potvrdu prije slanja
function SlanjeStanja({ stanje }: { stanje: StanjeProcjene }) {
  const [salje, setSalje] = useState(false);
  const [otvoren, setOtvoren] = useState(false);
  const [poruka, setPoruka] = useState<{ uspjeh: boolean; tekst: string } | null>(null);
  const zadnje = stanje.ocitanja[0];
  const s = stanje.slanje;
  if (!zadnje || !s) return null;

  const test = s.primalac !== ZVANICNI_PRIMALAC;
  const opis = datumIVrijeme(zadnje.datum, zadnje.vrijeme);

  const posalji = async () => {
    setSalje(true);
    setPoruka(null);
    try {
      const { primalac } = await posaljiStanjeEmailom(zadnje.id);
      setPoruka({ uspjeh: true, tekst: `Stanje od ${opis} je poslano na ${primalac}.` });
    } catch (err) {
      setPoruka({ uspjeh: false, tekst: err instanceof Error ? err.message : 'Email nije poslan' });
    } finally {
      setSalje(false);
      setOtvoren(false);
    }
  };

  return (
    <Kartica naslov="Slanje stanja Elektrokrajini">
      {!s.podeseno ? (
        <p className="text-sm text-gray-600">Slanje emaila nije podešeno na serveru (podaci u .env).</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 tabular-nums">
            Šalje se zadnje očitanje ({opis}): AVT <span className="font-semibold">{cijeliBroj(zadnje.vt)}</span>, AMT{' '}
            <span className="font-semibold">{cijeliBroj(zadnje.mt)}</span>
          </p>
          <p className="text-xs text-gray-500">Na: {s.primalac}</p>
          {test && (
            <p className="bg-amber-50 text-amber-900 rounded-xl px-3 py-2 text-xs">Test način: email ne ide u Elektrokrajinu.</p>
          )}
          {poruka && (
            <p className={`rounded-xl px-3 py-2.5 text-sm ${poruka.uspjeh ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{poruka.tekst}</p>
          )}
          {!s.dozvoljeno && (
            <p className="bg-gray-100 text-gray-700 rounded-xl px-3 py-2 text-xs">
              Slanje je moguće samo od {s.period.od}. u mjesecu do {s.period.do}. u sljedećem mjesecu.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setPoruka(null);
              setOtvoren(true);
            }}
            disabled={salje || !s.dozvoljeno}
            className="w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl border-2 disabled:opacity-60 active:opacity-80"
            style={{ borderColor: theme.primary, color: theme.primary }}
          >
            <Send className="w-4 h-4" aria-hidden />
            Pošalji stanje Elektrokrajini
          </button>
        </div>
      )}
      {otvoren && (
        <PotvrdaSlanja
          primalac={s.primalac ?? ''}
          test={test}
          brojBrojila={s.brojBrojila}
          opis={opis}
          vt={zadnje.vt}
          mt={zadnje.mt}
          salje={salje}
          onPotvrdi={posalji}
          onOdustani={() => setOtvoren(false)}
        />
      )}
    </Kartica>
  );
}

// Modal na sredini ekrana sa upozorenjem prije slanja emaila
function PotvrdaSlanja({ primalac, test, brojBrojila, opis, vt, mt, salje, onPotvrdi, onOdustani }: {
  primalac: string;
  test: boolean;
  brojBrojila: string | null;
  opis: string;
  vt: number;
  mt: number;
  salje: boolean;
  onPotvrdi: () => void;
  onOdustani: () => void;
}) {
  const odustaniRef = useRef<HTMLButtonElement>(null);

  // Pri otvaranju: fokus na "Odustani" i stranica ispod se ne pomjera
  useEffect(() => {
    odustaniRef.current?.focus();
    const prijePomjeranja = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prijePomjeranja;
    };
  }, []);

  useEffect(() => {
    const naTipku = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salje) onOdustani();
    };
    window.addEventListener('keydown', naTipku);
    return () => window.removeEventListener('keydown', naTipku);
  }, [salje, onOdustani]);

  const stanjeRed = (oznaka: string, naziv: string, vrijednost: number, boja: string) => (
    <div className="flex items-center justify-between rounded-xl px-3 py-2.5 border-l-4" style={{ borderColor: boja, backgroundColor: `${boja}14` }}>
      <span className="text-sm text-gray-700">{naziv} <span className="font-semibold">({oznaka})</span></span>
      <span className="text-2xl font-bold text-gray-900 tabular-nums">{cijeliBroj(vrijednost)}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => !salje && onOdustani()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="potvrda-naslov"
        aria-describedby="potvrda-opis"
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="w-6 h-6 shrink-0" aria-hidden />
          <h2 id="potvrda-naslov" className="text-lg font-bold text-gray-900">Poslati stanje brojila?</h2>
        </div>
        <p id="potvrda-opis" className="text-sm text-gray-700">
          Email se šalje odmah i ne može se povući. Provjeri stanja prije slanja.
        </p>

        <div className="space-y-2">
          {stanjeRed('AVT', 'Skupa', vt, theme.skupa)}
          {stanjeRed('AMT', 'Jeftina', mt, theme.jeftina)}
        </div>

        <dl className="text-sm space-y-0.5">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Brojilo</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{brojBrojila}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Očitanje</dt>
            <dd className="text-gray-900">{opis}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500 shrink-0">Primalac</dt>
            <dd className="text-gray-900 break-all text-right">{primalac}</dd>
          </div>
        </dl>

        {test && (
          <p className="bg-amber-50 text-amber-900 rounded-xl px-3 py-2 text-xs">Test način: email ne ide u Elektrokrajinu.</p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            ref={odustaniRef}
            type="button"
            onClick={onOdustani}
            disabled={salje}
            className="py-3 rounded-xl font-semibold text-gray-800 bg-gray-100 disabled:opacity-60 active:opacity-80"
          >
            Odustani
          </button>
          <button
            type="button"
            onClick={onPotvrdi}
            disabled={salje}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-60 active:opacity-80"
            style={{ backgroundColor: theme.primary }}
          >
            <Send className="w-4 h-4" aria-hidden />
            {salje ? 'Šaljem...' : 'Pošalji'}
          </button>
        </div>
      </div>
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
            Zadnje poznato stanje prije ovog mjeseca je od {datumIspis(p.pocetak.datum)} Od tada je potrošeno {kwh(p.raspon.kwh)} za {decimalni(p.raspon.dana)} dana.
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

      <Kartica naslov={`${mjesecGodina(p.mjesec)}, stanje ${datumIVrijeme(p.datumOcitanja, p.vrijemeOcitanja)}`}>
        <p className="text-xs text-gray-500">Potrošeno dosad ({decimalni(p.dana)} od {p.uMjesecu} dana)</p>
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

        {p.tok.length > 0 && (
          <div className="border-t border-gray-100 mt-3 pt-3">
            <GrafikTokMjeseca p={p} />
          </div>
        )}
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
                  {!m.cijeliMjesec && <span className="block text-xs text-gray-500">zadnjih {decimalni(m.dana)} dana</span>}
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
      const novo = await sacuvajOcitanje({ vt, mt });
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

  const obrisi = async (id: number, opis: string) => {
    if (!window.confirm(`Obrisati očitanje ${opis}?`)) return;
    setGreska('');
    try {
      setStanje(await obrisiOcitanje(id));
    } catch (err) {
      setGreska(err instanceof Error ? err.message : 'Greška pri brisanju');
    }
  };

  const z = stanje?.zadnjePoznato;

  return (
    <div className="space-y-3">
      <Kartica naslov="Stanje sa brojila">
        <form onSubmit={posalji} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <PoljeTarife id="skupa" naziv="Skupa" oznaka="AVT" boja={theme.skupa} vrijednost={skupa} promijeni={setSkupa} zadnje={z?.vt} />
            <PoljeTarife id="jeftina" naziv="Jeftina" oznaka="AMT" boja={theme.jeftina} vrijednost={jeftina} promijeni={setJeftina} zadnje={z?.mt} />
          </div>
          {z && (
            <p className="text-xs text-gray-500">
              Zadnje očitanje: {datumIVrijeme(z.datum, z.vrijeme)}{z.izRacuna ? ' (sa računa)' : ''}
            </p>
          )}
          <p className="text-xs text-gray-500">Datum i vrijeme očitanja se upisuju sami, u trenutku kad pritisneš dugme.</p>
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

      {stanje && <SlanjeStanja stanje={stanje} />}

      {stanje?.procjena?.nedostajePocetak && (
        <p className="bg-amber-50 text-amber-900 rounded-xl px-3 py-2.5 text-sm">
          Nema poznatog stanja brojila prije {mjesecGodina(stanje.procjena.mjesec).toLowerCase()}. Uvezi račun za prethodni mjesec.
        </p>
      )}
      {stanje?.procjena && !stanje.procjena.nedostajePocetak && <RezultatProcjene p={stanje.procjena} />}

      {stanje?.kretanje && stanje.ocitanja.length > 0 && <KretanjeKartica k={stanje.kretanje} />}

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
                  <td>
                    {datumIspis(o.datum)}
                    {o.vrijeme && <span className="text-gray-500"> {o.vrijeme}</span>}
                  </td>
                  <td className="text-right">{cijeliBroj(o.vt)}</td>
                  <td className="text-right">{cijeliBroj(o.mt)}</td>
                  <td className="text-right">
                    <button type="button" onClick={() => obrisi(o.id, datumIVrijeme(o.datum, o.vrijeme))} aria-label={`Obriši očitanje ${datumIVrijeme(o.datum, o.vrijeme)}`} className="p-2 -mr-2 text-gray-500">
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
