import test from 'node:test';
import assert from 'node:assert/strict';
import { pickUne, homeUne, breveTime, breveDayKey, breveDayFallback, enDirectInner } from '../build/lib/en-direct.mjs';

const cats = { economie: { name: 'Économie' }, sport: { name: 'Sport' } };
const art = (slug, jour, aLaUne = false) => ({
  title: 'Titre ' + slug, slug, category: 'economie', date: `2026-10-${jour}`, image: '',
  aLaUne, publishedAt: `2026-10-${jour}T09:00:00Z`,
});

test('homeUne : cochés en tête puis complétés par les derniers, sans doublon', () => {
  const list = [art('a', '10', true), art('b', '15'), art('c', '12', true), art('d', '18'), art('e', '17'), art('f', '16'), art('g', '11')];
  const r = homeUne(list);
  assert.deepEqual(r.map((a) => a.slug), ['c', 'a', 'd', 'e']);
  assert.equal(new Set(r.map((a) => a.slug)).size, 4);
});

test('homeUne : aucun coché → les 4 plus récents ; 6 cochés → 4 cochés', () => {
  const sans = ['10', '11', '12', '13', '14'].map((j, i) => art('s' + i, j));
  assert.deepEqual(homeUne(sans).map((a) => a.slug), ['s4', 's3', 's2', 's1']);
  const tous = ['10', '11', '12', '13', '14', '15'].map((j, i) => art('t' + i, j, true)).concat([art('z', '20')]);
  assert.deepEqual(homeUne(tous).map((a) => a.slug), ['t5', 't4', 't3', 't2']);
  assert.deepEqual(homeUne([]), []);
});

test('pickUne : 8 cochés au maximum, sinon les 8 derniers publiés', () => {
  const dix = Array.from({ length: 10 }, (_, i) => art('u' + i, String(10 + i), true));
  assert.equal(pickUne(dix).length, 8);
  assert.equal(pickUne(dix)[0].slug, 'u9');
  const non = Array.from({ length: 10 }, (_, i) => art('n' + i, String(10 + i)));
  assert.deepEqual(pickUne(non).map((a) => a.slug), ['n9', 'n8', 'n7', 'n6', 'n5', 'n4', 'n3', 'n2']);
});

test('heure et jour des brèves en heure des Comores (UTC+3)', () => {
  assert.equal(breveTime('2026-10-21T23:30:00Z'), '02:30');
  assert.equal(breveTime('2026-10-21T08:05:00Z'), '11:05');
  assert.equal(breveDayKey('2026-10-21T23:30:00Z'), '2026-10-22');
  assert.equal(breveDayFallback('2026-10-21T10:00:00Z'), '21 octobre');
});

test('enDirectInner échappe le texte des brèves et affiche heure + horodatage', () => {
  const h = enDirectInner([], [{ id: '1', texte: '<script>x</script> & co', publishedAt: '2026-10-21T08:00:00Z' }], '../../../', cats);
  assert.ok(h.includes('&lt;script&gt;x&lt;/script&gt; &amp; co'));
  assert.ok(!h.includes('<script>x'));
  assert.ok(h.includes('datetime="2026-10-21T08:00:00Z"'));
  assert.ok(h.includes('11:00'));
  assert.ok(h.includes('À la une') && h.includes('Brèves'));
  assert.ok(h.includes('data-day="2026-10-21"'));
});

test('enDirectInner : message sans brève et liens des articles préfixés', () => {
  const une = [art('vanille', '12', true), art('ylang', '11', true)];
  const h = enDirectInner(une, [], '../../../', cats);
  assert.ok(h.includes('Aucune brève pour le moment.'));
  assert.ok(h.includes('../../../index.php/2026/10/12/vanille/index.html'));
  assert.ok(h.includes('../../../index.php/2026/10/11/ylang/index.html'));
  assert.equal((h.match(/<article class="cn-carte grille"/g) || []).length, 2);
  assert.ok(!h.includes('cn-direct-card'));
});

