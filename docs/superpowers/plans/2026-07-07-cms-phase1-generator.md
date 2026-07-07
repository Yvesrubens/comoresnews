# CMS Phase 1 — Générateur + Migration — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le site en site généré à partir de fiches Markdown, avec rendu et URLs identiques, déployé via GitHub Actions.

**Architecture:** Fiches `content/articles/*.md` (source de vérité) → générateur Node (`build/generate.mjs`) qui injecte le contenu dans des templates extraits des pages actuelles → sortie `_site/` publiée sur GitHub Pages via Actions. Un script `build/migrate.mjs` importe une fois les 10 articles existants.

**Tech Stack:** Node ≥ 20 (ESM), `gray-matter` (frontmatter), `markdown-it` (Markdown→HTML), `turndown` (migration HTML→Markdown), `node:test` + `node:assert` (tests, zéro dépendance de test externe).

## Global Constraints

- Rendu visuel et **URLs strictement identiques** à l'actuel : articles `index.php/<AAAA>/<MM>/<JJ>/<slug>/index.html`, catégories `index.php/category/<slug>/index.html`.
- 9 catégories : politique, economie, societe, culture, sport, diaspora, monde, annonces, tourisme.
- Chemins de ressources **relatifs** (calculés selon la profondeur de page), jamais absolus racine.
- `.nojekyll` présent dans la sortie (sert `_external/`).
- Générateur **déterministe** : la date « courante » utilisée pour filtrer les articles `scheduled` est passée en paramètre (`--now=AAAA-MM-JJ`), jamais lue implicitement.
- Aucune régression : scan final du site = uniquement des `200`.
- Répertoire de travail : `C:/Users/yves/CLAUDE PROJET/comoresnews-clone`.

---

## Structure des fichiers

- `package.json` — deps + script `build`, `migrate`, `test`.
- `config/categories.json` — `{ slug: {name, order} }`.
- `build/lib/content.mjs` — `loadArticles(dir)`, `parseArticle(str)`, validation.
- `build/lib/paths.mjs` — helpers URL/slug/chemins relatifs.
- `build/lib/render.mjs` — `renderMarkdown(md)`, `articleCard(a, prefix)`.
- `build/lib/templates.mjs` — `loadTemplates()`, `applyTemplate(tpl, vars)`.
- `build/generate.mjs` — orchestrateur.
- `build/migrate.mjs` — migration unique.
- `templates/` — `article.html`, `category.html`, `author.html`, `home.html`, `partials/`.
- `.github/workflows/deploy.yml` — build + déploiement Pages.
- `test/*.test.mjs` — tests unitaires.

---

### Task 1: Scaffolding du projet Node

**Files:**
- Create: `package.json`
- Create: `config/categories.json`
- Create: `test/smoke.test.mjs`

**Interfaces:**
- Produces: scripts npm `test`, `build`, `migrate` ; `config/categories.json` chargeable en JSON.

- [ ] **Step 1: Écrire un test smoke**

```js
// test/smoke.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cats from '../config/categories.json' with { type: 'json' };

test('categories.json contient les 9 categories', () => {
  const slugs = Object.keys(cats);
  for (const s of ['politique','economie','societe','culture','sport','diaspora','monde','annonces','tourisme'])
    assert.ok(slugs.includes(s), `manque ${s}`);
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `node --test`
Expected: FAIL (categories.json introuvable)

- [ ] **Step 3: Créer `config/categories.json`**

```json
{
  "politique": { "name": "Politique", "order": 1 },
  "economie":  { "name": "Économie", "order": 2 },
  "societe":   { "name": "Société", "order": 3 },
  "culture":   { "name": "Culture", "order": 4 },
  "sport":     { "name": "Sport", "order": 5 },
  "diaspora":  { "name": "Diaspora", "order": 6 },
  "monde":     { "name": "Monde", "order": 7 },
  "tourisme":  { "name": "Tourisme", "order": 8 },
  "annonces":  { "name": "Annonces", "order": 9 }
}
```

- [ ] **Step 4: Créer `package.json`**

```json
{
  "name": "comoresnews",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test",
    "build": "node build/generate.mjs",
    "migrate": "node build/migrate.mjs"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "markdown-it": "^14.1.0"
  },
  "devDependencies": {
    "turndown": "^7.2.0"
  }
}
```

- [ ] **Step 5: Installer et lancer le test → succès**

Run: `npm install && node --test`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json config/categories.json test/smoke.test.mjs
git commit -m "chore: scaffolding CMS (package.json, categories, test runner)"
```

