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

test('injectAds place la MégaBannière 1 avant le titre d\'un article', () => {
  const page = '<html><head></head><body><div class="td-crumb-container">fil</div><div class="td-post-header"><h1>T</h1></div><div class="td-post-content"><p>a</p></div></body></html>';
  const out = injectAds(page);
  const iAd = out.indexOf('id="sas_45656"');
  assert.ok(iAd > out.indexOf('<body>') + 6 && iAd < out.indexOf('<h1>'), 'avant le titre');
  assert.ok(iAd < out.indexOf('td-crumb-container">fil'), 'avant le fil d\'Ariane');
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

test('page article : GrandAngle et Pavé 1 dans la colonne de droite, sous « Suivez nous »', () => {
  const page = '<html><head></head><body><div class="td-post-content"><p>a</p><p>b</p></div>'
    + '<div class="td-ss-main-sidebar"><div class="social">Suivez nous</div><div id="cn-sidebar-ads"></div></div>'
    + '<div id="cn-legal-bar">footer</div></body></html>';
  const out = injectAds(page);
  const iSocial = out.indexOf('Suivez nous');
  const iGA = out.indexOf('id="sas_45654"');
  const iP1 = out.indexOf('id="sas_45655"');
  const iFooter = out.indexOf('<div id="cn-legal-bar"');
  const iMarque = out.indexOf('<div id="cn-sidebar-ads">');
  assert.ok(iGA > iSocial && iP1 > iGA, 'GrandAngle puis Pavé 1 sous Suivez nous');
  assert.ok(out.slice(iMarque + '<div id="cn-sidebar-ads">'.length).startsWith('<div class="cn-ad'), 'les pubs remplissent la colonne');
  assert.equal(out.split('id="sas_45654"').length - 1, 1, 'GrandAngle une seule fois');
  assert.equal(out.split('id="sas_45655"').length - 1, 1, 'Pavé 1 une seule fois');
  assert.ok(out.indexOf('id="sas_49046"') < iFooter, 'MégaBannière 2 toujours avant le footer');
});
