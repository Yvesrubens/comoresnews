# Refonte en cartes — plan de mise en œuvre (partie 2/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les gabarits clonés de WordPress par des pages légères en cartes (accueil, rubriques, auteur, « En direct », articles, pages fixes), selon les maquettes validées, sans perdre ni URL, ni pub, ni SEO, ni newsletter, ni règle de sélection existante.

**Architecture:** Les pages sont produites par des fonctions JS (plus de `templates/*.html`) : un habillage commun `build/lib/gabarit.mjs` (head, barre du haut, en-tête, `<main id="cn-main">`, pied de page), des cartes `build/lib/cartes.mjs`, et les pages dans `build/generate.mjs`. Le style et le petit script du site vivent dans `assets/cn.css` et `assets/cn.js`, recopiés tels quels. Les modules d'injection (pubs, newsletter, date, cookies, Analytics) restent, avec de nouveaux points d'ancrage explicites.

**Tech Stack:** Node ESM, `node:test`, `markdown-it` (déjà là), HTML/CSS/JS sans framework.

**Spec:** `docs/superpowers/specs/2026-11-05-refonte-cartes-design.md` — maquettes validées : `.superpowers/brainstorm/758-1793880110/content/accueil-v2.html`, `rubriques-v1.html` (option A), `article-v1.html`.

## Global Constraints

- Couleurs : vert `#19471a` (et `#0f2e10` pour la barre du haut), jaune `#fcc624`, rouge `#ce1329`, bleu `#2673b9`, fond `#f4f2ee`, cartes blanches, coins 10–12 px, ombre légère.
- Polices **système** (pas de police web, pas de dépendance externe nouvelle) : titres et corps d'article `Georgia, 'Times New Roman', serif` ; interface `system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`.
- Aucun nom, texte, couleur ou élément de SolarBrief.
- URLs inchangées (`index.php/AAAA/MM/JJ/<slug>/index.html`, `index.php/category/<slug>/index.html`, `index.php/author/lewistifosi/index.html`, `index.php/pages/*`), liens **relatifs** via `relPrefix` comme aujourd'hui.
- Emplacements publicitaires conservés (ids SmartAdServer) : MégaBannière 1 `45656` en haut, GrandAngle `45654` + Pavé 1 `45655` dans la colonne de droite, Pavé 2 `49048` dans le corps d'article, MégaBannière 2 `49046` + Floor `94320` en bas.
- Règles de sélection inchangées : `homeUne`, `titresDuJour`, `aNePasManquer`, `pourraitInteresser`, `HOME_SECTION_MAX = 4`.
- Téléphone (≤ 767 px) : une carte par ligne, colonne de droite sous le contenu, menu repliable.
- Heure des Comores (UTC+3) pour toutes les dates.
- Travail sur la branche `feat/refonte-cartes` ; **revenir sur `main` à chaque fin de session** (la tâche planifiée de réécriture lance les scripts depuis la copie de travail). Fusion et mise en ligne seulement avec l'accord d'Yves.

## Review Focus

- **Article sans image** : carte avec aplat gris, page article sans bloc photo ni légende → tests Tasks 2 et 6.
- **Caractères spéciaux** dans titres, chapôs, noms de source (`&`, `<`, guillemets) : échappés partout → test Task 2.
- **Profondeur de page** : CSS, logo, menu et cartes justes depuis l'accueil (`''`), une rubrique (`../../../`), un article (`../../../../../`) → test Task 1.
- **Rubrique ou section vide**, et site avec un seul article : « Aucun article pour le moment. », pas de « À lire aussi » vide, pas de bandeau de titres vide → tests Tasks 4, 5, 6.
- **Page fixe dont la zone de contenu est introuvable** (structure inattendue) : la page est recopiée telle quelle plutôt que vidée → test Task 7.

---

### Task 1: Habillage commun et fichiers de style

**Files:**
- Create: `build/lib/gabarit.mjs`, `assets/cn.css`, `assets/cn.js`
- Modify: `build/generate.mjs` (ajouter `'assets'` à `PASSTHROUGH`)
- Test: `test/gabarit.test.mjs`

