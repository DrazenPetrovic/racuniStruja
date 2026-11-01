// Pravi vrijednost za APP_PASSWORD_HASH u .env fajlu: npm run lozinka
import { createInterface } from 'node:readline/promises';
import { napraviHash } from '../src/services/lozinka.js';

const unos = createInterface({ input: process.stdin, output: process.stdout });
const lozinka = (await unos.question('Nova lozinka: ')).trim();
unos.close();

if (lozinka.length < 10) {
  console.error('Lozinka mora imati najmanje 10 znakova.');
  process.exit(1);
}

console.log(`APP_PASSWORD_HASH=${await napraviHash(lozinka)}`);
