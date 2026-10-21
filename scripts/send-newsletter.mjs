// Envoi de la newsletter (tests + newsletters validées), lancé toutes les 10 minutes.
// Exécution : node --env-file=.env scripts/send-newsletter.mjs
// Spec : docs/superpowers/specs/2026-10-21-envoi-newsletter-design.md
// Journaux publics (dépôt public) : jamais d'adresse email, seulement des compteurs.
// Ne pas lancer à la main pendant qu'un envoi planifié est en cours (pas de verrou hors GitHub Actions).
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { renderNewsletter } from '../admin/newsletter-template.mjs';
import { quotaRestant, LIMITES } from './lib/newsletter-quota.mjs';

const FROM = 'Comoresnews <newsletter@comoresnews.com>';
const MAILTO_UNSUB = 'mailto:newsletter@comoresnews.com?subject=desinscription';
const BUDGET_MS = 8 * 60_000; // le job GitHub est coupé à 15 min : on s'arrête bien avant
const masquer = (s) => String(s ?? '').replace(/[^\s@<>"']+@[^\s@<>"']+/g, '[adresse]').slice(0, 300);
const unsubUrl = (siteUrl, jeton) => `${siteUrl.replace(/\/$/, '')}/index.php/pages/desinscription/index.html${jeton ? `?t=${encodeURIComponent(jeton)}` : ''}`;

function message({ nl, articles, categories, siteUrl, to, jeton, subjectPrefix = '' }) {
  const unsubscribeUrl = unsubUrl(siteUrl, jeton);
  const { html, text } = renderNewsletter({ objet: nl.objet, intro: nl.intro, articles, siteUrl, unsubscribeUrl, categories });
  return { to, subject: subjectPrefix + nl.objet, html, text, headers: { 'List-Unsubscribe': `<${MAILTO_UNSUB}>, <${unsubscribeUrl}>` } };
}

// Coupure, authentification refusée ou refus temporaire (4xx) : on arrête et on réessaie
// au passage suivant, sans marquer l'abonné en échec. Seul un refus définitif (5xx) est un échec.
const GLOBAL_CODES = new Set(['ECONNECTION', 'ETIMEDOUT', 'EAUTH', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ECONNRESET']);
export function classerErreurSmtp(e) {
  if (GLOBAL_CODES.has(e?.code)) return true;
  return Number.isInteger(e?.responseCode) && e.responseCode >= 400 && e.responseCode < 500;
}

export async function runOnce({ db, mailer, now = () => new Date(), log = console.log, siteUrl, limites = LIMITES, tailleLot = 20, budgetMs = BUDGET_MS }) {
  const res = { tests: 0, envoyes: 0, echecs: 0, newsletterId: null, terminee: false };
  const debut = now().getTime();
  const categories = await db.categories();

  // 1) Tests demandés depuis le back-office (un seul destinataire, l'admin)
  for (const t of await db.testsDemandes()) {
    try {
      const articles = await db.articles(t.article_ids || []);
      await mailer.send(message({ nl: t, articles, categories, siteUrl, to: t.test_a, jeton: null, subjectPrefix: '[TEST] ' }));
      await db.effacerTest(t.id);
      res.tests++;
    } catch (e) {
      if (e.global) throw e;
      await db.effacerTest(t.id, `Test non envoyé : ${masquer(e.message)}`);
      log('Un email de test a été refusé (voir l’historique).');
    }
  }
  if (res.tests) log(`Tests envoyés : ${res.tests}`);

  // 2) Newsletter validée ou en cours
  const nl = await db.prochaineNewsletter();
  if (!nl) return res;
  res.newsletterId = nl.id;
  if (nl.statut === 'validee' && !(await db.demarrer(nl.id))) {
    log('Newsletter annulée juste avant le démarrage : rien envoyé.');
    return res;
  }
  const articles = await db.articles(nl.article_ids || []);
  let total = nl.nb_envoyes || 0;

  for (;;) {
    if (now().getTime() - debut >= budgetMs) { log('Temps imparti écoulé : la suite partira au prochain passage.'); break; }
    if ((await db.statut(nl.id)) !== 'en_cours') { log('Envoi arrêté par un administrateur.'); break; }
    const quota = quotaRestant(await db.comptesEnvois(now()), limites);
    if (quota <= 0) { log('Quota atteint : la suite partira au prochain passage.'); break; }
    const lot = await db.destinatairesRestants(nl.id, Math.min(tailleLot, quota));
    if (!lot.length) {
      res.terminee = await db.terminer(nl.id, { envoyee_le: now().toISOString(), nb_envoyes: total, derniere_erreur: null });
      break;
    }
    for (const ab of lot) {
      try {
        await mailer.send(message({ nl, articles, categories, siteUrl, to: ab.email, jeton: ab.jeton }));
        await db.enregistrerEnvoi({ newsletter_id: nl.id, abonne_id: ab.id, statut: 'envoye', erreur: null });
        res.envoyes++; total++;
      } catch (e) {
        if (e.global) { await db.marquer(nl.id, { nb_envoyes: total }); throw e; }
        await db.enregistrerEnvoi({ newsletter_id: nl.id, abonne_id: ab.id, statut: 'echec', erreur: masquer(e.message) });
        res.echecs++;
      }
    }
    await db.marquer(nl.id, { nb_envoyes: total });
  }
  log(`Newsletter : ${res.envoyes} envoyés, ${res.echecs} échecs${res.terminee ? ', terminée' : ''}.`);
  return res;
}

export function supabaseDb(sb) {
  const ok = ({ data, error }) => { if (error) throw new Error(`Supabase: ${error.message}`); return data; };
  return {
    testsDemandes: async () => ok(await sb.from('newsletters').select('id,objet,intro,article_ids,test_a').not('test_a', 'is', null)),
    effacerTest: async (id, erreur = null) => ok(await sb.from('newsletters')
      .update(erreur ? { test_a: null, derniere_erreur: erreur } : { test_a: null }).eq('id', id)),
    prochaineNewsletter: async () => ok(await sb.from('newsletters').select('*').in('statut', ['validee', 'en_cours'])
      .order('validee_le', { ascending: true }).limit(1).maybeSingle()),
    // Passages d'état conditionnels : ne gagnent que si l'état n'a pas changé entre-temps.
    demarrer: async (id) => ok(await sb.from('newsletters').update({ statut: 'en_cours' }).eq('id', id).eq('statut', 'validee').select('id')).length > 0,
    terminer: async (id, champs) => ok(await sb.from('newsletters').update({ statut: 'envoyee', ...champs }).eq('id', id).eq('statut', 'en_cours').select('id')).length > 0,
    statut: async (id) => ok(await sb.from('newsletters').select('statut').eq('id', id).single()).statut,
    marquer: async (id, champs) => ok(await sb.from('newsletters').update(champs).eq('id', id)),
    articles: async (ids) => (ids.length ? ok(await sb.from('articles')
      .select('id,titre,slug,categorie,excerpt,image_couverture,date_publication').in('id', ids)
      .order('date_publication', { ascending: false })) : []),
    categories: async () => Object.fromEntries(ok(await sb.from('categories').select('slug,nom')).map((c) => [c.slug, c.nom])),
    // Calculés en base : pas de plafond de lignes de l'API.
    destinatairesRestants: async (nlId, limite) => ok(await sb.rpc('newsletter_destinataires', { p_newsletter: nlId, p_limite: limite })),
    comptesEnvois: async () => {
      const r = ok(await sb.rpc('newsletter_comptes'));
      const row = Array.isArray(r) ? r[0] : r;
      return { minute: Number(row.minute), heure: Number(row.heure), jour: Number(row.jour) };
    },
    enregistrerEnvoi: async (row) => ok(await sb.from('newsletter_envois').upsert(row, { onConflict: 'newsletter_id,abonne_id' })),
  };
}

async function main() {
  const siteUrl = process.env.SITE_BASE_URL || 'https://comoresnews.com';
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const db = supabaseDb(sb);
  const transport = nodemailer.createTransport({
    host: 'mail.gandi.net', port: 465, secure: true, pool: true, maxConnections: 1,
    auth: { user: 'newsletter@comoresnews.com', pass: process.env.SMTP_PASS },
  });
  const mailer = {
    async send({ to, subject, html, text, headers }) {
      try {
        await transport.sendMail({ from: FROM, to, subject, html, text, headers });
      } catch (e) {
        if (classerErreurSmtp(e)) e.global = true;
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
    console.error(`Échec : ${masquer(e.message)}`);
    const nl = await db.prochaineNewsletter().catch(() => null);
    if (nl) await db.marquer(nl.id, { derniere_erreur: masquer(e.message) }).catch(() => {});
    process.exitCode = 1;
  } finally {
    transport.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('send-newsletter.mjs')) main();
