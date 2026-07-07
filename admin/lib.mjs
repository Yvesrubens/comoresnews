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
    + `excerpt: ${q(a.excerpt)}\nstatus: ${a.status || 'published'}\n---\n\n${(a.body || '').trim()}\n`;
}

export function parseFiche(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? m[1] : '';
  const body = m ? m[2].replace(/^\n+/, '') : md;
  const get = (k) => {
    const r = new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm);
    if (!r) return '';
    const v = r[1].trim();
    if (v.startsWith('"')) { try { return JSON.parse(v); } catch { return v.replace(/^"|"$/g, ''); } }
    return v;
  };
  return { title: get('title'), slug: get('slug'), category: get('category'), author: get('author'),
    date: get('date'), image: get('image'), excerpt: get('excerpt'), status: get('status') || 'published', body };
}

export function statusFor(mode, date, todayISO) {
  if (mode === 'now') return 'published';
  return date > todayISO ? 'scheduled' : 'published';
}
export function validateArticle(a) {
  const errors = [];
  if (!a.title?.trim()) errors.push('Titre requis');
  if (!/^[a-z0-9-]+$/.test(a.slug || '')) errors.push('Slug invalide (a-z, 0-9, tirets)');
  if (!a.category) errors.push('Catégorie requise');
  if (!a.body?.trim()) errors.push('Corps requis');
  return { ok: errors.length === 0, errors };
}
