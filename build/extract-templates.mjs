// Task 6: extraction des templates depuis les pages actuelles.
// Lit des pages existantes du site statique et produit des templates HTML
// (chrome intact) avec des marqueurs {{...}} a la place du contenu dynamique.
// Reproductible : relancer ce script regenere templates/*.html a l'identique
// tant que les pages sources n'ont pas change de structure.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Users/yves/CLAUDE PROJET/comoresnews-clone';
const TPL_DIR = path.join(ROOT, 'templates');
fs.mkdirSync(TPL_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helper: depth-count from the char right after an opening <div ...> tag to
// find the index of its matching closing </div>. Same technique as
// scratchpad/mktourisme.mjs and scratchpad/reorghome.mjs.
// ---------------------------------------------------------------------------
function findMatchingClose(html, openEnd) {
  let depth = 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = openEnd;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') {
      depth--;
      if (depth === 0) return m.index;
    } else {
      depth++;
    }
  }
  throw new Error('No matching close found for div starting at ' + openEnd);
}

// Find open tag matching `re`, return { openStart, openEnd, closeIdx, closeEnd }
function spliceDiv(html, re) {
  const m = re.exec(html);
  if (!m) throw new Error('Pattern not found: ' + re);
  const openStart = m.index;
  const openEnd = openStart + m[0].length;
  const closeIdx = findMatchingClose(html, openEnd);
  const closeEnd = closeIdx + '</div>'.length;
  return { openStart, openEnd, closeIdx, closeEnd };
}

function replaceInner(html, re, marker) {
  const { openEnd, closeIdx } = spliceDiv(html, re);
  return html.slice(0, openEnd) + marker + html.slice(closeIdx);
}

// ===========================================================================
// 1) templates/article.html
// Source: index.php/2026/06/12/vanille-anjouan-comores-agriculture-exportation/index.html
// ===========================================================================
function buildArticleTemplate() {
  const src = path.join(ROOT, 'index.php/2026/06/12/vanille-anjouan-comores-agriculture-exportation/index.html');
  let html = fs.readFileSync(src, 'utf8');

  // Breadcrumb: replace the whole entry-crumbs inner (keeps "Accueil" link + sep,
  // replaces the middle category crumb + trailing title text as one marker so
  // the generator can rebuild the full trail).
  html = html.replace(
    /(<div class="td-crumb-container"><div class="entry-crumbs">)[\s\S]*?(<\/div><\/div>)/,
    '$1{{BREADCRUMB}}$2'
  );

  // Category badge (the <ul class="td-category">...</ul> just above the title)
  html = html.replace(
    /<ul class="td-category">[\s\S]*?<\/ul>/,
    '<ul class="td-category"><li class="entry-category"><a href="#">{{CATEGORY}}</a></li></ul>'
  );

  // Title
  html = html.replace(
    /<h1 class="entry-title">[\s\S]*?<\/h1>/,
    '<h1 class="entry-title">{{TITLE}}</h1>'
  );

  // Author name (the link text inside td-post-author-name)
  html = html.replace(
    /(<div class="td-post-author-name"><div class="td-author-by">Par<\/div> <a href="[^"]*">)[^<]*(<\/a>)/,
    '$1{{AUTHOR}}$2'
  );

  // Date (the visible text inside <time ...>...</time> in td-post-date)
  html = html.replace(
    /(<span class="td-post-date"><time class="entry-date updated td-module-date" datetime="[^"]*"\s*>)[^<]*(<\/time><\/span>)/,
    '$1{{DATE}}$2'
  );

  // Body container: <div class="td-post-content tagdiv-type"> contains, in order,
  // the featured-image block then the article body markup. Replace the featured
  // image sub-block with {{IMAGE}} first, then replace the whole container's
  // inner (now "{{IMAGE}}" + body html) with "{{IMAGE}}\n{{BODY}}".
  {
    const re = /<div class="td-post-featured-image">/;
    const m = re.exec(html);
    const openStart = m.index;
    const openEnd = openStart + m[0].length;
    const closeIdx = findMatchingClose(html, openEnd);
    const closeEnd = closeIdx + '</div>'.length;
    html = html.slice(0, openStart) + '{{IMAGE}}' + html.slice(closeEnd);
  }
  html = replaceInner(html, /<div class="td-post-content tagdiv-type">/, '{{IMAGE}}\n            {{BODY}}');

  fs.writeFileSync(path.join(TPL_DIR, 'article.html'), html);
  console.log('templates/article.html written, size', html.length);
}

