// Import des nouveaux articles de la presse comorienne comme « sujets » (table Supabase `sujets`).
// Seuls les sujets qui concernent les Comores sont gardés ; chacun devient un article brouillon à réécrire.
// Exécution : node --env-file=.env scripts/import-sources.mjs [--dry-run]
// Spec : docs/superpowers/specs/2026-10-20-import-sources-design.md
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseRss } from './lib/sources/rss.mjs';
import { parseGazetteHome, parseGazetteArticle } from './lib/sources/gazette.mjs';
import { guessCategory } from './lib/sources/category.mjs';
import { concerneComores, creerBrouillons } from './lib/sujets-brouillons.mjs';

const USER_AGENT = 'ComoresnewsBot/1.0 (+https://comoresnews.com)';

const withCategory = (it) => ({ ...it, categorie: guessCategory(it.categorie_source.split(' | ')) });

async function collect(src, fetchText, db, log) {
  if (src.type === 'rss') {
    const items = parseRss(await fetchText(src.url), src);
    if (!items.length) throw new Error('flux vide (format modifié ?)');
    const known = await db.existingUrls(items.map((i) => i.url));
    return { trouves: items.length, rows: items.filter((i) => !known.has(i.url)).map(withCategory) };
  }
  if (src.type === 'gazette') {
    const links = parseGazetteHome(await fetchText(src.url), src.url);
    if (!links.length) throw new Error("aucun lien d'article sur la page d'accueil (structure du site modifiée ?)");
    const known = await db.existingUrls(links.map((l) => l.url));
    const rows = [];
    const candidats = links.filter((x) => !known.has(x.url));
    let sansTitre = 0;
    for (const l of candidats) { // pages déjà connues : pas téléchargées (site lent)
      try {
        const a = parseGazetteArticle(await fetchText(l.url));
        if (!a.titre) { sansTitre++; log(`  ${src.id}: page sans titre ignorée ${l.url}`); continue; }
        rows.push(withCategory({ source: src.id, source_nom: src.nom, url: l.url, titre: a.titre,
          texte: a.texte, categorie_source: l.rubrique, date_source: a.date_source }));
      } catch (e) {
        log(`  ${src.id}: page ignorée ${l.url} (${e.message})`);
      }
    }
    if (candidats.length && !rows.length) throw new Error(`aucune page article lisible (${sansTitre}/${candidats.length} sans titre : structure modifiée ?)`);
    return { trouves: links.length, rows };
  }
  throw new Error(`type de source inconnu : ${src.type}`);
}

// Importe chaque source indépendamment : une source en échec n'empêche pas les autres.
export async function importAll({ sources, fetchText, db, log = console.log }) {
  const results = [];
  for (const src of sources) {
    try {
      const { trouves, rows: tous } = await collect(src, fetchText, db, log);
      const rows = tous.filter((r) => concerneComores(`${r.titre} ${r.texte}`));
      const ecartes = tous.length - rows.length;
      const inseres = rows.length ? await db.insertSujets(rows) : [];
      const res = { source: src.id, trouves, nouveaux: inseres.length, ecartes, brouillons: 0, erreur: null };
      results.push(res);
      log(`${src.nom} : ${trouves} trouvés, ${inseres.length} nouveaux, ${ecartes} écarté${ecartes > 1 ? 's' : ''} (hors Comores)`);
      res.brouillons = inseres.length ? await db.creerBrouillons(inseres) : 0;
      if (res.brouillons) log(`  ${res.brouillons} brouillon${res.brouillons > 1 ? 's' : ''} créé${res.brouillons > 1 ? 's' : ''}`);
    } catch (e) {
      log(`${src.nom} : ERREUR ${e.message}`);
      const deja = results.find((r) => r.source === src.id);
      if (deja) deja.erreur = e.message;
      else results.push({ source: src.id, trouves: 0, nouveaux: 0, ecartes: 0, brouillons: 0, erreur: e.message });
    }
  }
  return results;
}

// 1 dès qu'une source a échoué : le run GitHub passe en rouge et envoie une alerte.
export function exitCode(results) {
  return results.some((r) => r.erreur) ? 1 : 0;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return res.text();
}

function supabaseDb({ dryRun }) {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return {
    async existingUrls(urls) {
      if (!urls.length) return new Set();
      const { data, error } = await sb.from('sujets').select('url').in('url', urls);
      if (error) throw new Error(`Supabase: ${error.message}`);
      return new Set(data.map((r) => r.url));
    },
    // Renvoie les sujets réellement insérés (avec leur id).
    async insertSujets(rows) {
      if (dryRun) { for (const r of rows) console.log(`  [dry-run] ${r.source} | ${r.categorie || '-'} | ${r.titre}`); return rows; }
      const { data, error } = await sb.from('sujets').upsert(rows, { onConflict: 'url', ignoreDuplicates: true }).select('id,titre,url,source_nom,categorie');
      if (error) throw new Error(`Supabase: ${error.message}`);
      return data;
    },
    async creerBrouillons(sujets) {
      if (dryRun) return 0;
      return creerBrouillons(sb, sujets);
    },
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const sources = JSON.parse(fs.readFileSync(new URL('../config/sources.json', import.meta.url), 'utf8'));
  const results = await importAll({ sources, fetchText, db: supabaseDb({ dryRun }) });
  process.exitCode = exitCode(results);
}

if (process.argv[1] && process.argv[1].endsWith('import-sources.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
