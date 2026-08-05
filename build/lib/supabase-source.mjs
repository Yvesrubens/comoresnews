import { createClient } from '@supabase/supabase-js';

// Vocabulaire de statut DB -> vocabulaire attendu par le build (comme content.mjs)
const STATUT_TO_BUILD = {
  publie: 'published',
  programme: 'scheduled',
  brouillon: 'draft',
  en_attente: 'draft',
};

// Convertit une ligne de la table `articles` (jointe à profiles) en objet
// article de MÊME forme que build/lib/content.mjs::parseArticle, plus champs SEO.
export function mapRow(row) {
  const rawDate = row.date_publication || row.date_programmee || row.cree_le;
  return {
    title: String(row.titre),
    slug: String(row.slug),
    category: String(row.categorie),
    author: String(row.profiles?.nom || 'Comoresnews'),
    date: String(rawDate).slice(0, 10),
    image: row.image_couverture || '',
    excerpt: row.excerpt || '',
    status: STATUT_TO_BUILD[row.statut] || 'draft',
    body: row.corps || '',
    seoTitle: row.seo_titre || '',
    seoDescription: row.seo_description || '',
    ogImage: row.og_image || '',
    keywords: Array.isArray(row.mots_cles) ? row.mots_cles : [],
  };
}

export function makeClient(
  url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
) {
  if (!url || !key) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Charge les articles publiables (publiés + programmés déjà échus).
export async function loadArticlesFromSupabase(client, nowISO) {
  const { data, error } = await client
    .from('articles')
    .select('*, profiles!articles_auteur_id_fkey(nom)')
    .in('statut', ['publie', 'programme']);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data.map(mapRow).filter((a) => {
    if (a.status === 'published') return true;
    if (a.status === 'scheduled') return a.date <= nowISO; // filet, le cron gère la bascule
    return false;
  });
}
