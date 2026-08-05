# CMS Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer le CMS Comoresnews des fiches Markdown+GitHub vers Supabase (Postgres+Auth+Storage) avec comptes éditeurs, workflow de validation et back-office enrichi, tout en gardant le site public statique régénéré.

**Architecture:** Supabase est la source de vérité. Un back-office statique `/admin` (supabase-js) gère l'auth et le CRUD sous RLS. À la publication (ou via un cron pour les articles programmés), un Deploy Hook Vercel relance le build ; `generate.mjs` lit alors les articles publiés depuis Supabase et régénère le site statique avec SEO complet.

**Tech Stack:** Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron), `@supabase/supabase-js`, Node 24 (ESM), `node --test`, `markdown-it`, `gray-matter` (migration seulement), `sharp`, Vercel (build + Deploy Hook + env).

## Global Constraints

- Node ESM (`"type": "module"`), Node 24.x (aligné Vercel).
- Tests avec le runner natif `node --test` (pas de framework externe). Suivre le style des tests existants dans `test/`.
- La clé `service_role` Supabase n'est JAMAIS exposée au navigateur : uniquement en variable d'env du build Vercel et des Edge Functions. Le back-office utilise la clé `anon` + session utilisateur.
- Le chargeur Supabase du build renvoie des objets article de MÊME forme que `build/lib/content.mjs::loadArticles` : `{ title, slug, category, author, date (YYYY-MM-DD), image, excerpt, status, body }` (+ champs SEO additionnels `seoTitle, seoDescription, ogImage, keywords`).
- Rôles : `admin` | `redacteur`. Statuts article : `brouillon` | `en_attente` | `programme` | `publie`.
- Slugs uniques. Catégories valides = lignes de la table `categories`.
- Le mode « fichiers Markdown » existant reste fonctionnel derrière un flag `CONTENT_SOURCE` (`files` par défaut, `supabase` en cible) tant que la bascule n'est pas validée.
- Domaine de production : `https://comoresnews.com` (base des URLs SEO/sitemap).

---

## Phase 0 — Provisionnement & socle local

### Task 0: Créer le projet Supabase et le socle local

**Files:**
- Create: `supabase/config.toml` (généré par `supabase init`)
- Create: `.env.example`
- Modify: `.gitignore` (ajouter `.env`, `supabase/.temp`)
- Modify: `package.json` (dépendance `@supabase/supabase-js`, devDependency `supabase` CLI optionnelle)

**Interfaces:**
- Produces: variables d'env `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_DEPLOY_HOOK_URL` (consommées par tout le reste).

**Action utilisateur requise (ne peut pas être automatisée — compte Supabase) :**
1. Créer un projet sur https://supabase.com/dashboard (région EU recommandée). Noter `Project URL`, clé `anon`, clé `service_role`.
2. Fournir ces valeurs pour configuration des env (Vercel + local `.env`).

- [ ] **Step 1: Installer la dépendance client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Initialiser Supabase en local (dev/test du schéma sans toucher au cloud)**

Prérequis : Docker Desktop actif. Installer la CLI si absente : `npm i -D supabase`.

```bash
npx supabase init
npx supabase start
```
Expected: la CLI affiche `API URL`, `anon key`, `service_role key` locaux. Ces valeurs servent aux tests locaux.

- [ ] **Step 3: Créer `.env.example`**

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CONTENT_SOURCE=files
VERCEL_DEPLOY_HOOK_URL=
SITE_BASE_URL=https://comoresnews.com
```

- [ ] **Step 4: Mettre `.env` et artefacts Supabase hors Git**

Ajouter à `.gitignore` : `.env`, `supabase/.temp/`, `supabase/.branches/`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore supabase/config.toml
git commit -m "chore: socle Supabase (deps, CLI init, env template)"
```

---

## Phase 1 — Schéma, RLS, triggers

### Task 1: Migration schéma initial (tables + index)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces: tables `profiles`, `categories`, `articles`, `media` (colonnes conformes à la spec §4).

- [ ] **Step 1: Écrire la migration**

