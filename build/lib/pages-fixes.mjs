// Pages fixes recopiées de l'ancien site : on garde leur contenu propre
// (zone td-main-content-wrap) et on les place dans l'habillage commun.
import { page } from './gabarit.mjs';

const DEBUT = '<div class="td-main-content-wrap';
const FIN = '<!-- /.td-main-content-wrap -->';

export function habillerPageFixe(html, { prefix, jour, catsCfg }) {
  const t = html.match(/<title>([\s\S]*?)\s*\|\s*Comoresnews\s*<\/title>/);
  const i = html.indexOf(DEBUT);
  const j = html.indexOf(FIN, i);
  if (!t || i === -1 || j === -1) return html;
  const contenu = html.slice(i, j + FIN.length);
  return page({ titre: t[1].trim(), prefix, contenu, jour, catsCfg });
}
