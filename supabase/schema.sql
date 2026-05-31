-- Accomplete: Consolidated Production Schema (baseline)
-- Generated: 2026-05-29
--
-- This is a single-file consolidation of migrations 001–010, intended to
-- stand up a FRESH production database in one shot. It is NOT a replacement
-- for the numbered migration history in `migration/` — that history is the
-- source of truth for the existing (test) database. This baseline folds every
-- ALTER from 002–010 directly into the CREATE TABLE statements, so there is
-- nothing incremental to apply afterward.
--
-- Backfills (migration 009's follower-count UPDATEs) are intentionally omitted:
-- a fresh DB starts empty, so there is nothing to backfill. The triggers that
-- KEEP those columns in sync going forward are retained.
--
-- Migration provenance is noted inline as `-- [NNN]`.
--
-- Apply once against the new prod project (e.g. Supabase SQL editor, or
-- `psql < schema.sql`). Requires the `auth.users` table to already exist
-- (Supabase provides it).

-- ============================================
-- PROFILES                                            [001 + 004 + 009 + 010]
-- ============================================
-- Extends Supabase auth.users with app-specific data.
-- Auto-created on signup via the on_auth_user_created trigger (id only).

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  display_name text,
  avatar_url text,
  total_score integer default 0 not null,
  global_streak integer default 0 not null,
  highest_streak integer default 0 not null,
  completed_goals_count integer default 0 not null,
  active_goals_count integer default 0 not null,
  dropped_goals_count integer default 0 not null,
  last_checkin_date date,                                       -- [004] global-streak math
  followers_count integer default 0 not null,                   -- [009] cached, trigger-maintained
  following_count integer default 0 not null,                   -- [009] cached, trigger-maintained
  timezone text not null default 'UTC',                         -- [010] IANA zone; source of truth for "today"
  is_deleted boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- GOALS                                   [001 + 003 + 005 + 007 + 008]
-- ============================================

create table goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  goal_name text not null,
  goal_description text,
  goal_type text,
  category text,                                                -- [008] UI grouping pill; free-form, no CHECK
  benchmark_name text,
  benchmark_target_value numeric,
  checkin_frequency text not null,                              -- dormant (daily-only scoring); app supplies a default
  days_between_checkins numeric not null,                       -- dormant; app supplies a default
  target_completion_at timestamptz not null,
  completion_message text,
  status text default 'active' not null check (status in ('active', 'completed', 'dropped')),
  completed_at timestamptz,
  total_milestones integer default 0 not null,
  checkin_value integer default 0 not null,
  score_checkin integer default 0 not null,
  score_milestone integer default 0 not null,
  score_completion integer,                                     -- [005] nullable; set only on completion (5x bonus)
  score_total integer generated always as                      -- [007] sortable total; PostgREST can't order by expr
    (score_checkin + score_milestone) stored,
  last_checkin_date date,                                       -- [003] "already scored today?" once-per-day guard
  current_streak integer default 0 not null,
  best_streak integer default 0 not null,
  is_public boolean default false not null,
  is_goal_name_public boolean default true not null,
  is_username_public boolean default true not null,
  is_description_public boolean default true not null,
  is_goal_type_public boolean default true not null,
  are_checkins_public boolean default true not null,
  is_benchmark_name_public boolean default true not null,
  is_deleted boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- MILESTONES                                          [001 + 002]
-- ============================================
-- Auto-generated when a goal is created.
-- Count by duration: <30d = 1, 30-90d = 3, 90+d = 5.

create table milestones (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  order_index integer not null,
  target_date timestamptz not null,
  message text,
  reached_at timestamptz,
  points_earned integer default 0 not null,
  checkin_score_at_creation integer not null default 0,         -- [002] snapshot for one-subtraction bonus math
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- CHECKINS                                            [001]
-- ============================================

create table checkins (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  metric_value numeric,
  notes text,
  points_earned integer default 0 not null,
  is_deleted boolean default false not null,                    -- soft delete; points stay permanent
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- RELATIONS (follows + blocks)                        [001]
-- ============================================

create table relations (
  id uuid default gen_random_uuid() primary key,
  source_id uuid references profiles(id) on delete cascade not null,
  destination_id uuid references profiles(id) on delete cascade not null,
  is_following boolean default false not null,
  is_blocked boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- One relationship row per directed user pair
  unique (source_id, destination_id)
);

-- ============================================
-- INDEXES                                   [001 + 006 + 007]
-- ============================================

-- Goals: fast lookup by user
create index idx_goals_user_id on goals(user_id);

-- Goals: cheap public-active filter
create index idx_goals_public on goals(is_public, status) where is_public = true and is_deleted = false;

-- Milestones / checkins: fast lookup by goal / user
create index idx_milestones_goal_id on milestones(goal_id);
create index idx_checkins_goal_id on checkins(goal_id);
create index idx_checkins_user_id on checkins(user_id);

-- Relations: follow lookups (partial on is_following)
create index idx_relations_source on relations(source_id) where is_following = true;
create index idx_relations_destination on relations(destination_id) where is_following = true;

-- [006] Relations: block lookups (partial on is_blocked) — used by read-time getBlockSet
create index idx_relations_blocked_source on relations(source_id) where is_blocked = true;
create index idx_relations_blocked_destination on relations(destination_id) where is_blocked = true;

-- [007] Global-feed sort indexes. Each mirrors the query's ORDER BY (sort col,
-- then created_at desc, id desc tie-break) and is partial on the feed filter
-- (public + not deleted + username public) to stay small.
create index idx_goals_feed_created_at
  on goals (created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

create index idx_goals_feed_current_streak
  on goals (current_streak desc, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

create index idx_goals_feed_best_streak
  on goals (best_streak desc, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

-- nulls last: goals with no check-in yet sink in the "recently active" sort
create index idx_goals_feed_last_checkin
  on goals (last_checkin_date desc nulls last, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

create index idx_goals_feed_score_total
  on goals (score_total desc, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

-- ============================================
-- UPDATED_AT TRIGGER                                  [001]
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger goals_updated_at
  before update on goals
  for each row execute function update_updated_at();

create trigger milestones_updated_at
  before update on milestones
  for each row execute function update_updated_at();

create trigger checkins_updated_at
  before update on checkins
  for each row execute function update_updated_at();

create trigger relations_updated_at
  before update on relations
  for each row execute function update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP                       [001]
-- ============================================
-- Inserts a bare profile (id only) on signup. Username + timezone are set
-- later during onboarding; timezone falls back to the 'UTC' column default
-- until then.

-- search_path is pinned to '' so the trigger resolves names the same way
-- regardless of the calling context (the auth.users insert). That forces
-- fully-qualified names below — public.profiles, not profiles.
create or replace function create_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_profile_on_signup();

-- ============================================
-- FOLLOWER-COUNT SYNC TRIGGER                         [009]
-- ============================================
-- Applies +/- deltas to both endpoints when is_following flips. Block toggles
-- do not affect counts. (No backfill here — fresh DB starts at 0.)
--
-- security definer (+ pinned search_path) is REQUIRED: the function updates the
-- followee's profile row (destination_id), which the calling `authenticated`
-- user does not own. Without it, the profiles UPDATE RLS policy silently blocks
-- that write and followers_count never moves. [011]
create or replace function sync_follower_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_following boolean := false;
  is_following_now boolean := false;
begin
  if tg_op = 'INSERT' then
    is_following_now := new.is_following;
  elsif tg_op = 'DELETE' then
    was_following := old.is_following;
  elsif tg_op = 'UPDATE' then
    was_following := old.is_following;
    is_following_now := new.is_following;
  end if;

  if was_following = is_following_now then
    return coalesce(new, old);
  end if;

  if was_following then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.source_id;
    update public.profiles set followers_count = greatest(0, followers_count - 1) where id = old.destination_id;
  end if;

  if is_following_now then
    update public.profiles set following_count = following_count + 1 where id = new.source_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.destination_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger relations_sync_follower_counts
  after insert or update or delete on relations
  for each row execute function sync_follower_counts();

-- ============================================
-- ROW LEVEL SECURITY                                  [001]
-- ============================================

alter table profiles enable row level security;
alter table goals enable row level security;
alter table milestones enable row level security;
alter table checkins enable row level security;
alter table relations enable row level security;

-- PROFILES
create policy "Profiles are viewable by everyone"
  on profiles for select
  using (is_deleted = false);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- GOALS
create policy "Users can view own goals"
  on goals for select
  using (auth.uid() = user_id and is_deleted = false);

create policy "Users can insert own goals"
  on goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on goals for update
  using (auth.uid() = user_id and is_deleted = false);

create policy "Public goals are viewable by everyone"
  on goals for select
  using (is_public = true and is_deleted = false);

-- MILESTONES
create policy "Users can manage own milestones"
  on milestones for all
  using (auth.uid() = user_id);

create policy "Public goal milestones are viewable"
  on milestones for select
  using (
    exists (
      select 1 from goals
      where goals.id = milestones.goal_id
      and goals.is_public = true
      and goals.is_deleted = false
    )
  );

-- CHECKINS
create policy "Users can manage own checkins"
  on checkins for select
  using (auth.uid() = user_id and is_deleted = false);

create policy "Users can insert own checkins"
  on checkins for insert
  with check (auth.uid() = user_id);

create policy "Users can update own checkins"
  on checkins for update
  using (auth.uid() = user_id);

create policy "Public goal checkins are viewable"
  on checkins for select
  using (
    is_deleted = false and
    exists (
      select 1 from goals
      where goals.id = checkins.goal_id
      and goals.is_public = true
      and goals.are_checkins_public = true
      and goals.is_deleted = false
    )
  );

-- RELATIONS
create policy "Users can manage own relations"
  on relations for all
  using (auth.uid() = source_id);

create policy "Users can see who follows them"
  on relations for select
  using (auth.uid() = destination_id);

-- ============================================
-- API ROLE GRANTS
-- ============================================
-- Supabase's PostgREST API connects as anon / authenticated. RLS (above)
-- controls WHICH ROWS each role sees, but the roles still need table-level
-- privileges to reach the table at all. Tables created via the Dashboard get
-- these automatically; tables created via raw SQL (this file) do not, so we
-- grant them explicitly. `grant all` is safe here because RLS is the real
-- gate — anon/authenticated only ever touch rows their policies permit.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Same grants for any objects created later in this schema.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
