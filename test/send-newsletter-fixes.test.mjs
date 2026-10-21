import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runOnce, supabaseDb, classerErreurSmtp } from '../scripts/send-newsletter.mjs';
import { quotaRestant } from '../scripts/lib/newsletter-quota.mjs';

const SITE = 'https://comoresnews.com';
const ab = (id, statut = 'actif') => ({ id, email: `${id}@exemple.test`, jeton: `jeton-${id}`, statut });
const quiet = () => {};

// Faux client Supabase : toute lecture de table est plafonnée à 1 000 lignes (comme PostgREST).
function cappedSb({ abonnes, envois }) {
  const chain = (rows) => {
    const p = Promise.resolve({ data: rows.slice(0, 1000), error: null });
    const proxy = new Proxy(function () {}, { get: (_, k) => (k === 'then' ? p.then.bind(p) : () => proxy), apply: () => proxy });
    return proxy;
  };
  return {
    from: (t) => chain(t === 'abonnes' ? abonnes : t === 'newsletter_envois' ? envois : []),
    rpc: async (name, args) => {
      if (name === 'newsletter_destinataires') {
        const servis = new Set(envois.filter((e) => e.newsletter_id === args.p_newsletter).map((e) => e.abonne_id));
        return { data: abonnes.filter((a) => a.statut === 'actif' && !servis.has(a.id)).slice(0, args.p_limite).map(({ id, email, jeton }) => ({ id, email, jeton })), error: null };
      }
      if (name === 'newsletter_comptes') return { data: [{ minute: 3, heure: 400, jour: 6000 }], error: null };
      return { data: null, error: { message: 'rpc inconnue ' + name } };
    },
  };
}

test('destinataires calculés en base, sans plafond de 1 000 lignes', async () => {
  const abonnes = Array.from({ length: 1500 }, (_, i) => ab('a' + i));
  const envois = abonnes.slice(0, 1200).map((a) => ({ newsletter_id: 'nl1', abonne_id: a.id, statut: 'envoye' }));
  const db = supabaseDb(cappedSb({ abonnes, envois }));
  const reste = await db.destinatairesRestants('nl1', 500);
  assert.equal(reste.length, 300);
  assert.equal(reste[0].id, 'a1200');
});

test('quotas comptés en base (minute, heure, 24 h)', async () => {
  const db = supabaseDb(cappedSb({ abonnes: [], envois: [] }));
  const c = await db.comptesEnvois(new Date());
  assert.deepEqual(c, { minute: 3, heure: 400, jour: 6000 });
  assert.equal(quotaRestant(c), 97);
  assert.equal(quotaRestant({ minute: 0, heure: 899, jour: 0 }), 1);
  assert.equal(quotaRestant({ minute: 0, heure: 0, jour: 7000 }), 0);
  assert.equal(quotaRestant({ minute: 120, heure: 0, jour: 0 }), 0);
});

// --- faux db minimal pour runOnce ---
function db0({ newsletter = null, abonnes = [], tests = [] } = {}) {
  const db = {
    newsletter, abonnes, tests, envois: [], erreursTests: [],
    async categories() { return {}; },
    async testsDemandes() { return db.tests.map((t) => ({ ...t })); },
    async effacerTest(id, erreur = null) { db.tests = db.tests.filter((t) => t.id !== id); if (erreur) db.erreursTests.push(erreur); },
    async prochaineNewsletter() { return db.newsletter && ['validee', 'en_cours'].includes(db.newsletter.statut) ? { ...db.newsletter } : null; },
    async demarrer() { if (db.newsletter.statut !== 'validee') return false; db.newsletter.statut = 'en_cours'; return true; },
    async terminer(id, champs) { if (db.newsletter.statut !== 'en_cours') return false; Object.assign(db.newsletter, { statut: 'envoyee' }, champs); return true; },
    async statut() { return db.newsletter.statut; },
    async marquer(id, champs) { Object.assign(db.newsletter, champs); },
    async articles() { return []; },
    async destinatairesRestants(nlId, limite) { return db.abonnes.filter((a) => a.statut === 'actif' && !db.envois.some((e) => e.abonne_id === a.id)).slice(0, limite); },
    async comptesEnvois() { return { minute: 0, heure: 0, jour: 0 }; },
    async enregistrerEnvoi(row) { db.envois.push(row); },
  };
  return db;
}
const mailer = (failFor = []) => ({ sent: [], async send(m) { if (failFor.includes(m.to)) throw new Error('adresse refusée'); this.sent.push(m); } });
const NL = () => ({ id: 'nl1', objet: 'S', intro: '', article_ids: [], statut: 'validee', nb_envoyes: 0 });

