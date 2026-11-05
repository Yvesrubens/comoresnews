import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArticlePage, buildCategoryPage, buildHome, buildSearchIndex } from '../build/generate.mjs';
import cats from '../config/categories.json' with { type: 'json' };

const a = { title:'Mon titre', slug:'s', category:'economie', author:'Comoresnews',
  date:'2026-06-12', image:'wp-content/uploads/x.png', excerpt:'e', status:'published',
  body:'Un **paragraphe**.' };

test('buildArticlePage injecte titre, corps, categorie et <title>', () => {
  const html = buildArticlePage(a, cats);
  assert.ok(html.includes('<h1>Mon titre</h1>') || /<h1[^>]*>Mon titre<[/]h1>/.test(html));
  assert.ok(html.includes('<strong>paragraphe</strong>'));
  assert.match(html, /Économie/);
  assert.ok(html.includes('<title>Mon titre | Comoresnews</title>'));
});

const mkA = (slug, jour, category = 'economie') => ({ ...a, category, title: 'A-' + slug, slug, date: `2026-10-${jour}`, publishedAt: `2026-10-${jour}T09:00:00Z` });

test('buildArticlePage : structure, chapo, byline, partage, ancres pub', () => {
  const art = { ...a, excerpt: 'Le chapô', sourceNom: 'Al-Watwan', sourceUrl: 'https://exemple.com/x' };
  const html = buildArticlePage(art, cats, [art], '2026-06-12');
  assert.ok(html.includes('<div id="cn-ad-top"></div>') && html.includes('cn-sidebar-ads'));
  assert.ok(html.includes('<p class="cn-chapo">Le chapô</p>'));
  assert.ok(html.includes('<div class="cn-article-body"><p>Un <strong>paragraphe</strong>.'));
  assert.ok(html.includes('⏱') && html.includes('min de lecture') && html.includes('12 juin 2026'));
  const url = encodeURIComponent('https://comoresnews.com/index.php/2026/06/12/s/index.html');
  assert.ok(html.includes('https://www.facebook.com/sharer/sharer.php?u=' + url));
  assert.ok(html.includes('https://twitter.com/intent/tweet?url=' + url));
  assert.ok(html.includes('https://wa.me/?text='));
  assert.ok(html.includes('mailto:?subject='));
  assert.ok(html.includes('Source :'));
  assert.ok(html.includes('Newsletter') && html.includes("S'inscrire gratuitement") && html.includes('index.html#cn-newsletter'));
});

test('buildArticlePage : légende seulement pour une photo de banque, <figure absent sans image', () => {
  const banque = { ...a, image: 'wp-content/uploads/medias/commons/x.jpg' };
  assert.ok(buildArticlePage(banque, cats).includes("Photo d'illustration"));
  const h = buildArticlePage(a, cats);
  assert.ok(h.includes('<figure') && !h.includes("Photo d'illustration"));
  assert.ok(!buildArticlePage({ ...a, image: '' }, cats).includes('<figure'));
});

test('buildArticlePage : « À lire aussi » avec 4 cartes, absent si seul article', () => {
  const cur = mkA('cur', '10');
  const autres = ['11', '12', '13', '14', '15'].map((j) => mkA('x' + j, j));
  const h = buildArticlePage(cur, cats, [cur, ...autres], '2026-10-16');
  const bloc = h.slice(h.indexOf('À lire aussi'));
  assert.equal((h.match(/À lire aussi/g) || []).length, 1);
  assert.equal((bloc.match(/cn-carte grille/g) || []).length, 4);
  assert.ok(h.includes('cn-grille quatre'));
  assert.ok(!buildArticlePage(cur, cats, [cur], '2026-10-16').includes('À lire aussi'));
});

test('buildArticlePage : seoTitle dans <title>, SEO une seule fois, plus de méta figée', () => {
  const h = buildArticlePage({ ...a, seoTitle: 'Titre SEO' }, cats);
  assert.ok(h.includes('<title>Titre SEO | Comoresnews</title>'));
  assert.equal(h.split('og:title').length - 1, 1);
  assert.equal(h.split('application/ld+json').length - 1, 1);
  assert.ok(!/vanille/i.test(h));
});

const mkS = (slug, jour, category = 'sport') => ({ ...a, category, title: 'T-' + slug, slug, date: `2026-10-${jour}`, publishedAt: `2026-10-${jour}T09:00:00Z` });

