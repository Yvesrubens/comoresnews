// Réécriture des brouillons issus des sujets : contrôles et mise en forme (fonctions pures).

import { normaliserIle } from '../../build/lib/iles.mjs';

export const CATEGORIES = ['politique', 'economie', 'societe', 'culture', 'sport', 'diaspora', 'monde', 'tourisme', 'annonces'];

const mots = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

// Nombre de suites de `n` mots du texte réécrit présentes telles quelles dans la source (citations exclues).
// Les noms d'institutions et de personnes en produisent quelques-unes : seuil large dans `controler`.
export function reprises(corps, source, n = 8) {
  const sans = String(corps ?? '').replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, ' ');
  const s = mots(source);
  const src = new Set();
  for (let i = 0; i + n <= s.length; i++) src.add(s.slice(i, i + n).join(' '));
  const c = mots(sans);
  let hits = 0;
  for (let i = 0; i + n <= c.length; i++) if (src.has(c.slice(i, i + n).join(' '))) hits++;
  return hits;
}

// Liste des problèmes d'un article réécrit (vide = conforme).
export function controler(a, texteSource, { pool, liens }) {
  const p = [];
  if (!a.titre || a.titre.length > 100) p.push('titre');
  if (!a.excerpt || a.excerpt.length > 230) p.push('excerpt');
  const n = mots(a.corps).length;
  if (n < 80 || n > 750) p.push(`corps ${n} mots`);
  if (/^#\s/m.test(a.corps || '')) p.push('titre # dans le corps');
  for (const m of String(a.corps ?? '').matchAll(/\]\(([^)]+)\)/g)) if (!liens.has(m[1])) p.push('lien non autorisé ' + m[1]);
  if (a.photo !== null && a.photo !== undefined && !pool[a.photo]) p.push('photo inconnue ' + a.photo);
  if (!CATEGORIES.includes(a.categorie)) p.push('categorie ' + a.categorie);
  try { normaliserIle(a.ile); } catch { p.push('ile ' + a.ile); }
  const r = reprises(a.corps, texteSource);
  if (r > 30) p.push(`${r} reprises de 8 mots du texte source`);
  return p;
}

// Légende placée en tête du corps : auteur et licence exigés par les licences Creative Commons.
export function legendePhoto(ph) {
  return ph ? `*Photo d'illustration : ${ph.legende} — ${ph.auteur}, ${ph.licence}, via [Wikimedia Commons](${ph.page}).*\n\n` : '';
}

export function decouper(items, taille = 9) {
  const lots = [];
  for (let i = 0; i < items.length; i += taille) lots.push(items.slice(i, i + taille));
  return lots;
}
