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
});
