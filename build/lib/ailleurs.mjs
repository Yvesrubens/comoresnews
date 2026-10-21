// Bloc « Ailleurs sur le web » : derniers titres des journaux suivis (sujets
// importés), avec lien vers l'article d'origine. Titre + lien seulement, jamais le texte.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const isHttp = (u) => /^https?:\/\//i.test(String(u || '').trim());

function dateFr(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function ailleursBlock(items) {
  const ok = (items || []).filter((it) => it && it.titre && isHttp(it.url));
  if (!ok.length) return '';
  const rows = ok.map((it) => {
    const date = dateFr(it.date_source);
    const meta = esc(it.source_nom) + (date ? ` · ${date}` : '');
    return `<li><a href="${esc(it.url.trim())}" target="_blank" rel="noopener">${esc(it.titre)}</a><span>${meta}</span></li>`;
  }).join('');
  return `<section id="cn-ailleurs" class="cn-ail">
<style>
.cn-ail{background:#111318;color:#fff;font-family:'Roboto',Arial,sans-serif;padding:28px 15px 18px;}
.cn-ail-in{max-width:1068px;margin:0 auto;}
.cn-ail h2{margin:0 0 14px;padding-left:14px;border-left:4px solid #e50914;font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:#fff;}
.cn-ail ul{list-style:none;margin:0;padding:0;}
.cn-ail li{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:12px 0;border-bottom:1px solid #2a2e37;}
.cn-ail li:last-child{border-bottom:0;}
.cn-ail a{color:#fff;font-weight:600;font-size:16px;line-height:1.4;text-decoration:none;}
.cn-ail a:hover{text-decoration:underline;}
.cn-ail li span{flex:0 0 auto;color:#8f96a3;font-size:14px;white-space:nowrap;}
@media(max-width:600px){.cn-ail li{flex-direction:column;gap:4px;}.cn-ail li span{white-space:normal;}}
</style>
<div class="cn-ail-in"><h2>Ailleurs sur le web</h2><ul>${rows}</ul></div>
</section>`;
}

// Insère le bloc juste avant le pied de page légal (sinon avant </body>). Idempotent.
export function injectAilleurs(html, items) {
  if (html.includes('id="cn-ailleurs"')) return html;
  const block = ailleursBlock(items);
  if (!block) return html;
  if (html.includes('<div id="cn-legal-bar"')) return html.replace('<div id="cn-legal-bar"', () => `${block}\n<div id="cn-legal-bar"`);
  return html.replace('</body>', () => `${block}\n</body>`);
}

// Garde au plus `perSource` titres par journal (ordre d'entrée conservé :
// les plus récents d'abord), puis les `total` premiers — pour mélanger les sources.
export function mixSources(items, perSource = 2, total = 5) {
  const seen = new Map();
  const out = [];
  for (const it of items || []) {
    const n = seen.get(it.source_nom) || 0;
    if (n >= perSource) continue;
    seen.set(it.source_nom, n + 1);
    out.push(it);
    if (out.length >= total) break;
  }
  return out;
}
