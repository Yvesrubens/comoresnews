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
.cn-direct-une{flex:3;min-width:0}.cn-direct-breves{flex:2;min-width:0}
.cn-direct h2{font-size:15px;font-weight:700;text-transform:uppercase;border-left:4px solid #4db2ec;padding-left:8px;margin:0 0 14px}
.cn-direct-card{margin:0 0 20px}.cn-direct-card img,.cn-direct-noimg{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:3px;background:#dcdcdc}
.cn-direct-cat{display:inline-block;background:#222;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;margin-top:8px}
.cn-direct-card h3{margin:6px 0 0;font-size:19px;line-height:1.3}.cn-direct-card h3 a{color:#111;text-decoration:none}
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