test('aNePasManquer : articles de la veille hors une, 6 max, plus récents d\'abord', async () => {
  const { aNePasManquer } = await import('../build/lib/en-direct.mjs');
  const v = (slug, h) => ({ ...art(slug, '20'), publishedAt: `2026-10-20T${h}:00:00Z` });
  const list = [art('auj', '21'), v('v1', '08'), v('v2', '10'), v('v3', '12'), v('v4', '14'), v('v5', '15'), v('v6', '16'), v('v7', '17'), art('vieux', '18')];
  const une = [list[0], list[6]]; // aujourd'hui + v6 déjà à la une
  const r = aNePasManquer(list, une, '2026-10-21');
  assert.deepEqual(r.map((a) => a.slug), ['v7', 'v5', 'v4', 'v3', 'v2', 'v1']);
});

test('aNePasManquer : veille trop maigre → complété par les plus récents hors une', async () => {
  const { aNePasManquer } = await import('../build/lib/en-direct.mjs');
  const list = [art('auj1', '21'), art('auj2', '21'), art('veille', '20'), art('a19', '19'), art('a18', '18'), art('a17', '17'), art('a16', '16'), art('a15', '15'), art('a14', '14')];
  const r = aNePasManquer(list, [list[0]], '2026-10-21');
  assert.equal(r[0].slug, 'veille');
  assert.equal(r.length, 6);
  assert.ok(!r.some((a) => a.slug === 'auj1'));
  assert.equal(new Set(r.map((a) => a.slug)).size, 6);
  assert.deepEqual(aNePasManquer([], [], '2026-10-21'), []);
});

test('titresDuJour : articles publiés le jour même, récents d\'abord ; sinon la une', async () => {
  const { titresDuJour } = await import('../build/lib/en-direct.mjs');
  const list = [art('h1', '20'), { ...art('j1', '21'), publishedAt: '2026-10-21T06:00:00Z' }, { ...art('j2', '21'), publishedAt: '2026-10-21T09:00:00Z' }];
  assert.deepEqual(titresDuJour(list, '2026-10-21', [list[0]]).map((a) => a.slug), ['j2', 'j1']);
  assert.deepEqual(titresDuJour(list, '2026-10-25', [list[0]]).map((a) => a.slug), ['h1']);
  const dix = Array.from({ length: 12 }, (_, i) => ({ ...art('d' + i, '21'), publishedAt: `2026-10-21T${String(i + 10)}:00:00Z` }));
  assert.equal(titresDuJour(dix, '2026-10-21', []).length, 10);
});

test('pourraitInteresser : 4 articles hors exclus, une rubrique différente d\'abord', async () => {
  const { pourraitInteresser } = await import('../build/lib/en-direct.mjs');
  const c = (slug, jour, category) => ({ ...art(slug, jour), category });
  const list = [c('e1', '19', 'economie'), c('e2', '18', 'economie'), c('s1', '17', 'sport'), c('p1', '16', 'politique'), c('e3', '15', 'economie'), c('x', '20', 'culture')];
  const r = pourraitInteresser(list, [list[5]]);
  assert.deepEqual(r.map((a) => a.slug), ['e1', 's1', 'p1', 'e2']);
  assert.deepEqual(pourraitInteresser([], []), []);
});

test('plusRecents : exclut, trie, limite', async () => {
  const { plusRecents } = await import('../build/lib/en-direct.mjs');
  const list = ['10', '11', '12', '13', '14', '15'].map((j) => art('r' + j, j));
  assert.deepEqual(plusRecents(list, [list[5]]).map((a) => a.slug), ['r14', 'r13', 'r12', 'r11']);
  assert.deepEqual(plusRecents(list, [], 2).map((a) => a.slug), ['r15', 'r14']);
  assert.deepEqual(plusRecents([], []), []);
});

test('aLireAussi : même rubrique d\'abord, complété, sans l\'article', async () => {
  const { aLireAussi } = await import('../build/lib/en-direct.mjs');
  const c = (slug, jour, category) => ({ ...art(slug, jour), category });
  const cur = c('cur', '10', 'sport');
  const list = [cur, c('s1', '11', 'sport'), c('e1', '19', 'economie'), c('s2', '12', 'sport'), c('e2', '18', 'economie'), c('e3', '17', 'economie')];
  assert.deepEqual(aLireAussi(cur, list).map((x) => x.slug), ['s2', 's1', 'e1', 'e2']);
  assert.deepEqual(aLireAussi(cur, list, 2).map((x) => x.slug), ['s2', 's1']);
});

test('aLireAussi : un seul article → []', async () => {
  const { aLireAussi } = await import('../build/lib/en-direct.mjs');
  const cur = art('seul', '10');
  assert.deepEqual(aLireAussi(cur, [cur]), []);
});
