import { carte } from './cartes.mjs';

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
<section class="cn-direct-une"><h2>À la une</h2>${une.length ? `<div class="cn-grille">${une.map((a) => carte(a, { variante: 'grille', prefix: P, catsCfg })).join('')}</div>` : ''}</section>
<section class="cn-direct-breves"><h2>Brèves</h2>${brevesHtml(breves)}</section>
</div>${SCRIPT}`;
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

// Bloc « Les plus récents » : les `n` derniers articles absents d'`exclus`.
export function plusRecents(articles, exclus, n = 4) {
  const pris = new Set(exclus.map((a) => a.slug));
  return [...articles].sort(byRecent).filter((a) => !pris.has(a.slug)).slice(0, n);
}
