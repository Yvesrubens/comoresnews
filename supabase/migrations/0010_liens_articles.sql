-- Liste des articles publiés pour l'outil « Insérer un lien » du back-office.
-- Un rédacteur ne lit que ses propres articles (RLS) ; cette fonction lui donne
-- seulement titre/slug/date des articles publiés, rien d'autre.
create or replace function public.articles_publies_pour_liens()
returns table (id uuid, titre text, slug text, date_publication timestamptz)
language sql stable security definer set search_path = public
as $$
  select a.id, a.titre, a.slug, a.date_publication
  from public.articles a
  where a.statut = 'publie' and a.date_publication is not null
  order by a.date_publication desc;
$$;

revoke all on function public.articles_publies_pour_liens() from public, anon;
grant execute on function public.articles_publies_pour_liens() to authenticated;
