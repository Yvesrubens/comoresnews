import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRow } from '../build/lib/supabase-source.mjs';

test('mapRow convertit une ligne DB en article de la forme attendue', () => {
  const row = {
    titre: 'T', slug: 's', categorie: 'sport', corps: '# Hi', excerpt: 'e',
    image_couverture: 'medias/a.webp', seo_titre: 'S', seo_description: 'D',
    og_image: 'medias/og.webp', mots_cles: ['a', 'b'], statut: 'publie',
    date_publication: '2026-06-12T10:00:00Z',
    profiles: { nom: 'Comoresnews' },
  };
  const a = mapRow(row);
  assert.equal(a.title, 'T');
  assert.equal(a.category, 'sport');
  assert.equal(a.author, 'Comoresnews');
  assert.equal(a.date, '2026-06-12');
  assert.equal(a.image, 'medias/a.webp');
  assert.equal(a.status, 'published');
  assert.deepEqual(a.keywords, ['a', 'b']);
  assert.equal(a.body, '# Hi');
  assert.equal(a.seoTitle, 'S');
  assert.equal(a.seoDescription, 'D');
  assert.equal(a.ogImage, 'medias/og.webp');
});

test('mapRow: auteur par défaut si profiles absent', () => {
  const a = mapRow({ titre: 'T', slug: 's', categorie: 'monde', statut: 'brouillon', cree_le: '2026-01-01T00:00:00Z' });
  assert.equal(a.author, 'Comoresnews');
  assert.equal(a.status, 'draft');
  assert.deepEqual(a.keywords, []);
});

test('mapRow: statut programme -> scheduled, date depuis date_programmee', () => {
  const a = mapRow({ titre: 'T', slug: 's', categorie: 'monde', statut: 'programme', date_programmee: '2026-09-01T08:00:00Z' });
  assert.equal(a.status, 'scheduled');
  assert.equal(a.date, '2026-09-01');
});
