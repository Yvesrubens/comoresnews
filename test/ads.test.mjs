import test from 'node:test';
import assert from 'node:assert/strict';
import { adsSetup, adSlot, injectAds, insertInArticle } from '../build/lib/ads.mjs';

test('adsSetup contient la lib, siteId/pageId et les 6 formats', () => {
  const s = adsSetup();
  assert.match(s, /ced\.sascdn\.com\/tag\/2136\/smart\.js/);
  assert.match(s, /siteId: 778464/);
  assert.match(s, /pageId: 2217296/);
  for (const id of [45656, 49046, 45655, 49048, 45654, 94320]) assert.match(s, new RegExp(`id: ${id}`));
});

test('adSlot génère le div et le render', () => {
  assert.match(adSlot(94320), /id="sas_94320"/);
  assert.match(adSlot(94320), /sas\.render\("94320"\)/);
});

test('injectAds insère setup + 5 emplacements hors article (pas de Pavé 2)', () => {
  const page = '<html><head><title>x</title></head><body class="home"><p>hi</p></body></html>';
  const out = injectAds(page);
  for (const id of [45656, 49046, 45655, 45654, 94320]) assert.match(out, new RegExp(`id="sas_${id}"`));
  assert.doesNotMatch(out, /id="sas_49048"/);
  assert.match(out, /cn-ad-floor/);
  assert.match(out, /onecall/);
});

test('injectAds place le Pavé 2 après le 2e paragraphe d\'un article', () => {
  const page = '<html><head></head><body><div class="td-post-content"><p>un</p><p>deux</p><p>trois</p></div></body></html>';
  const out = injectAds(page);
  const iAd = out.indexOf('id="sas_49048"');
  assert.ok(iAd > out.indexOf('<p>deux</p>'), 'après le 2e paragraphe');
  assert.ok(iAd < out.indexOf('<p>trois</p>'), 'avant le 3e paragraphe');
});

test('insertInArticle ne fait rien hors article', () => {
  const html = '<body><p>a</p><p>b</p></body>';
  assert.equal(insertInArticle(html, '<AD>'), html);
});

test('insertInArticle se rabat sur le 1er paragraphe si un seul', () => {
  const out = insertInArticle('<div class="td-post-content"><p>seul</p></div>', '<AD>');
  assert.ok(out.indexOf('<AD>') > out.indexOf('</p>'));
});

test('injectAds est idempotent', () => {
  const page = '<html><head></head><body></body></html>';
  const once = injectAds(page);
  assert.equal(injectAds(once), once);
});
