import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = () => fs.readFileSync(new URL('../supabase/migrations/0011_breves_une.sql', import.meta.url), 'utf8');

test('0011 ajoute la colonne à la une et la table des brèves', () => {
  const s = sql();
  assert.match(s, /add column if not exists a_la_une boolean not null default false/);
  assert.match(s, /create table if not exists public\.breves/);
  assert.match(s, /check \(char_length\(btrim\(texte\)\) between 1 and 300\)/);
  assert.match(s, /alter table public\.breves enable row level security/);
});

test('0011 : policies rejouables sur les brèves', () => {
  const s = sql();
  for (const p of ['breves_admin_all', 'breves_writer_read', 'breves_writer_insert', 'breves_writer_update', 'breves_writer_delete']) {
    assert.ok(s.includes(`drop policy if exists ${p} on public.breves`), p);
    assert.ok(s.includes(`create policy ${p} on public.breves`), p);
  }
  assert.match(s, /grant select, insert, update, delete on public\.breves to authenticated/);
  assert.match(s, /grant all on public\.breves to service_role/);
});

test('0011 : garde en base sur à la une (correction silencieuse pour les non-admins)', () => {
  const s = sql();
  assert.match(s, /create or replace function public\.articles_garde_une\(\)/);
  assert.match(s, /before insert or update on public\.articles/);
  assert.match(s, /new\.a_la_une := old\.a_la_une/);
  assert.match(s, /new\.a_la_une := false/);
});

test('0011 : la garde ne touche pas aux sessions sans utilisateur (éditeur SQL, service_role)', () => {
  assert.match(sql(), /if auth\.uid\(\) is not null and not public\.is_admin\(\) then/);
});
