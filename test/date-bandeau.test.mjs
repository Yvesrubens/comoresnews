import test from 'node:test';
import assert from 'node:assert/strict';
import { dateLongue, injectDate } from '../build/lib/date-bandeau.mjs';

test('dateLongue : format français', () => {
  assert.equal(dateLongue('2026-11-05'), 'jeudi 5 novembre 2026');
});

test('injectDate : remplace la date figée et ajoute la mise à jour chez le lecteur', () => {
  const html = '<head></head><div class="tdb-head-date-txt">dimanche, juillet 5, 2026</div></body>';
  const out = injectDate(html, '2026-11-05');
  assert.ok(out.includes('<div class="tdb-head-date-txt">jeudi 5 novembre 2026</div>'));
  assert.ok(!out.includes('juillet 5'));
  assert.ok(out.includes('<script id="cn-date">'));
  assert.equal(injectDate(out, '2026-11-05'), out);
  assert.equal(injectDate('<p>rien</p>', '2026-11-05'), '<p>rien</p>');
});
