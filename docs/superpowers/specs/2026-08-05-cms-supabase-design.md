# Spec — CMS Comoresnews sur Supabase (multi-utilisateurs, validation, SEO)

**Date :** 2026-08-05
**Statut :** validé (design), en attente de plan d'implémentation

## 1. Contexte & objectif

Le site Comoresnews est aujourd'hui un **site statique** généré à partir de fiches Markdown
(`content/articles/*.md`) via `build/generate.mjs`, avec un back-office `/admin` statique qui
écrit ces fiches dans le dépôt GitHub via l'API GitHub + jeton personnel. Déployé sur Vercel
(domaine `comoresnews.com`) et GitHub Pages.

Ce modèle a une limite bloquante : **chaque éditeur doit avoir un compte GitHub + un jeton +
un accès en écriture au dépôt**. Impossible d'ouvrir la rédaction à des personnes non techniques
(ex. agirod, herve) simplement.

**Objectif :** remplacer le stockage Git + l'auth GitHub par une base de données **Supabase**
offrant :
- des **comptes éditeurs** simples (email/mot de passe, invitation),
- un **circuit de validation** éditorial,
- un **back-office plus riche** (médiathèque images, workflow, filtres),
- tout en **conservant le site public statique** (rapidité + SEO déjà en place).

## 2. Décisions d'architecture (arrêtées avec l'utilisateur)

| Sujet | Décision |
|---|---|
| Backend | Supabase : Postgres + Auth + Storage |
| Site public | **Statique régénéré** depuis la base (réutilise les templates actuels) |
| Rôles | **Admin** + **Rédacteur** |
| Workflow | Brouillon → En attente → Publié (+ Programmé, + renvoi en brouillon commenté) |
| SEO | Complet (meta title/description, OpenGraph, mots-clés) + sitemap.xml + JSON-LD Article |
| Images | Médiathèque Supabase Storage |
| Migration | Import des 10 articles Markdown existants en statut « Publié » |
| Back-office | Réécriture de `/admin` en client Supabase (page statique, login email) |
| Hébergement | Inchangé : Vercel, domaine comoresnews.com |

## 3. Flux global

```
Rédacteur/Admin ─▶ Back-office /admin (Supabase Auth + supabase-js)
                        │  CRUD / validation
                        ▼
                Supabase (Postgres + Storage images)
                        │  à la publication OU au passage du cron
                        ▼
              Appel du Deploy Hook Vercel
                        ▼
   Build Vercel : generate.mjs LIT Supabase ─▶ site statique _site/
                        ▼
            comoresnews.com (rapide, SEO, IPv4/IPv6)
```

- Le **contenu quitte le dépôt Git** : les articles ne sont plus des `.md` versionnés. Le dépôt
  ne conserve que le **code** (templates, `generate.mjs`, `/admin`, scripts).
- **Délai de mise en ligne** : ~1-2 min après validation (durée du rebuild Vercel). Accepté.

## 4. Modèle de données (Postgres / Supabase)

### Table `profiles`
Une ligne par utilisateur, liée à `auth.users`.
- `id uuid` (PK, = `auth.users.id`)
- `nom text`
- `role text` — `admin` | `redacteur` (défaut `redacteur`)
- `cree_le timestamptz`

### Table `categories`
Remplace `config/categories.json`, éditable par l'admin.
- `slug text` (PK) — ex. `politique`
- `nom text` — ex. `Politique`
- `ordre int`

Valeurs initiales importées depuis `config/categories.json` :
politique, economie, societe, culture, sport, diaspora, monde, tourisme, annonces.

### Table `articles`
- `id uuid` (PK)
- `titre text`
- `slug text` (unique)
- `categorie text` (FK → `categories.slug`)
- `auteur_id uuid` (FK → `profiles.id`)
- `corps text` — Markdown
- `excerpt text` — chapô
- `image_couverture text` — chemin/url Storage
- **SEO** : `seo_titre text`, `seo_description text`, `og_image text`, `mots_cles text[]`
- **Workflow** : `statut text` — `brouillon` | `en_attente` | `programme` | `publie`
- `date_programmee timestamptz` (nullable)
- `date_publication timestamptz` (nullable)
- `commentaire_relecture text` (nullable) — motif de renvoi en brouillon
- `cree_le timestamptz`, `maj_le timestamptz`

