# CMS Phase 3 — Gestion + Programmation — Plan d'implémentation

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans.

**Goal:** Lister/modifier/supprimer les articles depuis `/admin`, et programmer des publications à date future.

**Architecture:** Extension du back-office Phase 2. Nouvelles fonctions pures (`parseFiche`, `statusFor`) et client API (`listDir`, `getFile`, `deleteFile`, `putFile` avec sha). UI : vue liste + mode édition + sélecteur de statut/date.

**Tech Stack:** JS navigateur, `node:test`, API GitHub Contents.

## Global Constraints

- `parseFiche` doit être l'inverse exact de `buildFrontmatter` (round-trip).
- Slug verrouillé en édition (pas de renommage).
- Programmation au jour ; `status: scheduled` + `date` ; publication via `isPublishable` (Phase 1, déjà en place) au prochain cron.
- Toujours relire le `sha` juste avant PUT/DELETE.
- Dépôt `Yvesrubens/comoresnews`, branche `main`.

---

### Task 1: `parseFiche` + `statusFor` (`admin/lib.mjs`)

**Files:** Modify `admin/lib.mjs` ; Test `test/admin-lib-phase3.test.mjs`

**Interfaces:**
- `parseFiche(md)` → `{title, slug, category, author, date, image, excerpt, status, body}`.
- `statusFor(mode, date, todayISO)` → `'published'` si mode==='now' ; sinon `'scheduled'` (si date>today) ou `'published'` (si date<=today).

- [ ] **Step 1: Tests**

```js
// test/admin-lib-phase3.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFiche, statusFor, buildFrontmatter } from '../admin/lib.mjs';

test('parseFiche round-trip avec buildFrontmatter', () => {
  const a = { title:'Un "Titre" : accents é', slug:'s', category:'sport', author:'Comoresnews',
    date:'2026-07-08', image:'wp-content/x.png', excerpt:'chapô', body:'Ligne 1\n\n## Titre\n\nLigne 2.' };
  const parsed = parseFiche(buildFrontmatter(a));
  assert.equal(parsed.title, a.title);
  assert.equal(parsed.category, 'sport');
  assert.equal(parsed.status, 'published');
  assert.equal(parsed.body.trim(), a.body.trim());
});
test('statusFor', () => {
  assert.equal(statusFor('now', '2026-07-08', '2026-07-07'), 'published');
  assert.equal(statusFor('schedule', '2026-07-10', '2026-07-07'), 'scheduled');
  assert.equal(statusFor('schedule', '2026-07-05', '2026-07-07'), 'published');
});
```

- [ ] **Step 2: Run → FAIL** (`node --test test/admin-lib-phase3.test.mjs`)

- [ ] **Step 3: Implémenter dans `admin/lib.mjs`**

```js
export function parseFiche(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? m[1] : '';
  const body = m ? m[2].replace(/^\n+/, '') : md;
  const get = (k) => {
    const r = new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm);
    if (!r) return '';
    let v = r[1].trim();
    if (v.startsWith('"')) { try { return JSON.parse(v); } catch { return v.replace(/^"|"$/g, ''); } }
    return v;
  };
  return { title:get('title'), slug:get('slug'), category:get('category'), author:get('author'),
    date:get('date'), image:get('image'), excerpt:get('excerpt'), status:get('status') || 'published', body };
}
export function statusFor(mode, date, todayISO) {
  if (mode === 'now') return 'published';
  return date > todayISO ? 'scheduled' : 'published';
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(admin): parseFiche + statusFor (edition/programmation)`

---

### Task 2: Client API — list/get/delete/update (`admin/github.mjs`)

**Files:** Modify `admin/github.mjs` ; Test `test/admin-github-phase3.test.mjs`

**Interfaces (ajouts au retour de `ghClient`):**
- `listDir(path)` → tableau `[{name, path}]`.
- `getFile(path)` → `{text, sha}` (contenu décodé UTF-8).
- `deleteFile(path, sha, message)`.
- `putFile(path, contentBase64, message, sha?)` — `sha` optionnel pour mise à jour.

- [ ] **Step 1: Tests (fetch simulé)**