---

### Task 2: Helpers de chemins (`build/lib/paths.mjs`)

**Files:**
- Create: `build/lib/paths.mjs`
- Test: `test/paths.test.mjs`

**Interfaces:**
- Produces:
  - `articlePath(date, slug)` → `"index.php/2026/06/12/<slug>/index.html"`
  - `categoryPath(slug)` → `"index.php/category/<slug>/index.html"`
  - `relPrefix(fromPageRel)` → chaîne `"../"` répétée pour remonter à la racine depuis une page.

- [ ] **Step 1: Écrire les tests**

```js
// test/paths.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articlePath, categoryPath, relPrefix } from '../build/lib/paths.mjs';

test('articlePath', () => {
  assert.equal(articlePath('2026-06-12','vanille'), 'index.php/2026/06/12/vanille/index.html');
});
test('categoryPath', () => {
  assert.equal(categoryPath('sport'), 'index.php/category/sport/index.html');
});
test('relPrefix racine', () => {
  assert.equal(relPrefix('index.html'), '');
});
test('relPrefix article (5 niveaux)', () => {
  assert.equal(relPrefix('index.php/2026/06/12/vanille/index.html'), '../../../../../');
});
test('relPrefix categorie (3 niveaux)', () => {
  assert.equal(relPrefix('index.php/category/sport/index.html'), '../../../');
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/paths.test.mjs`
Expected: FAIL (module introuvable)

- [ ] **Step 3: Implémenter `build/lib/paths.mjs`**

```js
export function articlePath(date, slug) {
  const [y, m, d] = date.split('-');
  return `index.php/${y}/${m}/${d}/${slug}/index.html`;
}
export function categoryPath(slug) {
  return `index.php/category/${slug}/index.html`;
}
export function relPrefix(fromPageRel) {
  const depth = fromPageRel.split('/').length - 1; // nb de dossiers
  return '../'.repeat(depth);
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/paths.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add build/lib/paths.mjs test/paths.test.mjs
git commit -m "feat: helpers de chemins (URLs articles/categories, prefixe relatif)"
```

---

### Task 3: Chargement et validation des fiches (`build/lib/content.mjs`)

**Files:**
- Create: `build/lib/content.mjs`
- Test: `test/content.test.mjs`

**Interfaces:**
- Consumes: `config/categories.json`.
- Produces:
  - `parseArticle(raw, validCats)` → `{ title, slug, category, author, date, image, excerpt, status, body }` (jette une `Error` si champ requis manquant ou catégorie inconnue).
  - `isPublishable(article, nowISO)` → booléen (`status==='published'`, ou `status==='scheduled'` et `date <= now`).

- [ ] **Step 1: Écrire les tests**

```js
// test/content.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArticle, isPublishable } from '../build/lib/content.mjs';

const cats = ['economie','sport'];
const raw = `---
title: "Titre"
slug: mon-article
category: economie
author: Comoresnews
date: 2026-06-12
image: wp-content/uploads/x.png
excerpt: "chapo"
status: published
---
Corps **markdown**.`;

test('parseArticle extrait les champs', () => {
  const a = parseArticle(raw, cats);
  assert.equal(a.slug, 'mon-article');
  assert.equal(a.category, 'economie');
  assert.match(a.body, /Corps/);
});
test('parseArticle rejette categorie inconnue', () => {
  assert.throws(() => parseArticle(raw.replace('economie','inconnue'), cats));
});
test('parseArticle rejette titre manquant', () => {
  assert.throws(() => parseArticle(raw.replace('title: "Titre"',''), cats));
});
test('isPublishable: scheduled futur = false', () => {
  const a = parseArticle(raw.replace('status: published','status: scheduled'), cats);
  assert.equal(isPublishable(a, '2026-06-01'), false);
  assert.equal(isPublishable(a, '2026-07-01'), true);
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/content.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implémenter `build/lib/content.mjs`**

```js
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const REQUIRED = ['title','slug','category','author','date','status'];

export function parseArticle(raw, validCats) {
  const { data, content } = matter(raw);
  for (const k of REQUIRED)
    if (!data[k]) throw new Error(`Champ requis manquant: ${k} (article ${data.slug || '?'})`);
  if (!validCats.includes(data.category))
    throw new Error(`Catégorie inconnue: ${data.category} (article ${data.slug})`);
  return {
    title: String(data.title),
    slug: String(data.slug),
    category: String(data.category),
    author: String(data.author),
    date: String(data.date).slice(0, 10),
    image: data.image ? String(data.image) : '',
    excerpt: data.excerpt ? String(data.excerpt) : '',
    status: String(data.status),
    body: content.trim(),
  };
}

