-- RunArena — Supabase schema (Postgres). Run once in the SQL editor.
-- Creates tables, row-level security, an anti-cheat validation trigger, and
-- enables realtime on results. Safe to re-run.

-- ------------------------------------------------------------------ tables
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'นักวิ่ง',
  points      int  not null default 1080,
  streak      int  not null default 0,
  streak_date date,
  created_at  timestamptz not null default now()
);

create table if not exists public.routes (
  id          text primary key,
  name        text not null,
  coords      jsonb not null,
  distance_km numeric,
  created_by  uuid references public.profiles(id) on delete set null,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- one row = a user's best time on a route
create table if not exists public.results (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  route_id   text not null,
  sec        int  not null,
  km         numeric,          -- distance actually covered (for validation)
  verified   boolean not null default false,
  source     text,             -- 'gps' | 'sim' | ...
  updated_at timestamptz not null default now(),
  primary key (user_id, route_id)
);

create table if not exists public.favorites (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  route_id text not null,
  primary key (user_id, route_id)
);

create index if not exists results_route_idx on public.results (route_id, sec);

-- --------------------------------------------------------------------- RLS
alter table public.profiles  enable row level security;
alter table public.routes    enable row level security;
alter table public.results   enable row level security;
alter table public.favorites enable row level security;

-- profiles: anyone may read (leaderboard names); only the owner may write.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read   on public.profiles for select using (true);
drop policy if exists profiles_write on public.profiles;
create policy profiles_write  on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- results: anyone may read (leaderboards); only the owner may write their own.
drop policy if exists results_read on public.results;
create policy results_read    on public.results for select using (true);
drop policy if exists results_write on public.results;
create policy results_write   on public.results for insert with check (auth.uid() = user_id);
drop policy if exists results_update on public.results;
create policy results_update  on public.results for update using (auth.uid() = user_id);

-- routes: published are public; owner sees/edits their own.
drop policy if exists routes_read on public.routes;
create policy routes_read     on public.routes for select using (published or auth.uid() = created_by);
drop policy if exists routes_write on public.routes;
create policy routes_write    on public.routes for insert with check (auth.uid() = created_by);
drop policy if exists routes_update on public.routes;
create policy routes_update   on public.routes for update using (auth.uid() = created_by);

-- favorites: fully private to the owner.
drop policy if exists favorites_all on public.favorites;
create policy favorites_all   on public.favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------- anti-cheat validation
-- Basic sanity: reject impossible times, and when a distance is supplied,
-- reject implausible paces (< 2:30/km or > 20:00/km). A fuller check (GPS trace
-- continuity) belongs in an Edge Function; this trigger is the first line.
create or replace function public.validate_result() returns trigger as $$
begin
  if new.sec is null or new.sec < 30 or new.sec > 21600 then
    raise exception 'implausible time (sec=%)', new.sec;
  end if;
  if new.km is not null and new.km > 0 then
    if (new.sec / new.km) < 150 or (new.sec / new.km) > 1200 then
      raise exception 'implausible pace';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists results_validate on public.results;
create trigger results_validate before insert or update on public.results
  for each row execute function public.validate_result();

-- ---------------------------------------------------------------- realtime
-- Live leaderboards: broadcast INSERT/UPDATE on results.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'results'
  ) then
    alter publication supabase_realtime add table public.results;
  end if;
end $$;
