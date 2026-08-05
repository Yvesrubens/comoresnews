-- profil auto à la création d'un utilisateur Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, nom) values (new.id, coalesce(new.raw_user_meta_data->>'nom',''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- maj_le auto sur update d'article
create or replace function public.touch_maj_le()
returns trigger language plpgsql as $$
begin new.maj_le = now(); return new; end $$;

create trigger articles_touch_maj_le
  before update on public.articles for each row execute function public.touch_maj_le();
