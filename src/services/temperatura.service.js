import { trenutak } from './procjena.js';

// Satne temperature sa Open-Meteo (besplatno, bez kljuca). Salje se samo lokacija.
// Podrazumijevano Banja Luka; moze se promijeniti u .env.
const LAT = Number(process.env.LOKACIJA_LAT || 44.7722);
const LON = Number(process.env.LOKACIJA_LON || 17.191);
const ZONA = 'Europe/Sarajevo';
const VAZI_MS = 3 * 60 * 60 * 1000;
const CEKANJE_MS = 10000;
// Arhiva kasni nekoliko dana, pa zadnje dane daje prognozni servis
const ZADNJIH_DANA = 10;

let kes = null;

const danas = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const pomjeriDan = (datum, dana) => new Date(Date.parse(`${datum}T00:00:00Z`) + dana * 86400000).toISOString().slice(0, 10);

// Kljuc je redni broj sata od 1970, u lokalnom vremenu, kao i trenutak() u procjeni
export const kljucSata = (datum, vrijeme) => Math.round(trenutak(datum, vrijeme) * 24);

const preuzmi = async (url, mapa, pokusaj = 1) => {
  const odgovor = await fetch(url, { signal: AbortSignal.timeout(CEKANJE_MS) });
  // Servis zna kratko vratiti 503, pa se pokusa jos jednom
  if (odgovor.status >= 500 && pokusaj < 2) return preuzmi(url, mapa, pokusaj + 1);
  if (!odgovor.ok) throw new Error(`Open-Meteo ${odgovor.status}`);
  const { hourly } = await odgovor.json();
  hourly.time.forEach((vrijeme, i) => {
    const t = hourly.temperature_2m[i];
    if (t !== null && t !== undefined) mapa.set(kljucSata(vrijeme.slice(0, 10), vrijeme.slice(11, 16)), t);
  });
};

// Vraca Map(kljucSata -> °C) od datuma "od" do danas
export const satneTemperature = async (od) => {
  if (kes && kes.od <= od && Date.now() - kes.vrijeme < VAZI_MS) return kes.mapa;

  const zajedno = `latitude=${LAT}&longitude=${LON}&hourly=temperature_2m&timezone=${encodeURIComponent(ZONA)}`;
  const mapa = new Map();
  try {
    const krajArhive = pomjeriDan(danas(), -1);
    if (od <= krajArhive) {
      await preuzmi(`https://archive-api.open-meteo.com/v1/archive?${zajedno}&start_date=${od}&end_date=${krajArhive}`, mapa);
    }
    await preuzmi(`https://api.open-meteo.com/v1/forecast?${zajedno}&past_days=${ZADNJIH_DANA}&forecast_days=1`, mapa);
  } catch (error) {
    // Bolje stare temperature nego nikakve
    if (kes && kes.od <= od) return kes.mapa;
    throw error;
  }

  kes = { od, vrijeme: Date.now(), mapa };
  return mapa;
};
