import test from 'node:test';
import assert from 'node:assert/strict';
import { newsletterBand, injectNewsletter } from '../build/lib/newsletter.mjs';

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
