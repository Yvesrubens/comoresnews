// Cartes d'articles (home, rubriques, article) : markup partagé, styles dans assets/cn.css.
import { articlePath, categoryPath, resolveImg } from './paths.mjs';
import { libelleIle } from './iles.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function dateFr(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return `${d} ${MOIS[m - 1]} ${y}`;
}

export function estPhotoBanque(url) {
  return String(url || '').includes('/medias/commons/');
}

export function tempsLecture(markdown) {
  const mots = String(markdown || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / 200));
}

export function etiquettes(a, catsCfg, prefix = '') {
  const nom = catsCfg?.[a.category]?.name || a.category || '';
  let h = `<a class="cn-tag-cat" href="${esc(prefix + categoryPath(a.category))}">${esc(nom)}</a>`;
  if (a.ile && !(a.ile === 'diaspora' && a.category === 'diaspora')) {
    h += `<span class="cn-tag-ile">${esc(libelleIle(a.ile))}</span>`;
  }
  return `<div class="cn-tags">${h}</div>`;
}

export function carte(a, { variante = 'grille', prefix = '', catsCfg } = {}) {
  const url = esc(prefix + articlePath(a.date, a.slug));
  const src = resolveImg(prefix, a.image);
  const img = src
    ? `<img src="${esc(src)}" alt="${esc(a.title)}" loading="lazy">`
    : '<span class="cn-carte-vide"></span>';
  const titre = `<h3><a href="${url}">${esc(a.title)}</a></h3>`;
  if (variante === 'mini') {
    return `<article class="cn-carte mini">${img}<div class="cn-carte-in">${titre}</div></article>`;
  }
  const meta = `<div class="cn-carte-meta">${a.author ? esc(a.author) + ' · ' : ''}${dateFr(a.date)}</div>`;
  const chapo = variante === 'grande' && a.excerpt ? `<p>${esc(a.excerpt)}</p>` : '';
  const cls = variante === 'grande' || variante === 'ligne' ? variante : 'grille';
  return `<article class="cn-carte ${cls}">${img}<div class="cn-carte-in">${etiquettes(a, catsCfg, prefix)}${titre}${chapo}${meta}</div></article>`;
}

export function grille(articles, opts = {}) {
  if (!articles || !articles.length) return '<p class="cn-vide">Aucun article pour le moment.</p>';
  return `<div class="cn-grille">${articles.map((a) => carte(a, { ...opts, variante: 'grille' })).join('')}</div>`;
}
