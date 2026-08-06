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
        .select('id,titre,slug,categorie,statut,date_publication,date_programmee,maj_le,auteur_id')
        .order('maj_le', { ascending: false });
      if (statut) q = q.eq('statut', statut);
      if (categorie) q = q.eq('categorie', categorie);
      return q;
    },
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

    // --- Déclenchement du rebuild du site public ---
    // Appelle directement le Deploy Hook Vercel si configuré (URL de capacité :
    // déclenche seulement un build, n'expose aucune donnée), sinon Edge Function.
    triggerDeploy: async () => {
      if (deployHook) return fetch(deployHook, { method: 'POST' });
      return sb.functions.invoke('trigger-deploy');
    },
  };
}
