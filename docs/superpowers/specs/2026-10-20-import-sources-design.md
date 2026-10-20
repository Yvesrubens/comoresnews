# Import automatique de sujets depuis la presse comorienne

**Date :** 2026-10-20 — **Statut :** design relu, en attente de validation

## 1. Intention

Comoresnews doit publier du contenu régulièrement. L'idée : surveiller
automatiquement trois journaux comoriens et déposer chaque nouvel article
dans le back-office comme **sujet à traiter**. Un rédacteur s'en sert comme
**source d'information**, **réécrit l'article avec ses propres mots**, puis le
publie par le circuit de validation habituel.

On ne republie **jamais** le texte d'un autre journal. Les flux fournissent le
texte intégral des articles : ce texte sert uniquement de référence interne
au rédacteur.

## 2. Ce que l'utilisateur a décidé

- Un rédacteur relit et valide avant toute publication.
- Le rédacteur **réécrit à partir de la source** (pas d'accord de reprise avec
  ces journaux).
- Récupération **3 fois par jour** (matin, midi, soir).
- Chaque nouvel article source devient un sujet « en attente » dans `/admin`,
  avec le titre d'origine, le nom du journal, le lien vers l'article source,
  la date, et une catégorie Comoresnews devinée.
- Un même article source n'est jamais importé deux fois.
- On ne reprend **pas les photos** des sources : le rédacteur choisit une
  image de la médiathèque.
- L'article publié affiche **« Source : <journal> »** avec le lien vers
  l'article d'origine.

## 3. Sources

| Journal | Accès | Ce qu'on obtient |
|---|---|---|
| Habari Za Comores | flux RSS `https://www.habarizacomores.com/rss.xml` (Blogger) | ~25 articles, texte intégral (HTML échappé dans `<description>`), catégorie, date |
| Masiwa | flux RSS `https://masiwa-comores.com/feed/` (WordPress) | ~10 articles, texte intégral (`<content:encoded>`), catégories, date |
| La Gazette des Comores | **pas de flux** : lecture de la page d'accueil `https://www.lagazettedescomores.com/` puis des pages d'article | titres + liens depuis l'accueil ; texte depuis chaque page article. Site maison très lent (~30 s par page) |

La liste des sources doit être facile à compléter (fichier de config), pour
ajouter d'autres journaux plus tard.

## 4. Fonctionnement

### 4.1 Récupération (tâche planifiée)
- Un script Node `scripts/import-sources.mjs` lit chaque source, extrait les
  articles, et insère les **nouveaux** dans Supabase (clé `service_role`).
