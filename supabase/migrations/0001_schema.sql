-- profiles : 1 ligne par utilisateur Auth
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null default '',
  role text not null default 'redacteur' check (role in ('admin','redacteur')),
  cree_le timestamptz not null default now()
);

-- categories : remplace config/categories.json
create table public.categories (
  slug text primary key,
  nom text not null,
  ordre int not null default 0
);

-- articles
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  slug text not null unique,
  categorie text not null references public.categories(slug),
  auteur_id uuid not null references public.profiles(id),
  corps text not null default '',
  excerpt text not null default '',
  image_couverture text not null default '',
  seo_titre text not null default '',
  seo_description text not null default '',
  og_image text not null default '',
  mots_cles text[] not null default '{}',
  statut text not null default 'brouillon'
    check (statut in ('brouillon','en_attente','programme','publie')),
  date_programmee timestamptz,
  date_publication timestamptz,
  commentaire_relecture text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index articles_statut_idx on public.articles(statut);
create index articles_categorie_idx on public.articles(categorie);

-- media
create table public.media (
  id uuid primary key default gen_random_uuid(),
  chemin text not null,
  url text not null,
  importe_par uuid references public.profiles(id),
  cree_le timestamptz not null default now()
);

-- seed catégories (repris de config/categories.json)
insert into public.categories(slug,nom,ordre) values
  ('politique','Politique',1),('economie','Économie',2),('societe','Société',3),
  ('culture','Culture',4),('sport','Sport',5),('diaspora','Diaspora',6),
  ('monde','Monde',7),('tourisme','Tourisme',8),('annonces','Annonces',9);
