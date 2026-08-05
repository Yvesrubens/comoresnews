import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articlePath, categoryPath, relPrefix, resolveImg } from '../build/lib/paths.mjs';

test('articlePath', () => {
  assert.equal(articlePath('2026-06-12','vanille'), 'index.php/2026/06/12/vanille/index.html');
});
test('categoryPath', () => {
  assert.equal(categoryPath('sport'), 'index.php/category/sport/index.html');
});
test('relPrefix racine', () => {
  assert.equal(relPrefix('index.html'), '');
});
test('relPrefix article (5 niveaux)', () => {
  assert.equal(relPrefix('index.php/2026/06/12/vanille/index.html'), '../../../../../');
});
test('relPrefix categorie (3 niveaux)', () => {
  assert.equal(relPrefix('index.php/category/sport/index.html'), '../../../');
});
test('resolveImg préfixe un chemin relatif', () => {
  assert.equal(resolveImg('../../', 'wp-content/uploads/x.png'), '../../wp-content/uploads/x.png');
});
test('resolveImg laisse une URL absolue intacte', () => {
  assert.equal(resolveImg('../../', 'https://x.supabase.co/storage/v1/object/public/medias/x.png'),
    'https://x.supabase.co/storage/v1/object/public/medias/x.png');
});
test('resolveImg vide si pas d image', () => {
  assert.equal(resolveImg('../', ''), '');
});
