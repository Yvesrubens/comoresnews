# CMS Phase 2 — Back-office /admin — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Une page `/admin` statique permettant de rédiger et publier un nouvel article (fiche `.md` + image) via l'API GitHub, déclenchant le rebuild automatique.

**Architecture:** Page autonome (HTML/CSS/JS inline) dans `admin/`. Logique pure isolée dans `admin/lib.mjs` (testée), client API dans `admin/github.mjs`, rendu Markdown vendoré. Publication = `PUT contents` sur `main` → workflow Phase 1 → déploiement.

**Tech Stack:** JS navigateur (ES modules), `node:test` pour les fonctions pures, `markdown-it` vendoré (copié de `node_modules`), API GitHub Contents.

## Global Constraints

- Aucune dépendance chargée depuis un CDN : tout est embarqué/vendoré dans `admin/`.
- Le jeton GitHub reste dans `localStorage` du navigateur, jamais dans le dépôt.
- Le frontmatter produit doit correspondre EXACTEMENT aux champs attendus par `build/lib/content.mjs` : `title, slug, category, author, date, image, excerpt, status`.
- Catégories : lues depuis `config/categories.json` (9 valeurs).
- Dépôt cible : `Yvesrubens/comoresnews`, branche `main`.
- Slug : `[a-z0-9-]+`. URL article : `index.php/<AAAA>/<MM>/<JJ>/<slug>/index.html`.
- Création uniquement (édition/suppression/programmation = Phase 3).

---

## Structure des fichiers

- `admin/lib.mjs` — fonctions pures : `slugify`, `buildFrontmatter`, `imageUploadPath`, `validateArticle`, `articleUrl`.
- `admin/github.mjs` — client API : `getRepo`, `fileExists`, `putFile` (prend `fetch` en paramètre pour testabilité).
- `admin/vendor/markdown-it.min.js` — rendu Markdown embarqué.
- `admin/index.html` — page : écran auth + formulaire + aperçu + publication.
- `build/generate.mjs` — ajouter `admin` au tableau `PASSTHROUGH`.
- `test/admin-lib.test.mjs`, `test/admin-github.test.mjs` — tests.

---

### Task 1: Fonctions pures (`admin/lib.mjs`)

**Files:**
- Create: `admin/lib.mjs`
- Test: `test/admin-lib.test.mjs`

**Interfaces:**
- Produces:
  - `slugify(str)` → slug `[a-z0-9-]+` (minuscules, accents retirés, espaces→`-`).
  - `articleUrl(date, slug)` → `"index.php/<AAAA>/<MM>/<JJ>/<slug>/index.html"`.
  - `imageUploadPath(date, filename)` → `"wp-content/uploads/<AAAA>/<MM>/<filename-slugifié>"`.
  - `buildFrontmatter(a)` → chaîne fiche Markdown (frontmatter + `\n\n` + body).
  - `validateArticle(a)` → `{ok:true}` ou `{ok:false, errors:[...]}`.

- [ ] **Step 1: Écrire les tests**

```js
// test/admin-lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, articleUrl, imageUploadPath, buildFrontmatter, validateArticle } from '../admin/lib.mjs';

test('slugify', () => {
  assert.equal(slugify('La Vanille d’Anjouan : trésor !'), 'la-vanille-danjouan-tresor');
  assert.equal(slugify('  Éléphant   blanc '), 'elephant-blanc');
});
test('articleUrl', () => {
  assert.equal(articleUrl('2026-07-08', 'mon-slug'), 'index.php/2026/07/08/mon-slug/index.html');
});
test('imageUploadPath slugifie le nom', () => {
  assert.equal(imageUploadPath('2026-07-08', 'Ma Photo.PNG'), 'wp-content/uploads/2026/07/ma-photo.png');
});
test('buildFrontmatter contient les champs et le corps', () => {
  const s = buildFrontmatter({ title:'T"itre', slug:'s', category:'sport', author:'A', date:'2026-07-08', image:'wp-content/x.png', excerpt:'e', body:'Corps.' });
  assert.match(s, /^---\n/);
  assert.match(s, /category: sport/);
  assert.match(s, /status: published/);
  assert.match(s, /\n\nCorps\.\n?$/);
});
test('validateArticle rejette champs vides', () => {
  assert.equal(validateArticle({ title:'', slug:'s', category:'sport', body:'b' }).ok, false);
  assert.equal(validateArticle({ title:'T', slug:'bad slug', category:'sport', body:'b' }).ok, false);
  assert.equal(validateArticle({ title:'T', slug:'ok-slug', category:'sport', body:'b' }).ok, true);
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/admin-lib.test.mjs`
Expected: FAIL (module introuvable)

