# Refonte de la présentation du site en cartes (inspirée de SolarBrief) — design

Date : 5 novembre 2026 · Statut : validé par Yves le 5 novembre 2026

## Intention

Yves aime la façon dont le site **SolarBrief Africa** (https://www.solarbrief.africa/fr) présente ses
articles : cartes blanches aux coins arrondis, étiquettes en pastilles, grands titres à empattement,
pages article aérées avec « À lire aussi » en bas. Il veut cette **disposition sur tout Comoresnews**,
en gardant l'identité, le contenu et le fonctionnement actuels de Comoresnews.

On reprend une **disposition**, pas une identité : aucun nom, logo, texte, police propriétaire,
couleur de marque ni élément graphique de SolarBrief.

Maquettes validées (non versionnées, dossier `.superpowers/brainstorm/758-1793880110/content/`) :
`accueil-v2.html`, `rubriques-v1.html` (option A), `article-v1.html`.

## Ce qui a été décidé avec Yves

1. **Accueil** : disposition de la maquette `accueil-v2.html`.
   - Le bandeau vert d'accroche de la maquette v1 (titre, recherche, encart newsletter) est **retiré**.
   - La bande newsletter actuelle « Recevez l'actualité des Comores dans votre boîte mail » **reste**,
     sous le menu, comme aujourd'hui.
   - « À la une » : 1 grande carte à gauche (photo, étiquettes, titre, chapô, auteur · date) + 3 cartes
     empilées à droite (photo à gauche, étiquettes, titre, auteur · date).
   - « À ne pas manquer » : grille de cartes.
2. **Rubriques de l'accueil** (Politique, Économie, Société, Culture, Sport, Diaspora, Monde, Tourisme,
   Annonces) : **option A** — cartes **2 par ligne** dans la colonne principale, **colonne de droite
   conservée** (« Suivez-nous », « Ça pourrait vous intéresser »). Lien « Tous les articles … → ».
3. **Pages rubriques** (`/index.php/category/<slug>/`) : même logique — **nombre d'articles en haut**
   (« 62 articles »), cartes 2 par ligne, colonne de droite.
4. **Étiquettes d'île** sur les cartes et la page article : Yves les veut. Valeurs : Ngazidja, Ndzuani,
   Mwali, Maoré, Diaspora (voir « Données »). La réécriture quotidienne les renseigne ; les articles
   déjà publiés sont complétés une fois.
5. **Page article** : disposition de SolarBrief, maquette `article-v1.html` validée — fil d'Ariane,
   étiquettes, grand titre, chapô, ligne auteur, grande photo + légende, corps aéré, source, colonne de
   droite, puis **« À lire aussi » : une rangée de 3 à 4 articles côte à côte** sous l'article.
6. Le reste, proposé par Claude et accepté par Yves (« tout me va ») :
   - « Les plus lus » (aujourd'hui figé sur des articles de juin) devient **« Les plus récents »**,
     rempli automatiquement, en cartes. Le branchement sur de vraies statistiques est hors périmètre.
   - **Pied de page** : mêmes liens qu'aujourd'hui, nouvelle présentation en colonnes sur fond vert.
   - **Téléphone** : une carte par ligne partout ; la colonne de droite passe sous le contenu.
   - **Pages fixes** (contact, recherche, mentions légales, confidentialité, désinscription) : nouvel
     en-tête et nouveau pied de page, contenu inchangé.
   - **Couleurs** : celles du drapeau, déjà présentes sur le site — vert `#19471a`, jaune `#fcc624`,
     rouge `#ce1329`, bleu `#2673b9` ; fond de page clair `#f4f2ee`, cartes blanches.

## Objectifs

- Un site plus lisible et plus moderne, cohérent d'une page à l'autre (même carte partout).
- Tout ce qui fonctionne aujourd'hui continue de fonctionner (voir « Existant à préserver »).
- Pages plus légères que les gabarits WordPress actuels (≈ 125 à 390 Ko de HTML chacun).

## Hors périmètre

- Statistiques réelles de lecture pour « Les plus lus ».
- Type d'article (brève, tribune, enquête) en étiquette : pas de champ aujourd'hui ; non demandé.
- Encadré « Ce que ça change » de SolarBrief, bandeau de cours (prix, fret, devises), sélecteur FR/EN,
  bandeau d'accroche avec recherche sur l'accueil (retiré par Yves).
- Refonte du back-office (seul ajout : le champ île) et du gabarit de la newsletter e-mail.

## À éviter absolument (anti-objectifs)

- Copier l'identité de SolarBrief (nom, logo, textes, couleurs de marque, images).
- Casser une URL existante (articles, rubriques, pages, auteur `index.php/author/lewistifosi/`) ou le
  référencement (balises SEO, JSON-LD, sitemap).
- Perdre un emplacement publicitaire, le consentement cookies, Google Analytics, le formulaire
  newsletter, le menu « En direct », la recherche.
- Afficher une étiquette d'île fausse : en cas de doute, **pas d'étiquette**.
- Présenter une photo de banque comme une photo de l'événement (légende « Photo d'illustration »).

