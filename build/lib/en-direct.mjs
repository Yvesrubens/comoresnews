import { articlePath, resolveImg } from './paths.mjs';

// Page « En direct » et listes « À la une » (accueil).

const COMORES_MS = 3 * 3600 * 1000; // UTC+3
const comoros = (iso) => new Date(new Date(iso).getTime() + COMORES_MS); // lire avec les getters UTC
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stamp = (a) => a.publishedAt || a.date || '';

export function byRecent(a, b) {
  return stamp(b).localeCompare(stamp(a));
}

// Articles cochés « À la une », récents d'abord ; aucun coché → les derniers publiés.
export function pickUne(articles, max = 8) {
  const coches = articles.filter((a) => a.aLaUne).sort(byRecent);
  return (coches.length ? coches : [...articles].sort(byRecent)).slice(0, max);
}

// Grille de l'accueil : cochés d'abord, complétés par les derniers publiés.
export function homeUne(articles, n = 4) {
  const coches = articles.filter((a) => a.aLaUne).sort(byRecent).slice(0, n);
  const pris = new Set(coches.map((a) => a.slug));
  const reste = [...articles].sort(byRecent).filter((a) => !pris.has(a.slug));
  return coches.concat(reste).slice(0, n);
}

export function breveTime(iso) {
  const d = comoros(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function breveDayKey(iso) {
  return comoros(iso).toISOString().slice(0, 10);
}

export function breveDayFallback(iso) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(comoros(iso));
}

function uneCard(a, P, catsCfg) {
  const url = P + articlePath(a.date, a.slug);
  const img = a.image
    ? `<img src="${resolveImg(P, a.image)}" alt="" loading="lazy" decoding="async">`
    : '<span class="cn-direct-noimg"></span>';
  return `<article class="cn-direct-card"><a href="${url}">${img}</a>
  <span class="cn-direct-cat">${esc(catsCfg[a.category]?.name || '')}</span>
  <h3><a href="${url}">${esc(a.title)}</a></h3></article>`;
}

function brevesHtml(breves) {
  if (!breves.length) return '<p class="cn-direct-vide">Aucune brève pour le moment.</p>';
  let out = '';
  let jour = null;
  for (const b of breves) {
    const k = breveDayKey(b.publishedAt);
    if (k !== jour) {
      if (jour !== null) out += '</ul>';
      out += `<h4 class="cn-day" data-day="${k}">${esc(breveDayFallback(b.publishedAt))}</h4><ul>`;
      jour = k;
    }
    out += `<li><time datetime="${esc(b.publishedAt)}">${breveTime(b.publishedAt)}</time> <span>${esc(b.texte)}</span></li>`;
  }
  return out + '</ul>';
}

const CSS = `<style>
.cn-direct{display:flex;gap:28px;align-items:flex-start;padding:8px 0 24px}
.cn-direct-une{flex:3;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:0 18px;align-content:start}.cn-direct-une>h2,.cn-direct-une>.cn-direct-card:first-of-type{grid-column:1/-1}.cn-direct-breves{flex:2;min-width:0}
.cn-direct h2{font-size:15px;font-weight:700;text-transform:uppercase;border-left:4px solid #4db2ec;padding-left:8px;margin:0 0 14px}
.cn-direct-card{margin:0 0 20px}.cn-direct-card img,.cn-direct-noimg{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:3px;background:#dcdcdc}
.cn-direct-cat{display:inline-block;background:#222;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;margin-top:8px}
.cn-direct-card h3{margin:6px 0 0;font-size:16px;line-height:1.3}.cn-direct-card:first-of-type h3{font-size:22px}.cn-direct-card h3 a{color:#111;text-decoration:none}
.cn-direct-breves ul{list-style:none;margin:0 0 12px;padding:0}
.cn-direct-breves li{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eaeaea;font-size:15px;line-height:1.45}
.cn-direct-breves time{flex:0 0 44px;font-weight:700;color:#e0262b}
.cn-day{font-size:12px;font-weight:700;text-transform:uppercase;color:#777;margin:14px 0 2px}
.cn-direct-vide{color:#999;font-style:italic}
@media (max-width:767px){.cn-direct{flex-direction:column}.cn-direct-breves{order:-1}}
</style>`;

// Libellés « Aujourd'hui » / « Hier » calculés chez le lecteur (heure des Comores).
const SCRIPT = `<script>(function(){var k=function(t){return new Date(t+10800000).toISOString().slice(0,10)};var n=Date.now();var a=k(n),h=k(n-86400000);document.querySelectorAll('.cn-day').forEach(function(e){var d=e.getAttribute('data-day');if(d===a)e.textContent="Aujourd'hui";else if(d===h)e.textContent='Hier';});})();</script>`;

// Contenu de la page : colonne « À la une » + colonne « Brèves ».
export function enDirectInner(une, breves, P, catsCfg) {
  return `${CSS}<div class="cn-direct">
<section class="cn-direct-une"><h2>À la une</h2>${une.map((a) => uneCard(a, P, catsCfg)).join('\n')}</section>
<section class="cn-direct-breves"><h2>Brèves</h2>${brevesHtml(breves)}</section>
</div>${SCRIPT}`;
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Une case de la grille « À la une » de l'accueil (balisage du thème, page à la racine).
function gridPost(a, i, catsCfg) {
  const url = articlePath(a.date, a.slug);
  const t = esc(a.title);
  const img = a.image ? resolveImg('', a.image) : '';
  const thumb = img
    ? `<span class="entry-thumb td-thumb-css" data-type="css_image" data-img-url="${esc(img)}" style="background-image:url('${esc(img)}')"></span>`
    : '<span class="entry-thumb td-thumb-css" style="background:#dcdcdc"></span>';
  const date = i === 0
    ? `<div class="td-editor-date"><span class="td-post-date"><time class="entry-date updated td-module-date" datetime="${esc(stamp(a))}">${MOIS.format(new Date(a.date + 'T12:00:00Z'))}</time></span></div>`
    : '';
  return `<div class="td_module_flex_${i === 0 ? 6 : i === 1 ? 7 : 8} td-animation-stack td-big-grid-flex-post td-big-grid-flex-post-${i} td-cpt-post">
  <div class="td-module-container td-category-pos-above">
    <div class="td-image-container"><div class="td-module-thumb"><a href="${url}" rel="bookmark" class="td-image-wrap " title="${t}">${thumb}</a></div></div>
    <div class="td-module-meta-info">
      <a href="index.php/category/${esc(a.category)}/index.html" class="td-post-category">${esc(catsCfg[a.category]?.name || '')}</a>
      <div class="tdb-module-title-wrap"><h3 class="entry-title td-module-title"><a href="${url}" rel="bookmark" title="${t}">${t}</a></h3></div>
      ${date}
    </div>
  </div>
</div>`;
}

export function uneGridHtml(list, catsCfg) {
  if (!list.length) return '';
  const [first, ...rest] = list;
  return `${gridPost(first, 0, catsCfg)}
<div class="td-big-grid-flex-scroll-holder">${rest.map((a, i) => gridPost(a, i + 1, catsCfg)).join('\n')}</div>`;
}

// Jour précédent (AAAA-MM-JJ) d'un jour AAAA-MM-JJ.
function veilleDe(jour) {
  return new Date(Date.parse(jour + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
}

// Bloc « À ne pas manquer » : les articles publiés la veille de `jour` (heure des Comores),
// hors ceux déjà à la une, les plus récents d'abord ; si la veille en compte moins de `n`,
// on complète avec les plus récents qui ne sont pas à la une.
export function aNePasManquer(articles, une, jour, n = 5) {
  const pris = new Set(une.map((a) => a.slug));
  const dispo = [...articles].sort(byRecent).filter((a) => !pris.has(a.slug));
  const veille = veilleDe(jour);
  const hier = dispo.filter((a) => a.date === veille).slice(0, n);
  const vus = new Set(hier.map((a) => a.slug));
  return hier.concat(dispo.filter((a) => !vus.has(a.slug))).slice(0, n);
}

// Balisage du thème (td_flex_block_3) : un grand article puis une colonne de petits.
function manquerPost(a, grand, catsCfg) {
  const url = articlePath(a.date, a.slug);
  const t = esc(a.title);
  const img = a.image ? resolveImg('', a.image) : '';
  const thumb = img
    ? `<span class="entry-thumb td-thumb-css" data-type="css_image" data-img-url="${esc(img)}" style="background-image:url('${esc(img)}')"></span>`
    : '<span class="entry-thumb td-thumb-css" style="background:#dcdcdc"></span>';
  const date = `<span class="td-post-date"><time class="entry-date updated td-module-date" datetime="${esc(stamp(a))}">${MOIS.format(new Date(a.date + 'T12:00:00Z'))}</time></span>`;
  const cat = grand ? `<a href="index.php/category/${esc(a.category)}/index.html" class="td-post-category">${esc(catsCfg[a.category]?.name || '')}</a>` : '';
  return `<div class="td_module_flex td_module_flex_${grand ? 1 : 3} td_module_wrap td-animation-stack td-cpt-post">
  <div class="td-module-container td-category-pos-${grand ? 'image' : ''}">
    <div class="td-image-container">${cat}<div class="td-module-thumb"><a href="${url}" rel="bookmark" class="td-image-wrap " title="${t}">${thumb}</a></div></div>
    <div class="td-module-meta-info">
      <h3 class="entry-title td-module-title"><a href="${url}" rel="bookmark" title="${t}">${t}</a></h3>
      <div class="td-editor-date"><span class="td-author-date">${date}</span></div>
      ${grand && a.excerpt ? `<div class="td-excerpt">${esc(a.excerpt)}</div>` : ''}
    </div>
  </div>
</div>`;
}

export function aNePasManquerHtml(list, catsCfg) {
  if (!list.length) return '';
  const [first, ...rest] = list;
  return `${manquerPost(first, true, catsCfg)}
<div class="td_module_column">${rest.map((a) => manquerPost(a, false, catsCfg)).join('\n')}</div>`;
}

// Bandeau « À la une » : titres des articles publiés le jour `jour` (10 max) ;
// aucun ce jour-là → les articles de la grille à la une.
export function titresDuJour(articles, jour, une, max = 10) {
  const auj = articles.filter((a) => a.date === jour).sort(byRecent).slice(0, max);
  return auj.length ? auj : une;
}

// Bloc latéral « Ça pourrait vous intéresser » : `n` articles absents des autres blocs
// (`exclus`), une rubrique différente par article d'abord, complétés par les plus récents.
export function pourraitInteresser(articles, exclus, n = 4) {
  const pris = new Set(exclus.map((a) => a.slug));
  const dispo = [...articles].sort(byRecent).filter((a) => !pris.has(a.slug));
  const rubriques = new Set();
  const choix = [];
  for (const a of dispo) {
    if (choix.length < n && !rubriques.has(a.category)) { rubriques.add(a.category); choix.push(a); }
  }
  const vus = new Set(choix.map((a) => a.slug));
  return choix.concat(dispo.filter((a) => !vus.has(a.slug))).slice(0, n);
}

export function pourraitHtml(list, catsCfg) {
  return list.map((a) => {
    const url = articlePath(a.date, a.slug);
    const t = esc(a.title);
    const img = a.image ? resolveImg('', a.image) : '';
    const thumb = img
      ? `<span class="entry-thumb td-thumb-css" data-type="css_image" data-img-url="${esc(img)}" style="background-image:url('${esc(img)}')"></span>`
      : '<span class="entry-thumb td-thumb-css" style="background:#dcdcdc"></span>';
    return `<div class="td_module_flex td_module_flex_1 td_module_wrap td-animation-stack td-cpt-post">
  <div class="td-module-container td-category-pos-image">
    <div class="td-image-container"><a href="index.php/category/${esc(a.category)}/index.html" class="td-post-category">${esc(catsCfg[a.category]?.name || '')}</a><div class="td-module-thumb"><a href="${url}" rel="bookmark" class="td-image-wrap " title="${t}">${thumb}</a></div></div>
    <div class="td-module-meta-info"><h3 class="entry-title td-module-title"><a href="${url}" rel="bookmark" title="${t}">${t}</a></h3></div>
  </div>
</div>`;
  }).join('\n');
}

export function uneTickerHtml(list) {
  return list.map((a, i) => {
    const t = esc(a.title);
    return `<div class="td_module_trending_now td-trending-now-post-${i} td-trending-now-post td-cpt-post"><h2 class="entry-title td-module-title"><a href="${articlePath(a.date, a.slug)}" rel="bookmark" title="${t}">${t}</a></h2></div>`;
  }).join('\n');
}
