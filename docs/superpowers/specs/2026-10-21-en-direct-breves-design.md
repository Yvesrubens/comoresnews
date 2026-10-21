# « En direct », brèves et articles à la une — design

Date : 2026-10-21 · Projet : Comoresnews (site statique généré, Supabase, Vercel)

## Intention

Yves aime deux éléments vus sur un autre site d'actualité : un bouton jaune
« Newsletter gratuite » bien visible dans le menu, et une entrée « ● En direct ».
Il veut les deux sur Comoresnews. La page « En direct » doit donner au lecteur,
d'un coup d'œil, les grands articles choisis par la rédaction et le fil des
dernières informations courtes (les brèves). L'objectif : des visites plus
fréquentes et plus d'inscriptions à la newsletter.

## Ce qui a été décidé avec Yves

1. **Menu** : sur toutes les pages, une entrée « ● En direct » (point vert
   clignotant) et un bouton jaune « Newsletter gratuite ».
2. **Page « En direct » en deux colonnes** (maquette B validée) :
   à gauche « À la une » (grands articles, photo + titre), à droite « Brèves »
   (fil chronologique, la plus récente en haut, avec l'heure).
3. **Brèves** : écrites par les rédacteurs dans le back-office, en quelques
   lignes. Comme les articles, **un admin valide avant la publication**.
4. **À la une** : **l'admin coche une case** « À la une » sur les articles de
   son choix.
5. **La même case pilote aussi le bloc « À la une » de la page d'accueil**.

## Objectifs

- Un rédacteur rédige une brève en moins d'une minute ; un admin la publie en un clic.
- Un admin choisit les articles à la une depuis l'éditeur d'article ; l'accueil
  et la page En direct suivent à la génération suivante.
- Le bouton newsletter mène au formulaire d'inscription existant.

## Hors périmètre

- Pas de mise à jour en temps réel dans le navigateur : la page est régénérée
  à chaque publication, comme le reste du site (1–2 min).
- Pas de page propre par brève, pas de photo dans une brève, pas de commentaires.
- Pas de nouvelle newsletter « brèves » ni d'envoi de notifications.
- On ne touche pas aux blocs de catégories de l'accueil.

## À éviter absolument (anti-objectifs)

- Une brève visible sur le site sans validation d'un admin.
- Un rédacteur (non admin) capable de mettre un article à la une.
- Un accueil vide ou cassé si aucun article n'est coché.
- Casser les emplacements publicitaires existants (accueil : MegaBannière 1 est
  injectée dans/après la grille `tdi_51`, voir `build/lib/ads.mjs`).

## Existant utile

- Accueil (`templates/home.html`) : la grille « À la une » `tdi_51` (4 cases :
  1 grande + 3) et le bandeau défilant « à la une » `tdi_50` (3 titres) sont
  **aujourd'hui en dur dans le gabarit** (articles de juin) ; ils ne suivent rien.
- Articles en base `public.articles` (statuts brouillon / en_attente / programme /
  publie), RLS : admin tout, rédacteur ses propres lignes (`0003_rls.sql`).
- Back-office `admin/index.html` : vues, workflow soumettre / publier / renvoyer
  avec commentaire, `api.triggerDeploy()` après publication.
- Le formulaire newsletter est injecté en bas de toutes les pages par
  `build/lib/newsletter.mjs`.
- Les menus sont en dur dans chaque gabarit (`templates/*.html`) et dans les pages
  statiques `index.php/pages/*/index.html` (menu bureau + menu mobile).

## Description fonctionnelle

### Menu (toutes les pages)

- Entrée « ● En direct » après les catégories, lien vers la page En direct.
- Bouton jaune (#f5b400, texte bleu nuit, gras, coins arrondis) « Newsletter
  gratuite » aligné à droite du menu ; clic = défilement vers le formulaire
  d'inscription de bas de page (ancre).
- Mobile : les deux apparaissent dans le menu déroulant, le bouton restant jaune.
  *(Choix de Claude.)*

### Page « En direct »

- Adresse : `index.php/pages/en-direct/index.html` *(choix de Claude : même profondeur que les pages catégorie, dont on réutilise le gabarit)*. Titre « En direct ».
- Colonne gauche « À la une » : articles publiés cochés, du plus récent au plus
  ancien (date de publication), **8 au maximum** *(choix de Claude)* : photo,
  catégorie, titre, lien vers l'article.
- Colonne droite « Brèves » : **les 30 dernières brèves publiées** *(choix de Claude)*,
  heure (heure des Comores, UTC+3) et texte ; séparateurs « Aujourd'hui »,
  « Hier », puis date (« 12 juin »). *(Choix de Claude.)*
- Si aucune brève : « Aucune brève pour le moment. » Si aucun article coché :
  on montre les derniers articles publiés.
- Publicités : mêmes emplacements que les pages de catégorie *(choix de Claude)* ;
  bandeau newsletter et « Ailleurs sur le web » comme partout. Présente dans le sitemap.
- Sur mobile, les deux colonnes s'empilent (ordre : voir « Laissé au constructeur »).

### Accueil

- La grille `tdi_51` (4 cases) affiche les articles cochés à la une, les plus
  récents d'abord ; s'il y en a moins de 4, on complète avec les derniers
  articles publiés (sans doublon).
- Le bandeau défilant « à la une » `tdi_50` affiche les 3 premiers de cette même liste.
  *(Choix de Claude : cohérent avec « la même case pour l'accueil ».)*

### Brèves dans le back-office

- Nouvelle entrée « Brèves » dans la section Rédaction du menu de gauche.
- Liste : texte (début), auteur, statut, date ; filtre par statut.
- Formulaire : un seul champ texte, **300 caractères au maximum** *(choix de
  Claude)* avec compteur ; texte brut, une ligne ou quelques lignes, pas de Markdown.
- Workflow identique aux articles : brouillon → soumettre (en attente) → l'admin
  publie, ou renvoie en brouillon avec un commentaire. Un admin peut écrire et
  publier directement. Un rédacteur peut modifier/supprimer ses brèves tant
  qu'elles ne sont pas publiées. Un admin peut dépublier ou supprimer une brève publiée.
- La publication déclenche la régénération du site (`triggerDeploy`).
- Tableau de bord : les brèves en attente comptent dans « en attente de validation ».

### Case « À la une » sur les articles

- Case à cocher dans l'éditeur d'article, **visible et modifiable seulement par
  un admin**, et colonne/indicateur « ★ » dans la liste des articles.
- Cocher/décocher sur un article publié déclenche la régénération du site. La case s'enregistre seule (mise à jour du seul champ `a_la_une`), **sans repasser par « Publier »**, qui remettrait la date de publication — donc l'adresse de l'article — à aujourd'hui. Un bouton ★ dans la liste des articles fait la même chose. *(Choix de Claude.)*

## Données (Supabase, migration 0011)

- `articles.a_la_une boolean not null default false`. Un rédacteur ne doit pas
  pouvoir la passer à vrai (trigger ou contrôle RLS côté base, pas seulement l'interface).
- Table `breves` : id, texte (≤ 300, non vide), auteur_id, statut
  (brouillon / en_attente / publie), commentaire_relecture, date_publication,
  cree_le, maj_le. RLS calquée sur `articles` : admin tout ; rédacteur lit,
  crée et modifie ses brèves non publiées, sans pouvoir publier.
- Le build lit les brèves publiées avec la clé service_role (comme les articles).
- Migration rejouable (`drop policy if exists`), collée par Yves dans l'éditeur SQL.

## Production et régénération

- **Le site en production est Vercel** (comoresnews.com, projet `comoresnews-clone`,
  variable `CONTENT_SOURCE=supabase`, secrets Supabase en place). Le déclencheur
  `api.triggerDeploy()` du back-office appelle le Deploy Hook Vercel : c'est la
  bonne cible. Le workflow GitHub Pages (`deploy.yml`, mode fichiers, sous-chemin
  `/comoresnews`) n'est qu'un miroir secondaire ; il n'a pas besoin des brèves ni
  de la case, il doit seulement continuer à se générer sans erreur.
- Liens du menu : relatifs, avec le préfixe de profondeur habituel (comme les
  autres liens des gabarits), pour fonctionner sur les deux hébergements.
- **Libellés « Aujourd'hui / Hier / date »** : calculés par un petit script dans
  le navigateur du lecteur à partir de l'horodatage de chaque brève (attribut
  `datetime`), en heure des Comores ; le HTML généré contient déjà la date
  complète en repli. Ce n'est pas une mise à jour en temps réel du contenu.
  *(Choix de Claude, pour qu'une nuit sans publication n'affiche pas des
  brèves de la veille sous « Aujourd'hui ».)*
- Dépublier une brève ou décocher « À la une » déclenche aussi la régénération.
  *(Choix de Claude.)*
- Tri par horodatage complet (pas seulement le jour). Un rédacteur ne voit que
  ses propres brèves dans le back-office, comme pour les articles. Garde en base
  sur `a_la_une` : un rédacteur ne peut pas **changer** la valeur, mais peut
  réenregistrer un article déjà coché par un admin sans erreur. *(Choix de Claude.)*

## Contraintes

- Même pile que l'existant : Node ESM, gabarits HTML, `node --test`, pas de nouvelle dépendance.
- Mode `CONTENT_SOURCE=files` (tests/local) : pas de brèves, pas de case ; le site
  doit se générer quand même (liste vide, repli sur derniers articles).
- Échappement HTML de tout texte saisi (brèves, titres).
- Ne jamais afficher d'e-mail ou de secret dans les journaux du dépôt public.

## Laissé au constructeur

- Mise en page exacte de la page En direct dans le thème (réutiliser les styles
  des cartes `articleCard` / modules existants), y compris l'ordre d'empilement mobile.
- Façon d'injecter le nouveau menu dans les ~9 gabarits (script de remplacement
  ou fonction au build) et d'animer le point vert.
- Découpage du code (nouveau module `build/lib/en-direct.mjs` probable).
