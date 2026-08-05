-- bucket public en lecture pour servir les images du site
insert into storage.buckets (id, name, public) values ('medias','medias', true)
  on conflict (id) do nothing;

create policy medias_public_read on storage.objects for select using (bucket_id = 'medias');
create policy medias_auth_insert on storage.objects for insert
  with check (bucket_id = 'medias' and auth.uid() is not null);