- [ ] **Step 3: Implémenter `admin/lib.mjs`**

```js
export function slugify(str) {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
export function articleUrl(date, slug) {
  const [y, m, d] = date.split('-');
  return `index.php/${y}/${m}/${d}/${slug}/index.html`;
}
export function imageUploadPath(date, filename) {
  const [y, m] = date.split('-');
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : 'png';
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename);
  return `wp-content/uploads/${y}/${m}/${base}.${ext}`;
}
export function buildFrontmatter(a) {
  const q = (s) => JSON.stringify(String(s ?? ''));
  return `---\ntitle: ${q(a.title)}\nslug: ${a.slug}\ncategory: ${a.category}\n`
    + `author: ${a.author || 'Comoresnews'}\ndate: ${a.date}\nimage: ${a.image || ''}\n`
    + `excerpt: ${q(a.excerpt)}\nstatus: published\n---\n\n${(a.body || '').trim()}\n`;
}
export function validateArticle(a) {
  const errors = [];
  if (!a.title?.trim()) errors.push('Titre requis');
  if (!/^[a-z0-9-]+$/.test(a.slug || '')) errors.push('Slug invalide (a-z, 0-9, tirets)');
  if (!a.category) errors.push('Catégorie requise');
  if (!a.body?.trim()) errors.push('Corps requis');
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/admin-lib.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add admin/lib.mjs test/admin-lib.test.mjs
git commit -m "feat(admin): fonctions pures (slugify, frontmatter, validation, urls)"
```

---

### Task 2: Client API GitHub (`admin/github.mjs`)

**Files:**
- Create: `admin/github.mjs`
- Test: `test/admin-github.test.mjs`

**Interfaces:**
- Consumes: un `fetch` injecté (pour testabilité).
- Produces:
  - `ghClient({ token, repo, fetchImpl })` → objet `{ getRepo(), fileExists(path), putFile(path, contentBase64, message) }`.
  - `toBase64(str)` / helper d'encodage UTF-8 → base64.

- [ ] **Step 1: Écrire les tests (avec fetch simulé)**

