// Envoi de la newsletter (tests + newsletters validées), lancé toutes les 10 minutes.
// Exécution : node --env-file=.env scripts/send-newsletter.mjs
// Spec : docs/superpowers/specs/2026-10-21-envoi-newsletter-design.md
// Journaux publics (dépôt public) : jamais d'adresse email, seulement des compteurs.
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { renderNewsletter } from '../admin/newsletter-template.mjs';
import { quotaDisponible, LIMITES } from './lib/newsletter-quota.mjs';

const FROM = 'Comoresnews <newsletter@comoresnews.com>';
const MAILTO_UNSUB = 'mailto:newsletter@comoresnews.com?subject=desinscription';
const unsubUrl = (siteUrl, jeton) => `${siteUrl.replace(/\/$/, '')}/index.php/pages/desinscription/index.html${jeton ? `?t=${encodeURIComponent(jeton)}` : ''}`;

function message({ nl, articles, categories, siteUrl, to, jeton, subjectPrefix = '' }) {
  const unsubscribeUrl = unsubUrl(siteUrl, jeton);
  const { html, text } = renderNewsletter({ objet: nl.objet, intro: nl.intro, articles, siteUrl, unsubscribeUrl, categories });
  return { to, subject: subjectPrefix + nl.objet, html, text, headers: { 'List-Unsubscribe': `<${MAILTO_UNSUB}>, <${unsubscribeUrl}>` } };
}

export async function runOnce({ db, mailer, now = () => new Date(), log = console.log, siteUrl, limites = LIMITES, tailleLot = 20 }) {
  const res = { tests: 0, envoyes: 0, echecs: 0, newsletterId: null, terminee: false };
  const categories = await db.categories();

  // 1) Tests demandés depuis le back-office (un seul destinataire, l'admin)
  for (const t of await db.testsDemandes()) {
    const articles = await db.articles(t.article_ids || []);
    await mailer.send(message({ nl: t, articles, categories, siteUrl, to: t.test_a, jeton: null, subjectPrefix: '[TEST] ' }));
    await db.effacerTest(t.id);
    res.tests++;
  }
  if (res.tests) log(`Tests envoyés : ${res.tests}`);

  // 2) Newsletter validée ou en cours
  const nl = await db.prochaineNewsletter();
  if (!nl) return res;
  res.newsletterId = nl.id;
  if (nl.statut === 'validee') await db.marquer(nl.id, { statut: 'en_cours' });
  const articles = await db.articles(nl.article_ids || []);
  let total = nl.nb_envoyes || 0;

  for (;;) {
    if ((await db.statut(nl.id)) !== 'en_cours') { log('Envoi arrêté par un administrateur.'); break; }
    const quota = quotaDisponible(await db.envoisRecents(new Date(now().getTime() - 86_400_000)), now(), limites);
    if (quota <= 0) { log('Quota atteint : la suite partira au prochain passage.'); break; }
    const lot = await db.destinatairesRestants(nl.id, Math.min(tailleLot, quota));
    if (!lot.length) {
      await db.marquer(nl.id, { statut: 'envoyee', envoyee_le: now().toISOString(), nb_envoyes: total });
      res.terminee = true;
      break;
    }
    for (const ab of lot) {
      try {
        await mailer.send(message({ nl, articles, categories, siteUrl, to: ab.email, jeton: ab.jeton }));
        await db.enregistrerEnvoi({ newsletter_id: nl.id, abonne_id: ab.id, statut: 'envoye', erreur: null });
        res.envoyes++; total++;
      } catch (e) {
        if (e.global) throw e; // serveur injoignable : on s'arrête sans marquer l'abonné en échec
        await db.enregistrerEnvoi({ newsletter_id: nl.id, abonne_id: ab.id, statut: 'echec', erreur: String(e.message).slice(0, 300) });
        res.echecs++;
      }
    }
    await db.marquer(nl.id, { nb_envoyes: total });
  }
  log(`Newsletter : ${res.envoyes} envoyés, ${res.echecs} échecs${res.terminee ? ', terminée' : ''}.`);
  return res;
}

