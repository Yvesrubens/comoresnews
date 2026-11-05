-- Île facultative d'un article (étiquette affichée sur les cartes et la page article).
-- null = pas d'île : sujet national, international, ou doute. Migration rejouable.
-- Pas de grant : 0005_grants.sql accorde déjà la table entière.

alter table public.articles add column if not exists ile text;

alter table public.articles drop constraint if exists articles_ile_check;
alter table public.articles add constraint articles_ile_check
  check (ile in ('ngazidja', 'ndzuani', 'mwali', 'maore', 'diaspora'));
