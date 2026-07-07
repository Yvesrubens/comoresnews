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
