import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { page, colonneDroite, titreSection } from '../build/lib/gabarit.mjs';

const cats = JSON.parse(fs.readFileSync(new URL('../config/categories.json', import.meta.url), 'utf8'));

test('page : structure, ancres et liens relatifs (accueil)', () => {
  const h = page({ titre: '', prefix: '', contenu: '<p>X</p>', jour: '2026-11-05', catsCfg: cats });
  assert.ok(h.includes("<title>Comoresnews | L'actualité des Comores et de la diaspora comorienne</title>"));
  assert.ok(h.includes('href="assets/cn.css"'));
  assert.ok(h.includes('<div class="tdb-head-date-txt">jeudi 5 novembre 2026</div>'));
  assert.ok(h.includes('<main id="cn-main"><p>X</p></main>'));
  assert.ok(h.includes('id="cn-legal-bar"'));
  assert.ok(h.includes('href="#cn-newsletter"'));
  assert.ok(h.includes('index.php/pages/en-direct/index.html'));
  assert.ok(h.includes('src="assets/cn.js"') || h.includes('assets/cn.js'));
  const menu = h.slice(h.indexOf('class="cn-menu"'), h.indexOf('</nav>', h.indexOf('class="cn-menu"')));
  const pos = Object.values(cats).sort((a, b) => a.order - b.order).map((c) => menu.indexOf(c.name));
  assert.ok(pos.every((p) => p > 0));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  assert.ok(menu.indexOf('Politique') < menu.indexOf('Annonces'));
});

test('page : profondeur article', () => {
  const h = page({ titre: 'Mon titre', prefix: '../../../../../', contenu: '', jour: '2026-11-05', catsCfg: cats });
  assert.ok(h.includes('href="../../../../../assets/cn.css"'));
  assert.ok(h.includes('src="../../../../../wp-content/uploads/2026/06/Logo-4.png"'));
  assert.ok(h.includes('href="../../../../../index.html#cn-newsletter"'));
  assert.ok(h.includes('<title>Mon titre | Comoresnews</title>'));
});

test("page : bandeau des titres seulement s'il y en a", () => {
  const sans = page({ titre: '', prefix: '', contenu: '', jour: '2026-11-05', catsCfg: cats, titres: [] });
  assert.ok(!sans.includes('cn-ticker'));
  const avec = page({ titre: '', prefix: '', contenu: '', jour: '2026-11-05', catsCfg: cats,
    titres: [{ title: 'A & B', date: '2026-11-04', slug: 'a-b' }, { title: 'C', date: '2026-11-03', slug: 'c' }] });
  assert.ok(avec.includes('cn-ticker'));
  assert.ok(avec.includes('href="index.php/2026/11/04/a-b/index.html"'));
  assert.ok(avec.includes('href="index.php/2026/11/03/c/index.html"'));
  assert.ok(avec.includes('A &amp; B'));
  assert.ok(!avec.includes('A & B'));
});

test('colonneDroite : réseaux sans chiffres et ancre pub', () => {
  const h = colonneDroite({ pourrait: '<p>P</p>', avant: '<p>N</p>' });
  for (const s of ['Facebook', "J'aime", "S'abonner", '<div id="cn-sidebar-ads"></div>', 'Ça pourrait vous intéresser', '<p>P</p>']) assert.ok(h.includes(s), s);
  assert.ok(h.indexOf('<p>N</p>') < h.indexOf('Suivez'));
  assert.ok(titreSection('T', { lien: 'x.html', libelleLien: 'Voir' }).includes('href="x.html"'));
});