export function isPublishable(a, nowISO) {
  if (a.status === 'published') return true;
  if (a.status === 'scheduled') return a.date <= nowISO;
  return false; // draft
}

export function loadArticles(dir, validCats) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => parseArticle(fs.readFileSync(path.join(dir, f), 'utf8'), validCats));
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/content.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add build/lib/content.mjs test/content.test.mjs
git commit -m "feat: chargement + validation des fiches d'articles"
```

---

### Task 4: Rendu Markdown + carte d'article (`build/lib/render.mjs`)

**Files:**
- Create: `build/lib/render.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: `paths.mjs`, `config/categories.json`.
- Produces:
  - `renderMarkdown(md)` → HTML.
  - `articleCard(article, prefix, catName)` → HTML de carte (image + badge + titre lien), chemins préfixés par `prefix`.

- [ ] **Step 1: Écrire les tests**

```js
// test/render.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, articleCard } from '../build/lib/render.mjs';

test('renderMarkdown convertit le gras', () => {
  assert.match(renderMarkdown('un **mot**'), /<strong>mot<\/strong>/);
});
test('articleCard contient titre, badge et lien prefixe', () => {
  const a = { title:'T', slug:'s', date:'2026-06-12', image:'wp-content/u/x.png' };
  const html = articleCard(a, '../../../', 'Sport');
  assert.match(html, /T</);
  assert.match(html, /Sport/);
  assert.match(html, /\.\.\/\.\.\/\.\.\/index\.php\/2026\/06\/12\/s\/index\.html/);
  assert.match(html, /\.\.\/\.\.\/\.\.\/wp-content\/u\/x\.png/);
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/render.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implémenter `build/lib/render.mjs`**

```js
import MarkdownIt from 'markdown-it';
import { articlePath } from './paths.mjs';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

export function renderMarkdown(src) {
  return md.render(src || '');
}

