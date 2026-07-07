# Comoresnews CMS — Phase 1 : Générateur + Migration

**Date :** 2026-07-07
**Statut :** Spec validée (design), en attente de plan d'implémentation
**Portée :** Phase 1 uniquement. Les phases 2 (back-office de création) et 3 (gestion + programmation) feront l'objet de specs séparées.

## 1. Objectif

Transformer le site statique actuel (pages HTML éditées à la main) en un **site généré** à partir de fiches d'articles structurées, **sans changer le rendu visuel ni les URLs**. C'est la fondation nécessaire pour pouvoir ensuite créer, modifier et programmer des articles via un back-office (phases 2-3).

Livrable de la Phase 1 : à partir des fiches de contenu, un générateur reconstruit l'intégralité des pages pilotées par les articles (articles, catégories, sections d'accueil, page auteur, index de recherche) **à l'identique** de la version en ligne actuelle, et le déploiement se fait automatiquement.

## 2. Périmètre

**Inclus :**
- Modèle de contenu (format des fiches d'articles).
- Migration des 10 articles existants en fiches.
- Générateur (Node) : articles, pages catégories, sections « Actu X » de l'accueil, page auteur, `articles-index.json`.
- Templates extraits des pages actuelles (chrome header/menu/footer + gabarits par type).
- Configuration des catégories (9 : politique, économie, société, culture, sport, diaspora, monde, annonces, tourisme).
- Déploiement via GitHub Actions (build → GitHub Pages).
- Vérification que le site généré correspond à l'actuel.

**Exclus (phases ultérieures) :** interface web /admin, authentification, upload d'images, aperçu, programmation, édition/suppression.

**Passthrough statique (non régénéré en Phase 1) :** pages `contact`, `recherche`, `mentions-legales`, `politique-confidentialite` (déjà construites) ; dossiers d'assets `wp-content/`, `wp-includes/`, `_external/` ; `.nojekyll`, `articles-index.json` (regénéré), barre légale/footer injectés.

## 3. Architecture du dépôt (après migration)

```
/                          (racine du dépôt = source)
├─ content/
│  └─ articles/            fiches d'articles (*.md) — SOURCE DE VÉRITÉ
├─ templates/              gabarits extraits (chrome + types de page)
│  ├─ partials/            header, footer, menu, barre légale
│  ├─ article.html
│  ├─ category.html
│  ├─ author.html
│  └─ home.html            accueil avec marqueurs de section
├─ config/
│  └─ categories.json      slug → {nom, couleur, ordre}
├─ site/                   assets statiques passthrough
│  ├─ wp-content/  wp-includes/  _external/
│  ├─ index.php/pages/     contact, recherche, legal (statiques)
│  └─ .nojekyll
├─ build/
│  └─ generate.mjs         le générateur
├─ package.json
└─ .github/workflows/deploy.yml
```

Le build produit un dossier `_site/` (artefact) publié sur GitHub Pages via `actions/deploy-pages`. **Les fichiers générés ne sont plus commités** : la source est `content/` + `templates/` + assets ; la sortie est éphémère. Cela découple source et rendu.

> Note : ceci fait passer GitHub Pages du mode « branche `/` » au mode « GitHub Actions ». À reconfigurer une fois (Settings → Pages → Source : GitHub Actions).

## 4. Modèle de contenu (fiche d'article)

Fichier `content/articles/<slug>.md`, frontmatter YAML + corps Markdown :

```markdown
---
title: "La vanille d'Anjouan : un trésor agricole en quête de sa juste valeur"
slug: vanille-anjouan-comores-agriculture-exportation
category: economie          # doit exister dans config/categories.json
author: Comoresnews
date: 2026-06-12            # date de publication (AAAA-MM-JJ)
image: wp-content/uploads/2026/06/Vanille_d_Anjouan.png   # image de une (chemin ou url)
excerpt: "La vanille d'Anjouan alimente les grandes maisons de parfum…"  # chapô
status: published          # published | scheduled | draft
---

Corps de l'article en **Markdown** : titres, gras, listes, liens, images.
```

**Règles :**
- `slug` unique ; détermine l'URL `index.php/<AAAA>/<MM>/<JJ>/<slug>/` (dérivée de `date` + `slug`, **identique aux URLs actuelles**).
- `category` doit référencer une clé de `config/categories.json` (sinon erreur de build).
- `status: draft` → non généré ; `scheduled` → généré seulement si `date <= aujourd'hui` (mécanique pleinement exploitée en phase 3, mais le champ existe dès la phase 1).
- Pas de tags en phase 1 (YAGNI ; pourra être ajouté plus tard).

## 5. Migration des 10 articles existants

Un script `build/migrate.mjs` (exécuté **une fois**) :
1. Parcourt les pages `index.php/**/<slug>/index.html`.
2. Extrait : titre (og:title), catégorie (lien fil d'ariane), auteur, image (og:image), chapô (og:description), date (URL), et le **corps** (conteneur de contenu de l'article).
3. Convertit le corps HTML → Markdown (lib `turndown`).
4. Écrit `content/articles/<slug>.md`.
5. **Vérification** : on régénère puis on compare le texte visible et les liens/images de chaque article généré à l'original (tolérance sur les espaces). Tout écart est listé et corrigé avant de continuer.

## 6. Le générateur (`build/generate.mjs`)

Entrées : `content/`, `templates/`, `config/`, `site/`. Sortie : `_site/`.

Étapes :
1. Charger les catégories (`config/categories.json`) et toutes les fiches valides (statut publiable, date due).
2. Trier les articles par date décroissante.
3. **Pages d'articles** → `_site/index.php/<AAAA>/<MM>/<JJ>/<slug>/index.html` via `templates/article.html` (injecte titre, fil d'ariane, catégorie, auteur, date, image de une, corps rendu depuis Markdown).
4. **Pages catégories** → `_site/index.php/category/<slug>/index.html` via `templates/category.html` (liste des articles de la catégorie ; message « Aucun article pour le moment » si vide).
5. **Accueil** → `templates/home.html` avec marqueurs `{{SECTION:<slug>}}` remplacés par les cartes des articles de chaque catégorie (réplique la réorganisation actuelle) ; sections transverses (« à ne pas manquer », « les plus lus ») remplies par une sélection récente.
6. **Page auteur** → liste des articles de l'auteur.
7. **`articles-index.json`** régénéré pour la recherche.
8. **Copie** de `site/` (assets + pages statiques) dans `_site/`.
9. Injection des éléments transverses (barre légale/footer, lien Contact actif, interception recherche) via partials, sur toutes les pages générées.