**Interfaces:**
- Consumes: `dateLongue(jour)` (`build/lib/date-bandeau.mjs`), `categoryPath`, `articlePath` (`paths.mjs`).
- Produces:
  - `page({ titre, prefix, head = '', contenu, jour, titres = [], catsCfg, actif = '' }): string` — document complet. `titre` déjà sans suffixe (la fonction écrit `<title>${titre} | Comoresnews</title>`, ou `Comoresnews | L'actualité des Comores et de la diaspora comorienne` si `titre` est vide). `titres` = articles du bandeau. `actif` = slug de rubrique à surligner.
  - `colonneDroite({ pourrait = '', avant = '' }): string` — `<aside class="cn-rail">` : `avant` (HTML facultatif, ex. encart newsletter de l'article), « Suivez-nous », `<div id="cn-sidebar-ads"></div>`, puis `titreSection('Ça pourrait vous intéresser')` + `pourrait` (HTML déjà rendu : les pages des Tasks 4–6 y passent `pourraitInteresser(…).map(a => carte(a, { variante: 'mini', … })).join('')`). Ainsi Task 1 ne dépend pas de Task 2.
  - `titreSection(texte, { lien = '', libelleLien = '' } = {}): string`.

Contenu exigé de `page` (dans l'ordre) :
1. `<head>` : `charset`, `viewport`, `<title>`, `<meta name='robots' content='max-image-preview:large'>`, favicons repris des gabarits actuels (`wp-content/uploads/2026/06/Favicone-300x292.png`, `cropped-Favicone-32x32.png`, `-192x192`, `-180x180` en apple-touch-icon, `-270x270` en msapplication), `<link rel="stylesheet" href="${prefix}assets/cn.css">`, puis `head`.
2. Barre du haut `.cn-top` : `<div class="tdb-head-date-txt">${dateLongue(jour)}</div>` (classe gardée pour `injectDate`) ; si `titres.length`, un bandeau `.cn-ticker` « À la une » listant les titres (liens) avec flèches précédent/suivant ; rien sinon.
3. En-tête `.cn-header` : logo `${prefix}wp-content/uploads/2026/06/Logo-4.png` lié à `${prefix}index.html` ; menu `.cn-menu` = Accueil + rubriques de `catsCfg` triées par `order` (liens `categoryPath`) + `● En direct` (`index.php/pages/en-direct/index.html`) ; lien loupe vers `index.php/pages/recherche/index.html` ; bouton `Newsletter gratuite` (`href="#cn-newsletter"` sur l'accueil quand `prefix === ''`, sinon `${prefix}index.html#cn-newsletter`) ; bouton burger `.cn-burger` (mobile).
4. `<main id="cn-main">${contenu}</main>`.
5. Pied `.cn-footer` vert : logo + « L'actualité des Comores et de la diaspora comorienne. » + liens réseaux (mêmes que « Suivez-nous ») ; colonne rubriques ; colonne Contact / Mentions légales / Politique de confidentialité ; puis `<div id="cn-legal-bar">` avec ces trois liens, « Gérer mes choix (cookies) » (`javascript:Sddan.cmp.displayUI()`) et `© 2026 Comoresnews — L'actualité des Comores et de la diaspora comorienne.` (repris de la barre actuelle).
6. `<script src="${prefix}assets/cn.js" defer></script>`.

« Suivez-nous » : Facebook `https://www.facebook.com/#` « J'aime », X `https://twitter.com/#` « Suivre », YouTube `https://www.youtube.com/#` « S'abonner » (valeurs actuelles, aucun compteur).

`assets/cn.js` : (a) bandeau : affiche un titre à la fois, passe au suivant toutes les **5 s**, flèches précédent/suivant qui relancent le minuteur ; (b) burger : bascule la classe `cn-menu-ouvert` sur `<body>`. `assets/cn.css` : variables de couleur, en-tête, barre du haut, cartes (Task 2), grilles, colonne de droite, pied, responsive ≤ 767 px, dans l'esprit des maquettes.

- [ ] **Step 1: Tests** (`test/gabarit.test.mjs`) :
  - `page : structure, ancres et liens relatifs (accueil)` — `page({ titre:'', prefix:'', contenu:'<p>X</p>', jour:'2026-11-05', catsCfg:cats })` contient `<title>Comoresnews | L&#039;actualité` ou `L'actualité` (au choix, mais tester la valeur produite), `href="assets/cn.css"`, `<div class="tdb-head-date-txt">jeudi 5 novembre 2026</div>`, `<main id="cn-main"><p>X</p></main>`, `id="cn-legal-bar"`, `href="#cn-newsletter"`, `index.php/pages/en-direct/index.html`, et les 9 rubriques dans l'ordre de `order` (Politique avant Annonces).
  - `page : profondeur article` — avec `prefix:'../../../../../'`, contient `href="../../../../../assets/cn.css"`, `src="../../../../../wp-content/uploads/2026/06/Logo-4.png"`, `href="../../../../../index.html#cn-newsletter"`, et le titre `<title>Mon titre | Comoresnews</title>` pour `titre:'Mon titre'`.
  - `page : bandeau des titres seulement s'il y en a` — `titres:[]` → pas de `cn-ticker` ; deux articles → deux liens vers leur `articlePath`, titres échappés (`A & B` → `A &amp; B`).
  - `colonneDroite : réseaux sans chiffres et ancre pub` — `colonneDroite({ pourrait: '<p>P</p>', avant: '<p>N</p>' })` contient `Facebook`, `J'aime`, `S'abonner`, `<div id="cn-sidebar-ads"></div>`, `Ça pourrait vous intéresser`, `<p>P</p>`, et `<p>N</p>` avant `Suivez`.
- [ ] **Step 2:** `node --test test/gabarit.test.mjs` → FAIL (module absent).
- [ ] **Step 3:** Écrire `gabarit.mjs`, `assets/cn.css`, `assets/cn.js` ; ajouter `'assets'` à `PASSTHROUGH`.
- [ ] **Step 4:** Test → PASS ; `npm test` → vert.
- [ ] **Step 5: Commit** `feat(refonte): habillage commun et feuille de style`.

---

### Task 2: Cartes

**Files:**
- Create: `build/lib/cartes.mjs`
- Test: `test/cartes.test.mjs`

**Interfaces:**
- Consumes: `articlePath`, `categoryPath`, `resolveImg` ; `libelleIle` (`build/lib/iles.mjs`) ; champ `a.ile` (déjà lu par `mapRow`).
- Produces:
  - `carte(a, { variante, prefix = '', catsCfg }): string` — `variante` ∈ `'grande'` (photo, étiquettes, titre, chapô, auteur · date), `'ligne'` (photo à gauche, étiquettes, titre, auteur · date), `'grille'` (photo en haut, étiquettes, titre, auteur · date), `'mini'` (vignette + titre). Toute la carte est cliquable vers l'article ; la pastille de rubrique pointe vers la page rubrique ; sans image → `<span class="cn-carte-vide">` (aplat gris).
  - `etiquettes(a, catsCfg, prefix): string` — pastille rubrique (`.cn-tag-cat`) + pastille île (`.cn-tag-ile`, `libelleIle`) si `a.ile` ; une seule pastille quand rubrique et île valent toutes deux « diaspora ».
  - `dateFr(date: 'AAAA-MM-JJ'): string` — « 5 novembre 2026 ».
  - `estPhotoBanque(url): boolean` — vrai si l'URL contient `/medias/commons/`.
  - `tempsLecture(markdown): number` — minutes, `Math.max(1, Math.round(mots / 200))`.
  - `grille(articles, opts): string` — `<div class="cn-grille">` de cartes `'grille'`, ou `<p class="cn-vide">Aucun article pour le moment.</p>` si vide.

- [ ] **Step 1: Tests** (`test/cartes.test.mjs`), avec `cats` = `config/categories.json` :
  - `carte grande : titre, chapô, date, lien et pastilles` — article `{ title:'A & B', slug:'s', category:'economie', ile:'ndzuani', date:'2026-11-05', excerpt:'Chapô <x>', image:'https://h/x.jpg', author:'Comoresnews' }` → contient `A &amp; B`, `Chapô &lt;x&gt;`, `5 novembre 2026`, `index.php/2026/11/05/s/index.html`, `index.php/category/economie/index.html`, `Économie`, `Ndzuani`.
  - `carte sans image → aplat gris` — `image:''` → `cn-carte-vide`, pas de `<img`.
  - `etiquettes : pas d'île → une pastille ; diaspora/diaspora → une seule` — compter les occurrences de `cn-tag-`.
  - `prefix appliqué aux liens et images relatives` — `prefix:'../../../'`, `image:'wp-content/x.png'` → `../../../index.php/…` et `../../../wp-content/x.png`.
  - `estPhotoBanque` — vrai pour `https://…/storage/v1/object/public/medias/commons/drapeau.png`, faux pour `https://…/medias/2026/x.jpg` et `''`.
  - `tempsLecture` — 30 mots → 1 ; 600 mots → 3.
  - `grille vide → message` — `grille([], …)` contient `Aucun article pour le moment.`.
- [ ] **Step 2:** Test → FAIL ; **Step 3:** écrire `cartes.mjs` (styles des cartes dans `assets/cn.css`) ; **Step 4:** test → PASS, `npm test` → vert.
- [ ] **Step 5: Commit** `feat(refonte): cartes d'articles et étiquettes`.

---

### Task 3: Pubs et newsletter sur les nouveaux points d'ancrage

**Files:**
- Modify: `build/lib/ads.mjs`, `build/lib/newsletter.mjs`
- Test: `test/ads.test.mjs`, `test/newsletter.test.mjs`

**Interfaces:**
- Consumes: le HTML de `page()` (Task 1) : `<main id="cn-main">`, `id="cn-sidebar-ads"`, `id="cn-legal-bar"` ; Tasks 4 et 6 posent `<div id="cn-ad-top"></div>` et `class="cn-article-body"`.
- Produces: ancres finales utilisées par toutes les pages :
  - MégaBannière 1 : remplace `<div id="cn-ad-top"></div>` ; à défaut, juste après `<main id="cn-main">` ; à défaut (page non refondue), après `<body>` comme aujourd'hui.
  - GrandAngle + Pavé 1 : `<div id="cn-sidebar-ads"></div>` (mécanisme existant) ; à défaut, repli en bas (existant).
  - Pavé 2 : après le 2ᵉ paragraphe de `class="cn-article-body"` (remplace l'ancre `td-post-content`).
  - Bas de page : avant `<div id="cn-legal-bar"` (existant).
  - Newsletter : bande insérée juste avant `<main id="cn-main"` (remplace l'ancre `<div class="td-main-content-wrap`).
  - Supprimer les ancres du thème (`tdi_51`, `tdi_64`, `td-post-header`, `td-crumb-container`) et `AD_RELOCATE`, devenus sans objet.

- [ ] **Step 1: Tests** — remplacer, dans `test/ads.test.mjs` et `test/newsletter.test.mjs`, les cas qui fabriquent du HTML du thème par des pages issues de `page()` (Task 1) :
  - `injectAds : MégaBannière 1 à la place de cn-ad-top` — `page({contenu:'<div id="cn-ad-top"></div>…'})` → `sas_45656` présent une fois, avant `cn-sidebar-ads`.
  - `injectAds : MégaBannière 1 en tête de main sans cn-ad-top`.
  - `injectAds : GrandAngle et Pavé 1 dans la colonne` — page avec `colonneDroite` → `sas_45654` et `sas_45655` à l'intérieur de `id="cn-sidebar-ads"`.
  - `injectAds : Pavé 2 après le 2e paragraphe du corps d'article` — `<div class="cn-article-body"><p>1</p><p>2</p><p>3</p></div>` → `sas_49048` entre `2</p>` et `<p>3`.
  - `injectAds : bas de page avant cn-legal-bar, idempotent` — un second passage ne change rien.
  - `injectNewsletter : bande juste avant main, idempotent`.
  Les cas existants qui testent la config régie, `adsSetup`, la révélation et le floor restent.
- [ ] **Step 2:** Tests → FAIL sur les nouveaux cas ; **Step 3:** modifier `ads.mjs` et `newsletter.mjs` ; **Step 4:** tests → PASS, `npm test` → vert (les tests encore liés aux anciens gabarits sont traités Task 7 ; s'ils cassent ici, les adapter au nouvel ancrage et le noter).
- [ ] **Step 5: Commit** `feat(refonte): pubs et newsletter sur les nouvelles ancres`.

---

### Task 4: Accueil

**Files:**
- Modify: `build/generate.mjs` (`buildHome`), `build/lib/en-direct.mjs` (ajout `plusRecents` ; retrait de `uneGridHtml`, `uneTickerHtml`, `aNePasManquerHtml`, `pourraitHtml` et de leurs tests)
- Delete: `templates/home.html`
- Test: `test/generate.test.mjs`, `test/en-direct.test.mjs`

**Interfaces:**
- Consumes: `page`, `colonneDroite`, `titreSection` (Task 1) ; `carte`, `grille` (Task 2) ; sélections existantes.
- Produces: `plusRecents(articles, exclus, n = 4)` (les `n` plus récents absents d'`exclus`) ; `buildHome(articles, catsCfg, jour)` (même signature).

Ordre de la page : `.cn-une` (1 carte `grande` + 3 cartes `ligne` empilées, depuis `homeUne(articles, 4)`) → `<div id="cn-ad-top"></div>` → deux colonnes `.cn-cols` : colonne principale = `titreSection('À ne pas manquer')` + grille de `aNePasManquer` (2 par ligne), puis pour chaque rubrique de `catsCfg` (ordre `order`) `titreSection('Actu ' + nom, { lien: categoryPath(slug), libelleLien: 'Tous les articles ' + nom + ' →' })` + `grille` de 4 au plus (`HOME_SECTION_MAX`) — lien affiché seulement s'il y a plus de 4 articles ; colonne de droite = `colonneDroite` avec `pourraitInteresser(articles, une ∪ manquer)` → après les deux colonnes, `titreSection('Les plus récents')` + rangée de 4 cartes `grille` de `plusRecents(articles, une ∪ manquer ∪ pourrait)`. Bandeau : `titres = titresDuJour(articles, jour, une)`. `head` de l'accueil (repris du gabarit actuel) : `<link rel="canonical" href="index.html"/>`, `<meta name="description" content="L'actualité des Comores et de la diaspora comorienne">`, `og:description` (même texte), `og:site_name` « Comoresnews », `og:locale` « fr-FR », `og:type` « website », `og:title` « Comoresnews », `og:url` « index.html ».

- [ ] **Step 1: Tests** :
  - `plusRecents : exclut, trie, limite` (en-direct).
  - Réécrire dans `test/generate.test.mjs` les tests de `buildHome` (grille à la une, bandeau, à ne pas manquer, rubriques 4 max + lien) sur les nouvelles classes : `.cn-une` contient la carte cochée « À la une » en premier ; bandeau = titres du jour (cas jour avec articles / jour vide → articles de la une) ; « À ne pas manquer » = veille hors une ; rubrique de 6 articles → 4 cartes + lien « Tous les articles … → » ; rubrique vide → `Aucun article pour le moment.` ; `cn-ad-top` présent ; plus aucun `{{` ni `Le Grand Mariage` (contenu figé) dans la page.
- [ ] **Step 2:** Tests → FAIL ; **Step 3:** réécrire `buildHome` avec `page()`, ajouter `plusRecents`, supprimer `templates/home.html` et les fonctions de rendu devenues inutiles ; **Step 4:** `npm test` → vert.
- [ ] **Step 5: Commit** `feat(refonte): accueil en cartes`.

---

### Task 5: Pages rubrique, auteur et « En direct »

**Files:**
- Modify: `build/generate.mjs` (`buildCategoryPage`, `buildAuthor`, `buildEnDirectPage`), `build/lib/en-direct.mjs` (`enDirectInner` : articles en cartes `grille`, brèves inchangées)
- Delete: `templates/category.html`, `templates/author.html`
- Test: `test/generate.test.mjs`, `test/en-direct.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–2 ; `pourraitInteresser`.
- Produces: mêmes signatures ; `buildCategoryPage(slug, articles, catsCfg, jour, tous = articles)` et `buildAuthor(articles, catsCfg, jour)` — `jour` pour la date du bandeau, `tous` pour la colonne de droite.

Page rubrique : fil `Accueil › <Rubrique>`, `<h1>`, `<p class="cn-compte">N articles</p>` (« 1 article » au singulier), `grille` de tous les articles (récents d'abord), `colonneDroite` avec `pourraitInteresser(tous, articles)`. `head` : `<meta name="description" content="Toute l'actualité <Rubrique> des Comores — Comoresnews">`. Page auteur : même présentation, titre « Comoresnews ». « En direct » : habillage `page()`, colonne des brèves inchangée (`brevesHtml`, script « Aujourd'hui/Hier »), articles en cartes.

- [ ] **Step 1: Tests** — `buildCategoryPage` : compte « 3 articles », cartes dans l'ordre récent, lien actif sur la rubrique, colonne avec `cn-sidebar-ads`, rubrique vide → `0 article` et message vide ; singulier « 1 article ». `buildEnDirectPage` : brèves présentes, liens à la bonne profondeur (`../../../index.php/…`), cartes `cn-carte`. `buildAuthor` : toutes les cartes, profondeur `../../../`.
- [ ] **Step 2:** FAIL ; **Step 3:** implémenter, supprimer les deux gabarits, passer `jour` et `all` depuis `main()` ; **Step 4:** `npm test` → vert.
- [ ] **Step 5: Commit** `feat(refonte): rubriques, auteur et En direct en cartes`.

---

### Task 6: Page article

**Files:**
- Modify: `build/generate.mjs` (`buildArticlePage`), `build/lib/en-direct.mjs` (ajout `aLireAussi`)
- Delete: `templates/article.html`
- Test: `test/generate.test.mjs`, `test/en-direct.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–2 ; `renderMarkdown`, `sourceLine`, `metaTags`, `jsonLdArticle` (inchangés).
- Produces: `aLireAussi(a, articles, n = 4)` — articles de la même rubrique les plus récents hors `a`, complétés par les plus récents des autres rubriques ; `buildArticlePage(a, catsCfg, articles = [a], jour)`.

Contenu, dans l'ordre : `<div id="cn-ad-top"></div>` ; `.cn-article` à deux colonnes : `<article>` = fil `Accueil › <Rubrique>` → `etiquettes` → `<h1>` → `<p class="cn-chapo">` (si `excerpt`) → `.cn-byline` (pastille « CN », « Comoresnews » = `a.author`, `dateFr`, `⏱ N min de lecture`, partage : Facebook `https://www.facebook.com/sharer/sharer.php?u=`, X `https://twitter.com/intent/tweet?url=`, WhatsApp `https://wa.me/?text=`, e-mail `mailto:?subject=…&body=` — URL absolue `${BASE}/${rel}` encodée) → `<figure>` si `a.image` (légende `Photo d'illustration` seulement si `estPhotoBanque(a.image)`) → `<div class="cn-article-body">` = `renderMarkdown(a.body, P) + sourceLine(a)` ; colonne de droite = `colonneDroite({ avant: <encart newsletter : titre « Newsletter », texte « Les articles de la semaine, chaque vendredi. », bouton « S'inscrire gratuitement » vers ${P}index.html#cn-newsletter>, pourrait: <cartes mini de pourraitInteresser(articles, [a, ...aLireAussi])> })`. Puis, pleine largeur, `titreSection('À lire aussi')` + 4 cartes `grille` (section omise si `aLireAussi` est vide). `head` = `metaTags` + `jsonLdArticle` (comme aujourd'hui), titre = `seoTitle || title`.

- [ ] **Step 1: Tests** :
  - `aLireAussi : même rubrique d'abord, complété, sans l'article` ; `un seul article → []`.
  - `buildArticlePage` : titre, `cn-chapo`, `cn-article-body` avec le Markdown rendu, `⏱`, liens de partage encodés, `Source :` si source ; image de banque → `Photo d'illustration` ; image ordinaire → pas de légende ; sans image → pas de `<figure` ; « À lire aussi » avec 4 cartes, absent si seul article ; `<title>` = seoTitle ; balises SEO présentes une seule fois (`og:title` ×1) ; plus de méta figée « vanille ».
- [ ] **Step 2:** FAIL ; **Step 3:** implémenter, supprimer le gabarit, passer `all` et `jour` depuis `main()` ; **Step 4:** `npm test` → vert.
- [ ] **Step 5: Commit** `feat(refonte): page article`.

---

### Task 7: Pages fixes et nettoyage

**Files:**
- Create: `build/lib/pages-fixes.mjs`
- Modify: `build/generate.mjs` (boucle des pages fixes)
- Delete: `build/lib/menu.mjs`, `test/menu.test.mjs`, `test/suivez-nous.test.mjs`, `build/extract-templates.mjs`, dossier `templates/` s'il est vide
- Test: `test/pages-fixes.test.mjs`

**Interfaces:**
- Consumes: `page` (Task 1).
- Produces: `habillerPageFixe(html, { prefix, jour, catsCfg }): string` — extrait le titre (`<title>X | Comoresnews</title>` → `X`) et la zone allant de `<div class="td-main-content-wrap` jusqu'à `<!-- /.td-main-content-wrap -->` inclus, et la place dans `page({ titre: X, prefix, contenu, jour, catsCfg })` ; si l'une des deux bornes manque, renvoie `html` inchangé.

La boucle des pages fixes de `main()` applique `injectDate(habillerPageFixe(html, …), jour)` (plus d'`injectMenu` : le menu fait partie de `page()`). Elle ne reçoit ni pubs ni Analytics, comme aujourd'hui. Les scripts propres à chaque page (recherche, contact, désinscription) restent dans la zone extraite et gardent leur `CN_PREFIX`.

- [ ] **Step 1: Tests** (`test/pages-fixes.test.mjs`) :
  - `habillerPageFixe : contenu gardé, nouvel habillage` — sur `index.php/pages/recherche/index.html` réel : contient `id="cn-search-form"`, `cn-results`, `articles-index.json`, `<title>Recherche | Comoresnews</title>`, `id="cn-legal-bar"`, `cn-header` ; ne contient plus `td-footer-template-wrap` ni `menu-main-3`.
  - `habillerPageFixe : structure inattendue → page inchangée` — `'<html><body>x</body></html>'` renvoyé tel quel.
- [ ] **Step 2:** FAIL ; **Step 3:** implémenter, brancher dans `main()`, supprimer le code et les tests devenus sans objet ; vérifier qu'aucun `import` ne vise un fichier supprimé (`grep -rn "menu.mjs\|templates/" build test scripts`) ; **Step 4:** `npm test` → vert.
- [ ] **Step 5: Commit** `feat(refonte): pages fixes habillées, anciens gabarits retirés`.

---

### Task 8: Vérification visuelle et mise en ligne

**Files:** aucun (sauf corrections trouvées, chacune avec son test).

- [ ] **Step 1:** `CONTENT_SOURCE=supabase node --env-file=.env build/generate.mjs` → `Build OK: <N> articles`.
- [ ] **Step 2:** Aperçu local (`preview_start` « comoresnews-site ») ; contrôler sur ordinateur **et** en largeur 375 px : accueil, une rubrique, un article avec photo de banque, un article sans source, « En direct », recherche (une requête renvoie des résultats), contact, désinscription. Pour chaque page : aucune erreur console venant de `cn.js`, ancres `sas_45656`, `sas_45654`, `sas_45655`, `sas_49046` présentes (et `sas_49048` sur les articles), bande `cn-newsletter` présente, liens du menu et des cartes valides (aucun 404 sur un échantillon de 10 liens).
- [ ] **Step 3:** Comparer le poids HTML de l'accueil avant/après (`wc -c _site/index.html`) et le noter.
- [ ] **Step 4:** Montrer à Yves des captures (accueil, rubrique, article ; ordinateur et téléphone) et **attendre son accord**.
- [ ] **Step 5:** Avec son accord : `npm test` vert, fusion de `feat/refonte-cartes` dans `main`, push, suivi du déploiement, contrôle de comoresnews.com (accueil 200, une page article, une rubrique). Revenir sur `main`.
