import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = () => fs.readFileSync(new URL('../supabase/migrations/0012_ile.sql', import.meta.url), 'utf8');

test('0012 ajoute la colonne ile nullable avec ses 5 valeurs', () => {
  const s = sql();
  assert.match(s, /add column if not exists ile text/);
  assert.doesNotMatch(s, /ile text not null/);
  assert.match(s, /drop constraint if exists articles_ile_check/);
  assert.match(s, /check \(ile in \('ngazidja', 'ndzuani', 'mwali', 'maore', 'diaspora'\)\)/);
});
