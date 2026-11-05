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
  const bandeau = (h) => h.slice(h.indexOf('<div class="td-trending-now-display-area">'), h.indexOf('<div class="td-next-prev-wrap">', h.indexOf('<div class="td-trending-now-display-area">')));
  // Bandeau : titres publiés le jour du build…
  const jour = bandeau(buildHome(list, cats, '2026-10-15'));
  assert.ok(jour.includes('Une a2') && !jour.includes('Une coche') && !jour.includes('Une a3'));
  // … et, si rien n'a été publié ce jour-là, les articles de la une.
  const vide = bandeau(buildHome(list, cats, '2026-10-30'));
  assert.ok(vide.includes('Une coche') && vide.includes('Une a4') && !vide.includes('Une a5') && !vide.includes('Le Grand Mariage'));
  assert.doesNotThrow(() => buildHome([], cats));
});

test('buildEnDirectPage : brèves et articles à la une, liens à la bonne profondeur', async () => {
  const { buildEnDirectPage } = await import('../build/generate.mjs');
  const html = buildEnDirectPage([{ ...a, aLaUne: true, publishedAt: '2026-06-12T09:00:00Z' }], [{ id: 'b', texte: 'Le ferry reprend demain.', publishedAt: '2026-10-21T08:00:00Z' }], cats);
  assert.match(html, /En direct/);
  assert.ok(html.includes('Le ferry reprend demain.'));
  assert.ok(html.includes('../../../index.php/2026/06/12/s/index.html'));
});

test('buildHome : chaque rubrique limitée à 4 articles + lien vers la rubrique', () => {
  const mk = (cat, i) => ({ ...a, category: cat, title: `T-${cat}-${i}`, slug: `${cat}-${i}`, date: `2026-10-${10 + i}`, publishedAt: `2026-10-${10 + i}T09:00:00Z` });
  const list = ['politique', 'economie', 'societe', 'culture', 'sport', 'diaspora', 'monde', 'tourisme'].flatMap((c) => [0, 1, 2, 3, 4, 5].map((i) => mk(c, i)));
  const html = buildHome(list, cats);
  for (const c of ['politique', 'economie', 'societe', 'culture', 'sport', 'diaspora', 'monde', 'tourisme']) {
    assert.ok(html.includes(`T-${c}-5`) && html.includes(`T-${c}-2`), c + ' : les 4 plus récents');
    assert.ok(!html.includes(`>T-${c}-1<`) && !html.includes(`>T-${c}-0<`), c + ' : pas les plus anciens');
    assert.ok(html.includes(`href="index.php/category/${c}/index.html" class="cn-voir-tout"`), c + ' : lien');
  }
});

test('buildHome : « À ne pas manquer » affiche la veille hors une, plus de contenu figé', () => {
  const mk = (slug, jour, h = '09') => ({ ...a, title: 'Art ' + slug, slug, date: `2026-10-${jour}`, publishedAt: `2026-10-${jour}T${h}:00:00Z` });
  const list = ['1', '2', '3', '4'].map((x) => mk('auj' + x, '21', '0' + x)).concat([mk('hier1', '20', '10'), mk('hier2', '20', '11'), mk('vieux', '15')]);
  const html = buildHome(list, cats, '2026-10-21');
  assert.doesNotMatch(html, /\{\{A_NE_PAS_MANQUER\}\}/);
  const bloc = html.slice(html.indexOf('<div id=tdi_56'), html.indexOf('data-td-block-uid="tdi_57"'));
  assert.ok(bloc.indexOf('Art hier2') < bloc.indexOf('Art hier1') && bloc.includes('Art vieux'));
  assert.ok(!bloc.includes('Art auj') && !bloc.includes('Le Grand Mariage') && !bloc.includes('next-page-tdi_56'));
});
