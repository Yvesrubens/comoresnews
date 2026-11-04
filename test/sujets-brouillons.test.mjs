import test from 'node:test';
import assert from 'node:assert/strict';
import { concerneComores, brouillonDepuisSujet, sujetsAConvertir } from '../scripts/lib/sujets-brouillons.mjs';

test('concerneComores : noms du pays, des îles, des villes, du président, de la langue', () => {
  for (const t of ['Les Comores et la France', 'Le gouvernement comorien', 'une Comorienne primée', 'Grève à Moroni',
    'Anjouan : coupure', 'Moheli sans eau', 'Mohéli sans eau', 'Ngazidja', 'Ndzuani', 'Mwali', 'Mayotte : visas', 'Maore',
    'Port de Mutsamudu', 'Fomboni', 'Le président Azali', 'cours de shikomori', '100 000 francs comoriens']) {
    assert.equal(concerneComores(t), true, t);
  }
});

test('concerneComores : sujets sans lien avec les Comores écartés', () => {
  for (const t of ['Début de la COP 17 sur la biodiversité à Erevan', 'La Plume de Senghor en demi-finale', '']) {
    assert.equal(concerneComores(t), false, t);
  }
  assert.equal(concerneComores(null), false);
});

test('brouillonDepuisSujet : brouillon vide, catégorie devinée ou Société, source renseignée', () => {
  const s = { id: 's1', titre: 'Grève des enseignants à Moroni', categorie: 'politique', source_nom: 'Masiwa', url: 'https://masiwa-comores.com/a' };
  assert.deepEqual(brouillonDepuisSujet(s, 'auteur-1', new Set()), {
    titre: 'Grève des enseignants à Moroni', slug: 'greve-des-enseignants-a-moroni', categorie: 'politique',
    auteur_id: 'auteur-1', corps: '', statut: 'brouillon', source_nom: 'Masiwa', source_url: 'https://masiwa-comores.com/a',
  });
  assert.equal(brouillonDepuisSujet({ ...s, categorie: null }, 'a', new Set()).categorie, 'societe');
});

test('brouillonDepuisSujet : slug déjà pris → suffixe', () => {
  const s = { id: 's1', titre: 'Moroni', categorie: 'societe', source_nom: 'X', url: 'https://x.km/a' };
  const pris = new Set(['moroni', 'moroni-2']);
  assert.equal(brouillonDepuisSujet(s, 'a', pris).slug, 'moroni-3');
});

test('sujetsAConvertir : nouveaux, non liés, des 7 derniers jours, concernant les Comores', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const rows = [
    { id: 'a', statut: 'nouveau', article_id: null, importe_le: '2026-11-03T08:00:00Z', titre: 'Moroni', texte: '' },
    { id: 'b', statut: 'nouveau', article_id: null, importe_le: '2026-10-20T08:00:00Z', titre: 'Moroni', texte: '' },
    { id: 'c', statut: 'traite', article_id: 'x', importe_le: '2026-11-03T08:00:00Z', titre: 'Moroni', texte: '' },
    { id: 'd', statut: 'nouveau', article_id: null, importe_le: '2026-11-03T08:00:00Z', titre: 'COP 17 à Erevan', texte: 'biodiversité' },
    { id: 'e', statut: 'nouveau', article_id: null, importe_le: '2026-11-02T08:00:00Z', titre: 'Grève', texte: 'à Anjouan' },
    { id: 'f', statut: 'ignore', article_id: null, importe_le: '2026-11-03T08:00:00Z', titre: 'Moroni', texte: '' },
  ];
  assert.deepEqual(sujetsAConvertir(rows, now).map((r) => r.id), ['a', 'e']);
});

test('le bloc « Ailleurs sur le web » a disparu du site', async () => {
  const fs = await import('node:fs');
  const gen = fs.readFileSync(new URL('../build/generate.mjs', import.meta.url), 'utf8');
  assert.ok(!/ailleurs|loadLatestSujets/i.test(gen));
  assert.equal(fs.existsSync(new URL('../build/lib/ailleurs.mjs', import.meta.url)), false);
});
