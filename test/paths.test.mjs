import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articlePath, categoryPath, relPrefix } from '../build/lib/paths.mjs';

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
