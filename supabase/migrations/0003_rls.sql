alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.media enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- categories : lecture connectés, écriture admin
create policy categories_read on public.categories for select using (auth.uid() is not null);
create policy categories_admin_write on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- articles
create policy articles_admin_all on public.articles for all
  using (public.is_admin()) with check (public.is_admin());
create policy articles_writer_read on public.articles for select
  using (auteur_id = auth.uid());
create policy articles_writer_insert on public.articles for insert
  with check (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));
create policy articles_writer_update on public.articles for update
  using (auteur_id = auth.uid() and statut in ('brouillon','en_attente'))
  with check (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));
create policy articles_writer_delete on public.articles for delete
  using (auteur_id = auth.uid() and statut in ('brouillon','en_attente'));

-- media : lecture connectés, insert éditeurs, delete auteur/admin
create policy media_read on public.media for select using (auth.uid() is not null);
create policy media_insert on public.media for insert with check (importe_par = auth.uid());
create policy media_delete on public.media for delete
  using (importe_par = auth.uid() or public.is_admin());
