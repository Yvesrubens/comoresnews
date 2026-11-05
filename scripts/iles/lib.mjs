// Remplissage unique de l'île des articles déjà publiés (fonctions pures).

import { normaliserIle } from '../../build/lib/iles.mjs';

// Articles publiés sans île, avec de quoi choisir : titre, chapô, 120 premiers mots du corps.
export function aRemplir(rows) {
  return rows
    .filter((r) => r.statut === 'publie' && r.ile == null)
    .map((r) => ({
      id: r.id,
      titre: r.titre,
      excerpt: r.excerpt || '',
      extrait: String(r.corps || '').split(/\s+/).filter(Boolean).slice(0, 120).join(' '),
    }));
}

// Mises à jour à écrire : seulement des articles existants encore sans île, et des îles non nulles.
// Une valeur inconnue fait échouer l'ensemble (normaliserIle lève).
export function miseAJour(choix, rows) {
  const sansIle = new Set(rows.filter((r) => r.ile == null).map((r) => r.id));
  return choix
    .map((c) => ({ id: c.id, ile: normaliserIle(c.ile) }))
    .filter((c) => c.ile && sansIle.has(c.id));
}
