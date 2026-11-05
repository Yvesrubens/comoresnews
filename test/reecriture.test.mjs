import test from 'node:test';
import assert from 'node:assert/strict';
import { reprises, controler, legendePhoto, decouper } from '../scripts/reecriture/lib.mjs';

const POOL = { drapeau: { legende: 'Le drapeau', auteur: 'Cloudcounter', licence: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:F.png', url: 'https://x/f.png' } };
const LIENS = new Set(['/index.php/2026/06/12/vanille/index.html']);
const corps = (n) => Array.from({ length: n }, (_, i) => 'mot' + i).join(' ');
const ok = { article_id: 'a1', titre: 'Titre', excerpt: 'Chapô.', corps: corps(200), categorie: 'societe', photo: 'drapeau' };

test('reprises : compte les suites de 8 mots identiques, hors citations', () => {
  const src = 'le chat noir dort sur le canapé du salon depuis ce matin';
  assert.equal(reprises('Hier, le chat noir dort sur le canapé du salon.', src), 2); // 9 mots communs = 2 suites de 8
  assert.equal(reprises('« le chat noir dort sur le canapé du salon »', src), 0);
  assert.equal(reprises('Un tout autre texte sans rapport aucun avec la source.', src), 0);
});

test('controler : article conforme → aucun problème', () => {
  assert.deepEqual(controler(ok, 'source', { pool: POOL, liens: LIENS }), []);
});

test('controler : signale longueur, lien non autorisé, photo inconnue, catégorie, titre #, copie massive', () => {
  const p = controler({ ...ok, corps: '# Titre\n' + corps(50) + ' [x](https://ailleurs.com)', photo: 'inconnue', categorie: 'faits' }, 'source', { pool: POOL, liens: LIENS });
  assert.ok(p.some((x) => x.startsWith('corps')));
  assert.ok(p.some((x) => x.includes('lien non autorisé')));
  assert.ok(p.some((x) => x.includes('photo inconnue')));
  assert.ok(p.some((x) => x.includes('categorie')));
  assert.ok(p.some((x) => x.includes('#')));
  const long = corps(400);
  assert.ok(controler({ ...ok, corps: long }, long, { pool: POOL, liens: LIENS }).some((x) => x.includes('reprises')));
  assert.deepEqual(controler({ ...ok, corps: corps(150) + ' [vanille](/index.php/2026/06/12/vanille/index.html)', photo: null }, 'x', { pool: POOL, liens: LIENS }), []);
});

test('legendePhoto : auteur, licence, lien Commons ; vide sans photo', () => {
  assert.equal(legendePhoto(POOL.drapeau), "*Photo d'illustration : Le drapeau — Cloudcounter, CC0, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:F.png).*\n\n");
  assert.equal(legendePhoto(null), '');
});

test('decouper : lots de 9 au plus', () => {
  assert.deepEqual(decouper([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 9).map((l) => l.length), [9, 2]);
  assert.deepEqual(decouper([], 9), []);
});

test('controler : ile valide, null ou absente → conforme', () => {
  for (const a of [{ ...ok, ile: 'mwali' }, { ...ok, ile: null }, ok]) {
    assert.deepEqual(controler(a, 'source', { pool: POOL, liens: LIENS }), []);
  }
});

test('controler : ile inconnue signalée', () => {
  assert.ok(controler({ ...ok, ile: 'Anjouan' }, 'source', { pool: POOL, liens: LIENS }).includes('ile Anjouan'));
});
