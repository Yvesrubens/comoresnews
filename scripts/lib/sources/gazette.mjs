import { parse } from 'node-html-parser';
import { htmlToText } from './html-text.mjs';

const DEFAULT_BASE = 'https://www.lagazettedescomores.com/';

// Liens d'articles de la page d'accueil : "<rubrique>/<slug>.html", dédoublonnés.
export function parseGazetteHome(html) {
  const root = parse(html);
  const base = root.querySelector('base')?.getAttribute('href') || DEFAULT_BASE;
  const seen = new Set();
  const out = [];
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    const m = /^([^/:#?]+)\/[^:#?]+\.html$/.exec(href || ''); // rubrique[/sous-rubrique]/slug.html
    if (!m) continue;
    const url = new URL(href, base).href;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, rubrique: m[1] });
  }
  return out;
}

// Page article : titre, date (JJ/MM/AAAA) et texte, sans la mention de copyright du journal.
export function parseGazetteArticle(html) {
  const root = parse(html);
  const titre = htmlToText(root.querySelector('.titre-article')?.innerHTML || '');
  const dt = root.querySelector('time[datetime]')?.getAttribute('datetime') || '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dt);
  const date_source = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`).toISOString() : null;
  const content = root.querySelector('.article-content');
  if (content) for (const p of content.querySelectorAll('p')) {
    if (/propriété exclusive/i.test(p.text)) p.remove();
  }
  return { titre, texte: htmlToText(content?.innerHTML || ''), date_source };
}