Le générateur est **déterministe** (aucune dépendance à l'heure sauf le filtrage `scheduled`, injecté en paramètre pour testabilité).

## 7. Templates

Extraits des pages actuelles pour garantir un rendu identique :
- **Partials** : header + logo, menu (avec les 9 catégories + Tourisme + Contact), barre légale/footer, blocs de recherche.
- **article.html** : gabarit d'un article (le chrome + zone de contenu avec marqueurs `{{TITLE}}`, `{{BREADCRUMB}}`, `{{CATEGORY}}`, `{{AUTHOR}}`, `{{DATE}}`, `{{IMAGE}}`, `{{BODY}}`).
- **category.html / author.html** : chrome + `{{ARTICLES}}`.
- **home.html** : accueil complet actuel avec marqueurs de section.

Les chemins relatifs sont calculés par le générateur selon la profondeur de chaque page (comme aujourd'hui).

## 8. Déploiement (GitHub Actions)

`.github/workflows/deploy.yml` :
- Déclencheurs : `push` sur `main` **et** `schedule` (cron horaire, pour publier les articles programmés — pleinement utilisé en phase 3, mais câblé dès la phase 1).
- Étapes : `npm ci` → `node build/generate.mjs` → `actions/upload-pages-artifact` (`_site/`) → `actions/deploy-pages`.
- Permissions Pages + `id-token` pour le déploiement.

## 9. Critères de succès (Phase 1)

- Les 10 articles sont en fiches `content/articles/*.md`.
- `node build/generate.mjs` produit `_site/` sans erreur.
- Le site généré est **visuellement identique** à l'actuel et **toutes les URLs sont préservées** (aucun lien cassé).
- Un scan complet du site déployé ne renvoie que des `200` (mêmes vérifications que précédemment).
- Le déploiement GitHub Actions fonctionne de bout en bout.
- Modifier une fiche + push → le site se met à jour automatiquement, changement visible.

## 10. Risques et mitigations

- **Fidélité de conversion HTML→Markdown du corps** → vérification systématique post-génération (§5.5) ; en dernier recours, conserver le corps en HTML brut pour un article récalcitrant.
- **Bascule du mode Pages (branche → Actions)** → opération unique, documentée ; rollback possible en repointant sur `main`.
- **Régression visuelle de l'accueil (structure tagDiv complexe)** → l'accueil est un template quasi verbatim avec seulement des marqueurs de section ; comparaison avant/après.
- **URLs** → dérivées de `date`+`slug` pour matcher l'existant ; test de non-régression des liens internes.

## 11. Suite

- **Phase 2** : back-office `/admin/` (auth jeton, formulaire création, aperçu, publier) écrivant des fiches via l'API GitHub.
- **Phase 3** : liste/édition/suppression + programmation (le cron du §8 promeut les articles `scheduled` à échéance).
