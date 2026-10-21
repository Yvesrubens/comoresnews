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
  const une = f.a_la_une === undefined ? {} : { a_la_une: !!f.a_la_une }; // champ réservé aux admins
  return {
    ...une,
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
    source_nom: f.source_nom || null,
    source_url: f.source_url || null,
  };
}

// ---- Tableau de bord ----

// Lundi 0h (heure locale) de la semaine de `now`.
export function startOfWeek(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - offset);
  return d;
}

const t = (v) => (v ? new Date(v).getTime() : NaN);

// Chiffres du tableau de bord à partir des lignes `articles` visibles par l'utilisateur.
export function summarizeArticles(rows, now) {
  const week = startOfWeek(now).getTime();
  const n = now.getTime();
  return {
    enAttente: rows.filter((r) => r.statut === 'en_attente').length,
    programmes: rows.filter((r) => r.statut === 'programme' && t(r.date_programmee) > n).length,
    publiesSemaine: rows.filter((r) => r.statut === 'publie' && t(r.date_publication) >= week).length,
  };
}

// Publications programmées à venir, de la plus proche à la plus lointaine.
export function upcomingScheduled(rows, now, limit = 5) {
  const n = now.getTime();
  return rows
    .filter((r) => r.statut === 'programme' && t(r.date_programmee) > n)
    .sort((a, b) => t(a.date_programmee) - t(b.date_programmee))
    .slice(0, limit);
}

// Pour un rédacteur : ses articles en attente ou renvoyés en brouillon avec un commentaire.
export function myPending(rows) {
  return rows
    .filter((r) => r.statut === 'en_attente' || (r.statut === 'brouillon' && r.commentaire_relecture))
    .sort((a, b) => t(b.maj_le) - t(a.maj_le));
}

// "mardi 20 octobre"
export function formatDateLongFr(now) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
}

// "à l'instant", "il y a 25 min", "il y a 2 h", "hier", "le 12/10"
export function relativeTime(value, now) {
  if (!value) return '';
  const d = new Date(value);
  const min = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.floor(min / 60)} h`;
  if (min < 48 * 60) return 'hier';
  return `le ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---- Newsletter ----

// Export des abonnés (séparateur « ; » pour Excel en français).
export function abonnesToCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ['email;statut;inscrit_le;page'];
  for (const r of rows || []) {
    lines.push([r.email, r.statut, String(r.cree_le || '').slice(0, 10), r.source].map(cell).join(';'));
  }
  return lines.join('\r\n');
}

const COMORES_MS = 3 * 3600 * 1000; // UTC+3
const comoros = (d) => new Date(d.getTime() + COMORES_MS); // lire avec les getters UTC

// Vendredi, à l'heure des Comores.
export function isFridayComoros(now) {
  return comoros(now).getUTCDay() === 5;
}

// Le vendredi, rappeler de préparer la newsletter si aucune n'est partie, en cours ou validée depuis lundi (heure des Comores).
export function newsletterDueThisWeek(newsletters, now) {
  if (!isFridayComoros(now)) return false;
  const local = comoros(now);
  const offset = (local.getUTCDay() + 6) % 7;
  const lundiUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - offset) - COMORES_MS;
  return !(newsletters || []).some((n) => ['envoyee', 'en_cours', 'validee'].includes(n.statut) && new Date(n.cree_le).getTime() >= lundiUtc);
}

// ---------- Liens dans le corps d'un article ----------
// Entoure la sélection [start,end) d'un lien Markdown ; sans sélection, insère `label` (ou l'URL).
export function insertLink(text, start, end, label, url) {
  const sel = text.slice(start, end);
  const lien = `[${sel || label || url}](${url})`;
  return { text: text.slice(0, start) + lien + text.slice(end), cursor: start + lien.length };
}
// Chemin public d'un article publié, depuis la racine du site.
export function internalLinkTarget(a) {
  return '/' + articleUrl(String(a.date_publication).slice(0, 10), a.slug);
}
const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function searchArticles(rows, q, limit = 8) {
  const n = sansAccents(q).trim();
  return rows.filter((r) => r.statut === 'publie' && (!n || sansAccents(r.titre).includes(n))).slice(0, limit);
}
