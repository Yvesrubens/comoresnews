import test from 'node:test';
import assert from 'node:assert/strict';
import { adsSetup, adSlot, injectAds } from '../build/lib/ads.mjs';

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

test('injectAds insère setup + 6 emplacements', () => {
  const page = '<html><head><title>x</title></head><body class="home"><p>hi</p></body></html>';
  const out = injectAds(page);
  for (const id of [45656, 49046, 45655, 49048, 45654, 94320]) assert.match(out, new RegExp(`id="sas_${id}"`));
  assert.match(out, /cn-ad-floor/);
  assert.match(out, /onecall/);
});

test('injectAds est idempotent', () => {
  const page = '<html><head></head><body></body></html>';
  const once = injectAds(page);
  assert.equal(injectAds(once), once);
});
