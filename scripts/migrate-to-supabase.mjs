// Import des fiches Markdown existantes vers Supabase (articles + images).
// Exécution : node --env-file=.env scripts/migrate-to-supabase.mjs
// Nécessite SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadArticles } from '../build/lib/content.mjs';

const AUTEUR_EMAIL = 'redaction@comoresnews.com';
const AUTEUR_NOM = 'Comoresnews';
const CT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// Pur : convertit une fiche (forme content.mjs) en ligne de la table articles (statut publié).
export function ficheToRow(a, auteurId) {
  return {
    titre: a.title,
    slug: a.slug,
    categorie: a.category,
    auteur_id: auteurId,
    corps: a.body,
    excerpt: a.excerpt,
    image_couverture: a.image,
    seo_titre: '',
    seo_description: a.excerpt,
    og_image: a.image,
    mots_cles: [],
    statut: 'publie',
    date_publication: new Date(a.date + 'T08:00:00Z').toISOString(),
  };
}

async function ensureAuthor(sb) {
  const { data } = await sb.auth.admin.listUsers();
  const found = data.users.find((u) => u.email === AUTEUR_EMAIL);
  if (found) return found.id;
  const { data: created, error } = await sb.auth.admin.createUser({
    email: AUTEUR_EMAIL, email_confirm: true, user_metadata: { nom: AUTEUR_NOM },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  return created.user.id;
}

async function main() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const auteurId = await ensureAuthor(sb);
  console.log('Auteur:', auteurId);

  const cats = Object.keys(JSON.parse(fs.readFileSync('config/categories.json', 'utf8')));
  const arts = loadArticles(path.join(process.cwd(), 'content/articles'), cats);

  for (const a of arts) {
    if (a.image && fs.existsSync(a.image)) {
      const base = path.basename(a.image);
      const buf = fs.readFileSync(a.image);
      const ct = CT[path.extname(a.image).toLowerCase()] || 'application/octet-stream';
      const { error: upErr } = await sb.storage.from('medias').upload(base, buf, { upsert: true, contentType: ct });
      if (upErr) throw new Error(`upload ${base}: ${upErr.message}`);
      const { data: pub } = sb.storage.from('medias').getPublicUrl(base);
      a.image = pub.publicUrl; // URL publique absolue
    }
    const { error } = await sb.from('articles').upsert(ficheToRow(a, auteurId), { onConflict: 'slug' });
    if (error) throw new Error(`${a.slug}: ${error.message}`);
    console.log('OK', a.slug);
  }
  console.log(`\nMigration terminée : ${arts.length} articles.`);
}

if (process.argv[1] && process.argv[1].endsWith('migrate-to-supabase.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
