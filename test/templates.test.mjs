import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplate, replaceSection } from '../build/lib/templates.mjs';

test('applyTemplate remplace les cles', () => {
  assert.equal(applyTemplate('<h1>{{TITLE}}</h1>', {TITLE:'X'}), '<h1>X</h1>');
});
test('applyTemplate: cle absente = vide', () => {
  assert.equal(applyTemplate('a{{Z}}b', {}), 'ab');
});
test('replaceSection', () => {
  assert.equal(replaceSection('x{{SECTION:sport}}y', 'sport', 'OK'), 'xOKy');
});