test("un test en échec n'empêche pas l'envoi de la newsletter", async () => {
  const db = db0({ newsletter: NL(), abonnes: [ab('a')], tests: [{ id: 't', objet: 'S', intro: '', article_ids: [], test_a: 'mauvaise@exemple.test' }] });
  const m = mailer(['mauvaise@exemple.test']);
  await runOnce({ db, mailer: m, siteUrl: SITE, log: quiet });
  assert.equal(db.tests.length, 0, 'le test est effacé');
  assert.equal(db.erreursTests.length, 1);
  assert.deepEqual(m.sent.map((x) => x.to), ['a@exemple.test']);
});

test("classerErreurSmtp : refus temporaires (4xx) et coupures = arrêt global, 5xx = échec de l'adresse", () => {
  assert.equal(classerErreurSmtp({ code: 'ECONNECTION' }), true);
  assert.equal(classerErreurSmtp({ code: 'EAUTH' }), true);
  assert.equal(classerErreurSmtp({ code: 'EENVELOPE', responseCode: 450, command: 'RCPT TO' }), true);
  assert.equal(classerErreurSmtp({ code: 'EMESSAGE', responseCode: 421, command: 'DATA' }), true);
  assert.equal(classerErreurSmtp({ code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' }), false);
  assert.equal(classerErreurSmtp({ message: 'autre' }), false);
});

test('runOnce respecte un budget de temps et laisse la suite au passage suivant', async () => {
  const db = db0({ newsletter: NL(), abonnes: Array.from({ length: 50 }, (_, i) => ab('b' + i)) });
  let t = Date.parse('2026-10-23T08:00:00Z');
  const now = () => new Date((t += 60_000)); // chaque appel avance d'une minute
  const r = await runOnce({ db, mailer: mailer(), siteUrl: SITE, log: quiet, now, tailleLot: 2, budgetMs: 5 * 60_000 });
  assert.equal(r.terminee, false);
  assert.ok(r.envoyes > 0 && r.envoyes < 50, `envoyés: ${r.envoyes}`);
  assert.equal(db.newsletter.statut, 'en_cours');
});

test("annulation juste avant le démarrage : rien n'est envoyé", async () => {
  const db = db0({ newsletter: { ...NL(), statut: 'brouillon' }, abonnes: [ab('a')] });
  db.prochaineNewsletter = async () => ({ ...NL() }); // lue « validee » juste avant l'annulation
  const m = mailer();
  const r = await runOnce({ db, mailer: m, siteUrl: SITE, log: quiet });
  assert.equal(m.sent.length, 0);
  assert.equal(db.newsletter.statut, 'brouillon');
  assert.equal(r.envoyes, 0);
});

test('page de désinscription : rien ne se passe sans clic sur le bouton de confirmation', () => {
  const h = fs.readFileSync(new URL('../index.php/pages/desinscription/index.html', import.meta.url), 'utf8');
  assert.match(h, /Confirmer ma désinscription/);
  const iClic = h.indexOf("addEventListener('click'");
  const iFetch = h.indexOf('rpc/desinscrire_newsletter');
  assert.ok(iClic > 0 && iFetch > iClic, "l'appel ne part qu'au clic");
});
