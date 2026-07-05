# Comoresnews — site statique

Site d'actualité statique (HTML/CSS/JS, sans base de données) reprenant le design de comoresnews.com.
Accueil, 8 catégories, 10 articles, page auteur, recherche, contact, mentions légales et politique de confidentialité.

## Structure

- `index.html` — page d'accueil
- `index.php/category/<cat>/` — pages catégories (politique, économie, société, culture, sport, diaspora, monde, annonces)
- `index.php/<AAAA>/<MM>/<JJ>/<slug>/` — articles
- `index.php/author/lewistifosi/` — page auteur
- `index.php/pages/recherche/` — recherche (utilise `articles-index.json`)
- `index.php/pages/contact/` — formulaire de contact (FormSubmit.co)
- `index.php/pages/mentions-legales/`, `index.php/pages/politique-confidentialite/`
- `wp-content/`, `wp-includes/`, `_external/` — CSS, JS, polices, images
- `.nojekyll` — **ne pas supprimer** : indispensable pour que GitHub Pages serve le dossier `_external/`

## Déploiement

### Option A — Vercel (recommandé, le plus simple)
1. Pousser ce dossier sur un dépôt GitHub (voir plus bas).
2. Sur [vercel.com](https://vercel.com) → *Add New Project* → importer le dépôt.
3. Framework Preset : **Other** ; Build Command : *(vide)* ; Output Directory : `.` (racine).
4. *Deploy*. URL de test fournie (ex. `comoresnews.vercel.app`). Domaine perso branchable ensuite.

### Option B — GitHub Pages
1. Pousser sur GitHub (voir plus bas).
2. Dépôt → *Settings* → *Pages* → Source : *Deploy from a branch* → branche `main`, dossier `/ (root)` → *Save*.
3. Le site sera publié sous `https://<utilisateur>.github.io/<depot>/`.
   ⚠️ Si le site n'est pas à la racine du domaine, certains liens absolus peuvent nécessiter un ajustement — préférer Vercel ou un domaine perso à la racine.

## À personnaliser avant mise en ligne

- **Formulaire de contact** : au 1er envoi, FormSubmit.co envoie un e-mail d'activation à `contact@comoresnews.com` (cliquer le lien une fois). Cette boîte doit exister.
- Le champ `_next` du formulaire (`index.php/pages/contact/index.html`) redirige vers `comoresnews.com` après envoi — remplacer par l'URL finale du site déployé.
- **Mentions légales** : compléter le nom du directeur de publication et les coordonnées de l'hébergeur.
- Les liens de *tags* et la catégorie *tourisme* (non clonés) renvoient encore vers `comoresnews.com`.
