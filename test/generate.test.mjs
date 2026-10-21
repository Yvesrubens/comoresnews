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

test('buildHome : grille et bandeau À la une suivent la case, ancre pub intacte', async () => {
  const mk = (slug, jour, aLaUne = false) => ({ ...a, title: 'Une ' + slug, slug, date: `2026-10-${jour}`, publishedAt: `2026-10-${jour}T09:00:00Z`, aLaUne });
  const list = [mk('coche', '10', true), mk('a2', '15'), mk('a3', '14'), mk('a4', '13'), mk('a5', '12')];
  const html = buildHome(list, cats);
  assert.doesNotMatch(html, /\{\{UNE_GRID\}\}|\{\{UNE_TICKER\}\}/);
  assert.ok(html.includes('data-td-block-uid="tdi_51" >'));
  const grille = html.slice(html.indexOf('<div id=tdi_51'));
  assert.ok(grille.indexOf('Une coche') < grille.indexOf('Une a2'));
  assert.ok(!grille.slice(0, grille.indexOf('tdi_52')).includes('Une a5'));
  assert.ok(!grille.slice(0, grille.indexOf('tdi_52')).includes('Le Grand Mariage aux Comores'));
  const ticker = html.slice(html.indexOf('<div class="td-trending-now-display-area">'), html.indexOf('<div class="td-trending-now-display-area">') + 3000);
  assert.ok(ticker.includes('Une coche') && ticker.includes('Une a3') && !ticker.includes('Une a4') && !ticker.includes('Le Grand Mariage'));
  assert.doesNotThrow(() => buildHome([], cats));
});

test('buildEnDirectPage : brèves et articles à la une, liens à la bonne profondeur', async () => {
  const { buildEnDirectPage } = await import('../build/generate.mjs');
  const html = buildEnDirectPage([{ ...a, aLaUne: true, publishedAt: '2026-06-12T09:00:00Z' }], [{ id: 'b', texte: 'Le ferry reprend demain.', publishedAt: '2026-10-21T08:00:00Z' }], cats);
  assert.match(html, /En direct/);
  assert.ok(html.includes('Le ferry reprend demain.'));
  assert.ok(html.includes('../../../index.php/2026/06/12/s/index.html'));
});
