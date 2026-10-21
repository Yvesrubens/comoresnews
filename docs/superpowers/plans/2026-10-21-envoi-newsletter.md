# Envoi de la newsletter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer, relire et valider la newsletter hebdomadaire dans le back-office, puis l'envoyer automatiquement depuis `newsletter@comoresnews.com` (SMTP Gandi), avec désinscription en un clic.

**Architecture:** Les admins manipulent la table `newsletters` sous RLS ; les changements d'état sensibles passent par des fonctions SQL (valider / annuler / arrêter). Un gabarit d'email unique (`admin/newsletter-template.mjs`) sert à l'aperçu du back-office et au script d'envoi. Un script Node lancé toutes les 10 minutes par GitHub Actions envoie les tests et les newsletters validées, dans des quotas glissants calculés sur `newsletter_envois`. Une page statique traite la désinscription via une fonction SQL appelée avec la clé publique.

**Tech Stack:** Node 24 ESM, `nodemailer`, `@supabase/supabase-js`, Postgres/RLS Supabase, GitHub Actions, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-21-envoi-newsletter-design.md`

## Global Constraints

- SMTP : `mail.gandi.net`, port 465, TLS, utilisateur `newsletter@comoresnews.com`, mot de passe en variable `SMTP_PASS` (jamais dans le dépôt, le navigateur ou les journaux).
- Expéditeur affiché : `Comoresnews <newsletter@comoresnews.com>`.
- Quotas : **100 / minute, 900 / heure glissante, 7 000 / 24 h glissantes**, comptés sur `newsletter_envois.envoye_le`.
- Base des liens : `SITE_BASE_URL`, défaut `https://comoresnews.com`.
- Statuts newsletter : `brouillon` | `validee` | `en_cours` | `envoyee` | `arretee` | `echec`.
- Transitions admin seulement : `brouillon→validee`, `validee→brouillon`, `en_cours→arretee` ; `en_cours`/`envoyee`/`echec` posés par le `service_role`.
- Fuseau de référence : Comores, UTC+3 (« vendredi », dates de l'objet).
- Les journaux du script n'écrivent **jamais** d'adresse email (dépôt public) : seulement des compteurs.
- Un email individuel par abonné (pas de copie cachée groupée).
- En-tête `List-Unsubscribe: <mailto:newsletter@comoresnews.com?subject=desinscription>, <URL de désinscription>`.
- Page de désinscription : `index.php/pages/desinscription/index.html?t=<jeton>`.
- Commits en français, fin de message `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Coupure au milieu d'un envoi** (run GitHub tué, SMTP qui lâche) → le passage suivant reprend avec les seuls abonnés pas encore servis, personne ne reçoit deux fois. Test : Task 4 `runOnce reprend sans renvoyer aux abonnés déjà servis`.
2. **Abonné qui se désinscrit pendant un envoi en cours** → il ne reçoit pas la suite. Test : Task 4 `runOnce ignore les désinscrits`.
3. **Arrêt demandé par un admin entre deux lots** → plus aucun email ne part. Test : Task 4 `runOnce s'arrête si le statut passe à arretee`.
4. **Quota déjà consommé dans l'heure** (newsletter précédente, tests) → le passage n'envoie que le reste autorisé, puis attend le suivant. Test : Task 3 `quotaDisponible tient compte de l'heure et des 24 h glissantes`.
5. **Article sans image ou sans chapô, titre avec `<` ou `&`** → l'email reste propre, aucun HTML injecté. Test : Task 2 `renderNewsletter échappe et tolère les champs vides`.

---

### Task 1: Migration `0009_newsletters.sql`

**Files:** Create `supabase/migrations/0009_newsletters.sql`

**Interfaces:**
- Produces: colonne `abonnes.jeton uuid not null default gen_random_uuid() unique` ; table `newsletters(id uuid pk, objet text not null, intro text not null default '', article_ids uuid[] not null default '{}', statut text not null default 'brouillon' check (statut in (…6 statuts…)), test_a text, cree_par uuid, cree_le timestamptz default now(), validee_par uuid, validee_le timestamptz, envoyee_le timestamptz, nb_destinataires int not null default 0, nb_envoyes int not null default 0, derniere_erreur text)` ; table `newsletter_envois(newsletter_id uuid references newsletters on delete cascade, abonne_id uuid references abonnes on delete cascade, statut text check in ('envoye','echec'), envoye_le timestamptz default now(), erreur text, primary key(newsletter_id, abonne_id))` + index `(envoye_le)`.
- Produces: fonctions `valider_newsletter(p_id uuid) returns int` (nb de destinataires, fixe `nb_destinataires`, `validee_par/le`), `annuler_newsletter(p_id uuid) returns void`, `arreter_newsletter(p_id uuid) returns void` — `security definer`, refusent si `not is_admin()` ou si le statut de départ n'est pas le bon (`'Action impossible dans l''état actuel'`) ; `desinscrire_newsletter(p_jeton uuid) returns void` exécutable par `anon`, silencieuse si jeton inconnu.

- [ ] **Step 1: Écrire la migration** (relançable : `if not exists`, `drop policy if exists`, `create or replace`). RLS : `newsletters` — select/insert pour `is_admin()` (insert avec `statut='brouillon'`), update pour `is_admin()` **uniquement si** `statut='brouillon'` et avec check `statut='brouillon'` ; grants `select, insert, update (objet, intro, article_ids, test_a)` à authenticated. `newsletter_envois` — select `is_admin()`, grant select à authenticated. `grant all … to service_role` sur les deux. `grant execute` des 3 fonctions admin à authenticated, de `desinscrire_newsletter` à anon et authenticated.
- [ ] **Step 2: L'utilisateur l'applique** dans le SQL Editor → « Success ».
- [ ] **Step 3: Vérifier via REST** : avec la clé anon, `GET /rest/v1/newsletters` → 401/42501 ; `POST /rpc/desinscrire_newsletter {"p_jeton":"00000000-0000-0000-0000-000000000000"}` → 204 ; avec le service_role, `GET /rest/v1/abonnes?select=jeton&limit=1` renvoie un jeton (si au moins un abonné).
- [ ] **Step 4: Commit** `feat(db): newsletters, envois, jeton de désinscription`.

---

### Task 2: Gabarit d'email partagé

**Files:** Create `admin/newsletter-template.mjs` ; Test `test/newsletter-template.test.mjs`

**Interfaces:**
- Produces: `renderNewsletter({ objet: string, intro: string, articles: Article[], siteUrl: string, unsubscribeUrl: string, categories?: Record<slug,nom> }) → { html: string, text: string }` où `Article = { titre, slug, categorie, excerpt, image_couverture, date_publication }`. Lien d'article = `${siteUrl}/` + `articleUrl(date_publication.slice(0,10), slug)` (fonction existante de `admin/lib.mjs`). Image : URL absolue telle quelle, chemin relatif préfixé par `siteUrl`, absente → pas de balise `<img>`.
- Produces: `weekSubject(now: Date) → string` : `« Comoresnews — l'essentiel de la semaine du 19 au 25 octobre »` (lundi→dimanche de la semaine de `now`, heure des Comores ; si les mois diffèrent : « du 28 septembre au 4 octobre »).
- Produces: `pickArticles(rows, sinceIso: string|null, now: Date) → rows` : articles `statut='publie'` avec `date_publication` > `sinceIso` (ou > now − 7 jours si null), du plus récent au plus ancien.

- [ ] **Step 1: Tests** :
  - `renderNewsletter contient chaque article avec lien absolu, image et lien de désinscription` : 2 articles → HTML contient `https://comoresnews.com/index.php/2026/10/20/vanille/index.html`, `<img` avec l'URL Storage, le `unsubscribeUrl`, `COMORES` et `NEWS` ; `text` contient les 2 titres et l'URL de désinscription.
  - `renderNewsletter échappe et tolère les champs vides` : titre `A<b>&C`, pas d'image, pas de chapô → HTML contient `A&lt;b>&amp;C`, ne contient ni `<b>` ni `<img`, pas de `undefined`.
  - `renderNewsletter met l'introduction en tête si elle existe` ; sans intro, pas de paragraphe vide.
  - `weekSubject` : mercredi 21 oct 2026 → `Comoresnews — l'essentiel de la semaine du 19 au 25 octobre` ; jeudi 1er oct 2026 → `… du 28 septembre au 4 octobre`.
  - `pickArticles` : ignore les non publiés et ceux antérieurs à `sinceIso` ; sans `sinceIso`, garde les 7 derniers jours ; tri décroissant.
- [ ] **Step 2: FAIL**, **Step 3: implémenter** (HTML en tableaux, styles en ligne, largeur 600 px, couleurs du site : fond d'en-tête #111, « NEWS » #e50914), **Step 4: PASS** + suite complète.
- [ ] **Step 5: Commit** `feat(newsletter): gabarit d'email partagé (aperçu + envoi)`.

---

### Task 3: Quotas d'envoi

**Files:** Create `scripts/lib/newsletter-quota.mjs` ; Test `test/newsletter-quota.test.mjs`

**Interfaces:**
- Produces: `LIMITES = { parMinute: 100, parHeure: 900, parJour: 7000 }` ; `quotaDisponible(envoyesLe: Date[], now: Date, limites = LIMITES) → number` = minimum de (limite − envois dans la fenêtre) sur les trois fenêtres glissantes, jamais négatif.

- [ ] **Step 1: Tests** : aucun envoi → 100 ; 900 envois il y a 30 min → 0 ; 900 envois il y a 61 min → 100 ; 6 950 envois répartis sur les 23 dernières heures dont aucun dans l'heure → 50 ; 30 envois dans la dernière minute → 70. Nom : `quotaDisponible tient compte de l'heure et des 24 h glissantes`.
- [ ] **Step 2: FAIL**, **Step 3: implémenter**, **Step 4: PASS**.
- [ ] **Step 5: Commit** `feat(newsletter): quotas d'envoi glissants`.

---

### Task 4: Script d'envoi

**Files:** Create `scripts/send-newsletter.mjs` ; Modify `package.json` (dépendance `nodemailer`) ; Test `test/send-newsletter.test.mjs`

**Interfaces:**
- Consumes: `renderNewsletter` (Task 2), `quotaDisponible`, `LIMITES` (Task 3).
- Produces: `runOnce({ db, mailer, now = () => new Date(), log = console.log, siteUrl, limites = LIMITES, tailleLot = 20 }) → Promise<{ tests: number, envoyes: number, echecs: number, newsletterId: string|null, terminee: boolean }>` avec :
  - `db.testsDemandes() → [{ id, objet, intro, article_ids, test_a }]`, `db.effacerTest(id)`,
  - `db.prochaineNewsletter() → newsletter | null` (statut `validee` ou `en_cours`, la plus ancienne `validee_le`), `db.statut(id) → string`, `db.marquer(id, champs)`,
  - `db.articles(ids) → Article[]`, `db.categories() → Record<slug,nom>`,
  - `db.destinatairesRestants(newsletterId, limite) → [{ id, email, jeton }]` (abonnés `actif` absents de `newsletter_envois`),
  - `db.envoisRecents(depuis: Date) → Date[]`, `db.enregistrerEnvoi({ newsletter_id, abonne_id, statut, erreur })`,
  - `mailer.send({ to, subject, html, text, headers }) → Promise`.
  Déroulé : tests d'abord (objet préfixé `[TEST] `, désinscription vers `${siteUrl}/index.php/pages/desinscription/index.html`), puis newsletter : passe `en_cours`, lots de `tailleLot` dans la limite de `quotaDisponible`, **relit `db.statut` avant chaque lot** (sort si `arretee`), un échec d'adresse → `enregistrerEnvoi` statut `echec` et on continue ; plus aucun destinataire → `envoyee` + `envoyee_le` + `nb_envoyes`.
- Produces: `main()` : client Supabase `service_role`, transport `nodemailer` (Global Constraints), `process.exitCode = 1` si la connexion SMTP échoue (et `derniere_erreur` renseignée).

- [ ] **Step 1: Tests** avec faux `db` en mémoire et faux `mailer` qui mémorise les envois :
  - `runOnce envoie les tests au seul destinataire demandé puis les efface`.
  - `runOnce envoie une newsletter validée à tous les abonnés actifs et la termine` : 3 actifs + 1 désinscrit → 3 envois, statut `envoyee`, `nb_envoyes` = 3, chaque email a son propre lien `?t=<jeton>` et l'en-tête `List-Unsubscribe`.
  - `runOnce reprend sans renvoyer aux abonnés déjà servis` : 2 déjà dans les envois → seuls les 2 autres reçoivent.
  - `runOnce ignore les désinscrits` (même cas que ci-dessus vu côté `destinatairesRestants`).
  - `runOnce respecte le quota` : `envoisRecents` renvoie 895 dates dans l'heure, 10 destinataires → 5 envoyés, newsletter reste `en_cours`, `terminee:false`.
  - `runOnce s'arrête si le statut passe à arretee` : le faux `db.statut` renvoie `arretee` après le 1er lot de 2 (`tailleLot: 2`) → 2 envois seulement.
  - `runOnce continue après l'échec d'une adresse` : le mailer rejette pour un destinataire → enregistré `echec`, les autres envoyés.
  - `runOnce ne journalise aucune adresse email` : capturer `log`, aucune ligne ne contient `@`.
- [ ] **Step 2: FAIL**, **Step 3: `npm install nodemailer` puis implémenter**, **Step 4: PASS** + suite complète.
- [ ] **Step 5: Commit** `feat(newsletter): script d'envoi (tests, lots, quotas, reprise, arrêt)`.

---

### Task 5: Page de désinscription

**Files:** Create `index.php/pages/desinscription/index.html` ; Modify `build/generate.mjs` (`PASSTHROUGH` + `'index.php/pages/desinscription'`) ; Test `test/desinscription-page.test.mjs`

- [ ] **Step 1: Test** : le fichier existe, contient `rpc/desinscrire_newsletter`, lit le paramètre `t`, contient le texte `Vous êtes désinscrit de la newsletter`, et `id="cn-legal-bar"` ; le build copie la page dans `_site`.
- [ ] **Step 2: FAIL**, **Step 3: créer la page** en copiant `index.php/pages/mentions-legales/index.html` (titre `<title>` et `h1` → « Désinscription », contenu remplacé entre `<h1 style="font-size:32px` et la fermeture de `td-main-content-wrap`) avec un script qui appelle la RPC via `fetch` (clé anon de `build/lib/newsletter.mjs`), affiche « Vous êtes désinscrit de la newsletter. Vous ne recevrez plus nos emails. » ou, sans jeton/erreur réseau, « Ce lien de désinscription n'est pas valide. Écrivez-nous à contact@comoresnews.com. » ; `<meta name="robots" content="noindex">`.
- [ ] **Step 4: PASS**, **Step 5: Commit** `feat(newsletter): page de désinscription`.

---

### Task 6: Back-office — préparer, relire, valider, suivre

**Files:** Modify `admin/supabase.mjs`, `admin/lib.mjs`, `admin/index.html` ; Test `test/admin-dashboard.test.mjs`

**Interfaces:**
- Consumes: `renderNewsletter`, `weekSubject`, `pickArticles` (Task 2), fonctions SQL (Task 1).
- Produces (`admin/lib.mjs`) : `isFridayComoros(now: Date) → boolean` ; `newsletterDueThisWeek(newsletters, now) → boolean` = vendredi (Comores) **et** aucune newsletter `envoyee`/`en_cours`/`validee` créée depuis le lundi de la semaine.
- Produces (`admin/supabase.mjs`) : `listNewsletters()`, `getNewsletter(id)`, `createNewsletter(row)`, `updateNewsletter(id, champs)`, `validerNewsletter(id)`, `annulerNewsletter(id)`, `arreterNewsletter(id)` (RPC), `lastSentNewsletter()`, `listPublishedSince(iso)`.

- [ ] **Step 1: Tests** `isFridayComoros` (vendredi 23 oct 2026 22h UTC = samedi aux Comores → false ; vendredi 23 oct 2026 05h UTC → true) et `newsletterDueThisWeek` (vendredi sans newsletter → true ; avec une `envoyee` du mercredi → false ; un simple `brouillon` → true).
- [ ] **Step 2: FAIL**, **Step 3: implémenter**, **Step 4: PASS**.
- [ ] **Step 5: UI rubrique Newsletters** (sous la liste des abonnés existante) :
  - bouton « Préparer la newsletter de la semaine » : ouvre le brouillon existant s'il y en a un, sinon crée `{ objet: weekSubject(now), article_ids: pickArticles(…depuis la dernière envoyée…).map(id) }` ;
  - écran du brouillon : objet, introduction, articles à cocher, **aperçu** dans une `iframe srcdoc` avec `renderNewsletter(…, unsubscribeUrl: '#')` ; « Enregistrer », « M'envoyer un test » (`test_a` = email de l'admin, message « Test envoyé dans les 10 prochaines minutes »), « Valider et envoyer » (confirmation « Envoyer à N abonnés ? », N = abonnés actifs) ;
  - historique : date, objet, statut, `nb_envoyes`/`nb_destinataires`, erreur ; boutons « Annuler l'envoi » (validee) et « Arrêter l'envoi » (en_cours).
- [ ] **Step 6: Tableau de bord** : si `newsletterDueThisWeek` → encart « La newsletter de la semaine est à préparer » + bouton ; sinon dernier envoi (date, nombre).
- [ ] **Step 7: Vérifications** : suite complète ; contrôle de syntaxe du script de la page (`node --check` sur le module extrait) ; tous les `$('id')` existent dans le HTML.
- [ ] **Step 8: Commit** `feat(admin): préparation, aperçu, validation et suivi de la newsletter`.

---

### Task 7: Planification et mise en service

**Files:** Create `.github/workflows/send-newsletter.yml`

- [ ] **Step 1: Workflow** : `schedule: cron '*/10 * * * *'` + `workflow_dispatch`, `concurrency: { group: send-newsletter, cancel-in-progress: false }`, Node 24, `npm ci`, `node scripts/send-newsletter.mjs`, env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `SITE_BASE_URL=https://comoresnews.com`, `timeout-minutes: 15`.
- [ ] **Step 2: Secret** `SMTP_PASS` lu depuis `.env` (rempli par l'utilisateur) → `gh secret set` sans affichage.
- [ ] **Step 3: Essai réel** une fois la boîte créée : « M'envoyer un test » depuis le back-office (ou ligne de test posée en base), `gh workflow run send-newsletter.yml`, run vert, email reçu par l'admin.
- [ ] **Step 4: Commit, fusion, mise en ligne** ; mise à jour de la mémoire projet.
