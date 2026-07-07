# Comoresnews CMS — Phase 2 : Back-office de création (/admin)

**Date :** 2026-07-07
**Statut :** Spec (design) — en attente de validation
**Prérequis :** Phase 1 livrée (site généré depuis `content/articles/*.md`, déploiement GitHub Actions actif).
**Portée :** Création de nouveaux articles uniquement. L'édition/suppression des articles existants et la programmation relèvent de la Phase 3.

## 1. Objectif

Une page web `/admin` permettant de **rédiger et publier un nouvel article** sans toucher au code : on remplit un formulaire, on prévisualise, on clique « Publier », et l'article part sur GitHub (fiche `.md` + image), ce qui déclenche le rebuild automatique (Phase 1) et met le site en ligne en ~1-2 min.

## 2. Contrainte structurante

Le site est **statique** : `/admin` est une page HTML autonome (HTML/CSS/JS inline, **aucune étape de build**, aucune dépendance externe chargée depuis un CDN — tout est embarqué). Elle s'exécute dans le navigateur et parle directement à l'**API GitHub** avec un **jeton d'accès personnel** fourni par l'utilisateur.

## 3. Authentification

- Au premier accès, la page demande un **jeton GitHub fine-grained** (droits : *Contents = Read and write* sur le seul dépôt `Yvesrubens/comoresnews`).
- Le jeton est stocké **uniquement dans le navigateur** (`localStorage`), jamais dans le code ni le dépôt.
- La page valide le jeton via `GET /repos/Yvesrubens/comoresnews` ; si invalide → message clair + redemande.
- Un bouton « Se déconnecter » efface le jeton du navigateur.
- Avertissement affiché : utiliser un jeton **limité à ce dépôt**.

## 4. Formulaire de création

Champs :
- **Titre** (obligatoire).
- **Slug** (auto-généré depuis le titre, modifiable ; sert à l'URL et au nom de fichier).
- **Catégorie** (menu déroulant alimenté par `config/categories.json` — 9 valeurs).
- **Auteur** (par défaut « Comoresnews », modifiable).
- **Image de une** — DEUX options : (a) **glisser-déposer / choisir un fichier**, (b) **coller une URL**.
- **Chapô** (excerpt, texte court).
- **Corps** (zone de rédaction **Markdown** ; barre d'aide minimale : gras, titre, lien, liste).
- **Date** de publication (par défaut aujourd'hui).

Validation avant publication : titre, slug (format `[a-z0-9-]+`, unicité vérifiée via l'API), catégorie, corps non vides.

## 5. Aperçu

Un panneau **aperçu en direct** affiche le rendu : image de une, badge catégorie, titre, et corps Markdown rendu en HTML — dans un style proche de la page article réelle. Mise à jour à chaque frappe.

## 6. Publication (flux de données)

Au clic « Publier » :
1. Si image = fichier : `PUT /repos/.../contents/wp-content/uploads/<AAAA>/<MM>/<nom-fichier>` (contenu base64) → chemin retenu = ce chemin. Si image = URL : utilisée telle quelle.
2. Construction de la fiche Markdown (frontmatter `title, slug, category, author, date, image, excerpt, status: published` + corps).
3. `PUT /repos/.../contents/content/articles/<slug>.md` (base64, message de commit `Publication: <titre>`) sur la branche `main`.
4. Le push déclenche le workflow Actions → rebuild → déploiement.
5. Écran de succès : lien vers l'article publié (URL calculée depuis date+slug) + rappel « en ligne dans ~1-2 min ».

Gestion d'erreurs affichées à l'utilisateur : 401 (jeton invalide), 409/existant (slug déjà pris), erreurs réseau.

## 7. Découpage en fichiers

- `admin/index.html` — page autonome (structure + styles + point d'entrée JS).
- `admin/lib.mjs` — **fonctions pures** (slugify, construction du frontmatter, dérivation du chemin image, validation, calcul de l'URL d'article) — importées par la page ET par les tests.
- `admin/github.mjs` — client API GitHub (getRepo, putFile, fileExists) — couche mince, testée manuellement.
- `admin/vendor/markdown-it.min.js` — rendu Markdown embarqué (copié depuis `node_modules`, pas de CDN).
- Générateur : ajouter `admin` à la liste **passthrough** pour que `/admin` soit déployé.

## 8. Tests

- **Unitaires (`node --test`)** sur `admin/lib.mjs` : slugify (accents, espaces, ponctuation), frontmatter (échappement, champs), chemin image (année/mois), validation (rejets), URL d'article.
- **Manuels (navigateur)** : parcours complet auth → formulaire → aperçu → publication sur un article de test, via les outils de preview ; vérifier le commit créé et le rebuild.

## 9. Critères de succès (Phase 2)

- Depuis `/admin`, avec un jeton valide, on crée un article (titre, catégorie, auteur, image uploadée OU url, chapô, corps Markdown), on le prévisualise, on publie.
- La fiche `content/articles/<slug>.md` et l'éventuelle image apparaissent dans le dépôt ; le workflow se déclenche ; l'article est visible sur le site (bonne catégorie sur l'accueil et la page catégorie, page auteur, recherche).
- Aucun secret en clair dans le dépôt ; le jeton reste dans le navigateur.
- Rendu de l'article publié identique à ceux existants.

## 10. Risques et mitigations

- **Sécurité du jeton** → fine-grained, mono-dépôt, contents-only ; localStorage ; avertissement ; bouton déconnexion.
- **Markdown embarqué (pas de CDN)** → vendorer `markdown-it` dans `admin/vendor/`.
- **Unicité du slug** → vérification via l'API avant publication + message si conflit.
- **Cohérence du format de fiche** → `admin/lib.mjs` produit exactement le frontmatter attendu par `build/lib/content.mjs` (Phase 1) ; test dédié.
- **Latence de publication** (rebuild ~1-2 min) → message explicite, pas d'attente bloquante.

## 11. Hors périmètre (→ Phase 3)

Liste/édition/suppression des articles existants, programmation (date future + cron), gestion des brouillons, upload multiple d'images dans le corps.
