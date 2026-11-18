// Réécriture des brouillons vides issus des sujets importés.
//   node --env-file=.env scripts/reecriture/cli.mjs exporter            → .reecriture/<horodatage>/ (lots + contexte)
//   node --env-file=.env scripts/reecriture/cli.mjs appliquer <dossier> → contrôle les sortie-*.json et met à jour les brouillons conformes
//   node --env-file=.env scripts/reecriture/cli.mjs supprimer <dossier> <id>…  → supprime des brouillons en double (sujet marqué « ignoré »)
//   node --env-file=.env scripts/reecriture/cli.mjs chercher "<requête>"  → photos libres Wikimedia Commons (licence, déjà utilisée ou non)
//   node --env-file=.env scripts/reecriture/cli.mjs doublons            → .reecriture/photos-<horodatage>/ : articles dont l'image est partagée
//   node --env-file=.env scripts/reecriture/cli.mjs photos <dossier>    → applique les choix-*.json (une photo unique par article)
// Consignes de rédaction : scripts/reecriture/CONSIGNES.md. Rien n'est jamais publié : tout reste en brouillon.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { slugify } from '../../admin/lib.mjs';
import { controler, legendePhoto, decouper, champIle } from './lib.mjs';
import { preparerPhoto, imagesUtilisees, chercherCommons, aRemplacer, remplacerLegende, cheminStockage } from './photos.mjs';

const ROOT = new URL('../../', import.meta.url);
const pool = JSON.parse(fs.readFileSync(new URL('config/photos-commons.json', ROOT), 'utf8'));
const sb = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const lireJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const urlArticle = (a) => `/index.php/${a.date_publication.slice(0, 10).replace(/-/g, '/')}/${a.slug}/index.html`;

