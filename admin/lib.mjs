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

// ---- CMS Supabase (base de données) ----

// Renvoie la liste des champs manquants/invalides (vide = OK).
export function validateArticleDB(f) {
  const errs = [];
  if (!f.titre?.trim()) errs.push('titre');
  if (!/^[a-z0-9-]+$/.test(f.slug || '')) errs.push('slug');
  if (!f.categorie?.trim()) errs.push('categorie');
  if (!f.corps?.trim()) errs.push('corps');
  return errs;
}

// Traduit une action UI en statut de workflow DB.
export function nextStatus(action) {
  if (action === 'soumettre') return 'en_attente';
  if (action === 'publier') return 'publie';
  if (action === 'programmer') return 'programme';
  return 'brouillon';
}

// Construit la ligne `articles` à écrire selon l'action et l'auteur.
export function formToRow(f, auteurId) {
  const statut = nextStatus(f.action);
  return {
    titre: f.titre,
    slug: f.slug,
    categorie: f.categorie,
    auteur_id: auteurId,
    corps: f.corps,
    excerpt: f.excerpt || '',
    image_couverture: f.image_couverture || '',
    seo_titre: f.seo_titre || '',
    seo_description: f.seo_description || '',
    og_image: f.og_image || '',
    mots_cles: Array.isArray(f.mots_cles) ? f.mots_cles : [],
    statut,
    date_programmee: statut === 'programme' ? f.date_programmee : null,
    date_publication: statut === 'publie' ? new Date().toISOString() : null,
    commentaire_relecture: f.commentaire_relecture ?? null,
  };
}
