export function slugify(str) {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
export function articleUrl(date, slug) {
  const [y, m, d] = date.split('-');
  return `index.php/${y}/${m}/${d}/${slug}/index.html`;
}
export function imageUploadPath(date, filename) {
  const [y, m] = date.split('-');
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : 'png';
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename);
  return `wp-content/uploads/${y}/${m}/${base}.${ext}`;
}
export function buildFrontmatter(a) {
  const q = (s) => JSON.stringify(String(s ?? ''));
  return `---\ntitle: ${q(a.title)}\nslug: ${a.slug}\ncategory: ${a.category}\n`
    + `author: ${a.author || 'Comoresnews'}\ndate: ${a.date}\nimage: ${a.image || ''}\n`
    + `excerpt: ${q(a.excerpt)}\nstatus: published\n---\n\n${(a.body || '').trim()}\n`;
}
export function validateArticle(a) {
  const errors = [];
  if (!a.title?.trim()) errors.push('Titre requis');
  if (!/^[a-z0-9-]+$/.test(a.slug || '')) errors.push('Slug invalide (a-z, 0-9, tirets)');
  if (!a.category) errors.push('Catégorie requise');
  if (!a.body?.trim()) errors.push('Corps requis');
  return { ok: errors.length === 0, errors };
}
