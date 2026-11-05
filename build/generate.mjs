import fs from 'node:fs';
import path from 'node:path';
import cats from '../config/categories.json' with { type: 'json' };
import { loadArticles, isPublishable } from './lib/content.mjs';
import { makeClient, loadArticlesFromSupabase, loadBreves } from './lib/supabase-source.mjs';
import { injectNewsletter } from './lib/newsletter.mjs';
import { metaTags, jsonLdArticle, sitemapXml } from './lib/seo.mjs';
import { injectAds } from './lib/ads.mjs';
import { injectAnalytics } from './lib/analytics.mjs';
import { injectConsent } from './lib/consent.mjs';

const BASE = (process.env.SITE_BASE_URL || 'https://comoresnews.com').replace(/\/$/, '');
import { renderMarkdown, sourceLine } from './lib/render.mjs';
import { injectMenu } from './lib/menu.mjs';
import { byRecent, homeUne, pickUne, enDirectInner, aNePasManquer, breveDayKey, titresDuJour, pourraitInteresser, plusRecents } from './lib/en-direct.mjs';
import { page, colonneDroite, titreSection } from './lib/gabarit.mjs';
import { carte, grille } from './lib/cartes.mjs';
import { injectDate } from './lib/date-bandeau.mjs';
import { applyTemplate } from './lib/templates.mjs';
import { articlePath, categoryPath, relPrefix, resolveImg } from './lib/paths.mjs';
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
    ? `<img src="${resolveImg(P, a.image)}" alt="${esc(a.title)}" loading="eager" fetchpriority="high" decoding="async" style="width:100%;height:auto;margin:0 0 24px;border-radius:3px;">`
    : '';
  const breadcrumb = `<span><a class="entry-crumb" href="${P}index.html">Accueil</a></span> <i class="td-icon-right td-bread-sep"></i> <span><a class="entry-crumb" href="${P}${categoryPath(a.category)}">${catName}</a></span>`;
  let html = applyTemplate(TPL('article.html'), {
    TITLE: esc(a.title),
    BREADCRUMB: breadcrumb,
    CATEGORY: catName,
    AUTHOR: esc(a.author),
    DATE: a.date,
    IMAGE: img,
    BODY: renderMarkdown(a.body, P) + sourceLine(a),
    SEO: metaTags(a, `${BASE}/${rel}`) + '\n' + jsonLdArticle(a, `${BASE}/${rel}`),
  });
  return setTitle(html, a.seoTitle || a.title);
}

const pluriel = (n) => `${n} article${n > 1 ? 's' : ''}`;

// Fil d'Ariane et titre communs aux pages rubrique, auteur et « En direct ».
function enTete(titre, prefix) {
  return `<nav class="cn-fil"><a href="${prefix}index.html">Accueil</a> › <span>${esc(titre)}</span></nav><h1 class="cn-h1">${esc(titre)}</h1>`;
}

function pageListe({ titre, prefix, head = '', articles, tous, catsCfg, jour, actif = '' }) {
  const opts = { prefix, catsCfg };
  const list = [...articles].sort(byRecent);
  const pourrait = pourraitInteresser(tous, list).map((a) => carte(a, { ...opts, variante: 'mini' })).join('');
  const contenu = `${enTete(titre, prefix)}<p class="cn-compte">${pluriel(list.length)}</p>
<div class="cn-deux"><div class="cn-principal">${grille(list, opts)}</div>${colonneDroite({ pourrait })}</div>`;
  return page({ titre, prefix, head, contenu, jour, titres: titresDuJour(tous, jour, pickUne(tous, 4)), catsCfg, actif });
}

export function buildCategoryPage(slug, articles, catsCfg, jour = breveDayKey(new Date().toISOString()), tous = articles) {
  const catName = catsCfg[slug].name;
  return pageListe({
    titre: catName, prefix: relPrefix(categoryPath(slug)), actif: slug,
    head: `<meta name="description" content="Toute l'actualité ${esc(catName)} des Comores — Comoresnews">`,
    articles, tous, catsCfg, jour,
  });
}

// Rubriques de l'accueil limitées (la suite est sur la page de la rubrique).
const HOME_SECTION_MAX = 4;

const HOME_HEAD = `<link rel="canonical" href="index.html"/>
<meta name="description" content="L'actualité des Comores et de la diaspora comorienne">
<meta property="og:description" content="L'actualité des Comores et de la diaspora comorienne">
<meta property="og:site_name" content="Comoresnews">
<meta property="og:locale" content="fr-FR">
<meta property="og:type" content="website">
<meta property="og:title" content="Comoresnews">
<meta property="og:url" content="index.html">`;