```sql
-- profiles : 1 ligne par utilisateur Auth
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null default '',
  role text not null default 'redacteur' check (role in ('admin','redacteur')),
  cree_le timestamptz not null default now()
);

-- categories : remplace config/categories.json
create table public.categories (
  slug text primary key,
  nom text not null,
  ordre int not null default 0
);

-- articles
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  slug text not null unique,
  categorie text not null references public.categories(slug),
  auteur_id uuid not null references public.profiles(id),
  corps text not null default '',
  excerpt text not null default '',
  image_couverture text not null default '',
  seo_titre text not null default '',
  seo_description text not null default '',
  og_image text not null default '',
  mots_cles text[] not null default '{}',
  statut text not null default 'brouillon'
    check (statut in ('brouillon','en_attente','programme','publie')),
  date_programmee timestamptz,
  date_publication timestamptz,
  commentaire_relecture text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index articles_statut_idx on public.articles(statut);
create index articles_categorie_idx on public.articles(categorie);

-- media
create table public.media (
  id uuid primary key default gen_random_uuid(),
  chemin text not null,
  url text not null,
  importe_par uuid references public.profiles(id),
  cree_le timestamptz not null default now()
);

-- seed catégories (repris de config/categories.json)
insert into public.categories(slug,nom,ordre) values
  ('politique','Politique',1),('economie','Économie',2),('societe','Société',3),
  ('culture','Culture',4),('sport','Sport',5),('diaspora','Diaspora',6),
  ('monde','Monde',7),('tourisme','Tourisme',8),('annonces','Annonces',9);
```

- [ ] **Step 2: Appliquer et vérifier en local**

```bash
npx supabase migration up
```
Expected: migration appliquée sans erreur ; `npx supabase db reset` recharge le seed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat(db): schéma initial (profiles, categories, articles, media)"
```

### Task 2: Trigger de création de profil + `maj_le`

**Files:**
- Create: `supabase/migrations/0002_triggers.sql`

**Interfaces:**
- Produces: création auto d'une ligne `profiles` à chaque nouvel utilisateur Auth ; `maj_le` tenu à jour.

- [ ] **Step 1: Écrire la migration**

```sql
-- profil auto à la création d'un utilisateur Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, nom) values (new.id, coalesce(new.raw_user_meta_data->>'nom',''));
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- maj_le auto
create or replace function public.touch_maj_le()
returns trigger language plpgsql as $$
begin new.maj_le = now(); return new; end $$;
create trigger articles_touch_maj_le
  before update on public.articles for each row execute function public.touch_maj_le();
```

- [ ] **Step 2: Appliquer et tester**

```bash
npx supabase migration up
```
Expected: OK. Vérifier via un insert de test dans `auth.users` (studio local) qu'une ligne `profiles` apparaît.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_triggers.sql
git commit -m "feat(db): trigger profil auto + maj_le"
```

### Task 3: Politiques RLS

**Files:**
- Create: `supabase/migrations/0003_rls.sql`

**Interfaces:**
- Produces: RLS conforme spec §5. Helper `public.is_admin()`.

- [ ] **Step 1: Écrire la migration**

```sql
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.media enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- categories : lecture connectés, écriture admin
create policy categories_read on public.categories for select using (auth.uid() is not null);
create policy categories_admin_write on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- articles
create policy articles_admin_all on public.articles for all
  using (public.is_admin()) with check (public.is_admin());
create policy articles_writer_read on public.articles for select
  using (auteur_id = auth.uid());
create policy articles_writer_insert on public.articles for insert
  with check (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));
create policy articles_writer_update on public.articles for update
  using (auteur_id = auth.uid() and statut in ('brouillon','en_attente'))
  with check (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));
create policy articles_writer_delete on public.articles for delete
  using (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));

-- media : lecture connectés, insert éditeurs, delete auteur/admin
create policy media_read on public.media for select using (auth.uid() is not null);
create policy media_insert on public.media for insert with check (importe_par = auth.uid());
create policy media_delete on public.media for delete
  using (importe_par = auth.uid() or public.is_admin());
```

- [ ] **Step 2: Appliquer**

```bash
npx supabase migration up
```
Expected: OK.

- [ ] **Step 3: Test RLS scripté (rédacteur ne peut pas publier)**

Create `test/rls.test.mjs` — utilise deux clients (anon+session simulée) sur l'instance locale. Marqué `{ skip: !process.env.SUPABASE_URL }` pour ne pas casser la CI sans instance.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
test('un rédacteur ne peut pas passer un article en publie', { skip: !URL }, async () => {
  const admin = createClient(URL, SR);
  // créer un user rédacteur + article brouillon via service_role, puis tenter update en session rédacteur
  // (détails d'auth: signUp via admin.auth.admin.createUser, signInWithPassword côté client anon)
  // assert que l'update statut='publie' est refusé (data null / error non nul)
  assert.ok(true); // squelette : compléter avec l'appel réel
});
```

- [ ] **Step 4: Compléter le test avec l'appel réel et vérifier qu'il échoue puis passe**

Run: `SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node --test test/rls.test.mjs`
Expected: PASS (le refus RLS est bien constaté).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_rls.sql test/rls.test.mjs
git commit -m "feat(db): RLS admin/rédacteur + test refus publication rédacteur"
```

