-- Marketing HQ: first-cut schema (25 Nov 2026)
-- Posts, photos, ideas, docs + allowlist-only access + public photo bucket.

-- ───────────── Allowlist ─────────────
create table public.allowed_users (
  email text primary key check (email = lower(email)),
  name  text,
  added_at timestamptz not null default now()
);

insert into public.allowed_users (email, name) values
  ('arkykk@gmail.com', 'Arcadie'),
  ('irina.zaretcaia@gmail.com', 'Irina'),
  ('info@bigfish.careers', 'Big Fish');

create or replace function public.is_allowed()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Block sign-ups from anyone not on the allowlist (magic link creates the user on first login).
create or replace function public.enforce_allowlist()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.allowed_users where email = lower(new.email)) then
    raise exception 'This email is not allowed to use Marketing HQ';
  end if;
  return new;
end;
$$;

create trigger enforce_allowlist
  before insert on auth.users
  for each row execute function public.enforce_allowlist();

-- ───────────── Shared helpers ─────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────── Photos ─────────────
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text unique,
  public_url text,
  width int,
  height int,
  alt text,
  source text,                 -- library ID (26-0519), 'upload', or a Drive id
  tags text[] not null default '{}',
  rating smallint check (rating between 1 and 3),
  year smallint,
  consent_ok boolean not null default false,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);
create index photos_tags_idx on public.photos using gin (tags);
create index photos_source_idx on public.photos (source);

-- ───────────── Posts ─────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('bigfish', 'arcadie')),
  channel text not null check (channel in (
    'bf_linkedin_page', 'bf_ig_fb', 'bf_tiktok',
    'arcadie_linkedin', 'arcadie_ig', 'arcadie_fb')),
  language text not null default 'en',          -- 'ua+en', 'en', 'ro', …
  scheduled_at timestamptz,                      -- shown in Europe/Madrid
  caption text not null default '',
  pillar text,
  status text not null default 'draft' check (status in (
    'draft', 'change', 'approved', 'scheduled', 'published', 'skipped')),
  change_note text,
  show_again boolean not null default false,
  tool text check (tool in ('typefully', 'buffer', 'metricool', 'manual')),
  external_id text,
  external_url text,
  pair_id uuid,                                  -- same story across channels
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  history jsonb not null default '[]'::jsonb
);
create index posts_scheduled_idx on public.posts (scheduled_at);
create index posts_status_idx on public.posts (status);
create index posts_pair_idx on public.posts (pair_id);

create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- Append status changes and new change notes to history automatically.
create or replace function public.posts_log_history()
returns trigger language plpgsql set search_path = '' as $$
declare
  who text := coalesce(auth.jwt() ->> 'email', 'system');
begin
  if tg_op = 'INSERT' then
    new.history := new.history || jsonb_build_array(jsonb_build_object(
      'at', now(), 'by', who, 'event', 'created', 'status', new.status));
  else
    if new.status is distinct from old.status then
      new.history := new.history || jsonb_build_array(jsonb_build_object(
        'at', now(), 'by', who, 'event', 'status', 'from', old.status, 'to', new.status));
    end if;
    if new.change_note is distinct from old.change_note and coalesce(new.change_note, '') <> '' then
      new.history := new.history || jsonb_build_array(jsonb_build_object(
        'at', now(), 'by', who, 'event', 'note', 'note', new.change_note));
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_history before insert or update on public.posts
  for each row execute function public.posts_log_history();

create table public.post_photos (
  post_id uuid not null references public.posts (id) on delete cascade,
  photo_id uuid not null references public.photos (id) on delete restrict,
  position smallint not null default 0,
  primary key (post_id, photo_id)
);
create index post_photos_photo_idx on public.post_photos (photo_id);

-- ───────────── Ideas ─────────────
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  pillar text,
  brand text check (brand in ('bigfish', 'arcadie')),
  status text not null default 'open',          -- 'open' | 'used yyyy-mm-dd'
  source text,
  created_at timestamptz not null default now()
);

-- ───────────── Docs (strategy, tone, rules, plans) ─────────────
create table public.docs (
  slug text primary key,
  title text not null,
  markdown text not null default '',
  updated_at timestamptz not null default now()
);
create trigger docs_touch before update on public.docs
  for each row execute function public.touch_updated_at();

-- ───────────── Row-level security: allowlisted, signed-in users only ─────────────
alter table public.allowed_users enable row level security;
alter table public.photos        enable row level security;
alter table public.posts         enable row level security;
alter table public.post_photos   enable row level security;
alter table public.ideas         enable row level security;
alter table public.docs          enable row level security;

create policy "allowlist read" on public.allowed_users
  for select to authenticated using ((select public.is_allowed()));

create policy "team all" on public.photos      for all to authenticated
  using ((select public.is_allowed())) with check ((select public.is_allowed()));
create policy "team all" on public.posts       for all to authenticated
  using ((select public.is_allowed())) with check ((select public.is_allowed()));
create policy "team all" on public.post_photos for all to authenticated
  using ((select public.is_allowed())) with check ((select public.is_allowed()));
create policy "team all" on public.ideas       for all to authenticated
  using ((select public.is_allowed())) with check ((select public.is_allowed()));
create policy "team all" on public.docs        for all to authenticated
  using ((select public.is_allowed())) with check ((select public.is_allowed()));

-- ───────────── Storage: public bucket for post photos ─────────────
-- Public URLs go straight into Buffer / Metricool; only the team can upload or change.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

create policy "team upload post-photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-photos' and (select public.is_allowed()));
create policy "team update post-photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-photos' and (select public.is_allowed()));
create policy "team delete post-photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-photos' and (select public.is_allowed()));
