-- ---------------------------------------------------------------------------
-- Sanjana portfolio — Supabase schema
--
-- Paste this into the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- Everything here is public-read only; writes go through the dashboard or a
-- service-role key, never from the browser.
--
-- The app reads a single view, `performances_full`, which returns exactly the
-- `Performance` shape the TypeScript model expects — so one request fills the
-- whole site and no client-side joining is needed.
-- ---------------------------------------------------------------------------

create table if not exists performances (
  slug         text primary key,
  title        text not null,
  subtitle     text not null,
  category     text not null
                 check (category in ('solo-concert', 'musical-theatre',
                                     'studio-session', 'collaboration')),
  year         int  not null,
  venue        text not null,
  city         text not null,
  blurb        text not null,          -- one line, shown in the index overlay
  description  text not null,          -- long-form copy on the detail page
  role         text,                   -- character / billing, for theatre
  runtime      text,
  poster       text not null,          -- path or CDN url
  video_src    text,                   -- optional; the UI degrades without it
  featured     boolean not null default false,
  accent       text,                   -- hex; falls back to the category accent
  sort_index   int  not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists tracks (
  id               text primary key,
  performance_slug text not null references performances(slug) on delete cascade,
  title            text not null,
  composer         text,
  duration         int  not null,      -- seconds
  audio_src        text,               -- optional; player falls back to a tone
  note             text,
  position         int  not null default 0
);

create table if not exists credits (
  id               bigserial primary key,
  performance_slug text not null references performances(slug) on delete cascade,
  role             text not null,
  name             text not null,
  position         int  not null default 0
);

create table if not exists gallery_images (
  id               bigserial primary key,
  performance_slug text not null references performances(slug) on delete cascade,
  url              text not null,
  position         int  not null default 0
);

-- Single-row table for the About/Contact copy.
create table if not exists profile (
  id           int primary key default 1 check (id = 1),
  name         text not null,
  role         text not null,
  tagline      text not null,
  "bioShort"   text not null,
  bio          jsonb not null default '[]'::jsonb,   -- text[]
  "basedIn"    text not null,
  "vocalRange" text not null,
  training     jsonb not null default '[]'::jsonb,   -- text[]
  portraits    jsonb not null default '[]'::jsonb,   -- text[]
  press        jsonb not null default '[]'::jsonb,   -- {quote, source}[]
  stats        jsonb not null default '[]'::jsonb,   -- {value, label}[]
  contact      jsonb not null default '{}'::jsonb
);

create index if not exists tracks_perf_idx  on tracks(performance_slug, position);
create index if not exists credits_perf_idx on credits(performance_slug, position);
create index if not exists gallery_perf_idx on gallery_images(performance_slug, position);
create index if not exists performances_year_idx on performances(year desc);

-- ---------------------------------------------------------------------------
-- The view the client actually reads. Nested arrays are built here so the
-- browser makes one request and gets objects matching src/types/content.ts.
-- Keys are quoted to preserve the camelCase the TypeScript model uses.
-- ---------------------------------------------------------------------------
create or replace view performances_full as
select
  p.slug, p.title, p.subtitle, p.category, p.year, p.venue, p.city,
  p.blurb, p.description, p.role, p.runtime, p.poster,
  p.video_src, p.featured, p.accent,
  coalesce(
    (select jsonb_agg(g.url order by g.position)
       from gallery_images g where g.performance_slug = p.slug),
    '[]'::jsonb
  ) as gallery,
  coalesce(
    (select jsonb_agg(jsonb_build_object('role', c.role, 'name', c.name)
                      order by c.position)
       from credits c where c.performance_slug = p.slug),
    '[]'::jsonb
  ) as credits,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
              'id', t.id, 'title', t.title, 'composer', t.composer,
              'duration', t.duration, 'audioSrc', t.audio_src, 'note', t.note)
                      order by t.position)
       from tracks t where t.performance_slug = p.slug),
    '[]'::jsonb
  ) as tracks
from performances p;

-- ---------------------------------------------------------------------------
-- Row Level Security: the site ships an anon key, so read must be public and
-- write must be impossible with it. No insert/update/delete policy exists,
-- which means the anon key cannot write at all.
-- ---------------------------------------------------------------------------
alter table performances   enable row level security;
alter table tracks         enable row level security;
alter table credits        enable row level security;
alter table gallery_images enable row level security;
alter table profile        enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where tablename = 'performances' and policyname = 'public read') then
    create policy "public read" on performances   for select using (true);
    create policy "public read" on tracks         for select using (true);
    create policy "public read" on credits        for select using (true);
    create policy "public read" on gallery_images for select using (true);
    create policy "public read" on profile        for select using (true);
  end if;
end $$;

-- Views inherit the RLS of their underlying tables in Postgres 15+.
grant select on performances_full to anon, authenticated;
