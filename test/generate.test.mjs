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

test('buildSearchIndex', () => {
  const idx = buildSearchIndex([a], cats);
  assert.equal(idx[0].catSlug, 'economie');
  assert.equal(idx[0].url, 'index.php/2026/06/12/s/index.html');
});

test('buildEnDirectPage : brèves et articles à la une, liens à la bonne profondeur', async () => {
  const { buildEnDirectPage } = await import('../build/generate.mjs');
  const html = buildEnDirectPage([{ ...a, aLaUne: true, publishedAt: '2026-06-12T09:00:00Z' }], [{ id: 'b', texte: 'Le ferry reprend demain.', publishedAt: '2026-10-21T08:00:00Z' }], cats);
  assert.match(html, /En direct/);
  assert.ok(html.includes('Le ferry reprend demain.'));
  assert.ok(html.includes('../../../index.php/2026/06/12/s/index.html'));
});

const unePart = (h) => h.slice(h.indexOf('<div class="cn-une">'), h.indexOf('id="cn-ad-top"'));
const bandeau = (h) => h.slice(h.indexOf('<div class="cn-ticker">'), h.indexOf('</header>'));

test('buildHome : remplit la page, aucun marqueur ni contenu figé, ancres pub', () => {
  const html = buildHome([a], cats);
  assert.match(html, /Mon titre/);
  assert.doesNotMatch(html, /{{|Le Grand Mariage/);
  assert.ok(html.includes('<div id="cn-ad-top"></div>') && html.includes('id="cn-sidebar-ads"'));
  assert.ok(html.includes('<link rel="canonical" href="index.html"/>'));
  assert.ok(html.includes('og:site_name') && html.includes('<title>Comoresnews |'));
  assert.doesNotThrow(() => buildHome([], cats));
});

test('buildHome : .cn-une = 1 grande + 3 lignes, la case « À la une » en premier ; bandeau = titres du jour', () => {
  const mk = (slug, jour, aLaUne = false) => ({ ...a, title: 'Une ' + slug, slug, date: `2026-10-${jour}`, publishedAt: `2026-10-${jour}T09:00:00Z`, aLaUne });
  const list = [mk('coche', '10', true), mk('a2', '15'), mk('a3', '14'), mk('a4', '13'), mk('a5', '12')];
  const une = unePart(buildHome(list, cats));
  assert.ok(une.indexOf('Une coche') < une.indexOf('Une a2'));
  assert.equal((une.match(/cn-carte grande/g) || []).length, 1);
  assert.equal((une.match(/cn-carte ligne/g) || []).length, 3);
  assert.ok(une.indexOf('cn-carte grande') < une.indexOf('Une a2') && une.indexOf('Une coche') < une.indexOf('cn-carte ligne'));
  assert.ok(!une.includes('Une a5'));
  const jour = bandeau(buildHome(list, cats, '2026-10-15'));
  assert.ok(jour.includes('Une a2') && !jour.includes('Une coche') && !jour.includes('Une a3'));
  const vide = bandeau(buildHome(list, cats, '2026-10-30'));
  assert.ok(vide.includes('Une coche') && vide.includes('Une a4') && !vide.includes('Une a5'));
});

test('buildHome : « À ne pas manquer » = veille hors une', () => {
  const mk = (slug, jour, h = '09') => ({ ...a, title: 'Art ' + slug, slug, date: `2026-10-${jour}`, publishedAt: `2026-10-${jour}T${h}:00:00Z` });
  const list = ['1', '2', '3', '4'].map((x) => mk('auj' + x, '21', '0' + x)).concat([mk('hier1', '20', '10'), mk('hier2', '20', '11'), mk('vieux', '15')]);
  const html = buildHome(list, cats, '2026-10-21');
  const i = html.indexOf('À ne pas manquer');
  const bloc = html.slice(i, html.indexOf('Actu ', i));
  assert.ok(i > 0 && bloc.indexOf('Art hier2') < bloc.indexOf('Art hier1') && bloc.includes('Art vieux'));
  assert.ok(!bloc.includes('Art auj'));
});

test('buildHome : rubrique de 6 articles = 4 cartes + lien ; rubrique vide = message', () => {
  const mk = (i) => ({ ...a, category: 'sport', title: `T-sport-${i}`, slug: `sport-${i}`, date: `2026-10-${10 + i}`, publishedAt: `2026-10-${10 + i}T09:00:00Z` });
  const html = buildHome([0, 1, 2, 3, 4, 5].map(mk), cats);
  const i = html.indexOf('Actu Sport');
  const fin = html.indexOf('Actu ', i + 5);
  const bloc = html.slice(i, fin > 0 ? fin : html.indexOf('Les plus récents'));
  assert.equal((bloc.match(/<article class="cn-carte grille"/g) || []).length, 4);
  assert.ok(bloc.includes('Tous les articles Sport →') && bloc.includes('href="index.php/category/sport/index.html"'));
  assert.ok(html.includes('Aucun article pour le moment.'));
  assert.ok(!buildHome([mk(0), mk(1)], cats).includes('Tous les articles Sport'));
});

test('buildHome : « Les plus récents » en fin de page', () => {
  const html = buildHome(Array.from({ length: 20 }, (_, i) => i).map((i) => ({ ...a, title: `P${i}`, slug: `p${i}`, date: `2026-10-${10 + i}`, publishedAt: `2026-10-${10 + i}T09:00:00Z` })), cats, '2026-10-30');
  assert.ok(html.includes('Les plus récents') && html.includes('cn-grille quatre'));
});
