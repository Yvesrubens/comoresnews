export function articlePath(date, slug) {
  const [y, m, d] = date.split('-');
  return `index.php/${y}/${m}/${d}/${slug}/index.html`;
}
export function categoryPath(slug) {
  return `index.php/category/${slug}/index.html`;
}
export function relPrefix(fromPageRel) {
  const depth = fromPageRel.split('/').length - 1; // nb de dossiers
  return '../'.repeat(depth);
}
// Résout une image : URL absolue (Supabase Storage) renvoyée telle quelle,
// chemin relatif (fiches Markdown) préfixé du chemin relatif de la page.
export function resolveImg(prefix, img) {
  if (!img) return '';
  return /^https?:\/\//.test(img) ? img : prefix + img;
}