- Déduplication sur l'**URL de l'article source** (contrainte d'unicité).
- Il tourne via **GitHub Actions** sur un cron 3 fois par jour
  (*choix du builder initial : GitHub Actions, déjà utilisé par le projet
  pour `deploy.yml`, sans limite de durée gênante — nécessaire pour La
  Gazette qui met ~30 s par page*). Déclenchement manuel possible aussi
  (`workflow_dispatch`).
- Une source en panne (site indisponible, HTML changé) ne bloque pas les
  autres : on journalise l'erreur et on continue.
- Récupération polie : User-Agent identifiant Comoresnews, requêtes en série,
  pas plus de 3 passages par jour.

### 4.2 Stockage — nouvelle table `sujets`
Séparée de `articles`, pour que le texte source ne puisse jamais être publié
par erreur *(choix de conception)*.

Champs : `id`, `source` (ex. `masiwa`), `source_nom` (« Masiwa »),
`url` (unique), `titre`, `texte` (texte source nettoyé, référence interne),
`categorie_source` (texte brut), `categorie` (slug Comoresnews deviné,
nullable), `date_source`, `statut` (`nouveau` | `traite` | `ignore`),
`article_id` (article créé à partir du sujet, nullable), `importe_le`.

RLS : lecture et mise à jour du statut par les utilisateurs connectés ;
insertion réservée au `service_role` (script d'import).

### 4.3 Catégorie devinée
Correspondance par mots-clés sur la catégorie source (ex. « politique » →
`politique`, « économie/finance » → `economie`, « sport » → `sport`,
« culture » → `culture`, « société » → `societe`, « diaspora » → `diaspora`,
« international/monde » → `monde`, « tourisme » → `tourisme`). Sans
correspondance : pas de catégorie, le rédacteur choisit.

### 4.4 Back-office `/admin`
- Nouvel onglet **« Sujets »** : liste des sujets `nouveau`, les plus récents
  d'abord, avec journal, titre, date, catégorie devinée, lien source.
- Ouvrir un sujet affiche le **texte source en lecture seule**.
- Bouton **« Rédiger un article »** : crée un brouillon d'article pré-rempli
  avec le titre (modifiable), la catégorie devinée et la source
  (nom + lien) ; le **corps est vide** (le rédacteur écrit). Le texte source
  reste visible à côté pendant la rédaction. Le sujet passe en `traite` et
  garde le lien vers l'article.
- Bouton **« Ignorer »** : le sujet passe en `ignore`.
- Ensuite, circuit habituel : brouillon → en attente → publié.

### 4.4 bis Règles de prise en charge d'un sujet *(choix de conception)*
- « Rédiger un article » réserve le sujet de façon **atomique** : mise à jour
  conditionnelle `statut = 'traite'` **uniquement si** `statut = 'nouveau'`
  (fonction RPC ou update filtré). Si deux personnes cliquent en même temps,
  la seconde reçoit « Sujet déjà pris en charge ».
- `sujets.article_id` référence `articles(id)` avec `on delete set null` ; un
  trigger remet le sujet en `nouveau` si son article est supprimé, pour qu'il
  puisse être repris.
- RLS sur `sujets` pour les utilisateurs connectés : lecture de tout ;
  mise à jour limitée aux colonnes `statut` et `article_id` (via grant de
  colonnes) ; pas d'insertion ni de suppression (réservées au `service_role`).
- La catégorie d'un article étant obligatoire, si aucune n'a été devinée le
  formulaire impose au rédacteur d'en choisir une avant d'enregistrer.

### 4.5 Mention de la source sur le site
- Deux colonnes ajoutées à `articles` : `source_nom`, `source_url`
  (nullables).
- Si renseignées, la page article affiche en fin de texte
  « Source : <source_nom> » avec le lien (nouvel onglet).
- Modifiables dans l'éditeur d'article (le rédacteur peut citer plusieurs
  sources dans le texte s'il le souhaite ; le champ structuré porte la
  principale).

## 5. Non-objectifs
- **Détection automatique de copie** (comparaison texte publié / texte
  source) : la garantie repose sur la relecture humaine avant publication,
  plus le fait que le brouillon démarre avec un corps vide *(choix de
  conception ; ajoutable plus tard si besoin)*.
- Réécriture automatique par IA (possible plus tard).
- Publication automatique de quoi que ce soit.
- Reprise des images des sources.
- Notifications (email, etc.) à l'arrivée de nouveaux sujets.

## 6. Anti-objectifs (ce serait un échec même si ça « marche »)
- Un texte d'un autre journal publié tel quel ou presque sur Comoresnews.
- Le même article source importé plusieurs fois.
- Une source cassée qui empêche les deux autres d'être importées.

## 7. Contraintes et points techniques
- Stack existante : Supabase (Postgres + RLS), back-office statique
  `admin/` (supabase-js), build statique `build/generate.mjs`, tests
  `node --test`.
- Migration SQL à appliquer via le SQL Editor Supabase (pas de Supabase CLI
  lié) : nouvelle table `sujets` + grants + RLS + colonnes `source_*`.
- Secrets GitHub nécessaires pour le workflow : `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (posables via `gh secret set`).
- Le jeton `gh` local n'a **pas** le scope `workflow` : pousser un fichier
  `.github/workflows/*.yml` demandera une action unique de l'utilisateur
  (`gh auth refresh -s workflow`, ou ajout du fichier via l'interface web).
- Rappel sécurité : la clé `service_role` a été exposée en conversation et
  n'est pas encore régénérée. **L'import est construit et lancé avec la clé
  actuelle ; la rotation est une étape séparée** *(choix de conception)*. La
  clé vit à 3 endroits, à mettre à jour ensemble lors de la rotation :
  `.env` local, variable Vercel `SUPABASE_SERVICE_ROLE_KEY` (build du site),
  et le nouveau secret GitHub `SUPABASE_SERVICE_ROLE_KEY` (import). Le
  workflow `deploy.yml` (GitHub Pages) construit en mode fichiers et
  n'utilise pas cette clé.

## 8. Laissé au builder
- Analyse HTML de La Gazette (sélecteurs, nettoyage du texte).
- Nettoyage du HTML source en texte lisible (paragraphes conservés).
- Heures exactes du cron (fuseau Comores, UTC+3).
- Mise en page de l'onglet « Sujets » (dans le style existant de `/admin`).
- Comportement de la première exécution (import de l'historique présent
  dans les flux).
