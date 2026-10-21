import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const PAGE = new URL('../index.php/pages/desinscription/index.html', import.meta.url);

test('page de désinscription : appelle la fonction avec le jeton et affiche la confirmation', () => {
  assert.ok(fs.existsSync(PAGE), 'page absente');
  const h = fs.readFileSync(PAGE, 'utf8');
  assert.match(h, /rpc\/desinscrire_newsletter/);
  assert.match(h, /get\(['"]t['"]\)/);
  assert.match(h, /Vous êtes désinscrit de la newsletter/);
  assert.match(h, /n'est pas valide/);
  assert.match(h, /id="cn-legal-bar"/);
  assert.match(h, /<meta name="robots" content="noindex/);
  assert.match(h, /<title>[^<]*Désinscription/);
});

test('le build copie la page de désinscription', () => {
  const g = fs.readFileSync(new URL('../build/generate.mjs', import.meta.url), 'utf8');
  assert.match(g, /'index\.php\/pages\/desinscription'/);
});
