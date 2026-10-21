// Client Supabase pour le back-office (navigateur). Utilise la clé anon + la
// session utilisateur ; la RLS applique les droits. Aucune clé secrète ici.
import { createClient } from './vendor/supabase.js';

export function createApi({ url, anonKey, deployHook }) {
  const sb = createClient(url, anonKey);

  async function currentProfile() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('profiles').select('id,nom,role').eq('id', user.id).single();
    return data ? { ...data, email: user.email } : { id: user.id, email: user.email, nom: '', role: 'redacteur' };
  }

  return {
    sb,
    // --- Auth ---
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
    signOut: () => sb.auth.signOut(),
    resetPassword: (email) => sb.auth.resetPasswordForEmail(email),
    onAuth: (cb) => sb.auth.onAuthStateChange((_e, s) => cb(s)),
    getSession: () => sb.auth.getSession(),
    currentProfile,

    // --- Catégories ---
    listCategories: () => sb.from('categories').select('*').order('ordre'),
    saveCategory: (c) => sb.from('categories').upsert(c, { onConflict: 'slug' }),
    deleteCategory: (slug) => sb.from('categories').delete().eq('slug', slug),

    // --- Articles ---
    listArticles: ({ statut, categorie } = {}) => {
      let q = sb.from('articles')
        .select('id,titre,slug,categorie,statut,date_publication,date_programmee,maj_le,auteur_id,commentaire_relecture,a_la_une')
        .order('maj_le', { ascending: false });
      if (statut) q = q.eq('statut', statut);
      if (categorie) q = q.eq('categorie', categorie);
      return q;
    },
    // Articles publiés de tous les auteurs (titre, slug, date) pour l'insertion de liens.
    articlesPourLiens: async () => {
      const r = await sb.rpc('articles_publies_pour_liens');
      if (!r.error) return { data: (r.data || []).map((a) => ({ ...a, statut: 'publie' })), error: null };
      return sb.from('articles').select('id,titre,slug,statut,date_publication').eq('statut', 'publie'); // migration 0010 absente
    },
    // Case « À la une » seule : ne touche ni au statut ni à la date de publication.
    setUne: (id, value) => sb.from('articles').update({ a_la_une: value }).eq('id', id),
    getArticle: (id) => sb.from('articles').select('*').eq('id', id).single(),
    insertArticle: (row) => sb.from('articles').insert(row).select().single(),
    updateArticle: (id, row) => sb.from('articles').update(row).eq('id', id).select().single(),
    deleteArticle: (id) => sb.from('articles').delete().eq('id', id),

    // --- Médiathèque (Storage) ---
    async uploadMedia(file, name) {
      const clean = (name || file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const { error: upErr } = await sb.storage.from('medias').upload(clean, file, { upsert: true, contentType: file.type });
      if (upErr) return { error: upErr };
      const { data: pub } = sb.storage.from('medias').getPublicUrl(clean);
      const { data: { user } } = await sb.auth.getUser();
      await sb.from('media').insert({ chemin: clean, url: pub.publicUrl, importe_par: user?.id });
      return { data: { url: pub.publicUrl, chemin: clean } };
    },
    listMedia: () => sb.from('media').select('*').order('cree_le', { ascending: false }),

    // --- Utilisateurs (admin) ---
    listProfiles: () => sb.from('profiles').select('id,nom,role,cree_le').order('cree_le'),
    setRole: (id, role) => sb.from('profiles').update({ role }).eq('id', id),
    setNom: (id, nom) => sb.from('profiles').update({ nom }).eq('id', id),
    // Invitation par email : Edge Function service_role (déployée en Phase 6)
    inviteUser: (email, nom) => sb.functions.invoke('invite-user', { body: { email, nom } }),

    // --- Sujets importés de la presse (texte source = référence interne) ---
    listSujets: (statut = 'nouveau') => sb.from('sujets')
      .select('id,source_nom,url,titre,categorie,categorie_source,date_source,importe_le,statut')
      .eq('statut', statut).order('importe_le', { ascending: false }).limit(200),
    getSujet: (id) => sb.from('sujets').select('*').eq('id', id).single(),
    countSujets: () => sb.from('sujets').select('id', { count: 'exact', head: true }).eq('statut', 'nouveau'),

    // --- Newsletter (lecture réservée aux admins par la RLS) ---
    listAbonnes: () => sb.from('abonnes').select('email,statut,source,cree_le').order('cree_le', { ascending: false }),
    countAbonnes: () => sb.from('abonnes').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
    listNewsletters: () => sb.from('newsletters')
      .select('id,objet,statut,cree_le,validee_le,envoyee_le,nb_destinataires,nb_envoyes,derniere_erreur')
      .order('cree_le', { ascending: false }).limit(30),
    getNewsletter: (id) => sb.from('newsletters').select('*').eq('id', id).single(),
    createNewsletter: (row) => sb.from('newsletters').insert(row).select().single(),
    updateNewsletter: (id, champs) => sb.from('newsletters').update(champs).eq('id', id),
    validerNewsletter: (id) => sb.rpc('valider_newsletter', { p_id: id }),
    annulerNewsletter: (id) => sb.rpc('annuler_newsletter', { p_id: id }),
    arreterNewsletter: (id) => sb.rpc('arreter_newsletter', { p_id: id }),
    lastSentNewsletter: () => sb.from('newsletters').select('envoyee_le,nb_envoyes').eq('statut', 'envoyee')
      .order('envoyee_le', { ascending: false }).limit(1).maybeSingle(),
    listPublishedSince: (iso) => sb.from('articles')
      .select('id,titre,slug,categorie,excerpt,image_couverture,date_publication,statut')
      .eq('statut', 'publie').gt('date_publication', iso).order('date_publication', { ascending: false }),
    getSujetByArticle: (articleId) => sb.from('sujets').select('*').eq('article_id', articleId).maybeSingle(),
    ignorerSujet: (id) => sb.from('sujets').update({ statut: 'ignore' }).eq('id', id),
    // Réserve le sujet et crée un brouillon d'article vide (atomique côté base).
    redigerSujet: (sujetId, categorie, slug) =>
      sb.rpc('rediger_sujet', { p_sujet: sujetId, p_categorie: categorie, p_slug: slug }),

    // --- Déclenchement du rebuild du site public ---
    // Appelle directement le Deploy Hook Vercel si configuré (URL de capacité :
    // déclenche seulement un build, n'expose aucune donnée), sinon Edge Function.
    triggerDeploy: async () => {
      if (deployHook) return fetch(deployHook, { method: 'POST' });
      return sb.functions.invoke('trigger-deploy');
    },
  };
}
