import test from 'node:test';
import assert from 'node:assert/strict';
import { metaTags, jsonLdArticle, sitemapXml } from '../build/lib/seo.mjs';

const a = {
  title: 'Titre', excerpt: 'Résumé', seoTitle: 'SEO', seoDescription: 'Desc',
  ogImage: 'og.webp', image: 'c.webp', keywords: ['x', 'y'],
  date: '2026-06-12', author: 'Comoresnews', category: 'sport',
};

test('metaTags: description SEO prioritaire + OG image absolue + keywords', () => {
  const html = metaTags(a, 'https://comoresnews.com/a/');
  assert.match(html, /name="description" content="Desc"/);
  assert.match(html, /property="og:image" content="https:\/\/comoresnews.com\/og.webp"/);
  assert.match(html, /name="keywords" content="x, y"/);
  assert.match(html, /property="og:type" content="article"/);
});

test('metaTags: fallback excerpt si pas de seoDescription', () => {
  const html = metaTags({ ...a, seoDescription: '' }, 'https://c.com/a/');
  assert.match(html, /name="description" content="Résumé"/);
});

test('metaTags: pas de balise keywords si liste vide', () => {
  const html = metaTags({ ...a, keywords: [] }, 'https://c.com/a/');
  assert.doesNotMatch(html, /name="keywords"/);
});

test('jsonLdArticle contient le type Article et le titre', () => {
  const s = jsonLdArticle(a, 'https://c.com/a/');
  assert.match(s, /"@type":"Article"/);
  assert.match(s, /Titre|SEO/);
  assert.match(s, /application\/ld\+json/);
});

test('sitemapXml liste les URLs avec en-tête XML', () => {
  const xml = sitemapXml([{ loc: 'https://c.com/', lastmod: '2026-06-12' }]);
  assert.match(xml, /<loc>https:\/\/c.com\/<\/loc>/);
  assert.match(xml, /<lastmod>2026-06-12<\/lastmod>/);
  assert.match(xml, /^<\?xml/);
});
