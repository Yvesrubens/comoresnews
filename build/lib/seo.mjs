function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function abs(base, p) {
  if (!p) return '';
  return /^https?:/.test(p) ? p : base.replace(/\/$/, '') + '/' + String(p).replace(/^\//, '');
}

// Balises meta description + OpenGraph + Twitter + keywords pour un article.
export function metaTags(a, url) {
  const desc = a.seoDescription || a.excerpt || '';
  const title = a.seoTitle || a.title;
  const img = abs(new URL(url).origin, a.ogImage || a.image);
  const kw = (a.keywords || []).join(', ');
  return [
    `<meta name="description" content="${esc(desc)}">`,
    kw ? `<meta name="keywords" content="${esc(kw)}">` : '',
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    img ? `<meta property="og:image" content="${esc(img)}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n');
}

// Données structurées JSON-LD Article (Google Actualités).
export function jsonLdArticle(a, url) {
  const img = abs(new URL(url).origin, a.ogImage || a.image);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.seoTitle || a.title,
    image: img ? [img] : undefined,
    datePublished: a.date,
    author: { '@type': 'Organization', name: a.author || 'Comoresnews' },
    publisher: { '@type': 'Organization', name: 'Comoresnews' },
    mainEntityOfPage: url,
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

// sitemap.xml à partir d'entrées {loc, lastmod?}.
export function sitemapXml(entries) {
  const urls = entries
    .map((e) => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
