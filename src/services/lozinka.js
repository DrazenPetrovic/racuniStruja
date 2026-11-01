import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const DUZINA_KLJUCA = 64;

export const napraviHash = async (lozinka) => {
  const so = randomBytes(16).toString('hex');
  const kljuc = await scryptAsync(lozinka, so, DUZINA_KLJUCA);
  return `${so}:${kljuc.toString('hex')}`;
};

export const provjeriLozinku = async (lozinka, hash) => {
  const [so, ocekivano] = hash.split(':');
  if (!so || !ocekivano) return false;
  const kljuc = await scryptAsync(lozinka, so, DUZINA_KLJUCA);
  const ocekivaniKljuc = Buffer.from(ocekivano, 'hex');
  return ocekivaniKljuc.length === kljuc.length && timingSafeEqual(ocekivaniKljuc, kljuc);
};
