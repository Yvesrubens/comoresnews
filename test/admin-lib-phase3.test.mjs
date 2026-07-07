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
test('parseFiche lit un statut scheduled', () => {
  const s = buildFrontmatter({ title:'T', slug:'s', category:'sport', date:'2026-12-01', body:'b', status:'scheduled' });
  assert.equal(parseFiche(s).status, 'scheduled');
});
test('statusFor', () => {
  assert.equal(statusFor('now', '2026-07-08', '2026-07-07'), 'published');
  assert.equal(statusFor('schedule', '2026-07-10', '2026-07-07'), 'scheduled');
  assert.equal(statusFor('schedule', '2026-07-05', '2026-07-07'), 'published');
});
