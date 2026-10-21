import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNewsletter, weekSubject, pickArticles } from '../admin/newsletter-template.mjs';

const SITE = 'https://comoresnews.com';
const UNSUB = 'https://comoresnews.com/index.php/pages/desinscription/index.html?t=abc';
const A1 = { id: '1', titre: 'La vanille d’Anjouan', slug: 'vanille', categorie: 'economie', excerpt: 'Un trésor agricole.',
  image_couverture: 'https://x.supabase.co/storage/v1/object/public/medias/vanille.webp', date_publication: '2026-10-20T09:00:00Z' };
const A2 = { id: '2', titre: 'Les Coelacanthes', slug: 'coelacanthes', categorie: 'sport', excerpt: 'Le football comorien.',
  image_couverture: 'wp-content/uploads/2026/06/foot.webp', date_publication: '2026-10-19T09:00:00Z' };
const CATS = { economie: 'Économie', sport: 'Sport' };

test('renderNewsletter contient chaque article avec lien absolu, image et lien de désinscription', () => {
  const { html, text } = renderNewsletter({ objet: 'Objet', intro: '', articles: [A1, A2], siteUrl: SITE, unsubscribeUrl: UNSUB, categories: CATS });
  assert.match(html, /https:\/\/comoresnews\.com\/index\.php\/2026\/10\/20\/vanille\/index\.html/);
  assert.match(html, /<img[^>]+src="https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/medias\/vanille\.webp"/);
  assert.match(html, /<img[^>]+src="https:\/\/comoresnews\.com\/wp-content\/uploads\/2026\/06\/foot\.webp"/);
  assert.ok(html.includes(UNSUB));
  assert.match(html, /COMORES/);
  assert.match(html, /NEWS/);
  assert.match(html, /Économie/);
  assert.ok(text.includes('La vanille d’Anjouan') && text.includes('Les Coelacanthes'));
  assert.ok(text.includes(UNSUB));
});

test('renderNewsletter échappe et tolère les champs vides', () => {
  const a = { id: '3', titre: 'A<b>&C', slug: 's', categorie: 'monde', excerpt: '', image_couverture: '', date_publication: '2026-10-20T09:00:00Z' };
  const { html } = renderNewsletter({ objet: 'O', intro: '', articles: [a], siteUrl: SITE, unsubscribeUrl: UNSUB });
  assert.match(html, /A&lt;b>&amp;C/);
  assert.ok(!html.includes('<b>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('undefined'));
});

test("renderNewsletter met l'introduction en tête si elle existe", () => {
  const avec = renderNewsletter({ objet: 'O', intro: 'Bonjour à tous', articles: [A1], siteUrl: SITE, unsubscribeUrl: UNSUB });
  assert.ok(avec.html.indexOf('Bonjour à tous') < avec.html.indexOf('La vanille'));
  assert.ok(avec.text.startsWith('Bonjour à tous'));
  const sans = renderNewsletter({ objet: 'O', intro: '   ', articles: [A1], siteUrl: SITE, unsubscribeUrl: UNSUB });
  assert.ok(!/<p[^>]*>\s*<\/p>/.test(sans.html));
});

test('weekSubject', () => {
  assert.equal(weekSubject(new Date('2026-10-21T10:00:00Z')), "Comoresnews — l'essentiel de la semaine du 19 au 25 octobre");
  assert.equal(weekSubject(new Date('2026-10-01T10:00:00Z')), "Comoresnews — l'essentiel de la semaine du 28 septembre au 4 octobre");
});

test('pickArticles', () => {
  const now = new Date('2026-10-23T08:00:00Z');
  const rows = [
    { id: 'a', statut: 'publie', date_publication: '2026-10-22T08:00:00Z' },
    { id: 'b', statut: 'publie', date_publication: '2026-10-20T08:00:00Z' },
    { id: 'c', statut: 'brouillon', date_publication: null },
    { id: 'd', statut: 'publie', date_publication: '2026-10-10T08:00:00Z' },
    { id: 'e', statut: 'en_attente', date_publication: '2026-10-22T09:00:00Z' },
  ];
  assert.deepEqual(pickArticles(rows, '2026-10-21T00:00:00Z', now).map((r) => r.id), ['a']);
  assert.deepEqual(pickArticles(rows, null, now).map((r) => r.id), ['a', 'b']); // 7 derniers jours
});
