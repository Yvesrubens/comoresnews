import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Seuil : on ne convertit en WebP que les images « lourdes » (photos).
// En dessous, ce sont des logos/favicons/petites vignettes -> on les laisse tels quels.
const MIN_BYTES = 100 * 1024;   // 100 Ko
const MAX_WIDTH = 1200;         // largeur max servie
const WEBP_QUALITY = 74;

function walkHtml(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, out);
    else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// Récupère tous les chemins d'images (relatifs, sans préfixe ../) référencés dans le HTML.
function collectRefs(html) {
  const set = new Set();
  const re = /(?:src=|data-img-url=|url\()\s*['"]?((?:\.\.\/)*wp-content\/uploads\/[^"')\s]+?\.(?:png|jpe?g))/gi;
  let m;
  while ((m = re.exec(html))) set.add(m[1].replace(/^(\.\.\/)+/, ''));
  return set;
}

/**
 * Optimise les images du site généré :
 *  - convertit en WebP (+ redimensionne) les photos > 100 Ko réellement référencées,
 *  - réécrit les références .png/.jpg -> .webp dans le HTML (src=, url()) et le JSON de recherche,
 *  - ajoute loading="lazy" aux <img> qui n'ont pas d'attribut loading.
 * Idempotent : un .webp déjà présent et plus récent que sa source n'est pas régénéré.
 */
export async function optimizeImages(outDir) {
  const htmlFiles = walkHtml(outDir);
  const referenced = new Set();
  for (const f of htmlFiles) for (const r of collectRefs(fs.readFileSync(f, 'utf8'))) referenced.add(r);

  // Génère les WebP pour les images lourdes référencées.
  const converted = new Map(); // rel .png -> rel .webp
  let saved = 0, bytesBefore = 0, bytesAfter = 0;
  for (const rel of referenced) {
    const srcAbs = path.join(outDir, rel);
    if (!fs.existsSync(srcAbs)) continue;
    const size = fs.statSync(srcAbs).size;
    if (size < MIN_BYTES) continue;
    const webpRel = rel.replace(/\.(png|jpe?g)$/i, '.webp');
    const webpAbs = path.join(outDir, webpRel);
    converted.set(rel, webpRel);
    if (!fs.existsSync(webpAbs) || fs.statSync(webpAbs).mtimeMs < fs.statSync(srcAbs).mtimeMs) {
      await sharp(srcAbs)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(webpAbs);
    }
    bytesBefore += size;
    bytesAfter += fs.statSync(webpAbs).size;
    saved++;
  }

  // Réécrit les références dans les HTML : src= et url() uniquement (on épargne <meta>/<link>).
  const rewrite = (txt) => txt.replace(
    /((?:src=|data-img-url=|url\()\s*['"]?)((?:\.\.\/)*wp-content\/uploads\/[^"')\s]+?)\.(png|jpe?g)/gi,
    (full, pre, base, ext) => {
      const rel = base.replace(/^(\.\.\/)+/, '') + '.' + ext.toLowerCase();
      return converted.has(rel) ? pre + base + '.webp' : full;
    },
  );
  const addLazy = (txt) => txt.replace(
    /<img (?![^>]*\bloading=)/gi, '<img loading="lazy" ',
  );
  for (const f of htmlFiles) {
    fs.writeFileSync(f, addLazy(rewrite(fs.readFileSync(f, 'utf8'))));
  }

  // JSON d'index de recherche : réécrit le champ image.
  const idx = path.join(outDir, 'articles-index.json');
  if (fs.existsSync(idx)) {
    let j = fs.readFileSync(idx, 'utf8');
    for (const [png, webp] of converted) j = j.split(png).join(webp);
    fs.writeFileSync(idx, j);
  }

  const kb = (b) => Math.round(b / 1024);
  console.log(`Images: ${saved} converties WebP, ${kb(bytesBefore)} Ko -> ${kb(bytesAfter)} Ko`);
}