### Task 4: Bucket Storage `medias`

**Files:**
- Create: `supabase/migrations/0004_storage.sql`

- [ ] **Step 1: Écrire la migration**

```sql
insert into storage.buckets (id, name, public) values ('medias','medias', true)
  on conflict (id) do nothing;
create policy medias_public_read on storage.objects for select using (bucket_id = 'medias');
create policy medias_auth_insert on storage.objects for insert
  with check (bucket_id = 'medias' and auth.uid() is not null);
```

- [ ] **Step 2: Appliquer + Commit**

```bash
npx supabase migration up
git add supabase/migrations/0004_storage.sql
git commit -m "feat(db): bucket Storage medias (lecture publique, upload authentifié)"
```

---

## Phase 2 — Chargeur Supabase pour le build

### Task 5: Module `supabase-source.mjs` (mapping DB → forme article)

**Files:**
- Create: `build/lib/supabase-source.mjs`
- Test: `test/supabase-source.test.mjs`

**Interfaces:**
- Consumes: `@supabase/supabase-js`.
- Produces:
  - `mapRow(row) → { title, slug, category, author, date, image, excerpt, status, body, seoTitle, seoDescription, ogImage, keywords }`
  - `async loadArticlesFromSupabase(client, nowISO) → Article[]` (publiés + programmés échus).

- [ ] **Step 1: Test de `mapRow` (fonction pure)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRow } from '../build/lib/supabase-source.mjs';

