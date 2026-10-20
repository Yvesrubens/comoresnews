import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { htmlToText } from '../scripts/lib/sources/html-text.mjs';
import { parseRss } from '../scripts/lib/sources/rss.mjs';
import { parseGazetteHome, parseGazetteArticle } from '../scripts/lib/sources/gazette.mjs';
import { guessCategory } from '../scripts/lib/sources/category.mjs';

const fx = (f) => fs.readFileSync(new URL(`./fixtures/sources/${f}`, import.meta.url), 'utf8');

test('htmlToText décode les entités et retire les balises', () => {
  assert.equal(htmlToText('<p>L&#8217;île&nbsp;&amp; la mer</p><p>B</p>'), 'L’île & la mer\n\nB');
});

test('parseRss Habari', () => {
  const items = parseRss(fx('habari.xml'), { id: 'habari', nom: 'Habari Za Comores' });
  assert.equal(items.length, 25);
  const it = items[0];
  assert.equal(it.titre, 'Vers une électricité plus fiable aux Comores');
  assert.equal(it.url, 'https://www.habarizacomores.com/2026/10/vers-une-electricite-plus-fiable-aux.html');
  assert.equal(it.source, 'habari');
  assert.equal(it.source_nom, 'Habari Za Comores');
  assert.ok(it.categorie_source.includes('Economie et Finance'));
  assert.ok(it.date_source.startsWith('2026-10-20'));
  assert.ok(!it.texte.includes('<') && !it.texte.includes('&lt;'));
  assert.ok(it.texte.length > 1000);
});

test('parseRss Masiwa', () => {
  const items = parseRss(fx('masiwa.xml'), { id: 'masiwa', nom: 'Masiwa' });
  assert.equal(items.length, 10);
  const it = items[0];
  assert.ok(it.titre.startsWith('Mohamed Daoudou alias Kiki'));
  assert.ok(it.categorie_source.includes('Politique'));
  assert.ok(!it.texte.includes('<'));
  assert.ok(it.texte.length > 1000);
});

test('parseGazetteHome dédoublonne (19 liens)', () => {
  const links = parseGazetteHome(fx('gazette-home.html'));
  assert.equal(links.length, 19);
  assert.equal(new Set(links.map((l) => l.url)).size, 19);
  for (const l of links) {
    assert.ok(l.url.startsWith('https://mail.lagazettedescomores.com/'), l.url);
    assert.ok(['economie', 'opinions', 'politique', 'société', 'sport'].includes(l.rubrique), l.rubrique);
  }
});

test('parseGazetteArticle', () => {
  const a = parseGazetteArticle(fx('gazette-article.html'));
  assert.equal(a.titre, 'Douanes : Les contractuels testés avant leur intégration');
  assert.ok(a.date_source.startsWith('2026-09-25'));
  assert.ok(a.texte.startsWith('Samedi dernier, les agents contractuels des douanes'), a.texte.slice(0, 80));
  assert.ok(!a.texte.includes('propriété exclusive'));
});

test('guessCategory', () => {
  assert.equal(guessCategory(['Economie et Finance']), 'economie');
  assert.equal(guessCategory(['Politique', 'A la une', 'Edition 603']), 'politique');
  assert.equal(guessCategory(['Culture et Société']), 'culture');
  assert.equal(guessCategory(['société']), 'societe');
  assert.equal(guessCategory(['Tribune libre']), null);
  assert.equal(guessCategory([]), null);
});
