-- Droits au niveau table (la RLS filtre ensuite les lignes).
-- Le build (service_role) contourne la RLS : pas de grant nécessaire pour lui.
-- Le site public est statique (généré via service_role) : anon n'a pas besoin d'accès aux données.
-- Seuls les éditeurs connectés (role "authenticated") ont besoin d'accès.

grant usage on schema public to authenticated;

grant select                         on public.categories to authenticated;
grant select, insert, update, delete on public.articles   to authenticated;
grant select, update                 on public.profiles    to authenticated;
grant select, insert, delete         on public.media       to authenticated;