### Table `media`
- `id uuid` (PK)
- `chemin text` — chemin dans le bucket Storage
- `url text` — url publique
- `importe_par uuid` (FK → `profiles.id`)
- `cree_le timestamptz`

Bucket Storage : `medias` (public en lecture pour servir les images du site).

## 5. Comptes & sécurité (RLS)

- **Auth Supabase email/mot de passe.** L'admin invite un éditeur par email (Supabase Auth
  invite) → l'éditeur définit son mot de passe. Aucun compte GitHub requis.
- À la création d'un utilisateur Auth, un trigger crée automatiquement sa ligne `profiles`
  (role `redacteur` par défaut ; l'admin peut promouvoir).
- **Row Level Security activé sur toutes les tables :**
  - `profiles` : chacun lit/écrit sa propre ligne ; l'admin lit/écrit toutes.
  - `articles` :
    - *Rédacteur* : `SELECT`/`INSERT`/`UPDATE`/`DELETE` uniquement sur **ses** articles
      (`auteur_id = auth.uid()`) et **seulement** en statut `brouillon`/`en_attente`.
      Ne peut pas passer un article en `publie`/`programme`.
    - *Admin* : accès total, y compris changement de statut vers `publie`/`programme` et
      suppression de n'importe quel article.
  - `categories` : lecture pour tous les connectés ; écriture admin uniquement.
  - `media` : lecture pour tous les connectés ; insertion par tout éditeur ; suppression par
    l'auteur du média ou l'admin.
- La clé `service_role` (accès complet, contourne RLS) reste **uniquement côté build Vercel**
  (variable d'environnement serveur), **jamais** exposée au navigateur. Le back-office
  utilise la clé `anon` + la session utilisateur.

## 6. Workflow éditorial

États : `brouillon` → `en_attente` → `publie` ; plus `programme` ; retour possible
`en_attente` → `brouillon` (avec `commentaire_relecture`).

- Le rédacteur crée en `brouillon`, puis « Soumettre » → `en_attente`.
- L'admin voit la file « En attente », relit, puis :
  - « Publier » → `publie` (`date_publication = now()`) → **Deploy Hook**.
  - « Programmer » → `programme` + `date_programmee`.
  - « Renvoyer » → `brouillon` + `commentaire_relecture`.
- **Programmation** : un **cron** (toutes les ~15 min) exécute une fonction qui passe en
  `publie` les articles `programme` dont `date_programmee <= now()`, puis appelle le Deploy Hook.
  Implémentation cron : **Supabase pg_cron + Edge Function** (préféré, garde toute la logique
  côté Supabase) ; alternative : Vercel Cron appelant un endpoint. À trancher au plan.

## 7. Génération statique & SEO

`build/generate.mjs` est adapté :
- Source des articles : **requête Supabase** (via `service_role`) des articles `statut = publie`
  (et `programme` déjà échus, par sécurité) — au lieu de lire `content/*.md`.
- Réutilise les **templates existants** (`templates/*.html`) et la logique de rendu
  (`build/render.mjs`, catégories, accueil, auteur, recherche `articles-index.json`).
- Réutilise le **pipeline d'optimisation d'images** existant (`build/lib/images.mjs`, WebP + lazy).
  Les images proviennent des URLs Storage Supabase.
- **SEO produit au build :**
  - `<title>` = `seo_titre` (fallback `titre`) ; `<meta name="description">` = `seo_description`
    (fallback `excerpt`).
  - Balises **OpenGraph** / Twitter Card : `og:title`, `og:description`, `og:image` (= `og_image`
    ou `image_couverture`), `og:url`, `og:type=article`.
  - `<meta name="keywords">` depuis `mots_cles`.
  - **`sitemap.xml`** listant accueil + catégories + articles publiés.
  - **JSON-LD** `Article` par page article (titre, image, date, auteur) pour Google Actualités.
- **Routage catégories** inchangé : chaque article rangé dans son onglet dédié.

## 8. Back-office `/admin` (réécriture Supabase)

- Reste une **page statique** (HTML/JS) servie par Vercel — pas de serveur applicatif ajouté.
- Utilise `supabase-js` (vendoré ou via import) : login email/mot de passe, session persistée.
- Écrans :
  - **Connexion** (email/mot de passe ; lien mot de passe oublié Supabase).
  - **Mes articles** (rédacteur) / **Tous les articles + file En attente** (admin) avec filtres
    par statut/catégorie.
  - **Éditeur d'article** : titre, slug auto/éditable, catégorie, corps Markdown + aperçu live
    (markdown-it déjà vendoré), chapô, image de couverture (upload → Storage), champs SEO,
    date de programmation. Boutons selon rôle : Enregistrer brouillon / Soumettre / (admin)
    Publier / Programmer / Renvoyer / Supprimer.
  - **Médiathèque** : liste des images du bucket, upload drag-drop, réutilisation.
  - **(admin) Utilisateurs** : inviter par email, changer de rôle.
  - **(admin) Catégories** : ajouter/renommer/ordonner.
- Après une action de publication, le back-office **déclenche le Deploy Hook Vercel**
  (URL secrète stockée côté Supabase Edge Function pour ne pas l'exposer, ou appelée par un
  trigger DB — à trancher au plan).
- Le code testable reste isolé (`admin/lib.mjs` : slugify, validation, mapping ; module client
  Supabase) avec tests `node --test`, comme l'existant.

## 9. Migration

Script `scripts/migrate-to-supabase.mjs` :
1. Lit les 10 fiches `content/articles/*.md` (gray-matter).
2. Upload les images référencées (`wp-content/uploads/...`) dans le bucket `medias`.
3. Insère chaque article dans `articles` en `statut = publie`, en réécrivant les chemins
   d'images vers les URLs Storage, `auteur_id` = un compte auteur par défaut (« Comoresnews »).
4. Idempotent (upsert sur `slug`) pour pouvoir relancer.

## 10. Rollout / bascule

1. Créer le projet Supabase, appliquer le schéma + RLS + triggers + bucket.
2. Migrer le contenu (script).
3. Adapter `generate.mjs` pour lire Supabase (derrière un flag/env, l'ancien mode fichiers reste
   fonctionnel tant que la bascule n'est pas validée).
4. Écrire le nouveau `/admin` Supabase à côté de l'ancien (`/admin` GitHub gardé en filet).
5. Configurer les variables d'env Vercel (URL Supabase, service_role) + Deploy Hook + cron.
6. Recette complète (publication, validation, programmation, SEO, images).
7. Bascule : `generate.mjs` en mode Supabase par défaut, ancien `/admin` retiré.

## 11. Hors périmètre (YAGNI pour cette itération)

- Édition collaborative temps réel simultanée.
- Statistiques d'audience / analytics.
- Commentaires lecteurs.
- Versionnement/historique des articles (au-delà de `maj_le`).
- Rôle « Éditeur » intermédiaire (on reste Admin + Rédacteur).

## 12. Risques & points à trancher au plan

- **Mécanisme de déclenchement du rebuild** (Deploy Hook depuis Edge Function vs trigger DB vs
  appel direct depuis le back-office) : à arrêter au plan, en gardant l'URL du hook secrète.
- **Cron de programmation** : Supabase pg_cron + Edge Function vs Vercel Cron.
- **Perte de la versioning Git du contenu** : compensée par la base + éventuels backups Supabase.
- **Coût** : plan gratuit Supabase suffisant au démarrage ; surveiller Storage/bande passante.
- **Sécurité clés** : `service_role` jamais côté navigateur ; RLS testée explicitement.
