import test from 'node:test';
import assert from 'node:assert/strict';
import { runOnce } from '../scripts/send-newsletter.mjs';

const SITE = 'https://comoresnews.com';
const ARTICLES = [{ id: 'art1', titre: 'La vanille', slug: 'vanille', categorie: 'economie', excerpt: 'x', image_couverture: '', date_publication: '2026-10-20T09:00:00Z' }];
const ab = (id, statut = 'actif') => ({ id, email: `${id}@exemple.test`, jeton: `jeton-${id}`, statut });

function fakeDb({ newsletter = null, abonnes = [], envois = [], tests = [], recents = [], statutSeq = null } = {}) {
  const db = {
    newsletter, abonnes, envois, tests, marques: [],
    erreursTests: [],
    async testsDemandes() { return db.tests.map((t) => ({ ...t })); },
    async effacerTest(id, erreur = null) { db.tests = db.tests.filter((t) => t.id !== id); if (erreur) db.erreursTests.push(erreur); },
    async demarrer(id) { if (db.newsletter.statut !== 'validee') return false; db.newsletter.statut = 'en_cours'; return true; },
    async terminer(id, champs) { if (db.newsletter.statut !== 'en_cours') return false; Object.assign(db.newsletter, { statut: 'envoyee' }, champs); return true; },
    async prochaineNewsletter() { return db.newsletter && ['validee', 'en_cours'].includes(db.newsletter.statut) ? { ...db.newsletter } : null; },
    async statut(id) { return statutSeq ? statutSeq() : db.newsletter.statut; },
    async marquer(id, champs) { db.marques.push(champs); Object.assign(db.newsletter, champs); },
    async articles(ids) { return ARTICLES.filter((a) => ids.includes(a.id)); },
    async categories() { return { economie: 'Économie' }; },
    async destinatairesRestants(nlId, limite) {
      return db.abonnes.filter((a) => a.statut === 'actif' && !db.envois.some((e) => e.newsletter_id === nlId && e.abonne_id === a.id)).slice(0, limite);
    },
    async comptesEnvois(now) {
      const dates = [...recents, ...db.envois.map((e) => e.envoye_le)];
      const n = (ms) => dates.filter((d) => now.getTime() - d.getTime() < ms).length;
      return { minute: n(60e3), heure: n(3600e3), jour: n(86400e3) };
    },
    async enregistrerEnvoi(row) { db.envois.push({ ...row, envoye_le: new Date() }); },
  };
  return db;
}

function fakeMailer({ failFor = [], global = false } = {}) {
  const sent = [];
  return {
    sent,
    async send(msg) {
      if (global) { const e = new Error('connexion refusée'); e.global = true; throw e; }
      if (failFor.includes(msg.to)) throw new Error('boîte inexistante');
      sent.push(msg);
    },
  };
}

const NL = () => ({ id: 'nl1', objet: 'Semaine', intro: '', article_ids: ['art1'], statut: 'validee', nb_envoyes: 0 });
const quiet = () => {};

test('runOnce envoie les tests au seul destinataire demandé puis les efface', async () => {
  const db = fakeDb({ tests: [{ id: 'nl1', objet: 'Semaine', intro: '', article_ids: ['art1'], test_a: 'admin@exemple.test' }] });
  const mailer = fakeMailer();
  const r = await runOnce({ db, mailer, siteUrl: SITE, log: quiet });
  assert.equal(r.tests, 1);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'admin@exemple.test');
  assert.ok(mailer.sent[0].subject.startsWith('[TEST] '));
  assert.equal(db.tests.length, 0);
});

test('runOnce envoie une newsletter validée à tous les abonnés actifs et la termine', async () => {
  const db = fakeDb({ newsletter: NL(), abonnes: [ab('a'), ab('b'), ab('c'), ab('d', 'desinscrit')] });
  const mailer = fakeMailer();
  const r = await runOnce({ db, mailer, siteUrl: SITE, log: quiet });
  assert.equal(mailer.sent.length, 3);
  assert.deepEqual(mailer.sent.map((m) => m.to).sort(), ['a@exemple.test', 'b@exemple.test', 'c@exemple.test']);
  assert.equal(db.newsletter.statut, 'envoyee');
  assert.ok(db.newsletter.envoyee_le);
  assert.equal(db.newsletter.nb_envoyes, 3);
  assert.equal(r.terminee, true);
  const m = mailer.sent.find((x) => x.to === 'a@exemple.test');
  assert.ok(m.html.includes('index.php/pages/desinscription/index.html?t=jeton-a'));
  assert.match(m.headers['List-Unsubscribe'], /mailto:newsletter@comoresnews\.com\?subject=desinscription/);
  assert.match(m.headers['List-Unsubscribe'], /\?t=jeton-a/);
});

