// Crée (ou met à jour) un compte éditeur avec un mot de passe temporaire.
// Usage : node --env-file=.env scripts/create-editor.mjs email@x.fr "Nom" [admin|redacteur]
import { createClient } from '@supabase/supabase-js';

const [email, nom = '', role = 'redacteur'] = process.argv.slice(2);
if (!email) { console.error('Usage: create-editor.mjs <email> [nom] [role]'); process.exit(1); }

function tempPassword() {
  return 'Cn-' + Math.random().toString(36).slice(2, 10) + '!' + Math.floor(Math.random() * 90 + 10);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pwd = tempPassword();

const { data: list } = await sb.auth.admin.listUsers();
let u = list.users.find((x) => x.email === email);
if (!u) {
  const r = await sb.auth.admin.createUser({ email, password: pwd, email_confirm: true, user_metadata: { nom } });
  if (r.error) throw r.error;
  u = r.data.user;
  console.log('CRÉÉ', email);
} else {
  await sb.auth.admin.updateUserById(u.id, { password: pwd });
  console.log('MAJ mot de passe', email);
}
const { error } = await sb.from('profiles').update({ role, nom }).eq('id', u.id);
if (error) throw error;
console.log(`  rôle=${role} nom="${nom}"`);
console.log('  MOT DE PASSE TEMPORAIRE:', pwd);
