import { test } from 'node:test';
import assert from 'node:assert/strict';
import cats from '../config/categories.json' with { type: 'json' };

test('categories.json contient les 9 categories', () => {
  const slugs = Object.keys(cats);
  for (const s of ['politique','economie','societe','culture','sport','diaspora','monde','annonces','tourisme'])
    assert.ok(slugs.includes(s), `manque ${s}`);
});