test('buildCategoryPage : fil, h1, compte, cartes récentes en premier, lien actif, colonne', () => {
  const arts = [mkS('ancien', '10'), mkS('recent', '12'), mkS('milieu', '11')];
  const autres = [mkS('eco1', '13', 'economie'), mkS('eco2', '14', 'economie')];
  const html = buildCategoryPage('sport', arts, cats, '2026-10-15', arts.concat(autres));
  assert.match(html, /<h1[^>]*>Sport<\/h1>/);
  assert.ok(html.includes('Accueil') && html.includes('<p class="cn-compte">3 articles</p>'));
  assert.ok(html.indexOf('T-recent') < html.indexOf('T-milieu') && html.indexOf('T-milieu') < html.indexOf('T-ancien'));
  assert.ok(html.includes('cn-carte grille'));
  assert.match(html, /<a href="[^"]*category\/sport\/index.html" class="actif">Sport<\/a>/);
  assert.ok(html.includes('cn-sidebar-ads') && html.includes('cn-carte mini'));
  assert.ok(html.includes("Toute l'actualité Sport des Comores — Comoresnews"));
  assert.ok(html.includes('<title>Sport | Comoresnews</title>'));
});

test('buildCategoryPage : singulier et rubrique vide', () => {
  assert.ok(buildCategoryPage('sport', [mkS('x', '10')], cats).includes('>1 article</p>'));
  const vide = buildCategoryPage('monde', [], cats);
  assert.ok(vide.includes('>0 article</p>') && vide.includes('Aucun article pour le moment.'));
});

test('buildEnDirectPage : brèves, cartes, liens à la bonne profondeur', async () => {
  const { buildEnDirectPage } = await import('../build/generate.mjs');
  const html = buildEnDirectPage([{ ...a, aLaUne: true, publishedAt: '2026-06-12T09:00:00Z' }], [{ id: 'b', texte: 'Le ferry reprend demain.', publishedAt: '2026-10-21T08:00:00Z' }], cats);
  assert.match(html, /<h1[^>]*>En direct<\/h1>/);
  assert.ok(html.includes('Le ferry reprend demain.') && html.includes('cn-carte grille') && html.includes('cn-menu'));
  assert.ok(html.includes('../../../index.php/2026/06/12/s/index.html'));
});

test('buildAuthor : toutes les cartes, profondeur ../../../', async () => {
  const { buildAuthor } = await import('../build/generate.mjs');
  const html = buildAuthor([mkS('p', '10'), mkS('q', '11', 'economie')], cats, '2026-10-15');
  assert.equal((html.match(/<article class="cn-carte grille"/g) || []).length, 2);
  assert.ok(html.includes('../../../index.php/2026/10/11/q/index.html') && html.includes('<p class="cn-compte">2 articles</p>'));
});

test('buildSearchIndex', () => {
  const idx = buildSearchIndex([a], cats);
  assert.equal(idx[0].catSlug, 'economie');
  assert.equal(idx[0].url, 'index.php/2026/06/12/s/index.html');
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

const mkN = (n) => Array.from({ length: n }, (_, i) => ({ ...a, title: `N${i}`, slug: `n${i}`, date: `2026-10-${10 + i}`, publishedAt: `2026-10-${10 + i}T09:00:00Z` }));

test('buildHome : pas de « Les plus récents » ni de grille vide quand tout est déjà affiché', () => {
  const html = buildHome(mkN(10), cats, '2026-10-30');
  assert.ok(!html.includes('Les plus récents'));
  const fin = html.slice(html.lastIndexOf('</main>') - 200);
  assert.ok(!fin.includes('Aucun article pour le moment.'));
});

test('buildHome : « À ne pas manquer » omis si vide ; « Les plus récents » présent avec >= 14 articles', () => {
  assert.ok(!buildHome([a], cats, '2026-10-30').includes('À ne pas manquer'));
  assert.ok(buildHome(mkN(20), cats, '2026-10-30').includes('Les plus récents'));
});

test('buildAuthor : pas de titre « Ça pourrait vous intéresser » vide', async () => {
  const { buildAuthor } = await import('../build/generate.mjs');
  assert.ok(!buildAuthor(mkN(3), cats, '2026-10-15').includes('Ça pourrait vous intéresser'));
});

test('buildArticlePage : une seule balise canonical absolue', () => {
  const html = buildArticlePage(a, cats);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes('<link rel="canonical" href="https://comoresnews.com/index.php/2026/06/12/s/index.html">'));
});

test('buildCategoryPage : canonical et og absolus', () => {
  const html = buildCategoryPage('economie', [mkA('x', '10')], cats, '2026-10-15');
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  for (const s of ['<link rel="canonical" href="https://comoresnews.com/index.php/category/economie/index.html">', '<meta property="og:title" content="Économie – Comoresnews">', '<meta property="og:type" content="website">', '<meta property="og:site_name" content="Comoresnews">', '<meta property="og:url" content="https://comoresnews.com/index.php/category/economie/index.html">']) assert.ok(html.includes(s), s);
});

test('buildHome : JSON-LD Organization/WebSite avec URLs absolues', () => {
  const html = buildHome([a], cats);
  const m = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  assert.equal(m.length, 1);
  const d = JSON.parse(m[0][1]);
  const graph = d['@graph'] || [d];
  assert.ok(graph.some((x) => x['@type'] === 'Organization' && x.url === 'https://comoresnews.com/'));
  assert.ok(graph.some((x) => x['@type'] === 'WebSite' && x.url === 'https://comoresnews.com/'));
});
