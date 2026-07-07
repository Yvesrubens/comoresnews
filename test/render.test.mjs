import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, articleCard } from '../build/lib/render.mjs';

test('renderMarkdown convertit le gras', () => {
  assert.match(renderMarkdown('un **mot**'), /<strong>mot<\/strong>/);
});
test('articleCard contient titre, badge et lien prefixe', () => {
  const a = { title:'T', slug:'s', date:'2026-06-12', image:'wp-content/u/x.png' };
  const html = articleCard(a, '../../../', 'Sport');
  assert.match(html, /T</);
  assert.match(html, /Sport/);
  assert.match(html, /\.\.\/\.\.\/\.\.\/index\.php\/2026\/06\/12\/s\/index\.html/);
  assert.match(html, /\.\.\/\.\.\/\.\.\/wp-content\/u\/x\.png/);
});
