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
    sourceNom: row.source_nom || '',
    sourceUrl: row.source_url || '',
    aLaUne: row.a_la_une === true,
    publishedAt: String(rawDate),
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

// Derniers titres des journaux suivis (bloc « Ailleurs sur le web »).
// Un échec ne doit jamais casser la génération du site : on renvoie alors [].
export async function loadLatestSujets(client, limit = 5) {
  const { data, error } = await client
    .from('sujets')
    .select('titre,url,source_nom,date_source')
    .order('date_source', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) { console.warn(`Ailleurs sur le web ignoré : ${error.message}`); return []; }
  return data;
}

// Brèves publiées, les plus récentes d'abord (page « En direct »).
// Un échec ne doit jamais casser la génération du site : on renvoie alors [].
export async function loadBreves(client, limit = 30) {
  const { data, error } = await client
    .from('breves')
    .select('id,texte,date_publication')
    .eq('statut', 'publie')
    .order('date_publication', { ascending: false })
    .limit(limit);
  if (error) { console.warn(`Brèves ignorées : ${error.message}`); return []; }
  return data.map((b) => ({ id: b.id, texte: b.texte, publishedAt: b.date_publication }));
}