test('mapRow convertit une ligne DB en article de la forme attendue', () => {
  const row = {
    titre: 'T', slug: 's', categorie: 'sport', corps: '# Hi', excerpt: 'e',
    image_couverture: 'medias/a.webp', seo_titre: 'S', seo_description: 'D',
    og_image: 'medias/og.webp', mots_cles: ['a','b'], statut: 'publie',
    date_publication: '2026-06-12T10:00:00Z',
    profiles: { nom: 'Comoresnews' },
  };
  const a = mapRow(row);
  assert.equal(a.title, 'T');
  assert.equal(a.category, 'sport');
  assert.equal(a.author, 'Comoresnews');
  assert.equal(a.date, '2026-06-12');
  assert.equal(a.image, 'medias/a.webp');
  assert.equal(a.status, 'published'); // statut DB mappé vers vocabulaire build
  assert.deepEqual(a.keywords, ['a','b']);
  assert.equal(a.body, '# Hi');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/supabase-source.test.mjs`
Expected: FAIL (`mapRow` non défini).

- [ ] **Step 3: Implémenter `mapRow` + `loadArticlesFromSupabase`**

```js
import { createClient } from '@supabase/supabase-js';

const STATUT_TO_BUILD = { publie: 'published', programme: 'scheduled', brouillon: 'draft', en_attente: 'draft' };

export function mapRow(row) {
  const rawDate = row.date_publication || row.date_programmee || row.cree_le;
  return {
    title: String(row.titre),
    slug: String(row.slug),
    category: String(row.categorie),
    author: String(row.profiles?.nom || 'Comoresnews'),
    date: String(rawDate).slice(0, 10),
    image: row.image_couverture || '',
    excerpt: row.excerpt || '',
    status: STATUT_TO_BUILD[row.statut] || 'draft',
    body: row.corps || '',
    seoTitle: row.seo_titre || '',
    seoDescription: row.seo_description || '',
    ogImage: row.og_image || '',
    keywords: Array.isArray(row.mots_cles) ? row.mots_cles : [],
  };
}

export function makeClient(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadArticlesFromSupabase(client, nowISO) {
  const { data, error } = await client
    .from('articles')
    .select('*, profiles!articles_auteur_id_fkey(nom)')
    .in('statut', ['publie', 'programme']);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data.map(mapRow).filter(a => {
    if (a.status === 'published') return true;
    if (a.status === 'scheduled') return a.date <= nowISO; // filet, le cron gère normalement
    return false;
  });
}
```

- [ ] **Step 4: Vérifier le test unitaire de `mapRow`**

Run: `node --test test/supabase-source.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add build/lib/supabase-source.mjs test/supabase-source.test.mjs
git commit -m "feat(build): chargeur Supabase (mapRow + loadArticlesFromSupabase)"
```

### Task 6: Sélecteur de source dans `generate.mjs`

**Files:**
- Modify: `build/generate.mjs` (bloc de chargement des articles, ~lignes 1-8 imports et l'appel `loadArticles`)

**Interfaces:**
- Consumes: `loadArticlesFromSupabase`, `makeClient` (Task 5) ; `loadArticles` (existant).
- Produces: variable `articles` identique quelle que soit la source.

- [ ] **Step 1: Ajouter l'import et la sélection de source**

Remplacer l'appel direct à `loadArticles(...)` par :

```js
import { makeClient, loadArticlesFromSupabase } from './lib/supabase-source.mjs';

const nowISO = new Date().toISOString().slice(0, 10);
const validCats = Object.keys(cats);
let articles;
if (process.env.CONTENT_SOURCE === 'supabase') {
  articles = await loadArticlesFromSupabase(makeClient(), nowISO);
} else {
  articles = loadArticles(path.join(ROOT, 'content/articles'), validCats)
    .filter(a => isPublishable(a, nowISO));
}
```

(Adapter selon le code exact : si `generate.mjs` n'est pas déjà `async`/top-level-await, envelopper le corps dans une IIFE `await`.)

- [ ] **Step 2: Test — build en mode files inchangé**

```bash
CONTENT_SOURCE=files node build/generate.mjs && node --test
```
Expected: site généré comme avant, 10 articles, tous les tests existants PASS.

- [ ] **Step 3: Test — build en mode supabase (instance locale seedée)**

```bash
CONTENT_SOURCE=supabase SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node build/generate.mjs
```
Expected: site généré depuis la base (après migration Task 9, sinon 0 article — OK à ce stade).

- [ ] **Step 4: Commit**

```bash
git add build/generate.mjs
git commit -m "feat(build): sélecteur de source articles (files|supabase) via CONTENT_SOURCE"
```

---

## Phase 3 — SEO au build

### Task 7: Module SEO `seo.mjs` (fonctions pures)

**Files:**
- Create: `build/lib/seo.mjs`
- Test: `test/seo.test.mjs`

**Interfaces:**
- Produces:
  - `metaTags(a, url) → string` (meta description, OpenGraph, Twitter, keywords)
  - `jsonLdArticle(a, url) → string` (`<script type="application/ld+json">`)
  - `sitemapXml(entries) → string` où `entries = [{loc, lastmod}]`.

- [ ] **Step 1: Écrire les tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { metaTags, jsonLdArticle, sitemapXml } from '../build/lib/seo.mjs';

const a = { title:'Titre', excerpt:'Résumé', seoTitle:'SEO', seoDescription:'Desc', ogImage:'og.webp', image:'c.webp', keywords:['x','y'], date:'2026-06-12', author:'Comoresnews', category:'sport' };

test('metaTags: description SEO prioritaire + OG image', () => {
  const html = metaTags(a, 'https://comoresnews.com/a/');
  assert.match(html, /name="description" content="Desc"/);
  assert.match(html, /property="og:image" content="https:\/\/comoresnews.com\/og.webp"/);
  assert.match(html, /name="keywords" content="x, y"/);
});
test('metaTags: fallback excerpt si pas de seoDescription', () => {
  const html = metaTags({ ...a, seoDescription:'' }, 'https://c.com/a/');
  assert.match(html, /name="description" content="Résumé"/);
});
test('jsonLdArticle contient le type Article et le titre', () => {
  const s = jsonLdArticle(a, 'https://c.com/a/');
  assert.match(s, /"@type":"Article"/);
  assert.match(s, /Titre/);
});
test('sitemapXml liste les URLs', () => {
  const xml = sitemapXml([{ loc:'https://c.com/', lastmod:'2026-06-12' }]);
  assert.match(xml, /<loc>https:\/\/c.com\/<\/loc>/);
  assert.match(xml, /<\?xml/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/seo.test.mjs`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter `seo.mjs`**

```js
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function abs(base, p){ if(!p) return ''; return /^https?:/.test(p) ? p : base.replace(/\/$/,'') + '/' + String(p).replace(/^\//,''); }

export function metaTags(a, url){
  const desc = a.seoDescription || a.excerpt || '';
  const title = a.seoTitle || a.title;
  const img = abs(new URL(url).origin, a.ogImage || a.image);
  const kw = (a.keywords||[]).join(', ');
  return [
    `<meta name="description" content="${esc(desc)}">`,
    kw ? `<meta name="keywords" content="${esc(kw)}">` : '',
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    img ? `<meta property="og:image" content="${esc(img)}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n');
}

export function jsonLdArticle(a, url){
  const img = abs(new URL(url).origin, a.ogImage || a.image);
  const data = {
    '@context':'https://schema.org','@type':'Article',
    headline:a.seoTitle||a.title, image:img?[img]:undefined,
    datePublished:a.date, author:{'@type':'Organization',name:a.author||'Comoresnews'},
    publisher:{'@type':'Organization',name:'Comoresnews'}, mainEntityOfPage:url,
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

export function sitemapXml(entries){
  const urls = entries.map(e => `  <url><loc>${e.loc}</loc>${e.lastmod?`<lastmod>${e.lastmod}</lastmod>`:''}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
```

- [ ] **Step 4: Vérifier les tests**

Run: `node --test test/seo.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add build/lib/seo.mjs test/seo.test.mjs
git commit -m "feat(build): SEO (meta/OpenGraph, JSON-LD Article, sitemap)"
```

### Task 8: Injecter le SEO dans les pages + écrire `sitemap.xml`

**Files:**
- Modify: `build/generate.mjs` (`buildArticlePage` : injecter `metaTags`+`jsonLdArticle` dans le `<head>` ; fin de build : écrire `_site/sitemap.xml`)
- Modify: `templates/article.html` (ajouter un marqueur `{{SEO}}` dans `<head>` si nécessaire)

**Interfaces:**
- Consumes: `metaTags`, `jsonLdArticle`, `sitemapXml` (Task 7) ; `SITE_BASE_URL` (env, défaut `https://comoresnews.com`).

- [ ] **Step 1: Ajouter le marqueur `{{SEO}}` dans le `<head>` de `templates/article.html`**

Juste avant `</head>`, insérer une ligne `{{SEO}}`.

- [ ] **Step 2: Injecter dans `buildArticlePage`**

Dans `applyTemplate(TPL('article.html'), { ... })`, ajouter la clé :
```js
SEO: metaTags(a, base + '/' + rel) + '\n' + jsonLdArticle(a, base + '/' + rel),
```
avec `const base = (process.env.SITE_BASE_URL||'https://comoresnews.com').replace(/\/$/,'');` en tête de fichier.

- [ ] **Step 3: Écrire le sitemap en fin de build**

Après la génération des pages :
```js
const entries = [{loc: base+'/', lastmod: nowISO}]
  .concat(Object.keys(cats).map(s => ({loc: base+'/'+categoryPath(s), lastmod: nowISO})))
  .concat(articles.map(a => ({loc: base+'/'+articlePath(a.date,a.slug), lastmod: a.date})));
fs.writeFileSync(path.join(ROOT,'_site','sitemap.xml'), sitemapXml(entries));
```

- [ ] **Step 4: Test de génération**

```bash
CONTENT_SOURCE=files node build/generate.mjs
grep -q 'property="og:title"' _site/index.php/*/*/*/*/index.html && echo OK-META
test -f _site/sitemap.xml && echo OK-SITEMAP
```
Expected: `OK-META` et `OK-SITEMAP`.

- [ ] **Step 5: Commit**

```bash
git add build/generate.mjs templates/article.html
git commit -m "feat(build): injection SEO dans les articles + sitemap.xml"
```

---

## Phase 4 — Migration du contenu existant

### Task 9: Script `migrate-to-supabase.mjs`

**Files:**
- Create: `scripts/migrate-to-supabase.mjs`
- Test: `test/migrate-map.test.mjs` (partie pure : mapping fiche→ligne DB)

**Interfaces:**
- Consumes: `parseArticle` (existant), `@supabase/supabase-js` (service_role).
- Produces: `ficheToRow(article, auteurId) → row` (pur) ; script d'upsert idempotent.

- [ ] **Step 1: Test de `ficheToRow`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ficheToRow } from '../scripts/migrate-to-supabase.mjs';

test('ficheToRow mappe une fiche vers une ligne articles publiée', () => {
  const a = { title:'T', slug:'s', category:'sport', author:'Comoresnews', date:'2026-06-12', image:'wp-content/uploads/x.png', excerpt:'e', status:'published', body:'# b' };
  const r = ficheToRow(a, 'uid-1');
  assert.equal(r.titre,'T'); assert.equal(r.slug,'s'); assert.equal(r.categorie,'sport');
  assert.equal(r.statut,'publie'); assert.equal(r.auteur_id,'uid-1');
  assert.equal(r.date_publication.slice(0,10),'2026-06-12');
});
```

- [ ] **Step 2: Vérifier l'échec puis implémenter**

```js
import 'dotenv/config';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadArticles } from '../build/lib/content.mjs';
import fs from 'node:fs';

export function ficheToRow(a, auteurId){
  return {
    titre:a.title, slug:a.slug, categorie:a.category, auteur_id:auteurId,
    corps:a.body, excerpt:a.excerpt, image_couverture:a.image,
    seo_titre:'', seo_description:a.excerpt, og_image:a.image, mots_cles:[],
    statut:'publie', date_publication:new Date(a.date+'T08:00:00Z').toISOString(),
  };
}

async function main(){
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
  // 1. compte auteur par défaut
  const email='redaction@comoresnews.com';
  let { data: users } = await sb.auth.admin.listUsers();
  let auteur = users.users.find(u=>u.email===email);
  if(!auteur){ auteur = (await sb.auth.admin.createUser({email, email_confirm:true, user_metadata:{nom:'Comoresnews'}})).data.user; }
  const auteurId = auteur.id;
  // 2. articles + images
  const cats = Object.keys(JSON.parse(fs.readFileSync('config/categories.json','utf8')));
  const arts = loadArticles(path.join(process.cwd(),'content/articles'), cats);
  for(const a of arts){
    if(a.image && fs.existsSync(a.image)){
      const buf = fs.readFileSync(a.image);
      const dest = 'medias/'+path.basename(a.image);
      await sb.storage.from('medias').upload(path.basename(a.image), buf, { upsert:true, contentType:'image/png' });
      a.image = dest;
    }
    const { error } = await sb.from('articles').upsert(ficheToRow(a, auteurId), { onConflict:'slug' });
    if(error) throw new Error(`${a.slug}: ${error.message}`);
    console.log('OK', a.slug);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```
(Ajouter `dotenv` en devDependency, ou charger `.env` manuellement.)

- [ ] **Step 3: Vérifier le test pur**

Run: `node --test test/migrate-map.test.mjs`
Expected: PASS.

- [ ] **Step 4: Exécuter la migration réelle (instance cible)**

```bash
node scripts/migrate-to-supabase.mjs
```
Expected: `OK <slug>` × 10. Vérifier dans le studio Supabase : 10 articles `publie`, images dans le bucket.

- [ ] **Step 5: Vérifier build depuis Supabase**

```bash
CONTENT_SOURCE=supabase node build/generate.mjs
```
Expected: 10 articles générés, identiques au mode files (comparer le nombre de pages).

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-to-supabase.mjs test/migrate-map.test.mjs package.json
git commit -m "feat(migration): import des 10 articles Markdown vers Supabase"
```

---

## Phase 5 — Back-office `/admin` Supabase

### Task 10: Module logique `admin/lib.mjs` (mappers + validation DB)

**Files:**
- Modify: `admin/lib.mjs` (ajouter fonctions ; garder `slugify` existant)
- Test: `test/admin-lib.test.mjs` (nouveau, cible les nouvelles fonctions)

**Interfaces:**
- Produces:
  - `validateArticleDB(form) → string[]` (liste d'erreurs ; vide si OK)
  - `formToRow(form, auteurId) → row` (statut selon action)
  - `nextStatus(action, dateProgrammee) → 'brouillon'|'en_attente'|'programme'|'publie'`

- [ ] **Step 1: Tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArticleDB, nextStatus } from '../admin/lib.mjs';

test('validateArticleDB signale titre et catégorie manquants', () => {
  const errs = validateArticleDB({ titre:'', categorie:'', corps:'x' });
  assert.ok(errs.includes('titre'));
  assert.ok(errs.includes('categorie'));
});
test('nextStatus mappe les actions', () => {
  assert.equal(nextStatus('brouillon'), 'brouillon');
  assert.equal(nextStatus('soumettre'), 'en_attente');
  assert.equal(nextStatus('publier'), 'publie');
  assert.equal(nextStatus('programmer','2026-09-01T10:00:00Z'), 'programme');
});
```

- [ ] **Step 2: Vérifier l'échec puis implémenter dans `admin/lib.mjs`**

```js
export function validateArticleDB(f){
  const errs=[];
  if(!f.titre?.trim()) errs.push('titre');
  if(!f.categorie?.trim()) errs.push('categorie');
  if(!f.corps?.trim()) errs.push('corps');
  return errs;
}
export function nextStatus(action, dateProgrammee){
  if(action==='soumettre') return 'en_attente';
  if(action==='publier') return 'publie';
  if(action==='programmer') return 'programme';
  return 'brouillon';
}
export function formToRow(f, auteurId){
  const statut = nextStatus(f.action, f.date_programmee);
  return {
    titre:f.titre, slug:f.slug, categorie:f.categorie, auteur_id:auteurId,
    corps:f.corps, excerpt:f.excerpt||'', image_couverture:f.image_couverture||'',
    seo_titre:f.seo_titre||'', seo_description:f.seo_description||'',
    og_image:f.og_image||'', mots_cles:f.mots_cles||[],
    statut,
    date_programmee: statut==='programme' ? f.date_programmee : null,
    date_publication: statut==='publie' ? new Date().toISOString() : null,
  };
}
```

- [ ] **Step 3: Vérifier les tests + Commit**

```bash
node --test test/admin-lib.test.mjs
git add admin/lib.mjs test/admin-lib.test.mjs
git commit -m "feat(admin): logique DB (validation, mapping form→row, statuts)"
```

### Task 11: Client Supabase `admin/supabase.mjs`

**Files:**
- Create: `admin/supabase.mjs`
- Create: `admin/vendor/supabase.js` (bundle UMD/ESM de `@supabase/supabase-js` vendoré, comme markdown-it l'est déjà)

**Interfaces:**
- Produces: `makeAdminClient(url, anonKey)`, et fonctions `signIn`, `signOut`, `currentProfile`, `listArticles(filter)`, `getArticle(id)`, `saveArticle(row)`, `deleteArticle(id)`, `uploadMedia(file)`, `listMedia()`, `listCategories()`, `inviteUser(email)`, `setRole(id,role)`. Chaque fonction encapsule un appel supabase-js et renvoie `{data,error}`.

- [ ] **Step 1: Vendoriser le client**

Télécharger le build ESM de `@supabase/supabase-js` dans `admin/vendor/supabase.js` (même approche que `admin/vendor/` pour markdown-it). Config `URL`/`ANON_KEY` injectées dans `admin/index.html` (valeurs publiques anon — OK côté navigateur).

- [ ] **Step 2: Implémenter les wrappers** (un fichier fin, pas de logique métier — la logique testable est dans `lib.mjs`).

- [ ] **Step 3: Commit**

```bash
git add admin/supabase.mjs admin/vendor/supabase.js
git commit -m "feat(admin): client Supabase (auth + CRUD articles/media/users)"
```

### Task 12: Réécriture de l'UI `admin/index.html`

**Files:**
- Modify: `admin/index.html` (remplacer l'auth GitHub par Supabase + écrans workflow)

**Interfaces:**
- Consumes: `admin/supabase.mjs`, `admin/lib.mjs`.

- [ ] **Step 1: Écran connexion** (email/mot de passe + « mot de passe oublié » via `supabase.auth.resetPasswordForEmail`).

- [ ] **Step 2: Liste articles** — rédacteur voit les siens ; admin voit tout + onglet « En attente ». Filtres statut/catégorie.

- [ ] **Step 3: Éditeur article** — champs titre/slug/catégorie/corps Markdown + aperçu (markdown-it vendoré), excerpt, image de couverture (upload → `uploadMedia`), champs SEO (seo_titre, seo_description, og_image, mots_cles), date de programmation. Boutons selon rôle via `nextStatus`/`formToRow`.

- [ ] **Step 4: Médiathèque** — grille des images (`listMedia`), upload drag-drop, insertion dans le corps/couverture.

- [ ] **Step 5: (admin) Utilisateurs** — inviter (`inviteUser`), changer rôle (`setRole`). **(admin) Catégories** — CRUD `categories`.

- [ ] **Step 6: Vérification manuelle en local** (instance Supabase locale) : login, création brouillon rédacteur, soumission, validation admin, upload image, programmation.

- [ ] **Step 7: Commit**

```bash
git add admin/index.html
git commit -m "feat(admin): UI Supabase (login, workflow, médiathèque, users, catégories)"
```

---

## Phase 6 — Déclenchement du build & programmation

### Task 13: Edge Function `trigger-deploy` + appel à la publication

**Files:**
- Create: `supabase/functions/trigger-deploy/index.ts`

**Interfaces:**
- Produces: endpoint qui appelle `VERCEL_DEPLOY_HOOK_URL` (secret stocké côté Supabase, jamais exposé au client). Appelé par le back-office après une action de publication/validation/suppression via `supabase.functions.invoke('trigger-deploy')`.

- [ ] **Step 1: Écrire la fonction**

```ts
Deno.serve(async () => {
  const url = Deno.env.get('VERCEL_DEPLOY_HOOK_URL');
  if (!url) return new Response('missing hook', { status: 500 });
  await fetch(url, { method: 'POST' });
  return new Response('ok');
});
```

- [ ] **Step 2: Déployer + configurer le secret**

```bash
npx supabase functions deploy trigger-deploy
npx supabase secrets set VERCEL_DEPLOY_HOOK_URL=<url du deploy hook Vercel>
```
(Le Deploy Hook se crée dans Vercel → Project → Settings → Git → Deploy Hooks.)

- [ ] **Step 3: Brancher l'appel dans le back-office** (après publier/valider/supprimer) et vérifier qu'un rebuild se déclenche.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/trigger-deploy/index.ts
git commit -m "feat(deploy): Edge Function trigger-deploy (Deploy Hook Vercel)"
```

### Task 14: Publication programmée (cron)

**Files:**
- Create: `supabase/functions/publish-scheduled/index.ts`
- Create: `supabase/migrations/0005_cron.sql`

**Interfaces:**
- Produces: fonction qui passe en `publie` les articles `programme` échus puis appelle `trigger-deploy` ; planifiée via pg_cron toutes les 15 min.

- [ ] **Step 1: Écrire l'Edge Function** (service_role) : `update articles set statut='publie', date_publication=now() where statut='programme' and date_programmee<=now()`, puis `fetch(VERCEL_DEPLOY_HOOK_URL)` si au moins une ligne modifiée.

- [ ] **Step 2: Planifier via pg_cron**

```sql
select cron.schedule('publish-scheduled', '*/15 * * * *', $$
  select net.http_post(url := '<url edge function publish-scheduled>',
    headers := '{"Authorization":"Bearer <anon-or-service>"}'::jsonb) $$);
```
(Activer les extensions `pg_cron` et `pg_net` dans le studio Supabase.)

- [ ] **Step 3: Test** — créer un article `programme` avec `date_programmee` dans le passé, déclencher la fonction manuellement, vérifier passage en `publie` + rebuild.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/publish-scheduled/index.ts supabase/migrations/0005_cron.sql
git commit -m "feat(deploy): cron de publication programmée (15 min)"
```

---

## Phase 7 — Bascule production

### Task 15: Configuration Vercel & bascule `CONTENT_SOURCE=supabase`

**Files:**
- Modify: `vercel.json` (rien à changer sur `buildCommand`/`outputDirectory` ; vérifier)
- Modify: `README.md` (documenter le nouveau flux)

- [ ] **Step 1: Variables d'env Vercel** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_BASE_URL=https://comoresnews.com`, `CONTENT_SOURCE=supabase`. (Via dashboard Vercel — action utilisateur.)

- [ ] **Step 2: Déploiement test** — déclencher un build, vérifier que le site en ligne provient bien de Supabase (10 articles, SEO présent, sitemap accessible sur `/sitemap.xml`).

- [ ] **Step 3: Recette end-to-end** — publier un nouvel article via `/admin`, vérifier rebuild + mise en ligne < 3 min, catégorie correcte, meta OG (test partage), programmation.

- [ ] **Step 4: Retrait de l'ancien `/admin` GitHub** — une fois validé, supprimer `admin/github.mjs` et l'ancienne UI GitHub ; retirer les fiches `content/articles/*.md` du dépôt (contenu désormais dans Supabase). Conserver `build/lib/content.mjs` tant que le mode `files` sert de secours, sinon le retirer.

- [ ] **Step 5: Mettre à jour la doc + Commit**

```bash
git add README.md vercel.json
git commit -m "docs+chore: bascule CMS vers Supabase (CONTENT_SOURCE=supabase)"
```

- [ ] **Step 6: Mettre à jour la mémoire projet** — noter la bascule Supabase dans `comoresnews-project.md`.

---

## Self-review (couverture de la spec)

- Comptes éditeurs simples → Task 2 (trigger profil), Task 11/12 (login, invitation). ✅
- Workflow validation (brouillon→en_attente→publie, renvoi commenté, programmé) → Task 1 (statuts), Task 10 (`nextStatus`), Task 12 (UI). ✅
- Back-office riche (médiathèque, filtres, users, catégories) → Task 11/12. ✅
- SEO complet + sitemap + JSON-LD → Task 7/8. ✅
- Images en médiathèque Storage → Task 4, Task 11 (`uploadMedia`), Task 9 (import). ✅
- Site statique régénéré depuis la base → Task 5/6, Task 13/14. ✅
- Sécurité RLS + service_role côté serveur → Task 3, Global Constraints. ✅
- Migration des 10 articles → Task 9. ✅
- Routage catégories (onglets dédiés) → réutilise `buildCategoryPage` existant, alimenté par la nouvelle source (Task 6). ✅
- Bascule progressive avec filet → flag `CONTENT_SOURCE`, ancien `/admin` gardé (Task 6, Task 15). ✅
