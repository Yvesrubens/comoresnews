// Liste canonique des îles d'un article (slug en base → libellé affiché).
// Le back-office (admin/lib.mjs, servi seul au navigateur) en garde une copie testée contre celle-ci.

export const ILES = Object.freeze({
  ngazidja: 'Ngazidja',
  ndzuani: 'Ndzuani',
  mwali: 'Mwali',
  maore: 'Maoré',
  diaspora: 'Diaspora',
});

// Slug valide → lui-même ; absent ou vide → null ; toute autre valeur → erreur.
export function normaliserIle(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && Object.hasOwn(ILES, v)) return v;
  throw new Error('île inconnue : ' + v);
}

export function libelleIle(slug) {
  return slug ? ILES[slug] || '' : '';
}