```js
// test/admin-github-phase3.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghClient } from '../admin/github.mjs';

test('listDir renvoie les fichiers', async () => {
  const gh = ghClient({ token:'t', repo:'o/r', fetchImpl: async () =>
    ({ ok:true, status:200, json: async () => ([{name:'a.md',path:'content/articles/a.md'}]) }) });
  const l = await gh.listDir('content/articles');
  assert.equal(l[0].name, 'a.md');
});
test('putFile inclut sha si fourni (update)', async () => {
  let cap; const gh = ghClient({ token:'t', repo:'o/r', fetchImpl: async (u,o)=>{cap=o; return {ok:true,status:200,json:async()=>({})};} });
  await gh.putFile('p.md', 'B64', 'msg', 'SHA123');
  assert.equal(JSON.parse(cap.body).sha, 'SHA123');
});
test('deleteFile envoie DELETE avec sha', async () => {
  let cap,url; const gh = ghClient({ token:'t', repo:'o/r', fetchImpl: async (u,o)=>{url=u;cap=o; return {ok:true,status:200,json:async()=>({})};} });
  await gh.deleteFile('p.md', 'SHA', 'msg');
  assert.equal(cap.method, 'DELETE');
  assert.equal(JSON.parse(cap.body).sha, 'SHA');
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implémenter** (ajouter au retour de `ghClient`, et étendre `putFile`) :

```js
async listDir(path) {
  const r = await fetchImpl(`${base}/contents/${path}`, { headers });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
},
async getFile(path) {
  const r = await fetchImpl(`${base}/contents/${path}`, { headers });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const j = await r.json();
  const text = new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g,'')), c => c.charCodeAt(0)));
  return { text, sha: j.sha };
},
async deleteFile(path, sha, message) {
  const r = await fetchImpl(`${base}/contents/${path}`, {
    method:'DELETE', headers:{...headers,'Content-Type':'application/json'},
    body: JSON.stringify({ message, sha, branch }) });
  if (!r.ok) throw new Error(`Suppression échouée (GitHub ${r.status})`);
  return r.json();
},
```

Et `putFile(path, contentBase64, message, sha)` : inclure `sha` dans le body si défini :
```js
async putFile(path, contentBase64, message, sha) {
  const payload = { message, content: contentBase64, branch };
  if (sha) payload.sha = sha;
  const r = await fetchImpl(`${base}/contents/${path}`, {
    method:'PUT', headers:{...headers,'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`Publication échouée (GitHub ${r.status})`);
  return r.json();
},
```

- [ ] **Step 4: Run → PASS** (relancer aussi `test/admin-github.test.mjs` — non-régression putFile sans sha)
- [ ] **Step 5: Commit** — `feat(admin): API list/get/delete + putFile avec sha`

---

### Task 3: UI liste + édition + suppression + programmation (`admin/index.html`)

**Files:** Modify `admin/index.html`

- [ ] **Step 1: Ajouter la navigation + vue liste**
- Barre : boutons « ✍ Rédiger » et « 🗂 Mes articles ».
- Vue liste : au clic, `gh.listDir('content/articles')` → pour chaque `.md`, `gh.getFile` + `parseFiche` → ligne (titre, catégorie, date, statut) + boutons **Modifier**/**Supprimer**.

- [ ] **Step 2: Mode édition**
- « Modifier » : charge la fiche (`getFile`), `parseFiche`, remplit le formulaire ; mémorise `editing = {path, sha}` ; **verrouille le champ slug** (`readonly`).
- Bouton devient « Enregistrer » : `putFile(path, toBase64(buildFrontmatter), "Mise à jour: <titre>", sha)`.
- Un bouton « Nouveau » réinitialise en mode création.

- [ ] **Step 3: Suppression**
- « Supprimer » : `confirm()` → `getFile` (sha frais) → `deleteFile(path, sha, "Suppression: <titre>")` → retirer la ligne + message succès.

- [ ] **Step 4: Programmation**
- Dans le formulaire : radio « Publier maintenant » (défaut) / « Programmer », + champ date (déjà présent, réutilisé comme date d'échéance).
- À la publication : `status = statusFor(mode, date, todayISO)` ; injecter ce `status` dans le frontmatter (adapter l'appel à `buildFrontmatter` pour transmettre `status`).
- Note : `buildFrontmatter` (Phase 2) force `status: published`. **Le modifier** pour accepter `a.status` (défaut `published`) — ajuster aussi le test Phase 2 si besoin.

- [ ] **Step 5: Vérifier en local** (page charge, bascule des vues, aucune erreur console) puis **Commit** — `feat(admin): liste, edition, suppression, programmation`

---

### Task 4: Ajuster `buildFrontmatter` pour le statut + build + déploiement

**Files:** Modify `admin/lib.mjs` (statut paramétrable), `test/admin-lib.test.mjs` si nécessaire.

- [ ] **Step 1: `buildFrontmatter` accepte `a.status`**

Remplacer `status: published` codé en dur par `status: ${a.status || 'published'}`. Mettre à jour/roder le test existant.

- [ ] **Step 2: Suite complète** — `node --test` tout vert.
- [ ] **Step 3: Build** — `node build/generate.mjs --now=$(date -u +%F)` OK, `_site/admin/` présent.
- [ ] **Step 4: Merge `cms-phase3` → `main` + push** (déclenche le déploiement).
- [ ] **Step 5: Vérification E2E navigateur** (avec jeton réel) : lister, modifier un article (titre), enregistrer, vérifier en ligne ; supprimer un article de test ; programmer à J+0 et déclencher le workflow (`workflow_dispatch`) pour voir la sortie.

---

## Auto-revue

- Couverture spec : liste (T3.1), édition (T3.2), suppression (T3.3), programmation (T3.4 + `statusFor` T1 + `isPublishable` Phase 1), API (T2), round-trip parse (T1), statut paramétrable (T4). ✓
- Placeholders : aucun ; code fourni pour lib et API ; T3 détaille l'UI.
- Cohérence types : `parseFiche/statusFor` (T1), `listDir/getFile/deleteFile/putFile(sha)` (T2) réutilisés en T3 ; `buildFrontmatter` étendu (T4) cohérent avec Phase 2.
