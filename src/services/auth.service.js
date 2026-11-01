import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { provjeriLozinku } from './lozinka.js';

// Aplikacija je javno dostupna, pa se prijava privremeno blokira nakon niza pogresnih pokusaja
const MAKS_POKUSAJA = 10;
const TRAJANJE_BLOKADE_MS = 15 * 60 * 1000;

let neuspjeliPokusaji = 0;
let blokiranoDo = 0;

export const login = async (username, password) => {
  if (Date.now() < blokiranoDo) return { success: false, blokirano: true };

  const ispravnaLozinka = await provjeriLozinku(password, env.APP_PASSWORD_HASH);

  if (username !== env.APP_USERNAME || !ispravnaLozinka) {
    neuspjeliPokusaji += 1;
    if (neuspjeliPokusaji >= MAKS_POKUSAJA) {
      blokiranoDo = Date.now() + TRAJANJE_BLOKADE_MS;
      neuspjeliPokusaji = 0;
    }
    return { success: false };
  }

  neuspjeliPokusaji = 0;
  const token = jwt.sign({ username }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  return { success: true, token, user: { username } };
};
