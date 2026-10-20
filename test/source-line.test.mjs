import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceLine } from '../build/lib/render.mjs';

test('sourceLine vide sans source complète', () => {
  assert.equal(sourceLine({}), '');
  assert.equal(sourceLine({ sourceNom: 'Masiwa' }), '');
  assert.equal(sourceLine({ sourceUrl: 'https://masiwa-comores.com/x/' }), '');
});

test('sourceLine affiche le nom et le lien', () => {
  const html = sourceLine({ sourceNom: 'Masiwa', sourceUrl: 'https://masiwa-comores.com/x/' });
  assert.match(html, />Masiwa<\/a>/);
  assert.match(html, /href="https:\/\/masiwa-comores\.com\/x\/"/);
  assert.match(html, /rel="noopener"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /Source : /);
});

test('sourceLine échappe le nom et l\'URL', () => {
  const html = sourceLine({ sourceNom: 'A<b>&"', sourceUrl: 'https://x.test/?a=1&b="2"' });
  assert.ok(!html.includes('<b>'));
  assert.match(html, /A&lt;b>&amp;&quot;/);
  assert.match(html, /href="https:\/\/x\.test\/\?a=1&amp;b=&quot;2&quot;"/);
});

test("sourceLine refuse un lien qui n'est pas http(s)", () => {
  assert.equal(sourceLine({ sourceNom: 'Masiwa', sourceUrl: 'javascript:alert(1)' }), '');
  assert.equal(sourceLine({ sourceNom: 'Masiwa', sourceUrl: ' JavaScript:alert(1)' }), '');
});
