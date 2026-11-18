// Photos d'illustration uniques : chaque article reçoit sa propre photo libre (Wikimedia Commons),
// jamais une image déjà utilisée par un autre article.
import { slugify } from '../../admin/lib.mjs';
import { legendePhoto } from './lib.mjs';

const UA = { 'User-Agent': 'ComoresnewsBot/1.0 (+https://comoresnews.com)' };
const LEGENDE = /^\*Photo d'illustration :[^\n]*\n\n/;

// Licences acceptées : réutilisation commerciale et modification permises.
export function licenceLibre(licence) {
  const l = String(licence ?? '').trim();
  if (!l || /\b(NC|ND)\b/i.test(l)) return false;
  return /^(CC BY|CC0|Public domain|PD\b|PD-)/i.test(l);
}

// Chemin dans le stockage : dérivé du nom du fichier Commons → même fichier = même adresse (sert au contrôle d'unicité).
export function cheminStockage(fichier) {
  const m = String(fichier).match(/^(.*)\.([a-z0-9]+)$/i);
  const ext = m && m[2].toLowerCase() === 'png' ? 'png' : 'jpg';
  return `commons/u-${slugify(m ? m[1] : fichier)}.${ext}`;
}

// Articles dont l'image est partagée : on garde le plus ancien de chaque image, les autres sont à changer.
export function aRemplacer(articles) {
  const parImage = {};
  for (const a of articles) if (a.image_couverture) (parImage[a.image_couverture] ??= []).push(a);
  return Object.values(parImage).filter((g) => g.length > 1)
    .flatMap((g) => [...g].sort((x, y) => String(x.date_publication).localeCompare(String(y.date_publication))).slice(1));
}

export function pageCommons(corps) {
  const m = String(corps ?? '').match(/^\*Photo d'illustration :[^\n]*\[Wikimedia Commons\]\((https:\/\/commons\.wikimedia\.org\/wiki\/[^)\s]+)\)/);
  return m ? m[1] : null;
}

export function remplacerLegende(corps, legende) {
  return legende + String(corps ?? '').replace(LEGENDE, '');
}

async function api(params) {
  const r = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', action: 'query', ...params }), { headers: UA });
  return r.json();
}

// Fiche d'un fichier Commons : licence, auteur, page, vignette 1 200 px.
export async function infoCommons(fichier) {
  const r = await api({ titles: 'File:' + fichier, prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1200' });
  const p = Object.values(r.query?.pages || {})[0];
  const ii = p?.imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata || {};
  const auteur = (m.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    .split(/The original uploader| Minor modif/)[0].trim() || 'auteur inconnu';
  return { fichier, page: ii.descriptionurl, licence: m.LicenseShortName?.value || '', auteur, vignette: ii.thumburl || ii.url, largeur: ii.width, mime: ii.mime };
}

export async function chercherCommons(requete, limite = 8) {
  const r = await api({ generator: 'search', gsrsearch: 'filetype:bitmap ' + requete, gsrnamespace: '6', gsrlimit: String(limite), prop: 'imageinfo', iiprop: 'extmetadata|size' });
  return Object.values(r.query?.pages || {}).map((p) => {
    const ii = p.imageinfo[0], m = ii.extmetadata || {};
    return { fichier: p.title.slice(5), taille: `${ii.width}x${ii.height}`, licence: m.LicenseShortName?.value || '',
      auteur: (m.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) };
  });
}

// Prépare les champs d'un article pour une photo Commons : licence libre, image non utilisée ailleurs, copie dans le stockage.
// `utilisees` : Map adresse d'image → id de l'article qui l'utilise.
export async function preparerPhoto(db, articleId, { fichier, legende }, utilisees) {
  const info = await infoCommons(fichier);
  if (!info) throw new Error(`fichier Commons introuvable : ${fichier}`);
  if (!licenceLibre(info.licence)) throw new Error(`licence non libre (${info.licence}) : ${fichier}`);
  if (info.largeur < 600) throw new Error(`image trop petite (${info.largeur} px) : ${fichier}`);
  const chemin = cheminStockage(fichier);
  const url = db.storage.from('medias').getPublicUrl(chemin).data.publicUrl;
  for (const cle of [url, decodeURI(info.page)]) {
    const deja = utilisees.get(cle);
    if (deja && deja !== articleId) throw new Error(`image déjà utilisée par un autre article : ${fichier}`);
  }
  const img = Buffer.from(await (await fetch(info.vignette, { headers: UA })).arrayBuffer());
  const { error } = await db.storage.from('medias').upload(chemin, img, { contentType: chemin.endsWith('.png') ? 'image/png' : 'image/jpeg', upsert: true });
  if (error) throw new Error(`stockage : ${error.message}`);
  utilisees.set(url, articleId);
  utilisees.set(decodeURI(info.page), articleId);
  return { url, legende: legendePhoto({ legende, auteur: info.auteur, licence: info.licence, page: info.page }) };
}

export async function imagesUtilisees(db) {
  // Clés : adresse de l'image stockée ET page Commons citée en légende (une même photo peut avoir été stockée sous deux noms).
  const { data, error } = await db.from('articles').select('id,image_couverture,corps');
  if (error) throw new Error(error.message);
  const m = new Map();
  for (const a of data) {
    if (a.image_couverture) m.set(a.image_couverture, a.id);
    const p = pageCommons(a.corps);
    if (p) m.set(decodeURI(p), a.id);
  }
  return m;
}