function supabaseDb(sb) {
  const ok = ({ data, error }) => { if (error) throw new Error(`Supabase: ${error.message}`); return data; };
  return {
    testsDemandes: async () => ok(await sb.from('newsletters').select('id,objet,intro,article_ids,test_a').not('test_a', 'is', null)),
    effacerTest: async (id) => ok(await sb.from('newsletters').update({ test_a: null }).eq('id', id)),
    prochaineNewsletter: async () => ok(await sb.from('newsletters').select('*').in('statut', ['validee', 'en_cours'])
      .order('validee_le', { ascending: true }).limit(1).maybeSingle()),
    statut: async (id) => ok(await sb.from('newsletters').select('statut').eq('id', id).single()).statut,
    marquer: async (id, champs) => ok(await sb.from('newsletters').update(champs).eq('id', id)),
    articles: async (ids) => (ids.length ? ok(await sb.from('articles')
      .select('id,titre,slug,categorie,excerpt,image_couverture,date_publication').in('id', ids)
      .order('date_publication', { ascending: false })) : []),
    categories: async () => Object.fromEntries(ok(await sb.from('categories').select('slug,nom')).map((c) => [c.slug, c.nom])),
    async destinatairesRestants(nlId, limite) {
      const servis = new Set(ok(await sb.from('newsletter_envois').select('abonne_id').eq('newsletter_id', nlId).limit(100000)).map((r) => r.abonne_id));
      const actifs = ok(await sb.from('abonnes').select('id,email,jeton').eq('statut', 'actif').order('cree_le').limit(100000));
      return actifs.filter((a) => !servis.has(a.id)).slice(0, limite);
    },
    envoisRecents: async (depuis) => ok(await sb.from('newsletter_envois').select('envoye_le').gte('envoye_le', depuis.toISOString()).limit(20000))
      .map((r) => new Date(r.envoye_le)),
    enregistrerEnvoi: async (row) => ok(await sb.from('newsletter_envois').upsert(row, { onConflict: 'newsletter_id,abonne_id' })),
  };
}

const GLOBAL_CODES = new Set(['ECONNECTION', 'ETIMEDOUT', 'EAUTH', 'ESOCKET', 'EDNS', 'ECONNREFUSED']);

async function main() {
  const siteUrl = process.env.SITE_BASE_URL || 'https://comoresnews.com';
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const db = supabaseDb(sb);
  const transport = nodemailer.createTransport({
    host: 'mail.gandi.net', port: 465, secure: true,
    auth: { user: 'newsletter@comoresnews.com', pass: process.env.SMTP_PASS },
  });
  const mailer = {
    async send({ to, subject, html, text, headers }) {
      try {
        await transport.sendMail({ from: FROM, to, subject, html, text, headers });
      } catch (e) {
        if (GLOBAL_CODES.has(e.code) || (e.responseCode && e.responseCode >= 421 && e.responseCode < 500 && e.command === 'CONN')) e.global = true;
        throw e;
      }
    },
  };
  try {
    // Rien à faire ? On ne contacte même pas le serveur mail.
    if (!(await db.testsDemandes()).length && !(await db.prochaineNewsletter())) { console.log('Rien à envoyer.'); return; }
    if (!process.env.SMTP_PASS) throw Object.assign(new Error('SMTP_PASS manquant'), { global: true });
    await transport.verify().catch((e) => { throw Object.assign(new Error(`Serveur mail injoignable (${e.code || e.message})`), { global: true }); });
    await runOnce({ db, mailer, siteUrl });
  } catch (e) {
    console.error(`Échec : ${e.message.replace(/[^\s@]+@[^\s@]+/g, '[adresse]')}`);
    const nl = await db.prochaineNewsletter().catch(() => null);
    if (nl) await db.marquer(nl.id, { derniere_erreur: String(e.message).replace(/[^\s@]+@[^\s@]+/g, '[adresse]').slice(0, 300) }).catch(() => {});
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('send-newsletter.mjs')) main();
