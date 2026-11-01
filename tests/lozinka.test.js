import test from 'node:test';
import assert from 'node:assert/strict';
import { napraviHash, provjeriLozinku } from '../src/services/lozinka.js';

test('ispravna lozinka prolazi, pogresna ne', async () => {
  const hash = await napraviHash('moja-duga-lozinka');
  assert.equal(await provjeriLozinku('moja-duga-lozinka', hash), true);
  assert.equal(await provjeriLozinku('pogresna', hash), false);
});

test('ista lozinka daje razlicit hash', async () => {
  assert.notEqual(await napraviHash('lozinka123'), await napraviHash('lozinka123'));
});

test('neispravan hash iz .env ne dozvoljava prijavu', async () => {
  assert.equal(await provjeriLozinku('lozinka123', 'OVDJE_UPISITE_HASH_LOZINKE'), false);
  assert.equal(await provjeriLozinku('lozinka123', 'abcd:ef'), false);
});