// ===========================================================================
// 2) templates/category.html
// Source: index.php/category/politique/index.html
// ===========================================================================
function buildCategoryTemplate() {
  const src = path.join(ROOT, 'index.php/category/politique/index.html');
  let html = fs.readFileSync(src, 'utf8');

  // Breadcrumb: replace last crumb ("Politique") with marker, keep Accueil link.
  html = html.replace(
    '<span class="td-bred-no-url-last">Politique</span>',
    '{{BREADCRUMB}}'
  );

  // Title
  html = html.replace(
    '<h1 class="entry-title td-page-title">Politique</h1>',
    '<h1 class="entry-title td-page-title">{{TITLE}}</h1>'
  );

  // Category description line is category-specific text; clear it (not in marker list,
  // but keep structure intact and empty so template stays generic).
  html = html.replace(
    /<div class="td-category-description"><p>[\s\S]*?<\/p>\n?<\/div>/,
    '<div class="td-category-description"></div>'
  );

  // Main content wrap -> {{ARTICLES}}
  html = replaceInner(html, /<div[^>]*class="[^"]*td-main-content-wrap[^"]*"[^>]*>/, '{{ARTICLES}}');

  fs.writeFileSync(path.join(TPL_DIR, 'category.html'), html);
  console.log('templates/category.html written, size', html.length);
}

// ===========================================================================
// 3) templates/author.html
// Source: index.php/author/lewistifosi/index.html
// ===========================================================================
function buildAuthorTemplate() {
  const src = path.join(ROOT, 'index.php/author/lewistifosi/index.html');
  let html = fs.readFileSync(src, 'utf8');

  // Author name in the page title (<h1><span>Comoresnews</span></h1>)
  html = html.replace(
    /(<h1 class="entry-title td-page-title">\s*<span>)[^<]*(<\/span>\s*<\/h1>)/,
    '$1{{AUTHOR}}$2'
  );

  // Breadcrumb trailing text ("Articles postés par Comoresnews")
  html = html.replace(
    'Articles postés par Comoresnews',
    'Articles postés par {{AUTHOR}}'
  );

  // Article list container: all consecutive <div class="td-block-row"> blocks.
  // Find the first row and the matching close of the LAST row (rows are siblings,
  // not nested), then replace everything in between with {{ARTICLES}}.
  {
    const rowRe = /<div class="td-block-row">/g;
    const positions = [];
    let m;
    while ((m = rowRe.exec(html))) positions.push(m.index);
    if (positions.length === 0) throw new Error('No td-block-row found in author page');
    const firstStart = positions[0];
    const lastStart = positions[positions.length - 1];
    const lastOpenEnd = html.indexOf('>', lastStart) + 1;
    const lastCloseIdx = findMatchingClose(html, lastOpenEnd);
    const lastCloseEnd = lastCloseIdx + '</div>'.length;
    html = html.slice(0, firstStart) + '{{ARTICLES}}' + html.slice(lastCloseEnd);
  }

  fs.writeFileSync(path.join(TPL_DIR, 'author.html'), html);
  console.log('templates/author.html written, size', html.length);
}

// ===========================================================================
// 4) templates/home.html
// Source: index.html
// ===========================================================================
function buildHomeTemplate() {
  const src = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(src, 'utf8');

  const map = {
    tdi_57: 'politique',
    tdi_58: 'economie',
    tdi_59: 'societe',
    tdi_69: 'culture',
    tdi_82: 'sport',
    tdi_85: 'diaspora',
    tdi_88: 'monde',
    tdi_900: 'tourisme',
    tdi_106: 'annonces',
  };

  function replaceBlockInner(html, uid, marker) {
    const anchor = html.indexOf(`data-td-block-uid="${uid}"`);
    if (anchor < 0) {
      console.log('  ! uid not found', uid);
      return html;
    }
    const openRe = new RegExp('<div id="?' + uid + '"? class="td_block_inner[^"]*">');
    const m = openRe.exec(html.slice(anchor));
    if (!m) {
      console.log('  ! inner not found for', uid);
      return html;
    }
    const innerStart = anchor + m.index;
    const openEnd = innerStart + m[0].length;
    const closeIdx = findMatchingClose(html, openEnd);
    return html.slice(0, openEnd) + marker + html.slice(closeIdx);
  }

  for (const [uid, slug] of Object.entries(map)) {
    const before = html.length;
    html = replaceBlockInner(html, uid, `{{SECTION:${slug}}}`);
    console.log('  ', uid, '->', slug, before !== html.length ? 'ok' : 'unchanged');
  }

  fs.writeFileSync(path.join(TPL_DIR, 'home.html'), html);
  console.log('templates/home.html written, size', html.length);
}

buildArticleTemplate();
buildCategoryTemplate();
buildAuthorTemplate();
buildHomeTemplate();
