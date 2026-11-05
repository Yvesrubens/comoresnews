import test from 'node:test';
import assert from 'node:assert/strict';
import { ILES, normaliserIle, libelleIle } from '../build/lib/iles.mjs';

test('ILES : 5 îles, libellés exacts', () => {
  assert.deepEqual(Object.keys(ILES), ['ngazidja', 'ndzuani', 'mwali', 'maore', 'diaspora']);
  assert.equal(ILES.maore, 'Maoré');
  assert.ok(Object.isFrozen(ILES));
});

test('normaliserIle : slug valide, vide → null, inconnu → erreur', () => {
  assert.equal(normaliserIle('mwali'), 'mwali');
  assert.equal(normaliserIle(null), null);
  assert.equal(normaliserIle(undefined), null);
  assert.equal(normaliserIle(''), null);
  assert.throws(() => normaliserIle('Anjouan'), /île inconnue : Anjouan/);
  assert.throws(() => normaliserIle('Mwali'), /île inconnue/);
  assert.throws(() => normaliserIle('toString'), /île inconnue/);
});

test('libelleIle', () => {
  assert.equal(libelleIle('ngazidja'), 'Ngazidja');
  assert.equal(libelleIle(null), '');
});
