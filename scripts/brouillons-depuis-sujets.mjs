// Rattrapage : transforme en brouillons les sujets en attente des N derniers jours qui concernent les Comores.
// Exécution : node --env-file=.env scripts/brouillons-depuis-sujets.mjs [--jours 7] [--dry-run]
import { createClient } from '@supabase/supabase-js';
import { sujetsAConvertir, creerBrouillons } from './lib/sujets-brouillons.mjs';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const i = args.indexOf('--jours');
  const jours = i >= 0 ? Number(args[i + 1]) : 7;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const depuis = new Date(Date.now() - jours * 86400e3).toISOString();
  const { data, error } = await sb.from('sujets')
    .select('id,titre,texte,url,source_nom,categorie,statut,article_id,importe_le')
    .eq('statut', 'nouveau').gte('importe_le', depuis).order('importe_le', { ascending: true });
  if (error) throw new Error(`Supabase: ${error.message}`);
  const choisis = sujetsAConvertir(data, new Date(), jours);
  console.log(`${data.length} sujets en attente depuis ${jours} jours, ${choisis.length} concernent les Comores.`);
  if (dryRun) { for (const s of choisis) console.log(`  [dry-run] ${s.source_nom} | ${s.categorie || 'societe'} | ${s.titre}`); return; }
  const n = await creerBrouillons(sb, choisis);
  console.log(`${n} brouillon(s) créé(s).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
