// Import des nouveaux articles de la presse comorienne comme « sujets » (table Supabase `sujets`).
// Exécution : node --env-file=.env scripts/import-sources.mjs [--dry-run]
// Spec : docs/superpowers/specs/2026-10-20-import-sources-design.md
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseRss } from './lib/sources/rss.mjs';
import { parseGazetteHome, parseGazetteArticle } from './lib/sources/gazette.mjs';
import { guessCategory } from './lib/sources/category.mjs';

const USER_AGENT = 'ComoresnewsBot/1.0 (+https://comoresnews.com)';

const withCategory = (it) => ({ ...it, categorie: guessCategory(it.categorie_source.split(' | ')) });

async function collect(src, fetchText, db, log) {
  if (src.type === 'rss') {
    const items = parseRss(await fetchText(src.url), src);
    const known = await db.existingUrls(items.map((i) => i.url));
    return { trouves: items.length, rows: items.filter((i) => !known.has(i.url)).map(withCategory) };
  }
  if (src.type === 'gazette') {
    const links = parseGazetteHome(await fetchText(src.url));
    const known = await db.existingUrls(links.map((l) => l.url));
    const rows = [];
    for (const l of links.filter((x) => !known.has(x.url))) { // pages déjà connues : pas téléchargées (site lent)
      try {
        const a = parseGazetteArticle(await fetchText(l.url));
        if (!a.titre) continue;
        rows.push(withCategory({ source: src.id, source_nom: src.nom, url: l.url, titre: a.titre,
          texte: a.texte, categorie_source: l.rubrique, date_source: a.date_source }));
      } catch (e) {
        log(`  ${src.id}: page ignorée ${l.url} (${e.message})`);
      }
    }
    return { trouves: links.length, rows };
  }
  throw new Error(`type de source inconnu : ${src.type}`);
}

// Importe chaque source indépendamment : une source en échec n'empêche pas les autres.
export async function importAll({ sources, fetchText, db, log = console.log }) {
  const results = [];
  for (const src of sources) {
    try {
      const { trouves, rows } = await collect(src, fetchText, db, log);
      const nouveaux = rows.length ? await db.insertSujets(rows) : 0;
      log(`${src.nom} : ${trouves} trouvés, ${nouveaux} nouveaux`);
      results.push({ source: src.id, trouves, nouveaux, erreur: null });
    } catch (e) {
      log(`${src.nom} : ERREUR ${e.message}`);
      results.push({ source: src.id, trouves: 0, nouveaux: 0, erreur: e.message });
    }
  }
  return results;
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
    async insertSujets(rows) {
      if (dryRun) { for (const r of rows) console.log(`  [dry-run] ${r.source} | ${r.categorie || '-'} | ${r.titre}`); return rows.length; }
      const { data, error } = await sb.from('sujets').upsert(rows, { onConflict: 'url', ignoreDuplicates: true }).select('id');
      if (error) throw new Error(`Supabase: ${error.message}`);
      return data.length;
    },
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const sources = JSON.parse(fs.readFileSync(new URL('../config/sources.json', import.meta.url), 'utf8'));
  const results = await importAll({ sources, fetchText, db: supabaseDb({ dryRun }) });
  if (results.every((r) => r.erreur)) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('import-sources.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
