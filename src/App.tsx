import { useCallback, useEffect, useState } from 'react';
import { BarChart3, CalendarDays, FileText, Gauge, LogOut, Plus, Zap } from 'lucide-react';
import type { Evidencija } from './types';
import { theme } from './theme';
import { DOGADJAJ_ODJAVA, getAuthToken, signOut, ucitajEvidenciju } from './utils/api';
import { cijeliBroj, datumIspis } from './utils/format';
import { LoginPanel } from './components/LoginPanel';
import { Pregled } from './components/Pregled';
import { MjeseciLista } from './components/MjeseciLista';
import { MjesecDetalj } from './components/MjesecDetalj';
import { ProcjenaPotrosnje } from './components/ProcjenaPotrosnje';
import { UvozPanel } from './components/UvozPanel';

type Kartica = 'pregled' | 'procjena' | 'mjeseci';

// Otvoreni ekran je u istoriji browsera da Android dugme "nazad" zatvori njega, a ne aplikaciju
type Ekran = { vrsta: 'mjesec'; id: number } | { vrsta: 'uvoz' } | null;

const PRAZNA_EVIDENCIJA: Evidencija = { racuni: [], osnovnaPotrosnja: null, sezone: [] };

function Aplikacija() {
  const [evidencija, setEvidencija] = useState<Evidencija>(PRAZNA_EVIDENCIJA);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState('');
  const [kartica, setKartica] = useState<Kartica>('pregled');
  const [ekran, setEkran] = useState<Ekran>(null);
  const { racuni } = evidencija;
  const brojilo = racuni[racuni.length - 1]?.brojilo;

  const osvjezi = useCallback(async () => {
    setGreska('');
    setUcitavanje(true);
    try {
      setEvidencija(await ucitajEvidenciju());
    } catch (err) {
      setGreska(err instanceof Error ? err.message : 'Greška pri učitavanju');
    } finally {
      setUcitavanje(false);
    }
  }, []);

  useEffect(() => {
    osvjezi();
  }, [osvjezi]);

  useEffect(() => {
    const naPovratak = (e: PopStateEvent) => setEkran((e.state as Ekran) ?? null);
    window.addEventListener('popstate', naPovratak);
    return () => window.removeEventListener('popstate', naPovratak);
  }, []);

  const otvori = (novi: Exclude<Ekran, null>) => {
    window.history.pushState(novi, '');
    setEkran(novi);
  };
  const nazad = () => window.history.back();
  const otvoriMjesec = (id: number) => otvori({ vrsta: 'mjesec', id });

  const odabrani = ekran?.vrsta === 'mjesec' ? racuni.find((r) => r.id === ekran.id) : undefined;

  if (odabrani) {
    return (
      <MjesecDetalj
        mjesec={odabrani}
        onNazad={nazad}
        onObrisan={() => {
          nazad();
          osvjezi();
        }}
      />
    );
  }

  const navDugme = (vrijednost: Kartica, tekst: string, Ikona: typeof BarChart3) => (
    <button
      type="button"
      onClick={() => setKartica(vrijednost)}
      aria-current={kartica === vrijednost ? 'page' : undefined}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 h-16 text-xs font-medium"
      style={{ color: kartica === vrijednost ? theme.primary : '#6b7280' }}
    >
      <Ikona className="w-6 h-6" aria-hidden />
      {tekst}
    </button>
  );

  return (
    <div className="min-h-screen">
      <header className="sigurno-gore sticky top-0 z-10 text-white" style={{ backgroundColor: theme.primary }}>
        <div className="flex items-center justify-between pl-4 pr-2 h-14">
          <h1 className="flex items-center gap-2 font-semibold text-lg">
            <Zap className="w-5 h-5" aria-hidden /> Računi Struja
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => otvori({ vrsta: 'uvoz' })}
              aria-label="Uvezi račun"
              className="p-2 rounded-full active:bg-white/20"
            >
              <Plus className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Odjaviti se?')) signOut();
              }}
              aria-label="Odjava"
              className="p-2 rounded-full active:bg-white/20"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        {brojilo?.datum && brojilo.vt !== null && brojilo.mt !== null && (
          <p className="px-4 pb-2 -mt-1 text-xs tabular-nums text-white/90">
            Stanje brojila na {datumIspis(brojilo.datum)} skupa {cijeliBroj(brojilo.vt)} · jeftina {cijeliBroj(brojilo.mt)}
          </p>
        )}
      </header>

      <main className="p-3 max-w-xl mx-auto prostor-za-navigaciju">
        {greska && (
          <div className="bg-red-50 text-red-800 rounded-xl px-4 py-3 text-sm mb-3">
            <p>{greska}</p>
            <button type="button" onClick={osvjezi} className="font-semibold underline mt-1">
              Pokušaj ponovo
            </button>
          </div>
        )}

        {ucitavanje && racuni.length === 0 && !greska && (
          <p className="text-center text-gray-500 py-16">Učitavanje...</p>
        )}

        {!ucitavanje && !greska && racuni.length === 0 && (
          <div className="text-center py-16 px-6">
            <FileText className="w-12 h-12 mx-auto text-gray-400" aria-hidden />
            <p className="font-semibold text-gray-800 mt-3">Još nema uvezenih računa</p>
            <p className="text-sm text-gray-600 mt-1">Uvezi PDF račun i ovdje će se pojaviti potrošnja po zonama i mjesecima.</p>
            <button
              type="button"
              onClick={() => otvori({ vrsta: 'uvoz' })}
              className="mt-4 px-5 py-3 rounded-xl text-white font-semibold active:opacity-80"
              style={{ backgroundColor: theme.primary }}
            >
              Uvezi račun
            </button>
          </div>
        )}

        {racuni.length > 0 && kartica === 'pregled' && (
          <Pregled evidencija={evidencija} onOtvoriMjesec={otvoriMjesec} />
        )}
        {racuni.length > 0 && kartica === 'procjena' && <ProcjenaPotrosnje key={racuni.length} />}
        {racuni.length > 0 && kartica === 'mjeseci' && (
          <MjeseciLista racuni={racuni} onOtvoriMjesec={otvoriMjesec} />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-10 bg-white border-t border-gray-200 sigurno-dolje">
        <div className="flex items-center max-w-xl mx-auto">
          {navDugme('pregled', 'Pregled', BarChart3)}
          {navDugme('procjena', 'Procjena', Gauge)}
          {navDugme('mjeseci', 'Mjeseci', CalendarDays)}
        </div>
      </nav>

      {ekran?.vrsta === 'uvoz' && <UvozPanel onZatvori={nazad} onUvezeno={osvjezi} />}
    </div>
  );
}

export default function App() {
  const [prijavljen, setPrijavljen] = useState(() => getAuthToken() !== null);

  useEffect(() => {
    const naOdjavu = () => setPrijavljen(false);
    window.addEventListener(DOGADJAJ_ODJAVA, naOdjavu);
    return () => window.removeEventListener(DOGADJAJ_ODJAVA, naOdjavu);
  }, []);

  if (!prijavljen) return <LoginPanel onLoginSuccess={() => setPrijavljen(true)} />;
  return <Aplikacija />;
}