test('runOnce reprend sans renvoyer aux abonnés déjà servis', async () => {
  const nl = { ...NL(), statut: 'en_cours', nb_envoyes: 2 };
  const envois = [{ newsletter_id: 'nl1', abonne_id: 'a', statut: 'envoye', envoye_le: new Date(Date.now() - 3 * 3600e3) },
    { newsletter_id: 'nl1', abonne_id: 'b', statut: 'envoye', envoye_le: new Date(Date.now() - 3 * 3600e3) }];
  const db = fakeDb({ newsletter: nl, abonnes: [ab('a'), ab('b'), ab('c'), ab('d')], envois });
  const mailer = fakeMailer();
  await runOnce({ db, mailer, siteUrl: SITE, log: quiet });
  assert.deepEqual(mailer.sent.map((m) => m.to).sort(), ['c@exemple.test', 'd@exemple.test']);
  assert.equal(db.newsletter.nb_envoyes, 4);
});

test('runOnce ignore les désinscrits', async () => {
  const db = fakeDb({ newsletter: NL(), abonnes: [ab('a', 'desinscrit'), ab('b')] });
  const mailer = fakeMailer();
  await runOnce({ db, mailer, siteUrl: SITE, log: quiet });
  assert.deepEqual(mailer.sent.map((m) => m.to), ['b@exemple.test']);
});

test('runOnce respecte le quota', async () => {
  const recents = Array.from({ length: 895 }, () => new Date(Date.now() - 30 * 60e3));
  const db = fakeDb({ newsletter: NL(), abonnes: Array.from({ length: 10 }, (_, i) => ab('x' + i)), recents });
  const mailer = fakeMailer();
  const r = await runOnce({ db, mailer, siteUrl: SITE, log: quiet });
  assert.equal(mailer.sent.length, 5);
  assert.equal(db.newsletter.statut, 'en_cours');
  assert.equal(r.terminee, false);
});

test("runOnce s'arrête si le statut passe à arretee", async () => {
  let appels = 0;
  const db = fakeDb({ newsletter: NL(), abonnes: Array.from({ length: 6 }, (_, i) => ab('y' + i)), statutSeq: () => (appels++ === 0 ? 'en_cours' : 'arretee') });
  const mailer = fakeMailer();
  const r = await runOnce({ db, mailer, siteUrl: SITE, log: quiet, tailleLot: 2 });
  assert.equal(mailer.sent.length, 2);
  assert.equal(r.terminee, false);
});

test("runOnce continue après l'échec d'une adresse", async () => {
  const db = fakeDb({ newsletter: NL(), abonnes: [ab('a'), ab('b'), ab('c')] });
  const mailer = fakeMailer({ failFor: ['b@exemple.test'] });
  const r = await runOnce({ db, mailer, siteUrl: SITE, log: quiet });
  assert.equal(mailer.sent.length, 2);
  assert.equal(r.echecs, 1);
  assert.equal(db.envois.find((e) => e.abonne_id === 'b').statut, 'echec');
  assert.equal(db.newsletter.statut, 'envoyee');
});

test("runOnce stoppe sans marquer d'échec si le serveur SMTP est injoignable", async () => {
  const db = fakeDb({ newsletter: NL(), abonnes: [ab('a'), ab('b')] });
  const mailer = fakeMailer({ global: true });
  await assert.rejects(runOnce({ db, mailer, siteUrl: SITE, log: quiet }), /connexion refusée/);
  assert.equal(db.envois.length, 0);
  assert.equal(db.newsletter.statut, 'en_cours');
});

test('runOnce ne journalise aucune adresse email', async () => {
  const lignes = [];
  const db = fakeDb({ newsletter: NL(), abonnes: [ab('a'), ab('b')], tests: [{ id: 't', objet: 'O', intro: '', article_ids: ['art1'], test_a: 'admin@exemple.test' }] });
  await runOnce({ db, mailer: fakeMailer({ failFor: ['a@exemple.test'] }), siteUrl: SITE, log: (s) => lignes.push(String(s)) });
  assert.ok(lignes.length > 0);
  assert.ok(lignes.every((l) => !l.includes('@')), lignes.join(' | '));
});
