-- Abonnés à la newsletter (collecte depuis le site public).
-- Le site n'a aucun accès direct à la table : il passe par la fonction
-- inscrire_newsletter (inscription seulement). Seuls les admins lisent la liste.

create table if not exists public.abonnes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,             -- stocké en minuscules
  statut text not null default 'actif' check (statut in ('actif','desinscrit')),
  source text not null default '',        -- page d'inscription
  cree_le timestamptz not null default now()
);

alter table public.abonnes enable row level security;
drop policy if exists abonnes_admin_read on public.abonnes;
create policy abonnes_admin_read on public.abonnes for select using (public.is_admin());

grant select on public.abonnes to authenticated;
grant all on public.abonnes to service_role;

-- Inscription : email validé, sans doublon ; un désinscrit qui revient redevient actif.
-- Ne renvoie rien (le site ne doit pas pouvoir savoir si un email est déjà inscrit).
create or replace function public.inscrire_newsletter(p_email text, p_source text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'email invalide';
  end if;
  insert into public.abonnes (email, source)
    values (v_email, left(coalesce(p_source, ''), 200))
  on conflict (email) do update set statut = 'actif'
    where public.abonnes.statut = 'desinscrit';
end $$;

grant execute on function public.inscrire_newsletter(text, text) to anon, authenticated;
