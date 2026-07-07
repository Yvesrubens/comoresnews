import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArticlePage, buildCategoryPage, buildHome, buildSearchIndex } from '../build/generate.mjs';
import cats from '../config/categories.json' with { type: 'json' };

const a = { title:'Mon titre', slug:'s', category:'economie', author:'Comoresnews',
  date:'2026-06-12', image:'wp-content/uploads/x.png', excerpt:'e', status:'published',
  body:'Un **paragraphe**.' };

test('buildArticlePage injecte titre, corps, categorie et <title>', () => {
  const html = buildArticlePage(a, cats);
  assert.match(html, /Mon titre/);
  assert.match(html, /<strong>paragraphe<\/strong>/);
  assert.match(html, /Économie/);
  assert.match(html, /<title>Mon titre \| Comoresnews<\/title>/);
});

test('buildCategoryPage: tri desc et message si vide', () => {
  const arts = [
    { title:'ZarticleAncien', slug:'a', category:'sport', date:'2026-06-10', image:'i.png' },
    { title:'ZarticleRecent', slug:'b', category:'sport', date:'2026-06-12', image:'j.png' },
  ];
  const html = buildCategoryPage('sport', arts, cats);
  assert.ok(html.indexOf('ZarticleRecent') < html.indexOf('ZarticleAncien'), 'recent avant ancien');
  assert.match(buildCategoryPage('monde', [], cats), /Aucun article pour le moment/);
});

test('buildHome remplit les sections, plus de marqueurs bruts', () => {
  const html = buildHome([a], cats);
  assert.doesNotMatch(html, /\{\{SECTION/);
  assert.match(html, /Mon titre/);
});

test('buildSearchIndex', () => {
  const idx = buildSearchIndex([a], cats);
  assert.equal(idx[0].catSlug, 'economie');
  assert.equal(idx[0].url, 'index.php/2026/06/12/s/index.html');
});
