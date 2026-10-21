import test from 'node:test';
import assert from 'node:assert/strict';
import { startOfWeek, summarizeArticles, upcomingScheduled, myPending, formatDateLongFr, relativeTime } from '../admin/lib.mjs';

// Mardi 20 octobre 2026, 15h (heure locale)
const NOW = new Date(2026, 9, 20, 15, 0, 0);
const iso = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();

test('startOfWeek renvoie le lundi 0h de la semaine', () => {
  assert.equal(startOfWeek(NOW).getTime(), new Date(2026, 9, 19, 0, 0, 0).getTime());
  assert.equal(startOfWeek(new Date(2026, 9, 25, 22)).getTime(), new Date(2026, 9, 19).getTime()); // dimanche
  assert.equal(startOfWeek(new Date(2026, 9, 19, 8)).getTime(), new Date(2026, 9, 19).getTime());  // lundi
});

const ROWS = [
  { statut: 'en_attente', maj_le: iso(2026, 10, 20, 13) },
  { statut: 'en_attente', maj_le: iso(2026, 10, 19) },
  { statut: 'programme', date_programmee: iso(2026, 10, 21, 8) },
  { statut: 'programme', date_programmee: iso(2026, 10, 22, 12) },
  { statut: 'programme', date_programmee: iso(2026, 10, 18) },             // échue (le cron la publiera)
  { statut: 'publie', date_publication: iso(2026, 10, 19, 9) },            // cette semaine
  { statut: 'publie', date_publication: iso(2026, 10, 18, 23) },           // semaine dernière
  { statut: 'brouillon', maj_le: iso(2026, 10, 20), commentaire_relecture: 'Sources ?' },
  { statut: 'brouillon', maj_le: iso(2026, 10, 17) },
];

test('summarizeArticles compte en attente, programmés à venir et publiés cette semaine', () => {
  assert.deepEqual(summarizeArticles(ROWS, NOW), { enAttente: 2, programmes: 2, publiesSemaine: 1 });
  assert.deepEqual(summarizeArticles([], NOW), { enAttente: 0, programmes: 0, publiesSemaine: 0 });
});

test('upcomingScheduled : programmés à venir, du plus proche au plus lointain', () => {
  const up = upcomingScheduled(ROWS, NOW);
  assert.deepEqual(up.map((r) => r.date_programmee), [iso(2026, 10, 21, 8), iso(2026, 10, 22, 12)]);
  assert.equal(upcomingScheduled(ROWS, NOW, 1).length, 1);
});

test('myPending : en attente ou renvoyés (brouillon commenté), plus récent d\'abord', () => {
  const p = myPending(ROWS);
  assert.deepEqual(p.map((r) => r.statut), ['en_attente', 'brouillon', 'en_attente']);
  assert.ok(!p.some((r) => r.statut === 'brouillon' && !r.commentaire_relecture));
});

test('formatDateLongFr', () => {
  assert.equal(formatDateLongFr(NOW), 'mardi 20 octobre');
});

test('relativeTime', () => {
  const ago = (min) => new Date(NOW.getTime() - min * 60000).toISOString();
  assert.equal(relativeTime(ago(0), NOW), "à l'instant");
  assert.equal(relativeTime(ago(25), NOW), 'il y a 25 min');
  assert.equal(relativeTime(ago(120), NOW), 'il y a 2 h');
  assert.equal(relativeTime(ago(60 * 30), NOW), 'hier');
  assert.equal(relativeTime(iso(2026, 10, 12), NOW), 'le 12/10');
  assert.equal(relativeTime(null, NOW), '');
});

test('abonnesToCsv : en-tête, une ligne par abonné, champs protégés', async () => {
  const { abonnesToCsv } = await import('../admin/lib.mjs');
  const csv = abonnesToCsv([
    { email: 'a@b.co', statut: 'actif', cree_le: '2026-10-21T08:30:00Z', source: '/' },
    { email: 'x@y.fr', statut: 'desinscrit', cree_le: '2026-10-20T10:00:00Z', source: '/page;"spéciale"' },
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'email;statut;inscrit_le;page');
  assert.equal(lines[1], 'a@b.co;actif;2026-10-21;/');
  assert.equal(lines[2], 'x@y.fr;desinscrit;2026-10-20;"/page;""spéciale"""');
  assert.equal(abonnesToCsv([]), 'email;statut;inscrit_le;page');
});
