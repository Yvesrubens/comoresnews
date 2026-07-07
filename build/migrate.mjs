import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import TurndownService from 'turndown';

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
// Ces éléments ne doivent jamais survivre dans le corps de l'article.
td.remove(['script', 'style', 'iframe', 'img', 'figure', 'ins', 'noscript']);

export function extractArticleData(html, urlPath) {
  const seg = urlPath.split('/');
  const [ , y, m, d, slug ] = seg; // index.php / y / m / d / slug / index.html
  const title = (html.match(/<title>([^<|]+)/) || [])[1]?.trim() || '';
  const excerpt = (html.match(/property="og:description" content="([^"]*)"/) || [])[1] || '';
  let image = (html.match(/property="og:image" content="([^"]*)"/) || [])[1] || '';
  image = image.replace(/^https?:\/\/comoresnews\.com\//, '').split('#')[0].split('?')[0];
  image = image.replace(/^(\.\.\/)+/, '');
  const cat = (html.match(/class="entry-crumb"[^>]*href="[^"]*category\/([^"/]+)\//) || [])[1] || '';
  return { title, slug, date: `${y}-${m}-${d}`, category: cat, author: 'Comoresnews', image, excerpt };
}

// Extrait le contenu de <div class="td-post-content ...">...</div> en comptant
// les balises <div> imbriquées (une regex simple ne suffit pas à cause de l'imbrication).
export function extractBodyHtml(html) {
  const startMarker = '<div class="td-post-content';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return '';
  const tagEnd = html.indexOf('>', startIdx);
  if (tagEnd === -1) return '';
  let depth = 1;
  let pos = tagEnd + 1;
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      pos = nextClose + 6;
      if (depth === 0) return html.slice(tagEnd + 1, nextClose);
    }
  }
  return '';
}

// Retire un <div ...class contenant needle...>...</div> en comptant les divs imbriqués,
// pour être robuste face à une imbrication arbitraire.
function stripDivsContaining(html, needle) {
  let out = html;
  let searchFrom = 0;
  for (;;) {
    const idx = out.indexOf(needle, searchFrom);
    if (idx === -1) break;
    const openStart = out.lastIndexOf('<div', idx);
    if (openStart === -1) { searchFrom = idx + needle.length; continue; }
    const tagEnd = out.indexOf('>', openStart);
    if (tagEnd === -1) { searchFrom = idx + needle.length; continue; }
    let depth = 1;
    let pos = tagEnd + 1;
    let closeIdx = -1;
    while (depth > 0 && pos < out.length) {
      const nextOpen = out.indexOf('<div', pos);
      const nextClose = out.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        pos = nextClose + 6;
        if (depth === 0) closeIdx = pos;
      }
    }
    if (closeIdx === -1) { searchFrom = idx + needle.length; continue; }
    out = out.slice(0, openStart) + out.slice(closeIdx);
    searchFrom = openStart;
  }
  return out;
}

export function bodyToMarkdown(bodyHtml) {
  let cleaned = bodyHtml.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = stripDivsContaining(cleaned, 'td-post-featured-image');
  cleaned = stripDivsContaining(cleaned, 'ruby-table-contents');
  cleaned = stripDivsContaining(cleaned, 'td-post-sharing');
  cleaned = stripDivsContaining(cleaned, 'related-posts');
  cleaned = stripDivsContaining(cleaned, 'id="comments"');
  return td.turndown(cleaned).trim();
}

export function writeFiche(a, bodyMd, dir = 'content/articles') {
  const fm = `---\ntitle: ${JSON.stringify(a.title)}\nslug: ${a.slug}\ncategory: ${a.category}\nauthor: ${a.author}\ndate: ${a.date}\nimage: ${a.image}\nexcerpt: ${JSON.stringify(a.excerpt)}\nstatus: published\n---\n\n${bodyMd}\n`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, a.slug + '.md'), fm);
}

function findArticleFiles(rootDir) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'feed') continue;
        walk(full);
      } else if (entry.isFile() && entry.name === 'index.html') {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        if (/^20\d\d\/\d\d\/\d\d\/[^/]+\/index\.html$/.test(rel) && !rel.includes('/feed/')) {
          results.push(full);
        }
      }
    }
  }
  walk(rootDir);
  return results.sort();
}

function main() {
  const root = path.join(process.cwd(), 'index.php');
  const files = findArticleFiles(root);
  console.log(`Found ${files.length} article(s).`);
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const relFromCwd = 'index.php/' + path.relative(root, file).replace(/\\/g, '/');
    const a = extractArticleData(html, relFromCwd);
    const bodyHtml = extractBodyHtml(html);
    const bodyMd = bodyToMarkdown(bodyHtml);
    writeFiche(a, bodyMd);
    console.log(`- ${a.slug} (${a.category}, ${a.date})`);
  }
  console.log('Migration terminée.');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
