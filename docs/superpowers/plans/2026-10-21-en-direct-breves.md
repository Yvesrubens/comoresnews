# En direct, brèves et articles à la une — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les brèves (rédigées et validées dans le back-office), une case admin « À la une » qui pilote l'accueil et une nouvelle page « En direct » en deux colonnes, plus « ● En direct » et un bouton jaune « Newsletter gratuite » dans le menu de toutes les pages.

**Architecture:** Données dans Supabase (colonne `articles.a_la_une`, table `breves`, migration 0011). Le générateur statique lit ces données (service_role), calcule les listes avec des fonctions pures dans `build/lib/en-direct.mjs`, remplit des marqueurs du gabarit d'accueil, écrit la page En direct à partir du gabarit catégorie, et post-traite chaque page HTML pour injecter le menu. Le back-office gagne une vue « Brèves » et la case/étoile À la une.

**Tech Stack:** Node 24 ESM, `node --test`, markdown-it, supabase-js (déjà présents), Postgres/RLS Supabase, HTML statique.

**Spec:** `docs/superpowers/specs/2026-10-21-en-direct-breves-design.md`

## Global Constraints

- Aucune nouvelle dépendance npm.
- Brève : texte brut, non vide après trim, **300 caractères au maximum**.
- Page En direct : **8** articles à la une max, **30** dernières brèves.
- Accueil : grille `tdi_51` = **4** articles ; bandeau `tdi_50` = **3** premiers de la même liste.
- Heure affichée en heure des Comores (**UTC+3**), format `HH:MM`.
- Adresse de la page : `index.php/pages/en-direct/index.html` (profondeur 3, comme les catégories).
- Bouton menu : fond `#f5b400`, texte `#1b2a45`, gras, coins arrondis, libellé exact « Newsletter gratuite » ; entrée menu libellé exact « En direct » précédée d'un point vert clignotant.
- Mode `CONTENT_SOURCE=files` : pas de brèves ni de case ; le build doit réussir (listes vides, repli sur derniers articles).
- Tout texte saisi est échappé en HTML.
- L'ancre pub `data-td-block-uid="tdi_51" >` de l'accueil doit rester intacte (`build/lib/ads.mjs`).
- Fichiers Windows : normaliser `\r\n` → `\n` avant toute recherche de chaîne dans les gabarits.
- Migration rejouable (`drop policy if exists`, `create or replace`, `if not exists`).

## Review Focus

1. Un rédacteur (non admin) enregistre un article déjà coché par un admin → aucune erreur, la case reste cochée (trigger base). Test : Task 1.
2. Aucun article coché / moins de 4 cochés → accueil plein, sans doublon. Test : Task 3 (`homeUne`).
3. Brève avec `<script>` ou `&` → affichée échappée sur la page En direct. Test : Task 3 (`enDirectInner`).
4. Brève publiée à 23h30 UTC → heure affichée 02:30 (UTC+3), groupe du jour Comores. Test : Task 3 (`breveTime`/`breveDayKey`).
5. Page statique sans bandeau newsletter (contact, mentions…) → le bouton mène à l'accueil `#cn-newsletter`, pas à une ancre absente. Test : Task 5.

---

### Task 1: Migration 0011 (colonne à la une, table brèves, RLS)

**Files:**
- Create: `supabase/migrations/0011_breves_une.sql`
- Test: `test/migration-0011.test.mjs`

**Interfaces:**
- Produces: `articles.a_la_une boolean not null default false` ; table `public.breves(id uuid pk default gen_random_uuid(), texte text not null check (char_length(btrim(texte)) between 1 and 300), auteur_id uuid not null references public.profiles(id) default auth.uid(), statut text not null default 'brouillon' check (statut in ('brouillon','en_attente','publie')), commentaire_relecture text, date_publication timestamptz, cree_le timestamptz not null default now(), maj_le timestamptz not null default now())`.

- [ ] **Step 1: Write the failing test** — lit le fichier SQL et vérifie la présence de : `add column if not exists a_la_une`, `create table if not exists public.breves`, `check (char_length(btrim(texte)) between 1 and 300)`, `enable row level security` sur breves, les policies `breves_admin_all`, `breves_writer_read`, `breves_writer_insert`, `breves_writer_update`, `breves_writer_delete` (chacune précédée de `drop policy if exists`), la fonction `articles_garde_une` et son trigger `before insert or update on public.articles`, `grant select, insert, update, delete on public.breves to authenticated`, `grant all on public.breves to service_role`.
- [ ] **Step 2: Run** `node --test test/migration-0011.test.mjs` → FAIL (fichier absent).
- [ ] **Step 3: Write the SQL.** RLS des brèves calquée sur `articles` dans `0003_rls.sql` (admin `for all using/with check is_admin()` ; rédacteur : select/insert/update/delete de ses lignes avec `statut in ('brouillon','en_attente')`). Trigger `articles_garde_une()` (plpgsql, `security definer`) : si `not public.is_admin()` → en INSERT `new.a_la_une := false`, en UPDATE `new.a_la_une := old.a_la_une` (correction silencieuse, jamais d'erreur ; s'applique aussi au service_role, qui ne modifie pas ce champ). Trigger `maj_le` sur breves en réutilisant la fonction de `0002_triggers.sql` si elle existe (lire le fichier), sinon une simple fonction `breves_touch`.
- [ ] **Step 4: Run** le test → PASS ; `npm test` → tout passe.
- [ ] **Step 5: Commit** `feat(db): migration 0011 brèves et à la une`.

