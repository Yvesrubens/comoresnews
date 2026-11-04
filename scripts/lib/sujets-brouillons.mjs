// Sujets importés → articles brouillons à réécrire (seulement s'ils concernent les Comores).
import { slugify } from '../../admin/lib.mjs';

// Pays, îles (noms français et comoriens), villes, président, langue, monnaie.
const COMORES = /comor|moroni|anjouan|moh[eé]li|grande[- ]comore|ngazidja|ndzuani|mwali|mayotte|maore|mutsamudu|fomboni|azali|shikomori/i;

export function concerneComores(texte) {
  return COMORES.test(String(texte ?? ''));
}

const CATEGORIE_PAR_DEFAUT = 'societe';

// Ligne `articles` pour un sujet. `slugsPris` : slugs déjà utilisés (complété au passage).
export function brouillonDepuisSujet(sujet, auteurId, slugsPris) {
  const base = slugify(sujet.titre) || 'sujet';
  let slug = base;
  for (let n = 2; slugsPris.has(slug); n++) slug = `${base}-${n}`;
  slugsPris.add(slug);
  return {
    titre: sujet.titre,
    slug,
    categorie: sujet.categorie || CATEGORIE_PAR_DEFAUT,
    auteur_id: auteurId,
    corps: '',
    statut: 'brouillon',
    source_nom: sujet.source_nom,
    source_url: sujet.url,
  };
}

// Sujets en attente à convertir (rattrapage) : nouveaux, sans article, récents, sur les Comores.
export function sujetsAConvertir(rows, now, jours = 7) {
  const depuis = now.getTime() - jours * 86400e3;
  return rows.filter((r) => r.statut === 'nouveau' && !r.article_id
    && new Date(r.importe_le).getTime() >= depuis
    && concerneComores(`${r.titre} ${r.texte}`));
}

// Crée les brouillons et lie chaque sujet à son article (client Supabase service_role).
// Renvoie le nombre de brouillons créés ; un échec sur un sujet n'arrête pas les autres.
export async function creerBrouillons(sb, sujets, { auteurNom = 'Comoresnews', log = console.log } = {}) {
  if (!sujets.length) return 0;
  const { data: prof, error: e1 } = await sb.from('profiles').select('id').eq('nom', auteurNom).limit(1).maybeSingle();
  if (e1 || !prof) throw new Error(`profil « ${auteurNom} » introuvable pour les brouillons`);
  const { data: slugs, error: e2 } = await sb.from('articles').select('slug');
  if (e2) throw new Error(`Supabase: ${e2.message}`);
  const pris = new Set((slugs || []).map((r) => r.slug));
  let n = 0;
  for (const s of sujets) {
    const row = brouillonDepuisSujet(s, prof.id, pris);
    const { data: art, error } = await sb.from('articles').insert(row).select('id').single();
    if (error) { log(`  brouillon impossible pour « ${s.titre} » : ${error.message}`); continue; }
    const { error: e3 } = await sb.from('sujets').update({ statut: 'traite', article_id: art.id }).eq('id', s.id);
    if (e3) log(`  sujet non lié « ${s.titre} » : ${e3.message}`);
    n++;
  }
  return n;
}
