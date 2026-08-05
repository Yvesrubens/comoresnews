import test from 'node:test';
import assert from 'node:assert/strict';
import { ficheToRow } from '../scripts/migrate-to-supabase.mjs';

test('ficheToRow mappe une fiche vers une ligne articles publiée', () => {
  const a = {
    title: 'T', slug: 's', category: 'sport', author: 'Comoresnews', date: '2026-06-12',
    image: 'wp-content/uploads/x.png', excerpt: 'e', status: 'published', body: '# b',
  };
  const r = ficheToRow(a, 'uid-1');
  assert.equal(r.titre, 'T');
  assert.equal(r.slug, 's');
  assert.equal(r.categorie, 'sport');
  assert.equal(r.statut, 'publie');
  assert.equal(r.auteur_id, 'uid-1');
  assert.equal(r.date_publication.slice(0, 10), '2026-06-12');
  assert.equal(r.seo_description, 'e');
});