## Existant à préserver (point d'attention principal)

Le site est un **générateur statique** (`build/generate.mjs`) qui remplit des gabarits HTML
(`templates/home.html`, `category.html`, `article.html`, `author.html`) **clonés du thème WordPress
« Newspaper »**. Plusieurs modules repèrent des **marqueurs propres à ce thème** pour injecter leur
contenu ; un nouveau balisage doit leur fournir de nouveaux points d'ancrage :

| Module | S'appuie aujourd'hui sur |
|---|---|
| `build/lib/ads.mjs` (régie SmartAdServer) | `data-td-block-uid="tdi_51"` (MégaBannière 1 après la une), `tdi_64` (GrandAngle avant / Pavé 1 après « Ça pourrait vous intéresser »), `td-post-header` / `td-crumb-container` (bannière en tête d'article), `td-post-content` (pub dans le corps), `<body>` (repli) |
| `build/lib/newsletter.mjs` (bande newsletter) | `<div class="td-main-content-wrap` |
| `build/lib/menu.mjs` (« En direct », bouton newsletter) | `id="menu-main-3"`, `id="menu-main-2"`, lien « Accueil » |
| `build/lib/date-bandeau.mjs` | `<div class="tdb-head-date-txt">` |
| `build/lib/consent.mjs`, `analytics.mjs` | `<head>`, `</head>` |
| `build/lib/en-direct.mjs`, `templates.mjs` | marqueurs `{{UNE_GRID}}`, `{{UNE_TICKER}}`, `{{A_NE_PAS_MANQUER}}`, `{{POURRAIT_INTERESSER}}`, `{{SECTION:<slug>}}` |

Les pages fixes (`index.php/pages/*`) sont recopiées telles quelles puis reçoivent menu et date ; elles
portent le même en-tête/pied WordPress et doivent recevoir les nouveaux.

Règles de sélection déjà en place, **à conserver** (fonctions de `build/lib/en-direct.mjs`) :
- grille « À la une » : `homeUne` (cochés « À la une », complétés par les plus récents, 4) ;
- bandeau des titres : `titresDuJour` (articles du jour, heure des Comores, défilement auto 5 s) ;
- « À ne pas manquer » : `aNePasManquer` (veille, hors une, 5, complété) ;
- « Ça pourrait vous intéresser » : `pourraitInteresser` (4, hors une et à ne pas manquer, rubriques variées) ;
- rubriques de l'accueil : 4 articles max + lien (`HOME_SECTION_MAX`).

Les tests existants (`npm test`, 184 au vert) couvrent ces règles et les injections ; ceux qui
vérifient des marqueurs du thème devront suivre les nouveaux marqueurs, sans perdre ce qu'ils
contrôlent.

Le bandeau des titres du jour : à placer dans la **fine barre du haut, à côté de la date** (proposé
par Claude, non contesté), en gardant le défilement automatique.

## Description par page

### Composant « carte » (commun)
Fond blanc, coins arrondis (~10–12 px), ombre légère. Photo en haut (ou à gauche en version
« ligne »), puis étiquettes, titre en caractère à empattement, ligne « Auteur · date ». La grande
carte ajoute le chapô. Photo absente → aplat gris clair (comme aujourd'hui). Toute la carte est
cliquable vers l'article ; la pastille de rubrique pointe vers la page rubrique.

Étiquettes : rubrique = pastille pleine verte ; île = pastille à contour vert.

### En-tête (toutes les pages)
Fine barre du haut (date dynamique + bandeau des titres du jour), puis barre verte soulignée de
jaune : logo Comoresnews, menu des rubriques, « ● En direct », bouton « Newsletter gratuite ». Menu
mobile équivalent à l'actuel.

### Accueil (de haut en bas)
En-tête → bande newsletter actuelle → « À la une » (1 grande + 3 empilées) → MégaBannière →
colonne principale : « À ne pas manquer » puis les rubriques en cartes 2 par ligne ; colonne de
droite : « Suivez-nous », GrandAngle, « Ça pourrait vous intéresser », Pavé 1 → « Les plus récents »
→ pied de page.

### Page rubrique
Titre de la rubrique, « N articles », cartes 2 par ligne (tous les articles, comme aujourd'hui, ou
paginé au choix du constructeur si la page devient trop longue), colonne de droite.

### Page article
Fil d'Ariane › étiquettes (rubrique, île) › titre › chapô › ligne auteur (pastille initiales,
« Comoresnews », date, temps de lecture estimé, boutons de partage Facebook / X / WhatsApp / e-mail)
› grande photo + légende « Photo d'illustration » › corps (Markdown rendu, intertitres, liens internes)
› ligne « Source : … » (`sourceLine`, inchangée). Colonne de droite : encart newsletter (même
formulaire que la bande), « Ça pourrait vous intéresser ». Sous l'article, pleine largeur :
**« À lire aussi »**, 4 cartes de la même rubrique (les plus récentes hors article courant ; complétées
par d'autres rubriques s'il en manque).

Légende « Photo d'illustration » (choix de Claude) : affichée **seulement** quand l'image vient de la
banque de photos libres (URL contenant `/medias/commons/`), reconnue par son chemin, sans nouveau
champ. Les vraies photos d'événement gardent leur légende éventuelle, ou aucune.

Publicités de l'article (choix de Claude) : les emplacements actuels sont conservés — MégaBannière en
tête, pub dans le corps, et dans la colonne de droite « Suivez-nous », GrandAngle et Pavé 1.

### Page auteur
Même présentation que la page rubrique. Publicités des pages rubrique et auteur (choix de Claude) :
GrandAngle et Pavé 1 dans la nouvelle colonne de droite, au lieu du repli en bas de page.

### Page « En direct » (`index.php/pages/en-direct/`)
Choix de Claude : elle garde son contenu et ses règles actuels (`buildEnDirectPage` : articles à la
une + brèves du jour). Elle reçoit le nouvel en-tête et le nouveau pied de page, et ses articles
passent en cartes. Les brèves restent une liste horodatée, pas des cartes.

### Doublon d'étiquettes
Quand la rubrique et l'île valent toutes deux « Diaspora », une seule pastille est affichée (choix de
Claude).

