import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArticleData } from '../build/migrate.mjs';

const html = `<title>Titre article | Comoresnews</title>
<meta property="og:description" content="Le chapo.">
<meta property="og:image" content="https://comoresnews.com/wp-content/uploads/2026/06/x.png">
<span><a class="entry-crumb" href="../../../../category/economie/index.html">Économie</a></span>`;

test('extractArticleData', () => {
  const a = extractArticleData(html, 'index.php/2026/06/12/mon-slug/index.html');
  assert.equal(a.slug, 'mon-slug');
  assert.equal(a.date, '2026-06-12');
  assert.equal(a.category, 'economie');
  assert.equal(a.title, 'Titre article');
  assert.equal(a.image, 'wp-content/uploads/2026/06/x.png');
  assert.equal(a.excerpt, 'Le chapo.');
});
