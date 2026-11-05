import test from 'node:test';
import assert from 'node:assert/strict';
import { aRemplir, miseAJour } from '../scripts/iles/lib.mjs';

const mots = (n) => Array.from({ length: n }, (_, i) => 'm' + i).join(' ');

test('aRemplir : seulement publiés sans île, extrait de 120 mots', () => {
  const rows = [
    { id: 'a', titre: 'A', excerpt: 'ea', corps: mots(200), statut: 'publie', ile: null },
    { id: 'b', titre: 'B', excerpt: 'eb', corps: 'x', statut: 'brouillon', ile: null },
    { id: 'c', titre: 'C', excerpt: 'ec', corps: 'x', statut: 'publie', ile: 'mwali' },
  ];
  const r = aRemplir(rows);
  assert.deepEqual(r.map((x) => x.id), ['a']);
  assert.deepEqual(Object.keys(r[0]).sort(), ['excerpt', 'extrait', 'id', 'titre']);
  assert.equal(r[0].extrait.split(' ').length, 120);
});

test("miseAJour : n'écrase jamais une île existante, ignore null, refuse l'inconnu", () => {
  const rows = [{ id: 'a', ile: null }, { id: 'b', ile: 'mwali' }];
  assert.deepEqual(miseAJour([{ id: 'a', ile: 'ndzuani' }, { id: 'b', ile: 'ngazidja' }, { id: 'c', ile: null }, { id: 'z', ile: 'maore' }], rows), [{ id: 'a', ile: 'ndzuani' }]);
  assert.throws(() => miseAJour([{ id: 'a', ile: 'Anjouan' }], rows), /île inconnue/);
});
