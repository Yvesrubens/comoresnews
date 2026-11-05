import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { habillerPageFixe } from '../build/lib/pages-fixes.mjs';

const catsCfg = JSON.parse(readFileSync(new URL('../config/categories.json', import.meta.url), 'utf8'));
const OPTS = { prefix: '../../../', jour: '2026-11-05', catsCfg };

test('habillerPageFixe : contenu gardé, nouvel habillage', () => {
  const src = readFileSync(new URL('../index.php/pages/recherche/index.html', import.meta.url), 'utf8');
  const out = habillerPageFixe(src, OPTS);
  for (const s of ['id="cn-search-form"', 'cn-results', 'articles-index.json', '<title>Recherche | Comoresnews</title>', 'id="cn-legal-bar"', 'cn-header']) {
    assert.ok(out.includes(s), s);
  }
  assert.ok(!out.includes('td-footer-template-wrap'));
  assert.ok(!out.includes('menu-main-3'));
});

test('habillerPageFixe : structure inattendue → page inchangée', () => {
  const html = '<html><body>x</body></html>';
  assert.equal(habillerPageFixe(html, OPTS), html);
});
