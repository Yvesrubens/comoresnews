import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, articleUrl, imageUploadPath, buildFrontmatter, validateArticle } from '../admin/lib.mjs';

test('slugify', () => {
  assert.equal(slugify('La Vanille d’Anjouan : trésor !'), 'la-vanille-danjouan-tresor');
  assert.equal(slugify('  Éléphant   blanc '), 'elephant-blanc');
});
test('articleUrl', () => {
  assert.equal(articleUrl('2026-07-08', 'mon-slug'), 'index.php/2026/07/08/mon-slug/index.html');
});
test('imageUploadPath slugifie le nom', () => {
  assert.equal(imageUploadPath('2026-07-08', 'Ma Photo.PNG'), 'wp-content/uploads/2026/07/ma-photo.png');
});
test('buildFrontmatter contient les champs et le corps', () => {
  const s = buildFrontmatter({ title:'T"itre', slug:'s', category:'sport', author:'A', date:'2026-07-08', image:'wp-content/x.png', excerpt:'e', body:'Corps.' });
  assert.match(s, /^---\n/);
  assert.match(s, /category: sport/);
  assert.match(s, /status: published/);
  assert.match(s, /\n\nCorps\.\n?$/);
});
test('validateArticle', () => {
  assert.equal(validateArticle({ title:'', slug:'s', category:'sport', body:'b' }).ok, false);
  assert.equal(validateArticle({ title:'T', slug:'bad slug', category:'sport', body:'b' }).ok, false);
  assert.equal(validateArticle({ title:'T', slug:'ok-slug', category:'sport', body:'b' }).ok, true);
});
