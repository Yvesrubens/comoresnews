import test from 'node:test';
import assert from 'node:assert/strict';
import { carte, etiquettes, dateFr, estPhotoBanque, tempsLecture, grille } from '../build/lib/cartes.mjs';
import cats from '../config/categories.json' with { type: 'json' };

const art = { title: 'A & B', slug: 's', category: 'economie', ile: 'ndzuani', date: '2026-11-05', excerpt: 'Chapô <x>', image: 'https://h/x.jpg', author: 'Comoresnews' };

test('carte grande : titre, chapô, date, lien et pastilles', () => {
  const h = carte(art, { variante: 'grande', catsCfg: cats });
  for (const s of ['A &amp; B', 'Chapô &lt;x&gt;', '5 novembre 2026', 'index.php/2026/11/05/s/index.html', 'index.php/category/economie/index.html', 'Économie', 'Ndzuani']) {
    assert.ok(h.includes(s), s);
  }
});

test('carte sans image → aplat gris', () => {
  const h = carte({ ...art, image: '' }, { variante: 'grille', catsCfg: cats });
  assert.ok(h.includes('cn-carte-vide'));
  assert.ok(!h.includes('<img'));
});

test("etiquettes : pas d'île → une pastille ; diaspora/diaspora → une seule", () => {
  const n = (h) => (h.match(/cn-tag-/g) || []).length;
  assert.equal(n(etiquettes({ ...art, ile: null }, cats, '')), 1);
  assert.equal(n(etiquettes(art, cats, '')), 2);
  assert.equal(n(etiquettes({ ...art, category: 'diaspora', ile: 'diaspora' }, cats, '')), 1);
});

test('prefix appliqué aux liens et images relatives', () => {
  const h = carte({ ...art, image: 'wp-content/x.png' }, { variante: 'mini', prefix: '../../../', catsCfg: cats });
  assert.ok(h.includes('../../../index.php/2026/11/05/s/index.html'));
  assert.ok(h.includes('../../../wp-content/x.png'));
});

test('estPhotoBanque', () => {
  assert.equal(estPhotoBanque('https://x.supabase.co/storage/v1/object/public/medias/commons/drapeau.png'), true);
  assert.equal(estPhotoBanque('https://x.supabase.co/storage/v1/object/public/medias/2026/x.jpg'), false);
  assert.equal(estPhotoBanque(''), false);
});

test('tempsLecture', () => {
  assert.equal(tempsLecture('mot '.repeat(30)), 1);
  assert.equal(tempsLecture('mot '.repeat(600)), 3);
});

test('dateFr', () => assert.equal(dateFr('2026-11-05'), '5 novembre 2026'));

test('grille vide → message', () => {
  assert.ok(grille([], { catsCfg: cats }).includes('Aucun article pour le moment.'));
  assert.ok(grille([art], { catsCfg: cats }).includes('class="cn-grille"'));
});
