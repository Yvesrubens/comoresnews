-- Import automatique de sujets depuis la presse comorienne.
-- Spec : docs/superpowers/specs/2026-10-20-import-sources-design.md

-- Mention de la source sur les articles réécrits
alter table public.articles add column if not exists source_nom text;
alter table public.articles add column if not exists source_url text;

-- Sujets importés (texte source = référence interne, jamais publié)
create table if not exists public.sujets (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_nom text not null,
  url text not null unique,
  titre text not null,
  texte text not null default '',
  categorie_source text not null default '',
  categorie text references public.categories(slug),
  date_source timestamptz,
  statut text not null default 'nouveau' check (statut in ('nouveau','traite','ignore')),
  article_id uuid references public.articles(id) on delete set null,
  importe_le timestamptz not null default now()
);
create index if not exists sujets_statut_importe_idx on public.sujets (statut, importe_le desc);

-- Sécurité : lecture et changement de statut (nouveau/ignore) pour les connectés ;
-- insertion/suppression réservées au service_role ; "traite" seulement via rediger_sujet.
alter table public.sujets enable row level security;
drop policy if exists sujets_read on public.sujets;
create policy sujets_read on public.sujets for select using (auth.uid() is not null);
drop policy if exists sujets_update on public.sujets;
create policy sujets_update on public.sujets for update
  using (auth.uid() is not null and statut in ('nouveau','ignore'))
  with check (statut in ('nouveau','ignore'));

grant select on public.sujets to authenticated;
grant update (statut) on public.sujets to authenticated;
grant all on public.sujets to service_role;

-- Réserve un sujet et crée le brouillon d'article (corps vide), de façon atomique.
create or replace function public.rediger_sujet(p_sujet uuid, p_categorie text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sujets%rowtype;
  v_slug text := p_slug;
  v_article uuid;
begin
  if auth.uid() is null then
    raise exception 'non authentifie';
  end if;

  update public.sujets set statut = 'traite'
    where id = p_sujet and statut = 'nouveau'
    returning * into s;
  if not found then
    raise exception 'Sujet déjà pris en charge';
  end if;

  if exists (select 1 from public.articles where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);
  end if;

  insert into public.articles (titre, slug, categorie, auteur_id, corps, statut, source_nom, source_url)
    values (s.titre, v_slug, p_categorie, auth.uid(), '', 'brouillon', s.source_nom, s.url)
    returning id into v_article;

  update public.sujets set article_id = v_article where id = p_sujet;
  return v_article;
end $$;

grant execute on function public.rediger_sujet(uuid, text, text) to authenticated;

-- Si l'article issu d'un sujet est supprimé, le sujet redevient disponible.
create or replace function public.liberer_sujet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sujets set statut = 'nouveau', article_id = null where article_id = old.id;
  return old;
end $$;

drop trigger if exists articles_liberer_sujet on public.articles;
create trigger articles_liberer_sujet
  before delete on public.articles
  for each row execute function public.liberer_sujet();
