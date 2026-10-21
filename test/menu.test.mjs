import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { injectMenu } from '../build/lib/menu.mjs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').split('\r\n').join('\n');
const count = (s, x) => s.split(x).length - 1;

test('page article avec bandeau newsletter : liens à la bonne profondeur, ancre locale', () => {
  const html = injectMenu(read('templates/article.html').replace('<body', '<section id="cn-newsletter"></section><body'));
  assert.ok(html.includes('href="../../../../../index.php/pages/en-direct/index.html"'));
  assert.ok(html.includes('Newsletter gratuite'));
  assert.ok(html.includes('class="cn-nl-btn" href="#cn-newsletter"'));
  assert.equal(count(html, 'cn-live-dot"></span>En direct'), 2); // menu bureau + menu mobile
  assert.ok(html.includes('id="cn-menu-css"'));
});

test('page statique sans bandeau : le bouton mène au formulaire de l’accueil', () => {
  const html = injectMenu(read('index.php/pages/contact/index.html'));
  assert.ok(html.includes('class="cn-nl-btn" href="../../../index.html#cn-newsletter"'));
  assert.ok(html.includes('href="../../../index.php/pages/en-direct/index.html"'));
});

test('accueil : lien à la racine ; injection idempotente ; HTML sans menu inchangé', () => {
  const once = injectMenu(read('templates/home.html'));
  assert.ok(once.includes('href="index.php/pages/en-direct/index.html"'));
  assert.equal(injectMenu(once), once);
  assert.equal(injectMenu('<html><body>rien</body></html>'), '<html><body>rien</body></html>');
});
