# Envoi de la newsletter hebdomadaire

**Date :** 2026-10-21 — **Statut :** design relu, en attente de validation

## 1. Intention

Le site collecte déjà des abonnés (table `abonnes`, bandeau « Chaque vendredi,
les articles de la semaine »). Il faut maintenant **envoyer** ce récapitulatif,
depuis le back-office, **sans CRM ni service d'emailing externe** : les emails
partent de la messagerie Gandi existante du domaine.

## 2. Décidé par l'utilisateur

- Un **admin relit et valide** chaque newsletter avant l'envoi.
- Tout se pilote depuis le **back-office** ; aucun autre outil.
- Expéditeur : **`newsletter@comoresnews.com`** (boîte Gandi, créée par l'utilisateur).
- Fonctionnement validé :
  1. « Préparer la newsletter de la semaine » crée un brouillon avec les articles publiés dans la semaine ; le vendredi, le tableau de bord le rappelle.
  2. L'admin peut modifier l'objet et une courte introduction, décocher des articles, voir un aperçu, s'envoyer un test, puis valider.
  3. Une fois validée, la newsletter part dans les minutes qui suivent via une tâche automatique ; envois étalés sous les limites Gandi, reprise après coupure, jamais deux fois au même abonné.
  4. Lien « Se désinscrire » en un clic dans chaque email.
  5. Historique des envois (date, nombre de destinataires) dans la rubrique Newsletters.

## 3. Contraintes

- **Limites Gandi** (doc officielle, « peuvent varier ») : ~200 emails/minute,
  1 000/heure, 8 000/jour, 40 destinataires max par message. On se fixe une marge :
  **100/minute, 900 sur une heure glissante, 7 000 sur 24 h glissantes**.
- Le domaine a déjà SPF (`include:_mailcust.gandi.net`) et DKIM Gandi
  (`gm1/gm2/gm3._domainkey`) → l'envoi via le SMTP Gandi est authentifié.
- SMTP : `mail.gandi.net`, port 465 (TLS), identifiant `newsletter@comoresnews.com`,
  mot de passe en secret (`SMTP_PASS`), **jamais** dans le dépôt ni dans le chat.
- Stack existante : Supabase (Postgres + RLS), back-office statique `admin/`,
  scripts Node + GitHub Actions (comme l'import des sujets, Node 24), tests `node --test`.
- Le navigateur ne détient jamais le mot de passe SMTP : l'envoi réel se fait côté
  serveur (tâche planifiée).
- **Domaine du site** : `https://comoresnews.com` sert bien ce site, à la racine
  (DNS Gandi → Vercel, bascule faite et vérifiée en août 2026). Tous les liens de
  l'email (articles, images, désinscription) utilisent cette base, lue depuis la même
  valeur que le build (`SITE_BASE_URL`, défaut `https://comoresnews.com`). La copie
  GitHub Pages (`yvesrubens.github.io/comoresnews`) n'est qu'un miroir, jamais
  utilisée dans les emails.
- Le dépôt GitHub est **public**, donc les journaux des tâches aussi : le script
  d'envoi n'y écrit **jamais** d'adresse email d'abonné (seulement des compteurs).
- Fuseau de référence : **Comores (UTC+3)** pour « vendredi » et les dates de la
  semaine dans l'objet.

## 4. Fonctionnement

### 4.1 Données (migration `0009_newsletters.sql`)
- `abonnes.jeton uuid not null default gen_random_uuid() unique` — identifiant
  secret de désinscription (rempli pour les abonnés existants).
- `newsletters` : `id`, `objet`, `intro` (texte), `article_ids uuid[]`, `statut`
  (`brouillon` | `validee` | `en_cours` | `envoyee` | `arretee` | `echec`), `test_a` (email
  destinataire d'un test demandé, nullable), `cree_par`, `cree_le`, `validee_par`,
  `validee_le`, `envoyee_le`, `nb_destinataires`, `nb_envoyes`, `derniere_erreur`.
- `newsletter_envois` : (`newsletter_id`, `abonne_id`) clé primaire, `statut`
  (`envoye` | `echec`), `envoye_le`, `erreur`. Sert de reprise (on n'envoie
  qu'aux abonnés actifs absents de cette table) et de compteur pour les quotas.
- RLS : `newsletters` lecture/écriture **admins seulement** ; les admins peuvent
  passer `brouillon`→`validee`, `validee`→`brouillon` et `en_cours`→`arretee` ;
  `en_cours`/`envoyee`/`echec` sont posés uniquement par le `service_role`.
- Un abonné qui se réinscrit garde son jeton de désinscription *(choix de conception)*.
  `newsletter_envois` lecture admins, écriture `service_role`.
- RPC `desinscrire_newsletter(p_jeton uuid)` exécutable par `anon` : passe
  l'abonné en `desinscrit` ; ne révèle rien (pas d'erreur si jeton inconnu).

### 4.2 Back-office (rubrique Newsletters)
- Bouton **« Préparer la newsletter de la semaine »** : crée un brouillon dont
  `article_ids` = articles **publiés depuis la dernière newsletter envoyée**
  (à défaut : 7 derniers jours), du plus récent au plus ancien. Objet par défaut :
  « Comoresnews — l'essentiel de la semaine du <lundi> au <dimanche> ».
- Écran du brouillon : objet, introduction (facultative), liste d'articles à cocher,
  **aperçu** rendu avec exactement le même gabarit que l'email, boutons
  « M'envoyer un test » (renseigne `test_a` avec l'email de l'admin) et
  « Valider et envoyer » (confirmation : « Envoyer à N abonnés ? »).
- Une newsletter validée ou envoyée n'est plus modifiable.
- **Arrêt possible** *(choix de conception)* : tant qu'elle est `validee` (aucun
  email parti), « Annuler l'envoi » la remet en `brouillon` ; pendant l'envoi
  (`en_cours`), « Arrêter l'envoi » la passe en `arretee` — les emails déjà partis
  le restent, les suivants ne partent pas. Le script relit le statut avant chaque lot.
- Si un brouillon existe déjà, « Préparer la newsletter de la semaine » l'ouvre au
  lieu d'en créer un second *(choix de conception)*.
- Historique : date, objet, statut, envoyés / destinataires, erreur éventuelle.
- Tableau de bord : le **vendredi**, si aucune newsletter n'a été envoyée ou n'est
  en cours pour la semaine, l'encart Newsletter affiche « La newsletter de la
  semaine est à préparer » avec le bouton ; sinon le dernier envoi.

### 4.3 Gabarit de l'email (module partagé)
- Un module **unique** `admin/newsletter-template.mjs`, importé par le back-office
  (aperçu) et par la tâche d'envoi, produit le HTML et la version texte.
- HTML compatible messageries (tableaux, styles en ligne, largeur 600 px) aux
  couleurs du site : en-tête noir « COMORES**NEWS** » (rouge #e50914), introduction,
  puis pour chaque article : image, catégorie, titre (lien), chapô, « Lire l'article ».
- Liens absolus vers `https://comoresnews.com` (chemin d'article du build) ; images :
  URL Storage absolue, ou chemin relatif préfixé par le domaine.
- Pied : « Vous recevez cet email car vous êtes inscrit sur comoresnews.com » +
  lien **Se désinscrire** personnalisé (jeton de l'abonné).
- En-têtes : `List-Unsubscribe: <mailto:newsletter@comoresnews.com?subject=desinscription>, <URL de désinscription>`.

### 4.4 Page de désinscription
- Page statique du site `index.php/pages/desinscription/` (même gabarit que les
  autres pages statiques) : lit `?t=<jeton>`, appelle `desinscrire_newsletter`,
  affiche « Vous êtes désinscrit de la newsletter » (ou un message neutre si lien
  invalide). Aucune donnée personnelle affichée.

### 4.5 Tâche d'envoi
- Script `scripts/send-newsletter.mjs` lancé par GitHub Actions **toutes les
  10 minutes** (+ déclenchement manuel), clé `service_role` + `SMTP_PASS`.
- À chaque passage :
  1. Envoie les **tests** demandés (`test_a` non nul) au seul destinataire indiqué
     (objet préfixé « [TEST] »), puis remet `test_a` à null. Le test n'utilise pas
     de vrai jeton de désinscription.
  2. Pour la newsletter `validee` ou `en_cours` la plus ancienne : passe en
     `en_cours`, calcule les destinataires (abonnés `actif` absents de
     `newsletter_envois`), envoie **un email individuel par abonné** dans la limite
     du quota disponible (100/min, 900/h glissante, 7 000/24 h glissantes, comptés
     sur `newsletter_envois`), enregistre chaque résultat, met à jour `nb_envoyes`.
  3. Quand il ne reste plus de destinataire : `envoyee` + `envoyee_le`.
- Un échec SMTP sur une adresse est noté (`echec`) sans bloquer les autres ;
  un échec global (connexion SMTP impossible) laisse la newsletter `en_cours`,
  note `derniere_erreur` et fait échouer le run (alerte email GitHub).
- Une seule newsletter envoyée à la fois (concurrence GitHub Actions désactivée).

## 5. Non-objectifs
- Statistiques d'ouverture ou de clic, segmentation, choix de l'heure d'envoi.
- Double confirmation de l'inscription (opt-in confirmé).
- Désinscription « one-click » par requête POST (exigée seulement au-delà de
  5 000 emails/jour chez Gmail/Yahoo).
- Envoi automatique sans validation humaine.
- Service d'emailing externe / CRM.

## 6. Anti-objectifs
- Un abonné reçoit deux fois la même newsletter.
- Un désinscrit reçoit encore la newsletter.
- Une newsletter part sans validation d'un admin.
- Dépasser les limites Gandi au point de faire bloquer la boîte.
- Le mot de passe SMTP exposé (navigateur, dépôt, chat).

## 7. Actions de l'utilisateur
- Créer la boîte `newsletter@comoresnews.com` chez Gandi.
- Écrire son mot de passe dans `.env` (`SMTP_PASS=…`) ; il est ensuite enregistré
  comme secret GitHub sans être affiché.
- Appliquer la migration `0009_newsletters.sql` dans le SQL Editor Supabase.

## 8. Laissé au builder
- Mise en page exacte de l'écran du brouillon et du gabarit email (dans le style
  existant), textes des messages.
- Bibliothèque SMTP (`nodemailer` recommandé).
- Rythme exact d'envoi à l'intérieur des quotas.
