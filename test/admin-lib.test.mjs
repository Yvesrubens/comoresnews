import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, articleUrl, imageUploadPath, buildFrontmatter, validateArticle,
  validateArticleDB, nextStatus, formToRow } from '../admin/lib.mjs';

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

// ---- CMS Supabase ----
test('validateArticleDB signale les champs manquants/invalides', () => {
  const errs = validateArticleDB({ titre:'', slug:'Bad Slug', categorie:'', corps:'' });
  assert.ok(errs.includes('titre'));
  assert.ok(errs.includes('slug'));
  assert.ok(errs.includes('categorie'));
  assert.ok(errs.includes('corps'));
});
test('validateArticleDB OK sur une fiche valide', () => {
  assert.deepEqual(validateArticleDB({ titre:'T', slug:'mon-article', categorie:'sport', corps:'x' }), []);
});
test('nextStatus mappe les actions', () => {
  assert.equal(nextStatus('brouillon'), 'brouillon');
  assert.equal(nextStatus('soumettre'), 'en_attente');
  assert.equal(nextStatus('publier'), 'publie');
  assert.equal(nextStatus('programmer'), 'programme');
});
test('formToRow: publier renseigne date_publication', () => {
  const r = formToRow({ action:'publier', titre:'T', slug:'s', categorie:'sport', corps:'b' }, 'uid');
  assert.equal(r.statut, 'publie');
  assert.equal(r.auteur_id, 'uid');
  assert.ok(r.date_publication);
  assert.equal(r.date_programmee, null);
});
test('formToRow: programmer renseigne date_programmee', () => {
  const r = formToRow({ action:'programmer', titre:'T', slug:'s', categorie:'sport', corps:'b', date_programmee:'2026-09-01T08:00:00Z' }, 'uid');
  assert.equal(r.statut, 'programme');
  assert.equal(r.date_programmee, '2026-09-01T08:00:00Z');
  assert.equal(r.date_publication, null);
});