// `jour` : date du build (AAAA-MM-JJ, heure des Comores) ; « À ne pas manquer » montre la veille.
export function buildHome(articles, catsCfg, jour = breveDayKey(new Date().toISOString())) {
  const opts = { prefix: '', catsCfg };
  const une = homeUne(articles, 4);
  const manquer = aNePasManquer(articles, une, jour);
  const pourrait = pourraitInteresser(articles, une.concat(manquer));
  const recents = plusRecents(articles, une.concat(manquer, pourrait));
  const [premiere, ...autres] = une;
  const uneHtml = une.length
    ? `<div class="cn-une">${carte(premiere, { ...opts, variante: 'grande' })}<div class="cn-une-pile">${autres.map((a) => carte(a, { ...opts, variante: 'ligne' })).join('')}</div></div>`
    : '';
  const rubriques = Object.entries(catsCfg).sort(([, x], [, y]) => x.order - y.order).map(([slug, c]) => {
    const tous = articles.filter((a) => a.category === slug).sort(byRecent);
    const lien = tous.length > HOME_SECTION_MAX ? { lien: categoryPath(slug), libelleLien: `Tous les articles ${c.name} →` } : {};
    return titreSection('Actu ' + c.name, lien) + grille(tous.slice(0, HOME_SECTION_MAX), opts);
  }).join('');
  const contenu = `${uneHtml}<div id="cn-ad-top"></div>
<div class="cn-deux"><div class="cn-principal">${titreSection('À ne pas manquer')}${grille(manquer, opts)}${rubriques}</div>${colonneDroite({ pourrait: pourrait.map((a) => carte(a, { ...opts, variante: 'mini' })).join('') })}</div>
${titreSection('Les plus récents')}${recents.length ? grille(recents, opts).replace('class="cn-grille"', 'class="cn-grille quatre"') : grille([], opts)}`;
  return page({ prefix: '', head: HOME_HEAD, contenu, jour, titres: titresDuJour(articles, jour, une), catsCfg });
}

export const EN_DIRECT_PAGE = 'index.php/pages/en-direct/index.html';

export function buildEnDirectPage(articles, breves, catsCfg, jour = breveDayKey(new Date().toISOString())) {
  const prefix = relPrefix(EN_DIRECT_PAGE);
  const une = pickUne(articles, 8);
  const contenu = `${enTete('En direct', prefix)}${enDirectInner(une, breves, prefix, catsCfg)}`;
  return page({ titre: 'En direct', prefix, contenu, jour, titres: titresDuJour(articles, jour, une), catsCfg });
}

export function buildAuthor(articles, catsCfg, jour = breveDayKey(new Date().toISOString())) {
  return pageListe({ titre: 'Comoresnews', prefix: relPrefix(AUTHOR_PAGE), articles, tous: articles, catsCfg, jour });
}

export function buildSearchIndex(articles, catsCfg) {
  return articles.map(a => ({
    title: a.title, cat: catsCfg[a.category].name, catSlug: a.category,
    excerpt: a.excerpt, url: articlePath(a.date, a.slug), img: a.image,
  }));
}

// --- assets & pages statiques à recopier tels quels dans _site ---
const PASSTHROUGH = ['wp-content', 'wp-includes', 'assets', '_external', '.nojekyll', 'admin',
  'index.php/pages/contact', 'index.php/pages/recherche',
  'index.php/pages/mentions-legales', 'index.php/pages/politique-confidentialite',
  'index.php/pages/desinscription'];

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

export async function main({ now, jour = now, outDir = '_site' }) {
  const validCats = Object.keys(cats);
  const all = process.env.CONTENT_SOURCE === 'supabase'
    ? await loadArticlesFromSupabase(makeClient(), now)
    : loadArticles('content/articles', validCats).filter(a => isPublishable(a, now));
  const breves = process.env.CONTENT_SOURCE === 'supabase' ? await loadBreves(makeClient(), 30) : [];
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const rel of PASSTHROUGH) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) copyRec(src, path.join(outDir, rel));
  }
  const ads = process.env.ADS === 'off' ? (h) => h : injectAds;
  const analytics = process.env.GA4 === 'off' ? (h) => h : injectAnalytics;
  const consent = process.env.CMP === 'off' ? (h) => h : injectConsent;
  // CMP tout en haut du <head> (après <head>), pub + GA4 avant </head>
  const newsletter = process.env.NEWSLETTER === 'off' ? (h) => h : injectNewsletter;
  const deco = (h) => injectDate(injectMenu(consent(analytics(ads(newsletter(h))))), jour);
  // Pages statiques recopiées telles quelles : menu et date du bandeau seulement.
  for (const rel of PASSTHROUGH.filter((r) => r.startsWith('index.php/pages/'))) {
    const p = path.join(outDir, rel, 'index.html');
    if (fs.existsSync(p)) fs.writeFileSync(p, injectDate(injectMenu(fs.readFileSync(p, 'utf8')), jour));
  }
  for (const a of all) write(outDir, articlePath(a.date, a.slug), deco(buildArticlePage(a, cats)));
  for (const slug of validCats)
    write(outDir, categoryPath(slug), deco(buildCategoryPage(slug, all.filter(a => a.category === slug), cats, jour, all)));
  write(outDir, 'index.html', deco(buildHome(all, cats, jour)));
  write(outDir, AUTHOR_PAGE, deco(buildAuthor(all, cats, jour)));
  write(outDir, EN_DIRECT_PAGE, deco(buildEnDirectPage(all, breves, cats, jour)));
  write(outDir, 'articles-index.json', JSON.stringify(buildSearchIndex(all, cats), null, 1));
  const sitemapEntries = [{ loc: `${BASE}/`, lastmod: now }, { loc: `${BASE}/${EN_DIRECT_PAGE}`, lastmod: now }]
    .concat(validCats.map(s => ({ loc: `${BASE}/${categoryPath(s)}`, lastmod: now })))
    .concat(all.map(a => ({ loc: `${BASE}/${articlePath(a.date, a.slug)}`, lastmod: a.date })));
  write(outDir, 'sitemap.xml', sitemapXml(sitemapEntries));
  await optimizeImages(outDir);
  console.log(`Build OK: ${all.length} articles -> ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate.mjs')) {
  const nowArg = (process.argv.find(a => a.startsWith('--now=')) || '').split('=')[1];
  main({
    now: nowArg || new Date().toISOString().slice(0, 10),
    jour: nowArg || breveDayKey(new Date().toISOString()), // jour aux Comores (UTC+3)
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
