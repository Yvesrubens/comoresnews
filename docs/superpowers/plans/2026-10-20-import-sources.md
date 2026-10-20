# Import automatique de sujets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Récupérer 3×/jour les nouveaux articles de Habari Za Comores, Masiwa et La Gazette des Comores comme « sujets » dans `/admin`, d'où un rédacteur rédige un article réécrit qui affiche « Source : … ».

**Architecture:** Un script Node (`scripts/import-sources.mjs`) lancé par GitHub Actions lit les sources (2 flux RSS + scraping HTML de La Gazette), devine la catégorie et insère les nouveaux sujets dans une table Supabase `sujets` (clé `service_role`). Le back-office liste les sujets ; « Rédiger » appelle une fonction SQL atomique `rediger_sujet` qui réserve le sujet et crée un brouillon d'article vide portant `source_nom`/`source_url`. Le build affiche la ligne source sous l'article.

**Tech Stack:** Node 20+ ESM, `fast-xml-parser`, `node-html-parser`, `@supabase/supabase-js` (déjà là), Postgres/RLS Supabase, `node --test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-20-import-sources-design.md`

## Global Constraints

- Le texte source n'est **jamais** publié : il vit seulement dans `sujets.texte`, jamais copié dans `articles.corps` (le brouillon créé a `corps = ''`).
- Pas de reprise d'images des sources ; pas de notifications ; pas d'IA ; pas de publication automatique.
- Déduplication sur `sujets.url` (unique), URL absolue résolue avec `new URL(href, base).href`.
- Une source en échec ne bloque pas les autres.
- User-Agent des requêtes : `ComoresnewsBot/1.0 (+https://comoresnews.com)` ; requêtes en série.
- Cron : 3 passages/jour — 04:00, 09:00, 15:00 UTC (= 7h, 12h, 18h aux Comores, UTC+3), plus `workflow_dispatch`.
- Statuts sujet : `nouveau` | `traite` | `ignore`. Slugs catégories : `politique, economie, societe, culture, sport, diaspora, monde, tourisme, annonces`.
- Ligne affichée sur l'article : `Source : <source_nom>` avec lien `target="_blank" rel="noopener"`.
- Les migrations SQL sont appliquées par l'utilisateur dans le SQL Editor Supabase (pas de CLI lié).
- Suivre le style existant : ESM, tests `node --test` dans `test/`, commits en français, fin de message `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Article déjà importé lors d'un passage précédent** → il n'est pas réinséré ; pour La Gazette, sa page n'est même pas re-téléchargée (site lent). Tests : Task 3 `importAll ignore les URL déjà connues` et `ne télécharge pas les pages Gazette déjà connues`.
2. **Une source plante (réseau, HTML modifié)** → les autres sont importées, l'erreur est rapportée. Test : Task 3 `importAll continue si une source échoue`.
3. **Texte source avec HTML échappé et entités** (Habari met `&lt;p&gt;`, `&#8217;`, `&nbsp;`) → texte lisible sans balises ni entités. Test : Task 2 `htmlToText décode les entités et retire les balises`.
4. **Accueil de La Gazette répétant chaque lien 2–4 fois** → chaque article n'est récupéré qu'une fois. Test : Task 2 `parseGazetteHome dédoublonne (19 liens)`.
5. **Deux rédacteurs cliquent « Rédiger » sur le même sujet / l'article est supprimé** → le second reçoit « Sujet déjà pris en charge » ; la suppression de l'article remet le sujet en `nouveau`. Vérification : Task 1 step 3 (SQL) et Task 5 step 6 (navigateur).

---

### Task 1: Migration SQL `0007_sujets.sql`

**Files:**
- Create: `supabase/migrations/0007_sujets.sql`

**Interfaces:**
- Produces: table `public.sujets(id uuid pk default gen_random_uuid(), source text not null, source_nom text not null, url text not null unique, titre text not null, texte text not null default '', categorie_source text not null default '', categorie text null references categories(slug), date_source timestamptz null, statut text not null default 'nouveau' check in ('nouveau','traite','ignore'), article_id uuid null references articles(id) on delete set null, importe_le timestamptz not null default now())`, index sur `(statut, importe_le desc)`.
- Produces: colonnes `articles.source_nom text null`, `articles.source_url text null`.
- Produces: fonction `public.rediger_sujet(p_sujet uuid, p_categorie text, p_slug text) returns uuid` (security definer).

