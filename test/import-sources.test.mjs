import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { importAll } from '../scripts/import-sources.mjs';

const fx = (f) => fs.readFileSync(new URL(`./fixtures/sources/${f}`, import.meta.url), 'utf8');

const SOURCES = [
  { id: 'habari', nom: 'Habari Za Comores', type: 'rss', url: 'https://www.habarizacomores.com/rss.xml' },
  { id: 'masiwa', nom: 'Masiwa', type: 'rss', url: 'https://masiwa-comores.com/feed/' },
  { id: 'gazette', nom: 'La Gazette des Comores', type: 'gazette', url: 'https://www.lagazettedescomores.com/' },
];

// Faux réseau : sert les fixtures ; toute page article Gazette renvoie l'article exemple.
function fakeFetch({ failOn } = {}) {
  const calls = [];
  const fetchText = async (url) => {
    calls.push(url);
    if (failOn && url === failOn) throw new Error('réseau indisponible');
    if (url.includes('habarizacomores')) return fx('habari.xml');
    if (url.includes('masiwa-comores')) return fx('masiwa.xml');
    if (url === 'https://www.lagazettedescomores.com/') return fx('gazette-home.html');
    if (url.includes('lagazettedescomores')) return fx('gazette-article.html');
    throw new Error('URL inattendue ' + url);
  };
  return { fetchText, calls };
}

// Fausse base en mémoire.
function fakeDb(known = []) {
  const rows = [];
  const urls = new Set(known);
  return {
    rows,
    existingUrls: async (list) => new Set(list.filter((u) => urls.has(u))),
    insertSujets: async (batch) => { for (const r of batch) { urls.add(r.url); rows.push(r); } return batch.length; },
  };
}

const quiet = () => {};
const bySource = (res) => Object.fromEntries(res.map((r) => [r.source, r]));

test('importAll insère les nouveaux sujets avec catégorie devinée', async () => {
  const db = fakeDb();
  const res = bySource(await importAll({ sources: SOURCES, fetchText: fakeFetch().fetchText, db, log: quiet }));
  assert.equal(res.habari.nouveaux, 25);
  assert.equal(res.masiwa.nouveaux, 10);
  assert.equal(res.gazette.nouveaux, 19);
  const masiwa = db.rows.find((r) => r.source === 'masiwa');
  assert.equal(masiwa.categorie, 'politique');
  const gaz = db.rows.find((r) => r.source === 'gazette');
  assert.equal(gaz.titre, 'Douanes : Les contractuels testés avant leur intégration');
  assert.equal(gaz.source_nom, 'La Gazette des Comores');
});

test('importAll ignore les URL déjà connues', async () => {
  const known = 'https://www.habarizacomores.com/2026/10/vers-une-electricite-plus-fiable-aux.html';
  const db = fakeDb([known]);
  const res = bySource(await importAll({ sources: SOURCES.slice(0, 1), fetchText: fakeFetch().fetchText, db, log: quiet }));
  assert.equal(res.habari.nouveaux, 24);
  assert.ok(!db.rows.some((r) => r.url === known));
});

test('ne télécharge pas les pages Gazette déjà connues', async () => {
  const { parseGazetteHome } = await import('../scripts/lib/sources/gazette.mjs');
  const known = parseGazetteHome(fx('gazette-home.html')).map((l) => l.url);
  const f = fakeFetch();
  const res = bySource(await importAll({ sources: SOURCES.slice(2), fetchText: f.fetchText, db: fakeDb(known), log: quiet }));
  assert.equal(res.gazette.nouveaux, 0);
  assert.equal(f.calls.length, 1); // seulement la page d'accueil
});

test('importAll continue si une source échoue', async () => {
  const db = fakeDb();
  const res = bySource(await importAll({ sources: SOURCES, fetchText: fakeFetch({ failOn: 'https://masiwa-comores.com/feed/' }).fetchText, db, log: quiet }));
  assert.ok(res.masiwa.erreur);
  assert.equal(res.masiwa.nouveaux, 0);
  assert.equal(res.habari.nouveaux, 25);
  assert.equal(res.gazette.nouveaux, 19);
});