### Task 2: Chargement des données au build

**Files:**
- Modify: `build/lib/supabase-source.mjs`
- Test: `test/supabase-source.test.mjs`

**Interfaces:**
- Produces: `mapRow(row)` renvoie en plus `aLaUne: boolean` (`row.a_la_une === true`) et `publishedAt: string` (`row.date_publication || row.date_programmee || row.cree_le`, ISO complet). `loadBreves(client, limit = 30) → Promise<Array<{ id: string, texte: string, publishedAt: string }>>` : statut `publie`, tri `date_publication` desc, `[]` (avec `console.warn`) en cas d'erreur.

- [ ] **Step 1: Tests** : `mapRow({... a_la_une: true, date_publication: '2026-10-21T08:30:00Z'})` → `aLaUne === true`, `publishedAt === '2026-10-21T08:30:00Z'` ; sans `a_la_une` → `false`. `loadBreves` avec un faux client (chaîne `from().select().eq().order().limit()`) renvoyant 2 lignes → 2 objets mappés ; faux client en erreur → `[]`.
- [ ] **Step 2: Run** `node --test test/supabase-source.test.mjs` → FAIL.
- [ ] **Step 3: Implement** (même style que `loadLatestSujets`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(build): charge à la une et brèves`.

### Task 3: Fonctions pures En direct

**Files:**
- Create: `build/lib/en-direct.mjs`
- Test: `test/en-direct.test.mjs`

**Interfaces:**
- Consumes: articles au format `mapRow` (`title, slug, category, date, image, aLaUne, publishedAt`), brèves `{id, texte, publishedAt}`, `articleCard`, `articlePath`, `resolveImg` existants.
- Produces:
  - `byRecent(a, b)` : tri desc sur `publishedAt || date`.
  - `pickUne(articles, max = 8) → Article[]` : cochés, récents d'abord ; si aucun coché → les `max` derniers publiés.
  - `homeUne(articles, n = 4) → Article[]` : cochés d'abord (récents), complétés par les derniers publiés non déjà pris.
  - `breveTime(iso) → 'HH:MM'` en UTC+3.
  - `breveDayKey(iso) → 'YYYY-MM-DD'` jour Comores.
  - `breveDayFallback(iso) → '21 octobre'` (fr-FR, jour Comores).
  - `enDirectInner(une, breves, P, catsCfg) → string` : `<div class="cn-direct">` avec colonne `.cn-direct-une` (titre « À la une », cartes) et `.cn-direct-breves` (titre « Brèves », groupes par jour `<h4 class="cn-day" data-day="YYYY-MM-DD">21 octobre</h4>`, items `<time datetime="ISO">HH:MM</time>` + texte échappé), message « Aucune brève pour le moment. » si vide, + `<style>` (deux colonnes ≥ 768px, empilées en dessous) + `<script>` qui remplace le texte des `h4.cn-day` du jour / de la veille (jour Comores du navigateur) par « Aujourd'hui » / « Hier ».

- [ ] **Step 1: Tests** :
  - `homeUne` : 2 cochés + 5 non cochés → 4 éléments, les 2 cochés en tête, aucun slug en double ; 0 coché → les 4 plus récents ; 6 cochés → 4 cochés seulement.
  - `pickUne` : 10 cochés → 8 ; 0 coché → 8 derniers.
  - `breveTime('2026-10-21T23:30:00Z') === '02:30'` ; `breveDayKey('2026-10-21T23:30:00Z') === '2026-10-22'` ; `breveDayFallback('2026-10-21T10:00:00Z') === '21 octobre'`.
  - `enDirectInner([], [{id:'1', texte:'<script>x</script> & co', publishedAt:'2026-10-21T08:00:00Z'}], '../../../', cats)` contient `&lt;script&gt;x&lt;/script&gt; &amp; co`, `datetime="2026-10-21T08:00:00Z"`, `11:00`, « À la une », « Brèves » ; ne contient pas `<script>x`.
  - `enDirectInner(une, [], P, cats)` contient « Aucune brève pour le moment. » et un lien `../../../index.php/2026/…` pour chaque article de `une`.
- [ ] **Step 2: Run** `node --test test/en-direct.test.mjs` → FAIL.
- [ ] **Step 3: Implement** (décalage UTC+3 par arithmétique sur `Date`, comme `admin/lib.mjs::comoros`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(build): fonctions En direct`.

### Task 4: Accueil piloté par À la une + page En direct

**Files:**
- Modify: `templates/home.html` (remplacer le contenu figé de la grille `tdi_51` par `{{UNE_GRID}}` et les 3 entrées figées du bandeau `tdi_50` par `{{UNE_TICKER}}`, en gardant la balise ouvrante `<div id=tdi_51 class="td_block_inner">` et tout ce qui précède l'ancre pub)
- Modify: `build/generate.mjs`
- Modify: `build/lib/en-direct.mjs` (`uneGridHtml`, `uneTickerHtml`)
- Test: `test/generate.test.mjs`, `test/en-direct.test.mjs`

**Interfaces:**
- Consumes: `homeUne`, `pickUne`, `enDirectInner`, `loadBreves`.
- Produces: `uneGridHtml(list, catsCfg) → string` reproduisant exactement le balisage actuel (post-0 `td_module_flex_6`, posts 1–3 `td_module_flex_7` dans `.td-big-grid-flex-scroll-holder` ; copier le balisage existant comme modèle, champs échappés) ; `uneTickerHtml(list) → string` (balisage `td_module_trending_now` existant, 3 éléments) ; `buildHome(articles, catsCfg)` remplit aussi ces deux marqueurs ; `buildEnDirectPage(articles, breves, catsCfg) → string` (gabarit `category.html`, TITLE « En direct », BREADCRUMB `<span class="td-bred-no-url-last">En direct</span>`, ARTICLES = `enDirectInner(pickUne(articles), breves, '../../../', catsCfg)`) ; `EN_DIRECT_PAGE = 'index.php/pages/en-direct/index.html'` ; `main` charge `loadBreves` en mode supabase (sinon `[]`), écrit la page via `deco`, l'ajoute au sitemap (`lastmod: now`).

- [ ] **Step 1: Tests** (`generate.test.mjs`) : `buildHome([coché, a2, a3, a4, a5], cats)` → ne contient ni `{{UNE_GRID}}` ni `{{UNE_TICKER}}`, contient le titre de l'article coché avant celui de a2 dans la grille, contient `data-td-block-uid="tdi_51" >`, ne contient plus « Le Grand Mariage aux Comores » si aucun article de ce titre n'est passé ; `buildEnDirectPage([a], [breve], cats)` contient « En direct », le texte de la brève et `../../../index.php/2026/06/12/s/index.html`. `buildHome([], cats)` ne lève pas d'erreur.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (modifier le gabarit par un script node qui normalise `\r\n`).
- [ ] **Step 4: Run** `npm test` → PASS ; `npm run build` (mode fichiers) → « Build OK » et `_site/index.php/pages/en-direct/index.html` existe.
- [ ] **Step 5: Commit** `feat: accueil à la une dynamique et page En direct`.

### Task 5: Menu « ● En direct » + bouton « Newsletter gratuite »

**Files:**
- Create: `build/lib/menu.mjs`
- Modify: `build/generate.mjs` (ajouter `injectMenu` en dernier dans `deco`, et l'appliquer aux pages HTML recopiées de `index.php/pages/*` après le PASSTHROUGH)
- Test: `test/menu.test.mjs`

**Interfaces:**
- Produces: `injectMenu(html) → string`, idempotent (ne fait rien si `id="cn-menu-direct"` présent ou si `menu-main-3` absent). Préfixe racine déduit du lien « Accueil » du menu (`href="(P)index.html"><div class="tdb-menu-item-text">Accueil`). Ajoute avant le `</ul>` de `id="menu-main-3"` un `<li id="cn-menu-direct">` (lien `P + 'index.php/pages/en-direct/index.html'`, `<span class="cn-live-dot"></span>En direct`) et un `<li>` bouton `<a class="cn-nl-btn" href="…">Newsletter gratuite</a>` ; même chose (sans styles de bouton bureau) avant le `</ul>` de `id="menu-main-2"` (mobile). Lien du bouton : `#cn-newsletter` si la page contient `id="cn-newsletter"`, sinon `P + 'index.html#cn-newsletter'`. Injecte un `<style id="cn-menu-css">` avant `</head>` (point vert animé, bouton jaune).

- [ ] **Step 1: Tests** : sur `templates/article.html` (normalisé) précédé de `<section id="cn-newsletter">` → contient `../../../../../index.php/pages/en-direct/index.html`, « Newsletter gratuite », `href="#cn-newsletter"`, 2 occurrences de « En direct » dans les menus ; sur `index.php/pages/contact/index.html` → bouton vers `../../../index.html#cn-newsletter` ; sur `templates/home.html` → lien `index.php/pages/en-direct/index.html` ; double appel = même résultat ; HTML sans `menu-main-3` inchangé.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS ; `npm run build` puis `grep -l cn-menu-direct _site/index.html _site/index.php/pages/contact/index.html` → les deux.
- [ ] **Step 5: Commit** `feat: menu En direct et bouton newsletter`.

### Task 6: Back-office — case et étoile À la une

**Files:**
- Modify: `admin/supabase.mjs` (`setUne(id, value) → sb.from('articles').update({ a_la_une: value }).eq('id', id)` ; ajouter `a_la_une` au select de `listArticles`)
- Modify: `admin/index.html` (case `#e-une` « À la une » classe `adminOnly` dans l'éditeur ; colonne ★ admin dans la liste)
- Modify: `admin/lib.mjs` (`formToRow` : inclut `a_la_une` seulement si `f.a_la_une !== undefined`)
- Test: `test/admin-lib.test.mjs`

**Interfaces:**
- Comportement : pour un article existant, changer la case appelle `api.setUne` immédiatement (jamais `save('publier')`, qui remettrait `date_publication` à maintenant) puis `api.triggerDeploy()` si `statut === 'publie'` ; pour un nouvel article, la valeur part avec l'insertion (admin seulement). Le ★ de la liste bascule de la même façon et rafraîchit la liste. `gatherForm` n'envoie `a_la_une` que si `PROFILE.role === 'admin'`.

- [ ] **Step 1: Tests** : `formToRow({...f, action:'brouillon'}, 'u')` n'a pas de clé `a_la_une` ; `formToRow({...f, a_la_une:true, action:'publier'}, 'u').a_la_une === true`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → PASS, et contrôle de syntaxe du script module de `admin/index.html` (extraire le `<script type="module">` et `node --check`).
- [ ] **Step 5: Commit** `feat(admin): case À la une`.

### Task 7: Back-office — vue Brèves et validation

**Files:**
- Modify: `admin/supabase.mjs` (`listBreves({ statut })`, `insertBreve(row)`, `updateBreve(id, row)`, `deleteBreve(id)` ; select `id,texte,statut,auteur_id,commentaire_relecture,date_publication,maj_le,profiles!breves_auteur_id_fkey(nom)`)
- Modify: `admin/lib.mjs` (`validateBreve(texte) → string[]`, `breveToRow(texte, action, existing) → object`)
- Modify: `admin/index.html` (nav « Brèves » dans Rédaction, vue `view-breves` : liste + filtre statut + formulaire avec compteur `n/300`, boutons Enregistrer brouillon / Soumettre / Publier (admin) / Renvoyer avec motif (admin) / Dépublier (admin, publiée) / Supprimer ; tableau de bord : « en attente » = articles + brèves en attente)
- Test: `test/admin-lib.test.mjs`

**Interfaces:**
- `validateBreve('')` → `['texte']` ; 301 caractères → `['longueur']` ; 300 → `[]`.
- `breveToRow(t, 'brouillon'|'soumettre'|'publier'|'depublier', existing)` : statut via `nextStatus` existant (`depublier` → `brouillon`) ; `date_publication` = maintenant seulement au passage en `publie` depuis un autre statut (on garde `existing.date_publication` sinon) ; `null` si dépubliée ; `texte` trimé.
- Publier, dépublier ou supprimer une brève publiée → `api.triggerDeploy()`.

- [ ] **Step 1: Tests** pour `validateBreve` et `breveToRow` (y compris : republier une brève déjà publiée garde sa date).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → PASS + `node --check` du script module.
- [ ] **Step 5: Commit** `feat(admin): brèves`.

### Task 8: Mise en ligne

- [ ] **Step 1:** Fusionner la branche dans `main`, pousser.
- [ ] **Step 2:** Demander à Yves de coller `0011_breves_une.sql` dans l'éditeur SQL Supabase ; vérifier ensuite avec la clé service_role que `breves` existe et que `articles.a_la_une` est lisible.
- [ ] **Step 3:** Déclencher le Deploy Hook Vercel ; vérifier par `curl` : `https://comoresnews.com/index.php/pages/en-direct/index.html` → 200 et contient « Brèves » ; l'accueil contient `cn-menu-direct` et « Newsletter gratuite ».
- [ ] **Step 4:** Mettre à jour la mémoire projet.
