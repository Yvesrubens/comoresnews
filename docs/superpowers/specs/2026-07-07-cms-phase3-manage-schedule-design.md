# Comoresnews CMS — Phase 3 : Gestion + Programmation

**Date :** 2026-07-07
**Statut :** Spec (design) — en attente de validation
**Prérequis :** Phases 1 (site généré) et 2 (back-office /admin de création) livrées ; workflow Actions avec cron horaire actif.
**Portée :** Lister / modifier / supprimer les articles existants depuis `/admin`, et programmer des publications à une date future.

## 1. Objectif

Compléter le back-office pour un cycle éditorial complet : à partir de `/admin`, voir la liste de tous les articles, **modifier** ou **supprimer** l'un d'eux, et **programmer** un article pour qu'il se publie automatiquement à une date future.

## 2. Fonctionnalités

### 2.1 Liste des articles
- Un onglet/vue « Mes articles » liste tous les fichiers `content/articles/*.md` (via l'API GitHub), avec pour chacun : titre, catégorie, date, statut (Publié / Programmé / Brouillon).
- Tri par date décroissante. Chaque ligne a des boutons **Modifier** et **Supprimer**.

### 2.2 Modifier
- « Modifier » charge la fiche (GET contenu + `sha`), décode et remplit le formulaire de rédaction (réutilisé de la Phase 2).
- Le **slug reste fixe** en édition (pas de renommage — évite la gestion de redirection ; documenté).
- « Enregistrer » fait un `PUT contents` avec le `sha` existant (mise à jour) → commit → rebuild.

### 2.3 Supprimer
- « Supprimer » demande confirmation, puis `DELETE contents` avec le `sha` → commit → rebuild → l'article disparaît du site.

### 2.4 Programmer
- Le formulaire gagne un choix de **statut** : « Publier maintenant » (défaut) ou « Programmer ».
- Si « Programmer » : champ **date/heure de publication** (date future) → la fiche est écrite avec `status: scheduled` et cette `date`.
- Le **générateur** (Phase 1) ne publie une fiche `scheduled` que si sa `date <= aujourd'hui` (déjà implémenté via `isPublishable`).
- Le **cron horaire** du workflow (déjà câblé) régénère le site chaque heure : à l'échéance, l'article programmé apparaît automatiquement.
- Dans la liste, un article `scheduled` est marqué « Programmé le JJ/MM ».

## 3. Composants (ajouts)

- `admin/lib.mjs` : ajouter `parseFiche(mdString)` → objet `{title, slug, category, author, date, image, excerpt, status, body}` (parse frontmatter, inverse de `buildFrontmatter`). Fonction pure, testée.
- `admin/github.mjs` : ajouter `listDir(path)` (GET d'un dossier → liste de fichiers), `getFile(path)` (→ `{contentDecoded, sha}`), `deleteFile(path, sha, message)`, et étendre `putFile` pour accepter un `sha` optionnel (mise à jour).
- `admin/index.html` : ajouter la **vue liste** (bascule « Rédiger » / « Mes articles »), le chargement en édition, la confirmation de suppression, et le sélecteur de statut + date de programmation.

## 4. Modèle de données

Inchangé (Phase 1). Le champ `status` prend `published` | `scheduled` | `draft` ; `date` sert d'échéance pour `scheduled`. La granularité reste **au jour** (le cron étant horaire, une échéance à la date du jour publie dans l'heure).

## 5. Tests

- **Unitaires (`node --test`)** : `parseFiche` (round-trip avec `buildFrontmatter`, champs, corps multi-lignes) ; logique de statut/échéance.
- **Manuels (navigateur, avec jeton réel)** : lister → modifier un article (changer le titre) → enregistrer → vérifier la mise à jour en ligne ; supprimer un article de test → vérifier sa disparition ; programmer un article à J+0 → vérifier qu'il sort au prochain cron (ou via déclenchement manuel du workflow).

## 6. Critères de succès

- Depuis `/admin`, la liste affiche tous les articles avec leur statut.
- Modifier un article met à jour son contenu en ligne après rebuild.
- Supprimer un article le retire du site (page, catégorie, accueil, recherche).
- Un article programmé à une date future n'apparaît pas immédiatement, puis apparaît automatiquement une fois la date atteinte (cron).
- Aucune régression sur la création (Phase 2) ni le rendu (Phase 1).

## 7. Risques et mitigations

- **Conflit d'édition (sha périmé)** → toujours relire le `sha` juste avant `PUT`/`DELETE` ; message clair en cas de 409.
- **Renommage de slug** → interdit en édition (slug verrouillé) pour éviter les liens cassés ; création d'un nouvel article si besoin.
- **Cohérence `parseFiche` ↔ `buildFrontmatter`** → test de round-trip.
- **Fuseau horaire de l'échéance** → comparaison en date ISO (AAAA-MM-JJ) UTC, cohérente avec `--now=$(date -u +%F)` du workflow ; documenté (précision au jour).

## 8. Hors périmètre

Édition du corps en WYSIWYG, gestion multi-auteurs avancée, brouillons collaboratifs, upload d'images dans le corps (toujours via URL Markdown), planification à l'heure précise (granularité au jour).
