import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../build/lib/render.mjs';
import { insertLink, internalLinkTarget, searchArticles } from '../admin/lib.mjs';

test('lien interne : même onglet, chemin préfixé selon la profondeur de la page', () => {
  const h = renderMarkdown('Voir [la vanille](/index.php/2026/06/01/vanille/index.html).', '../../../../../');
  assert.match(h, /<a href="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/index\.php\/2026\/06\/01\/vanille\/index\.html">la vanille<\/a>/);
  assert.ok(!h.includes('target='));
});

test('lien absolu vers comoresnews.com : traité comme interne', () => {
  const h = renderMarkdown('[a](https://www.comoresnews.com/index.php/x/index.html)');
  assert.ok(!h.includes('target='));
  assert.ok(!h.includes('nofollow'));
});

test('lien externe : nouvel onglet et nofollow', () => {
  const h = renderMarkdown('[blog](https://exemple.com/page)');
  assert.match(h, /href="https:\/\/exemple\.com\/page" target="_blank" rel="noopener nofollow"/);
});

test('lien externe vers une source fiable : nouvel onglet sans nofollow', () => {
  const h = renderMarkdown('[wiki](https://fr.wikipedia.org/wiki/Comores) et [unesco](https://whc.unesco.org/fr/)');
  assert.equal((h.match(/rel="noopener"/g) || []).length, 2);
  assert.ok(!h.includes('nofollow'));
});

test('sans préfixe, le chemin interne reste à la racine', () => {
  assert.match(renderMarkdown('[a](/index.php/a/index.html)'), /href="\/index\.php\/a\/index\.html"/);
});

test('insertLink entoure la sélection, ou insère le titre sans sélection', () => {
  assert.deepEqual(insertLink('La vanille pousse.', 3, 10, '', '/x'), { text: 'La [vanille](/x) pousse.', cursor: 16 });
  assert.deepEqual(insertLink('Fin.', 4, 4, 'Article', '/y'), { text: 'Fin.[Article](/y)', cursor: 17 });
  assert.equal(insertLink('a', 0, 0, '', 'https://e.com').text, '[https://e.com](https://e.com)a');
});

test('internalLinkTarget construit le chemin public', () => {
  assert.equal(internalLinkTarget({ slug: 'vanille', date_publication: '2026-06-01T09:00:00Z' }), '/index.php/2026/06/01/vanille/index.html');
});

test('searchArticles : publiés seulement, insensible aux accents, limite', () => {
  const rows = [
    { titre: 'Les Coelacanthes', statut: 'publie' },
    { titre: 'Pêche artisanale', statut: 'publie' },
    { titre: 'Pêcheurs de Mohéli', statut: 'brouillon' },
  ];
  assert.deepEqual(searchArticles(rows, 'peche').map((r) => r.titre), ['Pêche artisanale']);
  assert.equal(searchArticles(rows, '').length, 2);
  assert.equal(searchArticles(rows, '', 1).length, 1);
});