### Pied de page
Colonnes sur fond vert : logo + phrase de présentation + réseaux sociaux ; rubriques ; liens
« Contact », « Mentions légales », « Politique de confidentialité » ; copyright.

## Données (Supabase)

Nouvelle migration `0012` : colonne `ile` sur `articles`, texte nullable, valeurs autorisées
`ngazidja`, `ndzuani`, `mwali`, `maore`, `diaspora` (contrainte `check`). Libellés affichés :
Ngazidja, Ndzuani, Mwali, Maoré, Diaspora.

- **Build** : `supabase-source.mjs` lit `ile` ; le générateur l'affiche quand elle est renseignée.
- **Back-office** (`admin/index.html`) : liste déroulante « Île » (vide autorisé) dans l'éditeur.
- **Réécriture quotidienne** : `scripts/reecriture/CONSIGNES.md` ajoute un champ `ile` (une des
  valeurs, ou `null` si le sujet n'est pas propre à une île ou en cas de doute) ; `cli.mjs appliquer`
  le contrôle et l'enregistre. La tâche planifiée ne change pas.
- **Articles déjà publiés** : remplissage unique, article par article, à partir du texte (même règle :
  en cas de doute, `null`). Script ou passe manuelle au choix du constructeur ; le résultat est
  présenté à Yves avant écriture en base.

## Production

**Ordre** : la partie données (colonne `ile`, back-office, consignes de réécriture, remplissage des
articles publiés) est livrée **en premier**, séparément ; la colonne étant facultative, le site actuel
n'est pas affecté. La refonte visuelle vient ensuite et peut ainsi être vérifiée sur les vraies
données. *(Décidé par Yves le 5 novembre 2026 : la partie données passe en premier.)*

La tâche planifiée de réécriture lance les scripts depuis la copie de travail du dépôt : pendant la
refonte, le dépôt doit rester sur `main` en dehors des sessions de travail, pour qu'elle n'utilise
jamais des consignes ou scripts non validés.

Le déploiement reste celui d'aujourd'hui (push sur `main` → workflow « Build & Deploy », builds
planifiés). La refonte se fait sur une branche et n'est mise en ligne qu'après accord d'Yves, après
vérification sur un build local alimenté par Supabase (`CONTENT_SOURCE=supabase`).

## Contraintes

- Statique, sans framework ni dépendance nouvelle côté visiteur ; aucune police ou script chargé
  depuis SolarBrief.
- Accessibilité de base : contrastes suffisants, textes alternatifs, cibles tactiles confortables.
- Les heures/dates restent en heure des Comores (UTC+3).

## Laissé au constructeur

- Réécrire les gabarits avec un balisage propre ou restyler l'existant — **choix de Claude :
  nouveaux gabarits légers**, en redonnant des ancres explicites (`id`) aux modules du tableau
  ci-dessus et en adaptant leurs tests.
- Polices exactes (une famille à empattement pour les titres et le corps d'article, une sans
  empattement pour l'interface), tailles et espacements, dans l'esprit des maquettes.
- Pagination éventuelle des pages rubriques et auteur.
- Calcul du temps de lecture.
- Découpage du travail en étapes et ordre de mise en ligne.
