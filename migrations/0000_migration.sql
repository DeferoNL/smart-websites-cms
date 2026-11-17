create type public.app_role as enum ('admin','editor');
create type public.page_status as enum ('draft','live');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "own profile or staff read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own roles or admin read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  project_name text not null default 'Master CMS',
  primary_domain text,
  tagline text,
  default_og_image text,
  updated_at timestamptz not null default now()
);
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status page_status not null default 'draft',
  sort_order int not null default 0,
  show_in_nav boolean not null default true,
  seo_title text,
  meta_description text,
  og_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.media (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null unique,
  url text not null,
  folder text not null default 'general',
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.site_settings, public.pages, public.blocks, public.media, public.redirects to anon;
grant select, insert, update, delete on public.site_settings, public.pages, public.blocks, public.media, public.redirects to authenticated;
grant all on public.site_settings, public.pages, public.blocks, public.media, public.redirects to service_role;
alter table public.site_settings enable row level security;
alter table public.pages enable row level security;
alter table public.blocks enable row level security;
alter table public.media enable row level security;
alter table public.redirects enable row level security;

create policy "public read settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admin write settings" on public.site_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public read live pages" on public.pages for select to anon, authenticated
  using (status = 'live' or public.is_staff(auth.uid()));
create policy "staff write pages" on public.pages for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "public read live blocks" on public.blocks for select to anon, authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.pages p where p.id = page_id and p.status = 'live'));
create policy "staff write blocks" on public.blocks for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "public read media" on public.media for select to anon, authenticated using (true);
create policy "staff write media" on public.media for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "public read redirects" on public.redirects for select to anon, authenticated using (active or public.is_staff(auth.uid()));
create policy "staff write redirects" on public.redirects for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

insert into public.site_settings (id, project_name, tagline) values (1, 'Master CMS', 'Een schone basis voor elke klantsite');
insert into public.pages (id, slug, title, status, sort_order, seo_title, meta_description) values
 ('00000000-0000-0000-0000-000000000001','home','Home','live',0,'Welkom','Voorbeeldpagina aangedreven door Master CMS'),
 ('00000000-0000-0000-0000-000000000002','over-ons','Over ons','live',1,'Over ons','Wie wij zijn');
insert into public.blocks (page_id, type, data, sort_order) values
 ('00000000-0000-0000-0000-000000000001','hero','{"title":"Bouw sneller met Master CMS","subtitle":"Pagina''s, blokken, media en SEO op één plek.","ctaLabel":"Over ons","ctaHref":"/over-ons"}',0),
 ('00000000-0000-0000-0000-000000000001','heading','{"text":"Wat je krijgt"}',1),
 ('00000000-0000-0000-0000-000000000001','text','{"text":"Elke pagina bestaat uit losse blokken die je in het dashboard herschikt en bewerkt."}',2),
 ('00000000-0000-0000-0000-000000000001','cta','{"title":"Klaar om te starten?","label":"Naar dashboard","href":"/admin"}',3),
 ('00000000-0000-0000-0000-000000000002','heading','{"text":"Over ons"}',0),
 ('00000000-0000-0000-0000-000000000002','text','{"text":"Dit is een voorbeeldpagina. Pas hem aan in het dashboard."}',1);

create policy "public read cms media" on storage.objects for select using (bucket_id = 'media');
create policy "staff upload cms media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_staff(auth.uid()));
create policy "staff delete cms media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_staff(auth.uid()));