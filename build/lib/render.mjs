import MarkdownIt from 'markdown-it';
import { articlePath, resolveImg } from './paths.mjs';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// Sites de référence : liens externes sans nofollow.
const SOURCES_FIABLES = ['wikipedia.org', 'unesco.org', 'gouv.km', 'beit-salam.km', 'un.org', 'fifa.com', 'cafonline.com', 'worldbank.org', 'imf.org', 'afd.fr', 'ird.fr'];
const SITE = /^https?:\/\/(www\.)?comoresnews\.com(\/|$)/i;

function hote(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}
const fiable = (h) => SOURCES_FIABLES.some((d) => h === d || h.endsWith('.' + d));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  const href = t.attrGet('href') || '';
  if (href.startsWith('/') && !href.startsWith('//')) {
    if (env?.prefix) t.attrSet('href', env.prefix + href.slice(1));
  } else if (/^https?:\/\//i.test(href) && !SITE.test(href)) {
    t.attrSet('target', '_blank');
    t.attrSet('rel', fiable(hote(href)) ? 'noopener' : 'noopener nofollow');
  }
  return self.renderToken(tokens, idx, options);
};

// prefix : chemin relatif vers la racine du site depuis la page (liens internes « /… »).
export function renderMarkdown(src, prefix = '') {
  return md.render(src || '', { prefix });
}

export function articleCard(a, prefix, catName) {
  const url = prefix + articlePath(a.date, a.slug);
  const thumb = a.image
    ? `<img src="${resolveImg(prefix, a.image)}" alt="" width="108" height="74" loading="lazy" decoding="async" style="display:block;width:108px;height:74px;object-fit:cover;border-radius:3px;">`
    : `<span style="display:block;width:108px;height:74px;background:#dcdcdc;border-radius:3px;"></span>`;
  return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #eaeaea;align-items:flex-start;">
  <a href="${url}" style="flex:0 0 108px;text-decoration:none;">${thumb}</a>
  <div style="flex:1;min-width:0;">
    <span style="display:inline-block;background:#222;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;">${catName}</span>
    <h3 style="margin:7px 0 0;font-size:16px;line-height:1.35;font-weight:600;"><a href="${url}" style="color:#111;text-decoration:none;">${a.title}</a></h3>
  </div>
</div>`;
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Ligne « Source : <journal> » sous un article réécrit (vide si pas de source complète).
export function sourceLine(a) {
  if (!a.sourceNom || !/^https?:\/\//i.test(String(a.sourceUrl || '').trim())) return '';
  return `<p class="cn-source"><em>Source : <a href="${escAttr(a.sourceUrl)}" target="_blank" rel="noopener">${escAttr(a.sourceNom)}</a></em></p>`;
}
