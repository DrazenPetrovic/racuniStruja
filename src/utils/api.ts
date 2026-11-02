import type { Evidencija, StanjeProcjene } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3011';
const TOKEN_KLJUC = 'authToken';

export const DOGADJAJ_ODJAVA = 'struja-odjava';

export const getAuthToken = () => localStorage.getItem(TOKEN_KLJUC);

export const signOut = () => {
  localStorage.removeItem(TOKEN_KLJUC);
  window.dispatchEvent(new Event(DOGADJAJ_ODJAVA));
};

export class ApiGreska extends Error {
  detalji: string[];

  constructor(poruka: string, detalji: string[] = []) {
    super(poruka);
    this.detalji = detalji;
  }
}

const apiFetch = async (putanja: string, options: RequestInit = {}, timeoutMs = 15000) => {
  const token = getAuthToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${putanja}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiGreska('Server nije dostupan. Provjeri internet vezu.');
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    signOut();
    throw new ApiGreska('Prijava je istekla. Prijavi se ponovo.');
  }
  if (!response.ok) {
    throw new ApiGreska(data.message || 'Greška pri obradi zahtjeva', data.detalji);
  }
  return data;
};

export const signIn = async (username: string, password: string) => {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem(TOKEN_KLJUC, data.token);
};

export const ucitajEvidenciju = (): Promise<Evidencija> => apiFetch('/api/racuni');

export const uveziRacun = (fajl: File): Promise<{ status: 'dodan' | 'postoji'; mjesec: string }> =>
  apiFetch(
    '/api/racuni',
    { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: fajl },
    60000,
  );

export const ucitajProcjenu = (): Promise<StanjeProcjene> => apiFetch('/api/ocitanja');

export const sacuvajOcitanje = (ocitanje: { datum: string; vt: number; mt: number }): Promise<StanjeProcjene> =>
  apiFetch('/api/ocitanja', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ocitanje),
  });

export const obrisiOcitanje = (id: number): Promise<StanjeProcjene> =>
  apiFetch(`/api/ocitanja/${id}`, { method: 'DELETE' });

export const obrisiMjesec = (id: number) => apiFetch(`/api/racuni/${id}`, { method: 'DELETE' });