export function articleCard(a, prefix, catName) {
  const url = prefix + articlePath(a.date, a.slug);
  const img = a.image
    ? `background-image:url('${prefix}${a.image}');`
    : 'background:#dcdcdc;';
  return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #eaeaea;align-items:flex-start;">
  <a href="${url}" style="flex:0 0 108px;text-decoration:none;"><span style="display:block;width:108px;height:74px;background-position:center;background-size:cover;background-repeat:no-repeat;${img}border-radius:3px;"></span></a>
  <div style="flex:1;min-width:0;">
    <span style="display:inline-block;background:#222;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;">${catName}</span>
    <h3 style="margin:7px 0 0;font-size:16px;line-height:1.35;font-weight:600;"><a href="${url}" style="color:#111;text-decoration:none;">${a.title}</a></h3>
  </div>
</div>`;
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/render.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add build/lib/render.mjs test/render.test.mjs
git commit -m "feat: rendu Markdown + generateur de carte d'article"
```

---

### Task 5: Moteur de templates (`build/lib/templates.mjs`)

**Files:**
- Create: `build/lib/templates.mjs`
- Test: `test/templates.test.mjs`

**Interfaces:**
- Produces:
  - `applyTemplate(tpl, vars)` → remplace `{{CLE}}` par `vars.CLE` (chaîne vide si absent).
  - `replaceSection(html, slug, inner)` → remplace le marqueur `{{SECTION:slug}}` par `inner`.

- [ ] **Step 1: Écrire les tests**

```js
// test/templates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplate, replaceSection } from '../build/lib/templates.mjs';

test('applyTemplate remplace les cles', () => {
  assert.equal(applyTemplate('<h1>{{TITLE}}</h1>', {TITLE:'X'}), '<h1>X</h1>');
});
test('applyTemplate: cle absente = vide', () => {
  assert.equal(applyTemplate('a{{Z}}b', {}), 'ab');
});
test('replaceSection', () => {
  assert.equal(replaceSection('x{{SECTION:sport}}y', 'sport', 'OK'), 'xOKy');
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/templates.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implémenter `build/lib/templates.mjs`**

```js
export function applyTemplate(tpl, vars) {
  return tpl.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}
export function replaceSection(html, slug, inner) {
  return html.split(`{{SECTION:${slug}}}`).join(inner);
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/templates.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add build/lib/templates.mjs test/templates.test.mjs
git commit -m "feat: moteur de templates (cles + sections)"
```

---

### Task 6: Extraction des templates depuis les pages actuelles

**Files:**
- Create: `templates/article.html`, `templates/category.html`, `templates/author.html`, `templates/home.html`
- Create: `build/extract-templates.mjs` (script d'aide, exécuté une fois)

**Interfaces:**
- Produces: fichiers templates contenant le chrome actuel + marqueurs `{{TITLE}}`, `{{BREADCRUMB}}`, `{{CATEGORY}}`, `{{AUTHOR}}`, `{{DATE}}`, `{{IMAGE}}`, `{{BODY}}`, `{{ARTICLES}}`, `{{SECTION:<slug>}}`.

- [ ] **Step 1: Générer `templates/category.html`**

Partir de `index.php/category/politique/index.html`, remplacer le contenu de `<div ... td-main-content-wrap ...>` par un conteneur `{{ARTICLES}}`, et remplacer le titre/fil d'ariane par `{{TITLE}}` / `{{BREADCRUMB}}`. Réutiliser la logique de `mktourisme.mjs` (déjà écrite) comme base.

- [ ] **Step 2: Générer `templates/article.html`**

Partir d'un article existant (ex. `vanille…/index.html`). Remplacer, dans la zone de contenu : titre → `{{TITLE}}`, badge catégorie → `{{CATEGORY}}`, auteur → `{{AUTHOR}}`, date → `{{DATE}}`, image de une → `{{IMAGE}}`, corps → `{{BODY}}`, fil d'ariane → `{{BREADCRUMB}}`.

- [ ] **Step 3: Générer `templates/author.html`**

Partir de `index.php/author/lewistifosi/index.html`, remplacer la liste par `{{ARTICLES}}`.

- [ ] **Step 4: Générer `templates/home.html`**

Partir de `index.html`. Dans chaque bloc « Actu X » (uids connus : tdi_57 politique, tdi_58 economie, tdi_59 societe, tdi_69 culture, tdi_82 sport, tdi_85 diaspora, tdi_88 monde, tdi_106 annonces, tdi_900 tourisme), remplacer l'intérieur du `<div id=tdi_XX class="td_block_inner …">` par `{{SECTION:<slug>}}`. Réutiliser `reorghome.mjs` (déjà écrit) comme base.

- [ ] **Step 5: Vérifier visuellement**

Ouvrir chaque template : les marqueurs sont présents, le chrome (header/menu/footer) intact.

- [ ] **Step 6: Commit**

```bash
git add templates/ build/extract-templates.mjs
git commit -m "feat: extraction des templates (article, categorie, auteur, accueil)"
```

---

### Task 7: Migration des 10 articles existants (`build/migrate.mjs`)

**Files:**
- Create: `build/migrate.mjs`
- Create: `content/articles/*.md` (sortie)
- Test: `test/migrate.test.mjs`

**Interfaces:**
- Consumes: pages HTML existantes.
- Produces: `extractArticleData(html, urlPath)` → objet fiche ; écrit `content/articles/<slug>.md`.

- [ ] **Step 1: Écrire le test d'extraction**

```js
// test/migrate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArticleData } from '../build/migrate.mjs';

const html = `<title>Titre article | Comoresnews</title>
<meta property="og:description" content="Le chapo.">
<meta property="og:image" content="https://comoresnews.com/wp-content/uploads/2026/06/x.png">
<span><a class="entry-crumb" href="../../../../category/economie/index.html">Économie</a></span>`;

test('extractArticleData', () => {
  const a = extractArticleData(html, 'index.php/2026/06/12/mon-slug/index.html');
  assert.equal(a.slug, 'mon-slug');
  assert.equal(a.date, '2026-06-12');
  assert.equal(a.category, 'economie');
  assert.equal(a.title, 'Titre article');
  assert.equal(a.image, 'wp-content/uploads/2026/06/x.png');
  assert.equal(a.excerpt, 'Le chapo.');
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/migrate.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implémenter `build/migrate.mjs`** (extraction + corps HTML→Markdown + écriture)

```js
import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

export function extractArticleData(html, urlPath) {
  const seg = urlPath.split('/');
  const [ , y, m, d, slug ] = seg; // index.php / y / m / d / slug / index.html
  const title = (html.match(/<title>([^<|]+)/) || [])[1]?.trim() || '';
  const excerpt = (html.match(/property="og:description" content="([^"]*)"/) || [])[1] || '';
  let image = (html.match(/property="og:image" content="([^"]*)"/) || [])[1] || '';
  image = image.replace(/^https?:\/\/comoresnews\.com\//, '').split('#')[0].split('?')[0];
  const cat = (html.match(/class="entry-crumb"[^>]*href="[^"]*category\/([^"/]+)\//) || [])[1] || '';
  return { title, slug, date: `${y}-${m}-${d}`, category: cat, author: 'Comoresnews', image, excerpt };
}

// extraction du corps : conteneur article -> markdown (implémenté à l'étape suivante)
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/migrate.test.mjs`
Expected: PASS (1 test)

- [ ] **Step 5: Compléter la migration (corps + écriture des fiches) et l'exécuter**

Ajouter la sélection du conteneur de corps (`<div class="td-post-content …">` de chaque article), sa conversion via `td.turndown(bodyHtml)`, puis l'écriture du fichier :

```js
function writeFiche(a, bodyMd) {
  const fm = `---\ntitle: ${JSON.stringify(a.title)}\nslug: ${a.slug}\ncategory: ${a.category}\nauthor: ${a.author}\ndate: ${a.date}\nimage: ${a.image}\nexcerpt: ${JSON.stringify(a.excerpt)}\nstatus: published\n---\n\n${bodyMd}\n`;
  fs.mkdirSync('content/articles', { recursive: true });
  fs.writeFileSync(path.join('content/articles', a.slug + '.md'), fm);
}
```

Run: `npm run migrate`
Expected: 10 fichiers créés dans `content/articles/`.

- [ ] **Step 6: Vérifier la fidélité**

Comparer, pour chaque fiche, titre/catégorie/date/image au HTML d'origine ; ouvrir 2-3 corps Markdown pour vérifier qu'aucun paragraphe n'est perdu. Corriger au cas par cas.

- [ ] **Step 7: Commit**

```bash
git add build/migrate.mjs test/migrate.test.mjs content/articles/
git commit -m "feat: migration des 10 articles existants en fiches Markdown"
```

---

### Task 8: Générateur — pages d'articles

**Files:**
- Create: `build/generate.mjs`
- Test: `test/generate-article.test.mjs`

**Interfaces:**
- Consumes: `content.mjs`, `render.mjs`, `templates.mjs`, `paths.mjs`, `templates/article.html`.
- Produces: `buildArticlePage(article, cats)` → HTML final ; écrit dans `_site/<articlePath>`.

- [ ] **Step 1: Écrire le test**

```js
// test/generate-article.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArticlePage } from '../build/generate.mjs';
import cats from '../config/categories.json' with { type: 'json' };

test('buildArticlePage injecte titre, corps, categorie', () => {
  const a = { title:'Mon titre', slug:'s', category:'economie', author:'Comoresnews',
    date:'2026-06-12', image:'wp-content/uploads/x.png', excerpt:'e', status:'published',
    body:'Un **paragraphe**.' };
  const html = buildArticlePage(a, cats);
  assert.match(html, /Mon titre/);
  assert.match(html, /<strong>paragraphe<\/strong>/);
  assert.match(html, /Économie/);
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/generate-article.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implémenter `buildArticlePage` dans `build/generate.mjs`**

```js
import fs from 'node:fs';
import path from 'node:path';
import cats from '../config/categories.json' with { type: 'json' };
import { loadArticles, isPublishable } from './lib/content.mjs';
import { renderMarkdown } from './lib/render.mjs';
import { applyTemplate } from './lib/templates.mjs';
import { articlePath, categoryPath, relPrefix } from './lib/paths.mjs';

const TPL = (n) => fs.readFileSync(path.join('templates', n), 'utf8');

export function buildArticlePage(a, catsCfg) {
  const rel = articlePath(a.date, a.slug);
  const P = relPrefix(rel);
  const catName = catsCfg[a.category].name;
  return applyTemplate(TPL('article.html'), {
    TITLE: a.title,
    BREADCRUMB: `<span><a class="entry-crumb" href="${P}index.html">Accueil</a></span> <i class="td-icon-right td-bread-sep"></i> <span><a class="entry-crumb" href="${P}${categoryPath(a.category)}">${catName}</a></span>`,
    CATEGORY: catName,
    AUTHOR: a.author,
    DATE: a.date,
    IMAGE: a.image ? `${P}${a.image}` : '',
    BODY: renderMarkdown(a.body),
  });
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/generate-article.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build/generate.mjs test/generate-article.test.mjs
git commit -m "feat: generateur - pages d'articles"
```

---

### Task 9: Générateur — pages catégories (avec message si vide)

**Files:**
- Modify: `build/generate.mjs`
- Test: `test/generate-category.test.mjs`

**Interfaces:**
- Produces: `buildCategoryPage(slug, articles, cats)` → HTML ; liste triée par date décroissante ou message « Aucun article pour le moment ».

- [ ] **Step 1: Écrire le test**

```js
// test/generate-category.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCategoryPage } from '../build/generate.mjs';
import cats from '../config/categories.json' with { type: 'json' };

const arts = [
  { title:'A', slug:'a', category:'sport', date:'2026-06-10', image:'i.png' },
  { title:'B', slug:'b', category:'sport', date:'2026-06-12', image:'j.png' },
];
test('categorie liste triee par date desc', () => {
  const html = buildCategoryPage('sport', arts, cats);
  assert.ok(html.indexOf('B') < html.indexOf('A'), 'B (plus recent) doit precéder A');
});
test('categorie vide affiche le message', () => {
  assert.match(buildCategoryPage('monde', [], cats), /Aucun article pour le moment/);
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/generate-category.test.mjs`
Expected: FAIL

- [ ] **Step 3: Ajouter `buildCategoryPage` à `build/generate.mjs`**

```js
import { articleCard } from './lib/render.mjs';
import { replaceSection } from './lib/templates.mjs';

export function buildCategoryPage(slug, articles, catsCfg) {
  const P = relPrefix(categoryPath(slug));
  const catName = catsCfg[slug].name;
  const list = [...articles].sort((x, y) => y.date.localeCompare(x.date));
  const inner = list.length
    ? list.map(a => articleCard(a, P, catsCfg[a.category].name)).join('')
    : `<p style="padding:22px 4px;color:#999;font-style:italic;margin:0;">Aucun article pour le moment.</p>`;
  return applyTemplate(TPL('category.html'), { TITLE: catName, BREADCRUMB: catName })
    .replace('{{ARTICLES}}', inner);
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/generate-category.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add build/generate.mjs test/generate-category.test.mjs
git commit -m "feat: generateur - pages categories"
```

---

### Task 10: Générateur — accueil, auteur, index de recherche

**Files:**
- Modify: `build/generate.mjs`
- Test: `test/generate-home.test.mjs`

**Interfaces:**
- Produces:
  - `buildHome(articles, cats)` → HTML accueil (sections `{{SECTION:slug}}` remplies).
  - `buildAuthor(author, articles, cats)` → HTML page auteur.
  - `buildSearchIndex(articles, cats)` → tableau JSON `{title, cat, catSlug, excerpt, url, img}`.

- [ ] **Step 1: Écrire les tests**

```js
// test/generate-home.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHome, buildSearchIndex } from '../build/generate.mjs';
import cats from '../config/categories.json' with { type: 'json' };

const arts = [
  { title:'Eco1', slug:'e1', category:'economie', date:'2026-06-12', image:'i.png', excerpt:'x' },
  { title:'Sport1', slug:'s1', category:'sport', date:'2026-06-11', image:'j.png', excerpt:'y' },
];
test('accueil place l\'article eco dans la section economie', () => {
  const html = buildHome(arts, cats);
  const secEco = html.split('{{')[0]; // sanity: plus de marqueurs bruts
  assert.doesNotMatch(html, /\{\{SECTION/);
  assert.match(html, /Eco1/);
});
test('index de recherche', () => {
  const idx = buildSearchIndex(arts, cats);
  assert.equal(idx.length, 2);
  assert.equal(idx[0].catSlug, 'economie');
  assert.equal(idx[0].url, 'index.php/2026/06/12/e1/index.html');
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/generate-home.test.mjs`
Expected: FAIL

- [ ] **Step 3: Ajouter `buildHome`, `buildAuthor`, `buildSearchIndex`**

```js
export function buildHome(articles, catsCfg) {
  let html = TPL('home.html');
  for (const slug of Object.keys(catsCfg)) {
    const list = articles.filter(a => a.category === slug)
      .sort((x, y) => y.date.localeCompare(x.date));
    const inner = list.length
      ? `<div style="padding:4px 0;">${list.map(a => articleCard(a, '', catsCfg[a.category].name)).join('')}</div>`
      : `<p style="padding:22px 4px;color:#999;font-style:italic;margin:0;">Aucun article pour le moment.</p>`;
    html = replaceSection(html, slug, inner);
  }
  return html;
}

export function buildAuthor(author, articles, catsCfg) {
  const rel = `index.php/author/${author.toLowerCase()}/index.html`;
  const P = relPrefix(rel);
  const list = [...articles].sort((x, y) => y.date.localeCompare(x.date));
  const inner = list.map(a => articleCard(a, P, catsCfg[a.category].name)).join('');
  return applyTemplate(TPL('author.html'), { AUTHOR: author }).replace('{{ARTICLES}}', inner);
}

export function buildSearchIndex(articles, catsCfg) {
  return articles.map(a => ({
    title: a.title, cat: catsCfg[a.category].name, catSlug: a.category,
    excerpt: a.excerpt, url: articlePath(a.date, a.slug), img: a.image,
  }));
}
```

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/generate-home.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add build/generate.mjs test/generate-home.test.mjs
git commit -m "feat: generateur - accueil, auteur, index de recherche"
```

---

### Task 11: Orchestration du build + assets passthrough

**Files:**
- Modify: `build/generate.mjs` (fonction `main`)
- Create: `site/` (déplacement des assets + pages statiques)
- Test: `test/build-e2e.test.mjs`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: `main({ now, outDir })` → écrit le site complet dans `outDir` (défaut `_site`).

- [ ] **Step 1: Réorganiser les assets dans `site/`**

Déplacer `wp-content/`, `wp-includes/`, `_external/`, `.nojekyll`, et les pages statiques `index.php/pages/{contact,recherche,mentions-legales,politique-confidentialite}` dans `site/`. (Les pages générées écraseront leurs équivalents ; les fiches deviennent la source des articles/catégories/accueil/auteur.)

- [ ] **Step 2: Écrire le test e2e**

```js
// test/build-e2e.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { main } from '../build/generate.mjs';

test('build complet produit accueil + un article + index', () => {
  main({ now: '2026-07-07', outDir: '_site_test' });
  assert.ok(fs.existsSync('_site_test/index.html'));
  assert.ok(fs.existsSync('_site_test/articles-index.json'));
  assert.ok(fs.existsSync('_site_test/index.php/category/economie/index.html'));
  assert.ok(fs.existsSync('_site_test/.nojekyll'));
  fs.rmSync('_site_test', { recursive: true, force: true });
});
```

- [ ] **Step 3: Lancer → échec**

Run: `node --test test/build-e2e.test.mjs`
Expected: FAIL (main non définie)

- [ ] **Step 4: Implémenter `main` + copie récursive de `site/`**

```js
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
function write(outDir, rel, content) {
  const p = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

export function main({ now, outDir = '_site' }) {
  const validCats = Object.keys(cats);
  const all = loadArticles('content/articles', validCats).filter(a => isPublishable(a, now));
  fs.rmSync(outDir, { recursive: true, force: true });
  copyDir('site', outDir);                                   // assets + pages statiques
  for (const a of all) write(outDir, articlePath(a.date, a.slug), buildArticlePage(a, cats));
  for (const slug of validCats)
    write(outDir, categoryPath(slug), buildCategoryPage(slug, all.filter(a => a.category === slug), cats));
  write(outDir, 'index.html', buildHome(all, cats));
  write(outDir, 'index.php/author/comoresnews/index.html', buildAuthor('Comoresnews', all, cats));
  write(outDir, 'articles-index.json', JSON.stringify(buildSearchIndex(all, cats), null, 1));
  console.log(`Build OK: ${all.length} articles -> ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const nowArg = (process.argv.find(a => a.startsWith('--now=')) || '').split('=')[1];
  main({ now: nowArg || new Date().toISOString().slice(0, 10) });
}
```

> Note : la page auteur historique était `author/lewistifosi/` ; conserver ce chemin si des liens externes existent (ajouter une copie ou une redirection). À valider à l'étape de vérification des liens.

- [ ] **Step 5: Lancer → succès**

Run: `node --test test/build-e2e.test.mjs`
Expected: PASS

- [ ] **Step 6: Build réel + vérification locale**

Run: `npm run build -- --now=2026-07-07`
Puis servir `_site/` et vérifier : accueil (sections par catégorie), un article, une catégorie, la recherche. Comparer l'ensemble des URLs à l'inventaire actuel (aucune URL perdue) et scanner les liens internes (0 cassé).

- [ ] **Step 7: Commit**

```bash
git add build/generate.mjs site/ test/build-e2e.test.mjs
git commit -m "feat: orchestration du build + assets passthrough"
```

---

### Task 12: Injection des éléments transverses (footer légal, lien Contact, recherche)

**Files:**
- Modify: `build/generate.mjs`
- Create: `templates/partials/legal-bar.html`
- Test: `test/injection.test.mjs`

**Interfaces:**
- Produces: `injectCommon(html, pageRel)` → ajoute barre légale/footer + script d'interception recherche + active le lien Contact, avec chemins relatifs corrects ; appelée sur chaque page générée avant écriture.

- [ ] **Step 1: Écrire le test**

```js
// test/injection.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectCommon } from '../build/generate.mjs';

test('injectCommon ajoute la barre legale avec lien relatif correct', () => {
  const out = injectCommon('<body></body>', 'index.php/category/sport/index.html');
  assert.match(out, /Mentions légales/);
  assert.match(out, /\.\.\/\.\.\/\.\.\/index\.php\/pages\/mentions-legales/);
});
```

- [ ] **Step 2: Lancer → échec**

Run: `node --test test/injection.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implémenter `injectCommon`** (reprend la logique de `injectfooter.mjs`/`injectsearch.mjs`/`linkcontact.mjs` déjà écrites, factorisée) et l'appeler dans chaque `write(...)` de pages générées.

- [ ] **Step 4: Lancer → succès**

Run: `node --test test/injection.test.mjs`
Expected: PASS

- [ ] **Step 5: Build + vérif barre légale et recherche présentes partout**

Run: `npm run build -- --now=2026-07-07` puis contrôle visuel.

- [ ] **Step 6: Commit**

```bash
git add build/generate.mjs templates/partials/legal-bar.html test/injection.test.mjs
git commit -m "feat: injection footer legal + contact + recherche"
```

---

### Task 13: Déploiement GitHub Actions + bascule Pages

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `.gitignore` (ignorer `_site/`, `_site_test/`, `node_modules/`)

**Interfaces:**
- Produces: workflow qui build et déploie `_site/` sur Pages à chaque push sur `main` et via cron horaire.

- [ ] **Step 1: Ignorer les sorties de build**

Ajouter à `.gitignore` : `node_modules/`, `_site/`, `_site_test/`.

```bash
git rm -r --cached _site 2>/dev/null; true
```

- [ ] **Step 2: Créer `.github/workflows/deploy.yml`**

```yaml
name: Build & Deploy
on:
  push: { branches: [main] }
  schedule: [{ cron: '0 * * * *' }]   # horaire : publie les articles programmés
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: node build/generate.mjs --now=$(date -u +%F)
      - uses: actions/upload-pages-artifact@v3
        with: { path: _site }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Basculer Pages en mode Actions**

Via API : `gh api -X POST repos/Yvesrubens/comoresnews/pages -f build_type=workflow` (ou Settings → Pages → Source : GitHub Actions).

- [ ] **Step 4: Commit + push + observer le workflow**

```bash
git add .github/workflows/deploy.yml .gitignore
git commit -m "ci: build et deploiement GitHub Pages via Actions"
git push origin main
gh run watch
```

- [ ] **Step 5: Vérification live finale**

Scanner le site déployé : accueil, catégories, articles, recherche, contact, pages légales → uniquement des `200`, rendu identique à avant, aucune URL perdue.

---

## Auto-revue du plan

- **Couverture spec :** modèle de contenu (T3), migration (T7), générateur articles/catégories/accueil/auteur/index (T8-T11), templates (T6), catégories config (T1), déploiement Actions (T13), passthrough assets (T11), injection transverse (T12), vérification (T11.6, T13.5). ✓
- **Placeholders :** aucun « TBD » ; les tâches T6/T7 réutilisent des scripts déjà écrits (`mktourisme.mjs`, `reorghome.mjs`, `injectfooter.mjs`) comme base explicite.
- **Cohérence des types :** `buildArticlePage/CategoryPage/Home/Author/SearchIndex`, `main({now,outDir})`, `injectCommon(html,pageRel)`, helpers `articlePath/categoryPath/relPrefix` — noms constants d'une tâche à l'autre. ✓
- **Point ouvert résiduel :** chemin page auteur (`comoresnews` vs `lewistifosi`) — à trancher à T11.6 selon liens existants (défaut : conserver `lewistifosi` via copie).
