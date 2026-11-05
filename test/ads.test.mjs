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

// --- Nouveaux points d'ancrage (page() de la refonte) ---
import { readFileSync } from 'node:fs';
import { page, colonneDroite } from '../build/lib/gabarit.mjs';
const catsCfg = JSON.parse(readFileSync(new URL('../config/categories.json', import.meta.url), 'utf8'));
const mk = (contenu) => page({ titre: 'T', prefix: '', contenu, jour: '2026-11-05', catsCfg });
const count = (s, sub) => s.split(sub).length - 1;

test('injectAds : MégaBannière 1 à la place de cn-ad-top', () => {
  const out = injectAds(mk('<div id="cn-ad-top"></div><p>x</p>' + colonneDroite()));
  assert.equal(count(out, 'id="sas_45656"'), 1);
  assert.ok(!out.includes('<div id="cn-ad-top"></div>'));
  assert.ok(out.indexOf('sas_45656') < out.indexOf('id="cn-sidebar-ads"'));
});

test('injectAds : MégaBannière 1 en tête de main sans cn-ad-top', () => {
  const out = injectAds(mk('<p>x</p>'));
  assert.equal(count(out, 'id="sas_45656"'), 1);
  const m = out.indexOf('<main id="cn-main">');
  const s = out.indexOf('id="sas_45656"');
  assert.ok(m !== -1 && s > m && s - m < 300);
});

test('injectAds : GrandAngle et Pavé 1 dans la colonne', () => {
  const out = injectAds(mk('<p>x</p>' + colonneDroite()));
  const a = out.indexOf('id="cn-sidebar-ads"');
  const end = out.indexOf('</div></div>', a);
  for (const id of [45654, 45655]) {
    const p = out.indexOf(`id="sas_${id}"`);
    assert.ok(p > a && p < end + 12, `sas_${id} dans la colonne`);
  }
});

test('injectAds : Pavé 2 après le 2e paragraphe du corps d\'article', () => {
  const out = injectAds(mk('<div class="cn-article-body"><p>1</p><p>2</p><p>3</p></div>'));
  const p2 = out.indexOf('2</p>'), s = out.indexOf('id="sas_49048"'), p3 = out.indexOf('<p>3');
  assert.ok(p2 < s && s < p3);
});

test('injectAds : bas de page avant cn-legal-bar, idempotent', () => {
  const once = injectAds(mk('<p>x</p>'));
  assert.ok(once.indexOf('id="sas_49046"') < once.indexOf('<div id="cn-legal-bar"'));
  assert.equal(injectAds(once), once);
});
