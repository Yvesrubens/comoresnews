// Habillage commun des pages (en-tête, bandeau, pied, colonne de droite).
import { dateLongue } from './date-bandeau.mjs';
import { categoryPath, articlePath } from './paths.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SLOGAN = "L'actualité des Comores et de la diaspora comorienne";
const UP = 'wp-content/uploads/2026/06/';
const P = 'index.php/pages/';

const RESEAUX = [
  { nom: 'Facebook', url: 'https://www.facebook.com/#', action: "J'aime" },
  { nom: 'X', url: 'https://twitter.com/#', action: 'Suivre' },
  { nom: 'YouTube', url: 'https://www.youtube.com/#', action: "S'abonner" },
];

export function titreSection(texte, { lien = '', libelleLien = '' } = {}) {
  const l = lien ? `<a class="cn-section-lien" href="${esc(lien)}">${esc(libelleLien || 'Voir tout')}</a>` : '';
  return `<div class="cn-section-titre"><h2>${esc(texte)}</h2>${l}</div>`;
}

export function colonneDroite({ pourrait = '', avant = '' } = {}) {
  const reseaux = RESEAUX.map((r) => `<a class="cn-reseau" href="${r.url}" rel="noopener" target="_blank"><b>${r.nom}</b><span>${r.action}</span></a>`).join('');
  return `<aside class="cn-rail">${avant}<div class="cn-suivez"><h3>Suivez-nous</h3>${reseaux}</div><div id="cn-sidebar-ads"></div>${titreSection('Ça pourrait vous intéresser')}${pourrait}</aside>`;
}

function bandeau(titres, prefix) {
  if (!titres.length) return '';
  const items = titres.map((a, i) => `<a class="cn-ticker-item${i === 0 ? ' actif' : ''}" href="${prefix}${articlePath(a.date, a.slug)}">${esc(a.title)}</a>`).join('');
  return `<div class="cn-ticker"><b>À la une</b><div class="cn-ticker-titres">${items}</div><button type="button" class="cn-ticker-prec" aria-label="Titre précédent">&#8249;</button><button type="button" class="cn-ticker-suiv" aria-label="Titre suivant">&#8250;</button></div>`;
}

export function page({ titre, prefix, head = '', contenu, jour, titres = [], catsCfg, actif = '' }) {
  const cats = Object.entries(catsCfg).map(([slug, c]) => ({ slug, ...c })).sort((a, b) => a.order - b.order);
  const lienCat = (c) => `<a href="${prefix}${categoryPath(c.slug)}"${c.slug === actif ? ' class="actif"' : ''}>${esc(c.name)}</a>`;
  const nl = prefix === '' ? '#cn-newsletter' : `${prefix}index.html#cn-newsletter`;
  const titreDoc = titre ? `${esc(titre)} | Comoresnews` : `Comoresnews | ${SLOGAN}`;
  const fav = `${prefix}${UP}`;
  const legaux = [['Mentions légales', 'mentions-legales'], ['Politique de confidentialité', 'politique-confidentialite'], ['Contact', 'contact']]
    .map(([t, s]) => `<a href="${prefix}${P}${s}/index.html">${t}</a>`);
  const reseauxPied = RESEAUX.map((r) => `<a href="${r.url}" rel="noopener" target="_blank">${r.nom}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="fr-FR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titreDoc}</title>
${/name=["']robots["']/.test(head) ? '' : "<meta name='robots' content='max-image-preview:large'>\n"}<link rel="icon" href="${fav}cropped-Favicone-32x32.png" sizes="32x32">
<link rel="icon" href="${fav}cropped-Favicone-192x192.png" sizes="192x192">
<link rel="apple-touch-icon" href="${fav}cropped-Favicone-180x180.png">
<meta name="msapplication-TileImage" content="${fav}cropped-Favicone-270x270.png">
<link rel="stylesheet" href="${prefix}assets/cn.css">
${head}
</head>
<body>
<div class="cn-top"><div class="tdb-head-date-txt">${dateLongue(jour)}</div>${bandeau(titres, prefix)}</div>
<header class="cn-header">
<a class="cn-logo" href="${prefix}index.html"><img src="${prefix}${UP}Logo-4.png" alt="Comoresnews"></a>
<nav class="cn-menu"><a href="${prefix}index.html">Accueil</a>${cats.map(lienCat).join('')}<a class="cn-live" href="${prefix}${P}en-direct/index.html">&#9679; En direct</a></nav>
<a class="cn-loupe" href="${prefix}${P}recherche/index.html" aria-label="Rechercher">&#128269;</a>
<a class="cn-btn" href="${nl}">Newsletter gratuite</a>
<button type="button" class="cn-burger" aria-label="Menu"><span></span><span></span><span></span></button>
</header>
<main id="cn-main">${contenu}</main>
<footer class="cn-footer">
<div class="cn-footer-in">
<div class="cn-footer-col"><img src="${prefix}${UP}Logo-4.png" alt="Comoresnews"><p>${SLOGAN}.</p><div class="cn-footer-liens">${reseauxPied}</div></div>
<div class="cn-footer-col"><h4>Rubriques</h4>${cats.map(lienCat).join('')}</div>
<div class="cn-footer-col"><h4>Informations</h4>${legaux.join('')}</div>
</div>
<div id="cn-legal-bar"><div>${legaux.join(' · ')} · <a href="javascript:Sddan.cmp.displayUI()">Gérer mes choix (cookies)</a></div><div>© 2026 Comoresnews — ${SLOGAN}.</div></div>
</footer>
<script src="${prefix}assets/cn.js" defer></script>
</body>
</html>
`;
}