async function exporter() {
  const db = sb();
  const { data: sj, error } = await db.from('sujets')
    .select('article_id,titre,texte,source_nom,date_source, articles!sujets_article_id_fkey(id,statut,corps,categorie)')
    .not('article_id', 'is', null);
  if (error) throw new Error(error.message);
  const items = sj.filter((s) => s.articles?.statut === 'brouillon' && !s.articles.corps && s.texte.trim())
    .map((s) => ({ article_id: s.article_id, categorie: s.articles.categorie, titre_source: s.titre, source: s.source_nom, date_source: s.date_source, texte_source: s.texte }));
  const vides = sj.filter((s) => s.articles?.statut === 'brouillon' && !s.articles.corps && !s.texte.trim()).map((s) => s.article_id);
  if (!items.length && !vides.length) { console.log('Aucun brouillon à réécrire.'); return; }
  const dir = path.join(fileURLToPath(new URL('.reecriture/', ROOT)), new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const { data: pub } = await db.from('articles').select('titre,slug,date_publication').eq('statut', 'publie');
  fs.writeFileSync(path.join(dir, 'articles-publies.json'), JSON.stringify(pub.map((a) => ({ titre: a.titre, url: urlArticle(a) })), null, 1));
  // Pour repérer les doublons : brouillons déjà rédigés et articles publiés des 10 derniers jours.
  const depuis = new Date(Date.now() - 10 * 86400e3).toISOString();
  const { data: recents } = await db.from('articles').select('id,titre,statut,excerpt').neq('corps', '').gte('cree_le', depuis);
  fs.writeFileSync(path.join(dir, 'recents.json'), JSON.stringify(recents, null, 1));
  fs.writeFileSync(path.join(dir, 'sans-texte.json'), JSON.stringify(vides, null, 1));
  decouper(items, 9).forEach((lot, i) => fs.writeFileSync(path.join(dir, `lot-${i + 1}.json`), JSON.stringify(lot, null, 1)));
  console.log(`${items.length} brouillon(s) à réécrire en ${Math.ceil(items.length / 9)} lot(s), ${vides.length} sans texte source.`);
  console.log(`DOSSIER=${dir}`);
}

async function appliquer(dir) {
  const db = sb();
  const sources = Object.fromEntries(fs.readdirSync(dir).filter((f) => /^lot-\d+\.json$/.test(f)).flatMap((f) => lireJson(path.join(dir, f))).map((s) => [s.article_id, s]));
  const liens = new Set(lireJson(path.join(dir, 'articles-publies.json')).map((l) => l.url));
  const sorties = fs.readdirSync(dir).filter((f) => /^sortie-\d+\.json$/.test(f)).flatMap((f) => lireJson(path.join(dir, f)));
  const { data: slugs } = await db.from('articles').select('id,slug');
  const pris = new Set(slugs.filter((r) => !sources[r.id]).map((r) => r.slug));
  const utilisees = await imagesUtilisees(db);
  let n = 0;
  for (const a of sorties) {
    const s = sources[a.article_id];
    const p = s ? controler(a, s.texte_source, { pool, liens }) : ['article inconnu'];
    if (p.length) { console.log(`  ⚠ non enregistré « ${a.titre} » : ${p.join(', ')}`); continue; }
    const base = slugify(a.titre);
    let slug = base;
    for (let k = 2; pris.has(slug); k++) slug = `${base}-${k}`;
    pris.add(slug);
    // Photo : une photo Commons propre à l'article (« commons »), jamais une image déjà utilisée ailleurs.
    let image = '', legende = '';
    try {
      if (a.commons?.fichier) ({ url: image, legende } = await preparerPhoto(db, a.article_id, a.commons, utilisees));
      else if (a.photo && pool[a.photo]) {
        if (utilisees.has(pool[a.photo].url)) throw new Error(`photo de la banque déjà utilisée (${a.photo})`);
        image = pool[a.photo].url; legende = legendePhoto(pool[a.photo]); utilisees.set(image, a.article_id);
      }
    } catch (e) { console.log(`  ⚠ « ${a.titre} » enregistré sans photo : ${e.message}`); }
    const { error } = await db.from('articles').update({
      titre: a.titre, slug, excerpt: a.excerpt, corps: legende + a.corps.trim(),
      seo_titre: a.seo_titre || '', seo_description: a.seo_description || '', mots_cles: a.mots_cles || [],
      categorie: a.categorie, ...champIle(a), image_couverture: image, og_image: image,
    }).eq('id', a.article_id).eq('statut', 'brouillon').eq('corps', '');
    if (error) console.log(`  ERREUR « ${a.titre} » : ${error.message}`); else n++;
  }
  const manquants = Object.keys(sources).filter((id) => !sorties.some((a) => a.article_id === id)).length;
  console.log(`${n} brouillon(s) réécrit(s) sur ${Object.keys(sources).length}${manquants ? `, ${manquants} sans sortie` : ''}.`);
}

async function supprimer(dir, ids) {
  const db = sb();
  const { data } = await db.from('articles').select('*').in('id', ids).eq('statut', 'brouillon');
  fs.writeFileSync(path.join(dir, `supprimes-${Date.now()}.json`), JSON.stringify(data, null, 1)); // copie de secours
  for (const a of data) {
    const { error } = await db.from('articles').delete().eq('id', a.id).eq('statut', 'brouillon');
    if (error) { console.log(`  ERREUR « ${a.titre} » : ${error.message}`); continue; }
    if (a.source_url) await db.from('sujets').update({ statut: 'ignore' }).eq('url', a.source_url);
    console.log(`  supprimé : ${a.titre}`);
  }
}

async function chercher(requete) {
  const utilisees = await imagesUtilisees(sb());
  const pages = new Set([...utilisees.keys()]);
  for (const c of await chercherCommons(requete)) {
    const page = 'https://commons.wikimedia.org/wiki/File:' + c.fichier.replace(/ /g, '_');
    const prise = pages.has(page) || pages.has(sb().storage.from('medias').getPublicUrl(cheminStockage(c.fichier)).data.publicUrl);
    console.log(`${prise ? 'DÉJÀ UTILISÉE' : 'libre        '} | ${c.licence.padEnd(13)} | ${c.taille.padEnd(10)} | ${c.fichier} | ${c.auteur}`);
  }
}

async function doublons() {
  const db = sb();
  const { data, error } = await db.from('articles').select('id,titre,excerpt,categorie,ile,statut,date_publication,cree_le,image_couverture');
  if (error) throw new Error(error.message);
  const liste = aRemplacer(data.map((a) => ({ ...a, date_publication: a.date_publication || a.cree_le })))
    .map(({ id, titre, excerpt, categorie, ile, statut }) => ({ article_id: id, titre, excerpt, categorie, ile, statut }));
  if (!liste.length) { console.log('Aucune image partagée.'); return; }
  const dir = path.join(fileURLToPath(new URL('.reecriture/', ROOT)), 'photos-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  decouper(liste, 15).forEach((lot, i) => fs.writeFileSync(path.join(dir, `lot-${i + 1}.json`), JSON.stringify(lot, null, 1)));
  console.log(`${liste.length} article(s) à doter d'une photo propre, en ${Math.ceil(liste.length / 15)} lot(s).`);
  console.log(`DOSSIER=${dir}`);
}

// choix-*.json : [{ article_id, fichier, legende }] ; fichier null → l'article perd sa photo partagée.
async function photos(dir) {
  const db = sb();
  const choix = fs.readdirSync(dir).filter((f) => /^choix-d+.json$/.test(f)).flatMap((f) => lireJson(path.join(dir, f)));
  const utilisees = await imagesUtilisees(db);
  // Les images à remplacer ne comptent plus comme « utilisées » par ces articles.
  for (const c of choix) for (const [k, v] of utilisees) if (v === c.article_id) utilisees.delete(k);
  let n = 0, sans = 0, publie = false;
  for (const c of choix) {
    const { data: a } = await db.from('articles').select('id,titre,corps,statut').eq('id', c.article_id).single();
    if (!a) { console.log(`  ⚠ article introuvable ${c.article_id}`); continue; }
    let image = '', legende = '';
    if (c.fichier) {
      try { ({ url: image, legende } = await preparerPhoto(db, a.id, c, utilisees)); }
      catch (e) { console.log(`  ⚠ « ${a.titre} » : ${e.message} → laissé tel quel`); continue; }
    }
    const { error } = await db.from('articles').update({ image_couverture: image, og_image: image, corps: remplacerLegende(a.corps, legende) }).eq('id', a.id);
    if (error) { console.log(`  ERREUR « ${a.titre} » : ${error.message}`); continue; }
    image ? n++ : sans++;
    if (a.statut === 'publie') publie = true;
  }
  console.log(`${n} photo(s) unique(s) attribuée(s), ${sans} article(s) laissé(s) sans photo.`);
  if (publie && process.env.VERCEL_DEPLOY_HOOK_URL) {
    const r = await fetch(process.env.VERCEL_DEPLOY_HOOK_URL, { method: 'POST' }).catch(() => ({ ok: false }));
    console.log(r.ok ? 'Régénération du site déclenchée.' : 'Régénération du site impossible.');
  }
}

const [cmd, ...args] = process.argv.slice(2);
const run = { exporter: () => exporter(), appliquer: () => appliquer(args[0]), supprimer: () => supprimer(args[0], args.slice(1)),
  chercher: () => chercher(args.join(' ')), doublons: () => doublons(), photos: () => photos(args[0]) }[cmd];
if (!run) { console.error('Commande : exporter | appliquer <dossier> | supprimer <dossier> <id>… | chercher <requête> | doublons | photos <dossier>'); process.exit(2); }
run().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
