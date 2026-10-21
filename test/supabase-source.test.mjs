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

test('mapRow propage la source (nom + lien)', () => {
  const a = mapRow({ titre: 'T', slug: 's', categorie: 'monde', statut: 'publie', date_publication: '2026-10-20T00:00:00Z',
    source_nom: 'Masiwa', source_url: 'https://masiwa-comores.com/x/' });
  assert.equal(a.sourceNom, 'Masiwa');
  assert.equal(a.sourceUrl, 'https://masiwa-comores.com/x/');
  const b = mapRow({ titre: 'T', slug: 's', categorie: 'monde', statut: 'publie', date_publication: '2026-10-20T00:00:00Z' });
  assert.equal(b.sourceNom, '');
  assert.equal(b.sourceUrl, '');
});

test('mapRow expose la case à la une et l’horodatage complet', async () => {
  const base = { titre: 'T', slug: 's', categorie: 'sport', statut: 'publie', date_publication: '2026-10-21T08:30:00Z' };
  assert.equal(mapRow({ ...base, a_la_une: true }).aLaUne, true);
  assert.equal(mapRow(base).aLaUne, false);
  assert.equal(mapRow(base).publishedAt, '2026-10-21T08:30:00Z');
});

test('loadBreves renvoie les brèves publiées, ou [] en cas d’erreur', async () => {
  const { loadBreves } = await import('../build/lib/supabase-source.mjs');
  const appels = [];
  const fake = (res) => {
    const q = { select: (c) => (appels.push(['select', c]), q), eq: (k, v) => (appels.push(['eq', k, v]), q),
      order: (k, o) => (appels.push(['order', k, o]), q), limit: (n) => (appels.push(['limit', n]), Promise.resolve(res)) };
    return { from: (t) => (appels.push(['from', t]), q) };
  };
  const rows = [{ id: '1', texte: 'A', date_publication: '2026-10-21T08:00:00Z' }, { id: '2', texte: 'B', date_publication: '2026-10-20T08:00:00Z' }];
  const r = await loadBreves(fake({ data: rows, error: null }));
  assert.deepEqual(r, [{ id: '1', texte: 'A', publishedAt: '2026-10-21T08:00:00Z' }, { id: '2', texte: 'B', publishedAt: '2026-10-20T08:00:00Z' }]);
  assert.ok(appels.some((a) => a[0] === 'from' && a[1] === 'breves'));
  assert.ok(appels.some((a) => a[0] === 'eq' && a[1] === 'statut' && a[2] === 'publie'));
  assert.ok(appels.some((a) => a[0] === 'limit' && a[1] === 30));
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual(await loadBreves(fake({ data: null, error: { message: 'x' } })), []); } finally { console.warn = warn; }
});