- [ ] **Step 1: Écrire la migration** avec :
  - la table, l'index et les deux colonnes ci-dessus ;
  - `alter table sujets enable row level security` ; policy `sujets_read` (select, `auth.uid() is not null`) ; policy `sujets_update` (update, using `auth.uid() is not null`, with check `statut in ('nouveau','ignore')`) ;
  - grants : `grant select on sujets to authenticated; grant update (statut) on sujets to authenticated; grant all on sujets to service_role;` (pas d'insert/delete pour authenticated) ;
  - `rediger_sujet` en `plpgsql security definer set search_path = public` : lève `'non authentifie'` si `auth.uid()` est null ; `update sujets set statut='traite' where id=p_sujet and statut='nouveau' returning …` — si aucune ligne, `raise exception 'Sujet déjà pris en charge'` ; si `p_slug` existe déjà dans `articles`, suffixe `'-' || substr(md5(random()::text),1,6)` ; insère l'article (`titre` = titre du sujet, `slug`, `categorie = p_categorie`, `auteur_id = auth.uid()`, `corps = ''`, `statut = 'brouillon'`, `source_nom`, `source_url = sujets.url`) ; met `sujets.article_id` ; retourne l'id de l'article. Tout dans la même transaction (implicite dans la fonction) ;
  - `grant execute on function rediger_sujet(uuid,text,text) to authenticated` ;
  - trigger `before delete on articles` → `update sujets set statut='nouveau', article_id=null where article_id = old.id`.
- [ ] **Step 2: L'utilisateur l'applique** : copier le fichier dans le SQL Editor Supabase → Run. Attendu : « Success. No rows returned ».
- [ ] **Step 3: Vérifier dans le SQL Editor** (en `postgres`, sans session donc tester la logique hors `auth.uid()`) :
  ```sql
  select count(*) from sujets;                                  -- 0
  select column_name from information_schema.columns where table_name='articles' and column_name like 'source_%'; -- 2 lignes
  select proname from pg_proc where proname='rediger_sujet';    -- 1 ligne
  ```
  et via REST avec la clé anon : `GET /rest/v1/sujets` → `401/42501` (pas d'accès anonyme).
- [ ] **Step 4: Commit**
  ```bash
  git add supabase/migrations/0007_sujets.sql
  git commit -m "feat(db): table sujets, colonnes source, RPC rediger_sujet"
  ```

---

### Task 2: Analyse des sources (fonctions pures)

**Files:**
- Create: `scripts/lib/sources/html-text.mjs`, `scripts/lib/sources/rss.mjs`, `scripts/lib/sources/gazette.mjs`, `scripts/lib/sources/category.mjs`
- Fixtures (déjà présents) : `test/fixtures/sources/habari.xml`, `masiwa.xml`, `gazette-home.html`, `gazette-article.html`
- Test: `test/sources-parse.test.mjs`
- Modify: `package.json` (dépendances `fast-xml-parser`, `node-html-parser`)

**Interfaces:**
- Produces: `htmlToText(html: string): string` — décode entités nommées courantes et numériques, `</p>`, `<br>`, `</h1-6>`, `</li>` → saut de ligne, retire toutes les balises, compacte les espaces, paragraphes séparés par `\n\n`, trim.
- Produces: type `Item = { source: string, source_nom: string, url: string, titre: string, texte: string, categorie_source: string, date_source: string|null }` (`date_source` ISO).
- Produces: `parseRss(xml: string, src: { id: string, nom: string }): Item[]` — `texte` = `content:encoded` sinon `description`, passé par `htmlToText` ; `categorie_source` = catégories jointes par `' | '` ; `date_source` = `pubDate` en ISO.
- Produces: `parseGazetteHome(html: string): { url: string, rubrique: string }[]` — liens `href="<rubrique>/<slug>.html"`, résolus contre la valeur de `<base href>`, dédoublonnés, ordre d'apparition.
- Produces: `parseGazetteArticle(html: string): { titre: string, texte: string, date_source: string|null }` — `h2.titre-article`, `time[datetime]` au format `JJ/MM/AAAA` → ISO, texte de `div.article-content` sans le paragraphe en italique « Les contenus publiés dans ce site sont la propriété exclusive… ».
- Produces: `guessCategory(labels: string[]): string|null` — premier libellé qui correspond, règles testées dans cet ordre (insensible à la casse et aux accents) : `politique`→politique ; `econom|financ`→economie ; `sport`→sport ; `diaspora`→diaspora ; `monde|international`→monde ; `touris`→tourisme ; `cultur`→culture ; `societ`→societe ; sinon `null`.

- [ ] **Step 1: `npm install fast-xml-parser node-html-parser`**
- [ ] **Step 2: Écrire les tests** (`test/sources-parse.test.mjs`) :
  - `htmlToText décode les entités et retire les balises` : `htmlToText('<p>L&#8217;île&nbsp;&amp; la mer</p><p>B</p>')` === `"L’île & la mer\n\nB"`.
  - `parseRss Habari` : 25 items ; item 0 `titre` === `'Vers une électricité plus fiable aux Comores'`, `url` === `'https://www.habarizacomores.com/2026/10/vers-une-electricite-plus-fiable-aux.html'`, `categorie_source` contient `'Economie et Finance'`, `date_source` commence par `'2026-10-20'`, `texte` sans `'<'` ni `'&lt;'` et longueur > 1000.
  - `parseRss Masiwa` : 10 items ; item 0 `titre` commence par `'Mohamed Daoudou alias Kiki'`, `categorie_source` contient `'Politique'`, `texte` sans `'<'` et longueur > 1000.
  - `parseGazetteHome dédoublonne (19 liens)` : longueur 19, toutes les `url` commencent par `'https://mail.lagazettedescomores.com/'`, `rubrique` ∈ {`economie`,`opinions`,`politique`,`société`,`sport`}, pas de doublon d'`url`.
  - `parseGazetteArticle` : `titre` === `'Douanes : Les contractuels testés avant leur intégration'`, `date_source` commence par `'2026-09-25'`, `texte` commence par `'Samedi dernier, les agents contractuels des douanes'`, `texte` ne contient pas `'propriété exclusive'`.
  - `guessCategory` : `['Economie et Finance']`→`'economie'` ; `['Politique','A la une','Edition 603']`→`'politique'` ; `['Culture et Société']`→`'culture'` ; `['société']`→`'societe'` ; `['Tribune libre']`→`null` ; `[]`→`null`.
- [ ] **Step 3: Lancer** `node --test test/sources-parse.test.mjs` → FAIL (modules absents).
- [ ] **Step 4: Implémenter les 4 modules** selon les signatures ci-dessus (`XMLParser` avec `ignoreAttributes:false`, `processEntities:true` ; `parse()` de `node-html-parser` pour La Gazette).
- [ ] **Step 5: Relancer** → PASS, puis `node --test` complet → tout PASS.
- [ ] **Step 6: Commit** `feat(import): analyse des flux Habari/Masiwa et de La Gazette`.

---

### Task 3: Orchestrateur d'import + config des sources

**Files:**
- Create: `config/sources.json`, `scripts/import-sources.mjs`
- Modify: `package.json` (script `"import": "node scripts/import-sources.mjs"`)
- Test: `test/import-sources.test.mjs`

**Interfaces:**
- Consumes: `parseRss`, `parseGazetteHome`, `parseGazetteArticle`, `guessCategory` (Task 2).
- Produces: `config/sources.json` = `[{ "id":"habari","nom":"Habari Za Comores","type":"rss","url":"https://www.habarizacomores.com/rss.xml" }, { "id":"masiwa","nom":"Masiwa","type":"rss","url":"https://masiwa-comores.com/feed/" }, { "id":"gazette","nom":"La Gazette des Comores","type":"gazette","url":"https://www.lagazettedescomores.com/" }]`.
- Produces: `importAll({ sources, fetchText, db, log = console.log }): Promise<{ source: string, trouves: number, nouveaux: number, erreur: string|null }[]>` où `fetchText(url) → Promise<string>`, `db.existingUrls(urls: string[]) → Promise<Set<string>>`, `db.insertSujets(rows: Item & {categorie}[]) → Promise<number>`. Pour `gazette` : parse l'accueil, filtre les URL déjà connues **avant** de télécharger chaque page article, `categorie_source` = rubrique. Chaque source dans son propre `try/catch`.
- Produces: `main()` (exécuté si lancé directement) : client Supabase `service_role` depuis `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, `fetchText` avec le User-Agent des Global Constraints et timeout 60 s, `insertSujets` en `upsert(rows, { onConflict:'url', ignoreDuplicates:true })`, option `--dry-run` (aucune insertion, affiche ce qui serait inséré). Code de sortie 1 seulement si **toutes** les sources ont échoué.

- [ ] **Step 1: Écrire les tests** avec des faux `fetchText` (servant les fixtures par URL) et un faux `db` en mémoire :
  - `importAll insère les nouveaux sujets avec catégorie devinée` : base vide → `nouveaux` = 25 / 10 / 19 ; une ligne Masiwa a `categorie === 'politique'`.
  - `importAll ignore les URL déjà connues` : `existingUrls` renvoie l'URL de l'item 0 Habari → Habari `nouveaux` = 24, cette URL absente des lignes insérées.
  - `ne télécharge pas les pages Gazette déjà connues` : les 19 URL connues → `fetchText` appelé une seule fois pour la Gazette (l'accueil), `nouveaux` = 0.
  - `importAll continue si une source échoue` : `fetchText` rejette pour l'URL Masiwa → résultat Masiwa `erreur` non nul, Habari et Gazette importées.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter** `config/sources.json` et `scripts/import-sources.mjs` (exporter `importAll` ; `main()` gardé par un test `process.argv[1]` comme `migrate-to-supabase.mjs`).
- [ ] **Step 4: Relancer les tests** → PASS ; `node --test` complet → PASS.
- [ ] **Step 5: Essai à blanc réel** : `node --env-file=.env scripts/import-sources.mjs --dry-run` → affiche, par source, `trouves`/`nouveaux` > 0, aucune erreur (La Gazette peut prendre quelques minutes).
- [ ] **Step 6: Premier import réel** : `node --env-file=.env scripts/import-sources.mjs` puis relancer une 2ᵉ fois → au 2ᵉ passage `nouveaux` = 0 partout. Vérifier dans le Table Editor Supabase que `sujets` contient les lignes.
- [ ] **Step 7: Commit** `feat(import): script d'import des sujets (3 sources)`.

---

### Task 4: Mention de la source sur la page article

**Files:**
- Modify: `build/lib/supabase-source.mjs` (`mapRow`), `build/lib/render.mjs`, `build/generate.mjs:41` (`buildArticlePage`)
- Test: `test/supabase-source.test.mjs`, `test/source-line.test.mjs`

**Interfaces:**
- Produces: `mapRow` ajoute `sourceNom: row.source_nom || ''`, `sourceUrl: row.source_url || ''`.
- Produces: `sourceLine(a: { sourceNom?: string, sourceUrl?: string }): string` dans `render.mjs` — `''` si l'un des deux manque, sinon `<p class="cn-source"><em>Source : <a href="URL" target="_blank" rel="noopener">NOM</a></em></p>` avec NOM et URL échappés (`&`, `<`, `"`).
- `buildArticlePage` : `BODY: renderMarkdown(a.body) + sourceLine(a)`.

- [ ] **Step 1: Tests** : `mapRow` propage `source_nom`/`source_url` ; `sourceLine` renvoie `''` sans source ; avec `{sourceNom:'Masiwa', sourceUrl:'https://masiwa-comores.com/x/'}` contient `>Masiwa</a>` et `href="https://masiwa-comores.com/x/"` et `rel="noopener"` ; un nom `A<b>&"` est échappé.
- [ ] **Step 2: FAIL**, **Step 3: implémenter**, **Step 4: PASS** + `CONTENT_SOURCE=files node build/generate.mjs` OK et `node --test` PASS.
- [ ] **Step 5: Commit** `feat(build): afficher la source sous les articles`.

---

### Task 5: Back-office — onglet « Sujets » et champs source

**Files:**
- Modify: `admin/supabase.mjs`, `admin/lib.mjs`, `admin/index.html`
- Test: `test/admin-lib.test.mjs`

**Interfaces:**
- Consumes: table `sujets`, RPC `rediger_sujet` (Task 1).
- Produces (`admin/supabase.mjs`, dans `createApi`) : `listSujets(statut = 'nouveau')` (tri `importe_le` desc, limite 200), `getSujet(id)`, `getSujetByArticle(articleId)`, `ignorerSujet(id)` (update `statut='ignore'`), `redigerSujet(sujetId, categorie, slug)` → `sb.rpc('rediger_sujet', { p_sujet, p_categorie, p_slug })` renvoyant `{ data: articleId, error }`.
- Produces (`admin/lib.mjs`) : `formToRow` renvoie aussi `source_nom: f.source_nom || null`, `source_url: f.source_url || null`.

- [ ] **Step 1: Test** `formToRow` : avec `source_nom:'Masiwa', source_url:'https://masiwa-comores.com/x/'` → les deux présents ; sans → `null`. FAIL puis implémenter, PASS.
- [ ] **Step 2: API** : ajouter les 5 fonctions ci-dessus.
- [ ] **Step 3: UI onglet « Sujets »** (visible pour tous les connectés) : tableau Journal / Titre / Date / Catégorie devinée / [Voir]. Vue détail : titre, journal + lien source (nouvel onglet), date, catégorie devinée, **texte source en lecture seule** (`white-space:pre-wrap`, fond gris), boutons « Rédiger un article » et « Ignorer ».
- [ ] **Step 4: « Rédiger un article »** : sélecteur de catégorie pré-rempli avec la catégorie devinée ; si vide, le bouton reste inactif tant qu'aucune n'est choisie. Appelle `redigerSujet(id, categorie, slugify(titre))` ; en cas d'erreur affiche le message (dont « Sujet déjà pris en charge ») ; en cas de succès ouvre l'éditeur sur l'article créé.
- [ ] **Step 5: Éditeur d'article** : champs « Source (nom) » et « Source (lien) » enregistrés via `formToRow` ; si `getSujetByArticle(article.id)` renvoie un sujet, afficher son texte source en lecture seule dans un panneau repliable « Texte source (ne pas copier) » au-dessus du corps.
- [ ] **Step 6: Vérification navigateur** (serveur local `comoresnews-site`, compte admin) : l'onglet liste les sujets importés ; « Rédiger » crée un brouillon au corps vide avec titre, catégorie et source remplis ; recliquer « Rédiger » sur le même sujet (onglet rouvert) affiche « Sujet déjà pris en charge » ; supprimer ce brouillon remet le sujet dans la liste ; « Ignorer » le retire de la liste ; publier un article avec source → après rebuild, la page affiche « Source : … ».
- [ ] **Step 7: Commit** `feat(admin): onglet Sujets et champs source`, puis `git push` + Deploy Hook (comme d'habitude).

---

### Task 6: Planification GitHub Actions

**Files:**
- Create: `.github/workflows/import-sources.yml`

**Interfaces:**
- Consumes: `scripts/import-sources.mjs` (Task 3), secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Écrire le workflow** : `on: schedule` avec les 3 crons `'0 4 * * *'`, `'0 9 * * *'`, `'0 15 * * *'` + `workflow_dispatch` ; job `ubuntu-latest`, `timeout-minutes: 30`, `actions/checkout@v4`, `actions/setup-node@v4` (node 20, cache npm), `npm ci`, `node scripts/import-sources.mjs` avec `env` depuis les secrets ; `permissions: contents: read`.
- [ ] **Step 2: Secrets** : `gh secret set SUPABASE_URL` et `gh secret set SUPABASE_SERVICE_ROLE_KEY` (valeurs lues depuis `.env`, sans les afficher).
- [ ] **Step 3: Action utilisateur** : `gh auth refresh -s workflow` (connexion navigateur), nécessaire pour pousser un fichier de workflow.
- [ ] **Step 4: Commit + push**, puis `gh workflow run import-sources.yml` et `gh run watch` → succès, journal affichant les compteurs par source.
- [ ] **Step 5: Mettre à jour la mémoire projet** (`comoresnews-project.md`) : import des sujets en place, emplacements de la clé `service_role` (`.env`, Vercel, secret GitHub).
