// Remplissage unique de l'île des articles publiés.
//   node --env-file=.env scripts/iles/cli.mjs exporter            → DOSSIER=… avec a-remplir.json
//   node --env-file=.env scripts/iles/cli.mjs appliquer <dossier> → lit choix.json ([{ id, ile }])
// N'écrit que sur les articles encore sans île (jamais d'écrasement).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { aRemplir, miseAJour } from './lib.mjs';

const ROOT = new URL('../../', import.meta.url);
const sb = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function lignes(db) {
  const { data, error } = await db.from('articles').select('id,titre,excerpt,corps,statut,ile').eq('statut', 'publie');
  if (error) throw new Error(error.message);
  return data;
}

async function exporter() {
  const items = aRemplir(await lignes(sb()));
  const dir = path.join(fileURLToPath(new URL('.iles/', ROOT)), new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'a-remplir.json'), JSON.stringify(items, null, 1));
  console.log(`${items.length} article(s) publié(s) sans île.`);
  console.log(`DOSSIER=${dir}`);
}

async function appliquer(dir) {
  const db = sb();
  const choix = JSON.parse(fs.readFileSync(path.join(dir, 'choix.json'), 'utf8'));
  const maj = miseAJour(choix, await lignes(db));
  let n = 0;
  for (const { id, ile } of maj) {
    const { error } = await db.from('articles').update({ ile }).eq('id', id).is('ile', null);
    if (error) console.log(`  ERREUR ${id} : ${error.message}`); else n++;
  }
  console.log(`${n} île(s) enregistrée(s).`);
}

const [cmd, ...args] = process.argv.slice(2);
const run = { exporter: () => exporter(), appliquer: () => appliquer(args[0]) }[cmd];
if (!run) { console.error('Commande : exporter | appliquer <dossier>'); process.exit(2); }
run().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
