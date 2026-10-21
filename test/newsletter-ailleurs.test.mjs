import test from 'node:test';
import assert from 'node:assert/strict';
import { newsletterBand, injectNewsletter } from '../build/lib/newsletter.mjs';
import { ailleursBlock, injectAilleurs } from '../build/lib/ailleurs.mjs';
import { injectAds } from '../build/lib/ads.mjs';

const CFG = { url: 'https://projet.supabase.co', anonKey: 'cle-publique' };
const PAGE = '<html><head></head><body><header>menu</header><div class="td-main-content-wrap td-container-wrap">contenu</div>'
  + '<div id="cn-legal-bar">footer</div></body></html>';

test('newsletterBand : formulaire email, consentement, lien confidentialité, piège à robots, appel RPC', () => {
  const h = newsletterBand(CFG);
  assert.match(h, /id="cn-newsletter"/);
  assert.match(h, /type="email"/);
  assert.match(h, /S'abonner/);
  assert.match(h, /les articles de la semaine/);
  assert.match(h, /politique-confidentialite/);
  assert.match(h, /name="website"/); // champ piège invisible
  assert.match(h, /rpc\/inscrire_newsletter/);
  assert.match(h, /cle-publique/);
});

test('injectNewsletter place le bandeau juste avant le contenu, une seule fois', () => {
  const out = injectNewsletter(PAGE, CFG);
  assert.ok(out.indexOf('id="cn-newsletter"') > out.indexOf('</header>'));
  assert.ok(out.indexOf('id="cn-newsletter"') < out.indexOf('td-main-content-wrap'));
  assert.equal(injectNewsletter(out, CFG), out);
});

test('injectNewsletter ne fait rien sans zone de contenu', () => {
  const html = '<html><body><p>x</p></body></html>';
  assert.equal(injectNewsletter(html, CFG), html);
});

const ITEMS = [
  { titre: 'Vers une électricité <plus> fiable', url: 'https://www.habarizacomores.com/a.html', source_nom: 'Habari Za Comores', date_source: '2026-10-15T08:00:00Z' },
  { titre: 'Piège', url: 'javascript:alert(1)', source_nom: 'X', date_source: '2026-10-14T08:00:00Z' },
  { titre: 'Douanes', url: 'https://www.lagazettedescomores.com/b.html', source_nom: 'La Gazette des Comores', date_source: null },
];

test('ailleursBlock : titres liés vers la source dans un nouvel onglet, journal et date, échappés', () => {
  const h = ailleursBlock(ITEMS);
  assert.match(h, /Ailleurs sur le web/i);
  assert.match(h, /href="https:\/\/www\.habarizacomores\.com\/a\.html"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(h, /Vers une électricité &lt;plus> fiable/);
  assert.match(h, /Habari Za Comores · 15 oct\. 2026/);
  assert.match(h, /La Gazette des Comores</); // sans date
  assert.doesNotMatch(h, /javascript:/);
});

test('ailleursBlock vide si aucun élément', () => {
  assert.equal(ailleursBlock([]), '');
  assert.equal(ailleursBlock([{ titre: 'x', url: 'ftp://a', source_nom: 'y' }]), '');
});

test('injectAilleurs : avant le footer, et au-dessus des pubs de bas de page', () => {
  const out = injectAds(injectAilleurs(PAGE, ITEMS));
  const iBloc = out.indexOf('id="cn-ailleurs"');
  assert.ok(iBloc > 0);
  assert.ok(iBloc < out.indexOf('id="sas_49046"'), 'au-dessus de la MégaBannière 2');
  assert.ok(out.indexOf('id="sas_49046"') < out.indexOf('<div id="cn-legal-bar"'));
  assert.equal(injectAilleurs(injectAilleurs(PAGE, ITEMS), ITEMS), injectAilleurs(PAGE, ITEMS));
  assert.equal(injectAilleurs(PAGE, []), PAGE);
});
