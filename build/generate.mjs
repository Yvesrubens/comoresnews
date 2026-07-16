import fs from 'node:fs';
import path from 'node:path';
import cats from '../config/categories.json' with { type: 'json' };
import { loadArticles, isPublishable } from './lib/content.mjs';
import { renderMarkdown, articleCard } from './lib/render.mjs';
import { applyTemplate, replaceSection } from './lib/templates.mjs';
import { articlePath, categoryPath, relPrefix } from './lib/paths.mjs';
import { optimizeImages } from './lib/images.mjs';

const ROOT = process.cwd();
const TPL = (n) => fs.readFileSync(path.join(ROOT, 'templates', n), 'utf8');
const AUTHOR_PAGE = 'index.php/author/lewistifosi/index.html'; // URL historique préservée

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function setTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} | Comoresnews</title>`);
}

export function buildArticlePage(a, catsCfg) {
  const rel = articlePath(a.date, a.slug);
  const P = relPrefix(rel);
  const catName = catsCfg[a.category].name;
  const img = a.image
    ? `<img src="${P}${a.image}" alt="${esc(a.title)}" loading="eager" fetchpriority="high" decoding="async" style="width:100%;height:auto;margin:0 0 24px;border-radius:3px;">`
    : '';
  const breadcrumb = `<span><a class="entry-crumb" href="${P}index.html">Accueil</a></span> <i class="td-icon-right td-bread-sep"></i> <span><a class="entry-crumb" href="${P}${categoryPath(a.category)}">${catName}</a></span>`;
  let html = applyTemplate(TPL('article.html'), {
    TITLE: esc(a.title),
    BREADCRUMB: breadcrumb,
    CATEGORY: catName,
    AUTHOR: esc(a.author),
    DATE: a.date,
    IMAGE: img,
    BODY: renderMarkdown(a.body),
  });
  return setTitle(html, a.title);
}

export function buildCategoryPage(slug, articles, catsCfg) {
  const P = relPrefix(categoryPath(slug));
  const catName = catsCfg[slug].name;
  const list = [...articles].sort((x, y) => y.date.localeCompare(x.date));
  const inner = list.length
    ? list.map(a => articleCard(a, P, catsCfg[a.category].name)).join('')
    : `<p style="padding:22px 4px;color:#999;font-style:italic;margin:0;">Aucun article pour le moment.</p>`;
  let html = applyTemplate(TPL('category.html'), {
    TITLE: catName,
    BREADCRUMB: `<span class="td-bred-no-url-last">${catName}</span>`,
    ARTICLES: inner,
  });
  return setTitle(html, catName);
}

export function buildHome(articles, catsCfg) {
  let html = TPL('home.html');
  for (const slug of Object.keys(catsCfg)) {
    const list = articles.filter(a => a.category === slug).sort((x, y) => y.date.localeCompare(x.date));
    const inner = list.length
      ? `<div style="padding:4px 0;">${list.map(a => articleCard(a, '', catsCfg[a.category].name)).join('')}</div>`
      : `<p style="padding:22px 4px;color:#999;font-style:italic;margin:0;">Aucun article pour le moment.</p>`;
    html = replaceSection(html, slug, inner);
  }
  return html;
}

export function buildAuthor(articles, catsCfg) {
  const P = relPrefix(AUTHOR_PAGE);
  const list = [...articles].sort((x, y) => y.date.localeCompare(x.date));
  const inner = list.map(a => articleCard(a, P, catsCfg[a.category].name)).join('');
  return applyTemplate(TPL('author.html'), { AUTHOR: 'Comoresnews', ARTICLES: inner });
}

export function buildSearchIndex(articles, catsCfg) {
  return articles.map(a => ({
    title: a.title, cat: catsCfg[a.category].name, catSlug: a.category,
    excerpt: a.excerpt, url: articlePath(a.date, a.slug), img: a.image,
  }));
}

// --- assets & pages statiques à recopier tels quels dans _site ---
const PASSTHROUGH = ['wp-content', 'wp-includes', '_external', '.nojekyll', 'admin',
  'index.php/pages/contact', 'index.php/pages/recherche',
  'index.php/pages/mentions-legales', 'index.php/pages/politique-confidentialite'];

function copyRec(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src)) copyRec(path.join(src, e), path.join(dst, e));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
function write(outDir, rel, content) {
  const p = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

export async function main({ now, outDir = '_site' }) {
  const validCats = Object.keys(cats);
  const all = loadArticles('content/articles', validCats).filter(a => isPublishable(a, now));
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const rel of PASSTHROUGH) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) copyRec(src, path.join(outDir, rel));
  }
  for (const a of all) write(outDir, articlePath(a.date, a.slug), buildArticlePage(a, cats));
  for (const slug of validCats)
    write(outDir, categoryPath(slug), buildCategoryPage(slug, all.filter(a => a.category === slug), cats));
  write(outDir, 'index.html', buildHome(all, cats));
  write(outDir, AUTHOR_PAGE, buildAuthor(all, cats));
  write(outDir, 'articles-index.json', JSON.stringify(buildSearchIndex(all, cats), null, 1));
  await optimizeImages(outDir);
  console.log(`Build OK: ${all.length} articles -> ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate.mjs')) {
  const nowArg = (process.argv.find(a => a.startsWith('--now=')) || '').split('=')[1];
  main({ now: nowArg || new Date().toISOString().slice(0, 10) }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
