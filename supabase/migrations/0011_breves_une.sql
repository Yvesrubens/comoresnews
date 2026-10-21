-- « En direct » : case « À la une » sur les articles + brèves validées par un admin.
-- Migration rejouable.

-- ---------- À la une ----------
alter table public.articles add column if not exists a_la_une boolean not null default false;

-- Seul un admin peut changer la case. Pour tout autre rôle, la valeur est
-- corrigée en silence (jamais d'erreur : un rédacteur peut réenregistrer un
-- article déjà coché par un admin). Sans utilisateur connecté (éditeur SQL,
-- clé service_role), la valeur demandée est respectée.
create or replace function public.articles_garde_une()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.a_la_une := false;
    else
      new.a_la_une := old.a_la_une;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists articles_garde_une on public.articles;
create trigger articles_garde_une
  before insert or update on public.articles
  for each row execute function public.articles_garde_une();

-- ---------- Brèves ----------
create table if not exists public.breves (
  id uuid primary key default gen_random_uuid(),
  texte text not null check (char_length(btrim(texte)) between 1 and 300),
  auteur_id uuid not null default auth.uid() references public.profiles(id),
  statut text not null default 'brouillon' check (statut in ('brouillon','en_attente','publie')),
  commentaire_relecture text,
  date_publication timestamptz,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index if not exists breves_publiees_idx on public.breves (date_publication desc) where statut = 'publie';

drop trigger if exists breves_touch_maj_le on public.breves;
create trigger breves_touch_maj_le
  before update on public.breves for each row execute function public.touch_maj_le();

alter table public.breves enable row level security;

drop policy if exists breves_admin_all on public.breves;
create policy breves_admin_all on public.breves for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists breves_writer_read on public.breves;
create policy breves_writer_read on public.breves for select
  using (auteur_id = auth.uid());
drop policy if exists breves_writer_insert on public.breves;
create policy breves_writer_insert on public.breves for insert
  with check (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));
drop policy if exists breves_writer_update on public.breves;
create policy breves_writer_update on public.breves for update
  using (auteur_id = auth.uid() and statut in ('brouillon','en_attente'))
  with check (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));
drop policy if exists breves_writer_delete on public.breves;
create policy breves_writer_delete on public.breves for delete
  using (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));

grant select, insert, update, delete on public.breves to authenticated;
grant all on public.breves to service_role;