```js
// test/admin-github.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghClient } from '../admin/github.mjs';

function fakeFetch(routes) {
  return async (url, opts = {}) => {
    const key = `${opts.method || 'GET'} ${url}`;
    const r = routes[key];
    if (!r) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: r.status < 400, status: r.status, json: async () => r.body || {} };
  };
}

test('getRepo appelle la bonne URL', async () => {
  const gh = ghClient({ token: 't', repo: 'o/r', fetchImpl:
    fakeFetch({ 'GET https://api.github.com/repos/o/r': { status: 200, body: { full_name: 'o/r' } } }) });
  const r = await gh.getRepo();
  assert.equal(r.full_name, 'o/r');
});

test('fileExists true/false', async () => {
  const gh = ghClient({ token: 't', repo: 'o/r', fetchImpl:
    fakeFetch({ 'GET https://api.github.com/repos/o/r/contents/x.md': { status: 200, body: { sha: 'abc' } } }) });
  assert.equal(await gh.fileExists('x.md'), true);
  assert.equal(await gh.fileExists('absent.md'), false);
});

test('putFile envoie PUT avec message et contenu', async () => {
  let captured;
  const fetchImpl = async (url, opts) => { captured = { url, opts }; return { ok: true, status: 201, json: async () => ({ content: { path: 'content/articles/s.md' } }) }; };
  const gh = ghClient({ token: 't', repo: 'o/r', fetchImpl });
  await gh.putFile('content/articles/s.md', 'BASE64', 'Publication: T');
  assert.match(captured.url, /contents\/content\/articles\/s\.md$/);
  assert.equal(captured.opts.method, 'PUT');
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.message, 'Publication: T');
  assert.equal(body.content, 'BASE64');
  assert.equal(body.branch, 'main');
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/admin-github.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implémenter `admin/github.mjs`**

```js
export function ghClient({ token, repo, fetchImpl = fetch, branch = 'main' }) {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  return {
    async getRepo() {
      const r = await fetchImpl(base, { headers });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      return r.json();
    },
    async fileExists(path) {
      const r = await fetchImpl(`${base}/contents/${path}`, { headers });
      return r.ok;
    },
    async putFile(path, contentBase64, message) {
      const r = await fetchImpl(`${base}/contents/${path}`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: contentBase64, branch }),
      });
      if (!r.ok) throw new Error(`Publication échouée (GitHub ${r.status})`);
      return r.json();
    },
  };
}
// Encodage UTF-8 -> base64 (navigateur)
export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/admin-github.test.mjs`
Expected: PASS (3 tests). (`btoa`/`TextEncoder` existent en Node 20 ; sinon les tests n'appellent pas `toBase64`.)

- [ ] **Step 5: Commit**

```bash
git add admin/github.mjs test/admin-github.test.mjs
git commit -m "feat(admin): client API GitHub (getRepo, fileExists, putFile)"
```

---

### Task 3: Vendoriser markdown-it

**Files:**
- Create: `admin/vendor/markdown-it.min.js`

- [ ] **Step 1: Copier le build navigateur de markdown-it**

Depuis `node_modules/markdown-it/dist/markdown-it.min.js` vers `admin/vendor/markdown-it.min.js`.

```bash
mkdir -p admin/vendor
cp node_modules/markdown-it/dist/markdown-it.min.js admin/vendor/markdown-it.min.js
```

- [ ] **Step 2: Vérifier**

Le fichier existe et expose `window.markdownit`. Taille non nulle.

- [ ] **Step 3: Commit**

```bash
git add admin/vendor/markdown-it.min.js
git commit -m "chore(admin): vendorer markdown-it (rendu apercu, sans CDN)"
```

---

### Task 4: Page `/admin` (auth + formulaire + aperçu + publication)

**Files:**
- Create: `admin/index.html`

**Interfaces:**
- Consumes: `./lib.mjs`, `./github.mjs`, `./vendor/markdown-it.min.js`, `../config/categories.json` (chargé via fetch relatif au déploiement : `../config/...` n'est pas déployé — voir note).

> Note déploiement : `config/categories.json` n'est pas dans le site publié. Pour alimenter le menu catégories, **embarquer la liste des 9 catégories directement dans la page** (constante JS), en cohérence avec `config/categories.json`. Documenter qu'elles doivent rester synchronisées (Phase 3 pourra générer ce fichier).

- [ ] **Step 1: Écrire `admin/index.html`** — page autonome avec :

Structure :
1. `<head>` : styles inline (formulaire 2 colonnes : édition à gauche, aperçu à droite ; responsive : empilé sur mobile).
2. **Écran d'authentification** (si pas de jeton en `localStorage`) : champ jeton + bouton « Se connecter » + lien d'aide pour créer un jeton fine-grained + avertissement sécurité.
3. **Formulaire** : titre, slug (auto via `slugify`, éditable), catégorie (`<select>` des 9), auteur (défaut Comoresnews), image (zone drag-drop + input file + champ URL), chapô, corps (`<textarea>` Markdown), date (défaut aujourd'hui).
4. **Aperçu** : `<div>` mis à jour à chaque `input` — image + badge catégorie + titre + `markdownit().render(body)`.
5. **Bouton « Publier »** : `validateArticle` → si image fichier, `toBase64` + `putFile(imageUploadPath, ...)` → `putFile(content/articles/<slug>.md, buildFrontmatter, "Publication: <titre>")` → écran succès avec lien `articleUrl`. Vérifier `fileExists` du slug avant (conflit → message).
6. Bouton « Se déconnecter » (efface le jeton).
7. Gestion d'erreurs : bloc message (401/409/réseau).

JS embarqué en `<script type="module">`, important `./lib.mjs` et `./github.mjs`.

Code du cœur de publication (référence) :

```js
async function publier(state, gh) {
  const v = validateArticle(state);
  if (!v.ok) return showErrors(v.errors);
  if (await gh.fileExists(`content/articles/${state.slug}.md`))
    return showErrors([`Un article avec le slug "${state.slug}" existe déjà.`]);
  let image = state.imageUrl || '';
  if (state.imageFileBase64) {
    const p = imageUploadPath(state.date, state.imageFileName);
    await gh.putFile(p, state.imageFileBase64, `Image: ${state.slug}`);
    image = p;
  }
  const fiche = buildFrontmatter({ ...state, image });
  await gh.putFile(`content/articles/${state.slug}.md`, toBase64(fiche), `Publication: ${state.title}`);
  showSuccess(articleUrl(state.date, state.slug));
}
```

- [ ] **Step 2: Vérifier le chargement local**

Servir `admin/` et ouvrir la page : l'écran d'auth s'affiche, aucun 404 de ressource (lib/github/vendor chargés), aucune erreur console.

- [ ] **Step 3: Commit**

```bash
git add admin/index.html
git commit -m "feat(admin): page de creation (auth, formulaire, apercu, publication)"
```

---

### Task 5: Déployer `/admin` + vérification E2E

**Files:**
- Modify: `build/generate.mjs` (ajouter `'admin'` au tableau `PASSTHROUGH`)

- [ ] **Step 1: Ajouter `admin` au passthrough**

Dans `build/generate.mjs`, ajouter `'admin'` à la constante `PASSTHROUGH`.

- [ ] **Step 2: Build + vérifier présence**

Run: `node build/generate.mjs --now=$(date -u +%F)`
Vérifier : `_site/admin/index.html`, `_site/admin/lib.mjs`, `_site/admin/github.mjs`, `_site/admin/vendor/markdown-it.min.js` présents.

- [ ] **Step 3: Suite de tests complète**

Run: `node --test`
Expected: tous verts (Phase 1 + admin-lib + admin-github).

- [ ] **Step 4: Commit + push (déclenche le déploiement)**

```bash
git add build/generate.mjs
git commit -m "feat(admin): deployer /admin via le generateur"
git push origin main
```

- [ ] **Step 5: Vérification E2E navigateur (sur le site déployé ou en local avec jeton réel)**

Parcours : ouvrir `/admin` → saisir un jeton fine-grained valide → remplir un article de test (image par URL pour aller vite) → vérifier l'aperçu → Publier → confirmer : commit créé sur `main`, workflow déclenché, article visible sur le site (accueil section catégorie, page catégorie, recherche). Supprimer l'article de test ensuite (fiche + commit) si souhaité.

---

## Auto-revue du plan

- **Couverture spec :** auth (T4), formulaire tous champs (T4), image fichier+URL (T4 + `imageUploadPath` T1), aperçu (T4 + vendor T3), publication via API (T2 + T4), frontmatter conforme (T1), déploiement /admin (T5), tests (T1/T2/T5), critères de succès (T5.5). ✓
- **Placeholders :** aucun ; T4 fournit structure détaillée + code du cœur de publication. La page HTML complète est écrite à T4 selon cette structure.
- **Cohérence des types :** `slugify/articleUrl/imageUploadPath/buildFrontmatter/validateArticle` (T1) et `ghClient/getRepo/fileExists/putFile/toBase64` (T2) réutilisés à l'identique en T4. ✓
- **Point d'attention :** `config/categories.json` non déployé → catégories embarquées en constante dans la page (noté en T4).
