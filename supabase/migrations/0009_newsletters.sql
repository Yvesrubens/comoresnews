-- Envoi de la newsletter hebdomadaire.
-- Spec : docs/superpowers/specs/2026-10-21-envoi-newsletter-design.md

-- Jeton secret de désinscription (un par abonné, conservé s'il se réinscrit)
alter table public.abonnes add column if not exists jeton uuid not null default gen_random_uuid();
create unique index if not exists abonnes_jeton_idx on public.abonnes (jeton);

create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  objet text not null,
  intro text not null default '',
  article_ids uuid[] not null default '{}',
  statut text not null default 'brouillon'
    check (statut in ('brouillon','validee','en_cours','envoyee','arretee','echec')),
  test_a text,
  cree_par uuid references public.profiles(id),
  cree_le timestamptz not null default now(),
  validee_par uuid references public.profiles(id),
  validee_le timestamptz,
  envoyee_le timestamptz,
  nb_destinataires int not null default 0,
  nb_envoyes int not null default 0,
  derniere_erreur text
);

create table if not exists public.newsletter_envois (
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  abonne_id uuid not null references public.abonnes(id) on delete cascade,
  statut text not null check (statut in ('envoye','echec')),
  envoye_le timestamptz not null default now(),
  erreur text,
  primary key (newsletter_id, abonne_id)
);
create index if not exists newsletter_envois_date_idx on public.newsletter_envois (envoye_le);

-- Sécurité : tout réservé aux admins ; modification seulement à l'état brouillon.
alter table public.newsletters enable row level security;
drop policy if exists newsletters_admin_read on public.newsletters;
create policy newsletters_admin_read on public.newsletters for select using (public.is_admin());
drop policy if exists newsletters_admin_insert on public.newsletters;
create policy newsletters_admin_insert on public.newsletters for insert
  with check (public.is_admin() and statut = 'brouillon');
drop policy if exists newsletters_admin_update on public.newsletters;
create policy newsletters_admin_update on public.newsletters for update
  using (public.is_admin() and statut = 'brouillon')
  with check (public.is_admin() and statut = 'brouillon');

grant select, insert on public.newsletters to authenticated;
grant update (objet, intro, article_ids, test_a) on public.newsletters to authenticated;
grant all on public.newsletters to service_role;

alter table public.newsletter_envois enable row level security;
drop policy if exists newsletter_envois_admin_read on public.newsletter_envois;
create policy newsletter_envois_admin_read on public.newsletter_envois for select using (public.is_admin());
grant select on public.newsletter_envois to authenticated;
grant all on public.newsletter_envois to service_role;

-- Changements d'état réservés aux admins, avec contrôle de l'état de départ.
create or replace function public.valider_newsletter(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select count(*) into n from public.abonnes where statut = 'actif';
  update public.newsletters
     set statut = 'validee', validee_par = auth.uid(), validee_le = now(), nb_destinataires = n
   where id = p_id and statut = 'brouillon';
  if not found then raise exception 'Action impossible dans l''état actuel'; end if;
  return n;
end $$;

create or replace function public.annuler_newsletter(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.newsletters set statut = 'brouillon', validee_par = null, validee_le = null
   where id = p_id and statut = 'validee';
  if not found then raise exception 'Action impossible dans l''état actuel'; end if;
end $$;

create or replace function public.arreter_newsletter(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.newsletters set statut = 'arretee' where id = p_id and statut = 'en_cours';
  if not found then raise exception 'Action impossible dans l''état actuel'; end if;
end $$;

grant execute on function public.valider_newsletter(uuid) to authenticated;
grant execute on function public.annuler_newsletter(uuid) to authenticated;
grant execute on function public.arreter_newsletter(uuid) to authenticated;

-- Désinscription par lien : silencieuse si le jeton est inconnu.
create or replace function public.desinscrire_newsletter(p_jeton uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.abonnes set statut = 'desinscrit' where jeton = p_jeton;
end $$;

grant execute on function public.desinscrire_newsletter(uuid) to anon, authenticated;

-- Calculs côté base pour le script d'envoi (évite le plafond de 1 000 lignes de l'API).
-- Réservés au service_role.
create or replace function public.newsletter_destinataires(p_newsletter uuid, p_limite int)
returns table (id uuid, email text, jeton uuid) language sql stable set search_path = public as $$
  select a.id, a.email, a.jeton from public.abonnes a
   where a.statut = 'actif'
     and not exists (select 1 from public.newsletter_envois e where e.newsletter_id = p_newsletter and e.abonne_id = a.id)
   order by a.cree_le, a.id
   limit greatest(p_limite, 0);
$$;

create or replace function public.newsletter_comptes()
returns table (minute int, heure int, jour int) language sql stable set search_path = public as $$
  select count(*) filter (where envoye_le > now() - interval '1 minute')::int,
         count(*) filter (where envoye_le > now() - interval '1 hour')::int,
         count(*)::int
    from public.newsletter_envois where envoye_le > now() - interval '24 hours';
$$;

revoke all on function public.newsletter_destinataires(uuid, int) from public, anon, authenticated;
revoke all on function public.newsletter_comptes() from public, anon, authenticated;
grant execute on function public.newsletter_destinataires(uuid, int) to service_role;
grant execute on function public.newsletter_comptes() to service_role;
