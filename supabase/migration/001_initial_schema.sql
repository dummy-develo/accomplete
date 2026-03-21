-- Accomplete: Initial Schema Migration
-- Date: March 21, 2026
 
-- ============================================
-- PROFILES
-- ============================================
-- Extends Supabase auth.users with app-specific data
-- Automatically created when a user signs up (via trigger)
 
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
  is_deleted boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
 
-- ============================================
-- GOALS
-- ============================================
 
create table goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  goal_name text not null,
  goal_description text,
  goal_type text,
  benchmark_name text,
  benchmark_target_value numeric,
  checkin_frequency text not null,
  days_between_checkins numeric not null,
  target_completion_at timestamptz not null,
  completion_message text,
  status text default 'active' not null check (status in ('active', 'completed', 'dropped')),
  completed_at timestamptz,
  total_milestones integer default 0 not null,
  checkin_value integer default 0 not null,
  score_checkin integer default 0 not null,
  score_milestone integer default 0 not null,
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
-- MILESTONES
-- ============================================
-- Auto-generated when a goal is created
-- Number based on goal duration: <30d = 1, 30-90d = 3, 90+d = 5
 
create table milestones (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  order_index integer not null,
  target_date timestamptz not null,
  message text,
  reached_at timestamptz,
  points_earned integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
 
-- ============================================
-- CHECKINS
-- ============================================
 
create table checkins (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  metric_value numeric,
  notes text,
  points_earned integer default 0 not null,
  is_deleted boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
 
-- ============================================
-- RELATIONS (follows + blocks)
-- ============================================
 
create table relations (
  id uuid default gen_random_uuid() primary key,
  source_id uuid references profiles(id) on delete cascade not null,
  destination_id uuid references profiles(id) on delete cascade not null,
  is_following boolean default false not null,
  is_blocked boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
 
  -- One relationship row per user pair
  unique (source_id, destination_id)
);
 
-- ============================================
-- INDEXES
-- ============================================
 
-- Goals: fast lookup by user
create index idx_goals_user_id on goals(user_id);
 
-- Goals: feed queries (public active goals)
create index idx_goals_public on goals(is_public, status) where is_public = true and is_deleted = false;
 
-- Milestones: fast lookup by goal
create index idx_milestones_goal_id on milestones(goal_id);
 
-- Checkins: fast lookup by goal and by user
create index idx_checkins_goal_id on checkins(goal_id);
create index idx_checkins_user_id on checkins(user_id);
 
-- Relations: fast lookup for followers/following
create index idx_relations_source on relations(source_id) where is_following = true;
create index idx_relations_destination on relations(destination_id) where is_following = true;
 
-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
-- Automatically updates updated_at on row changes
 
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
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
-- When a user signs up via Supabase Auth, automatically create a profile row
 
create or replace function create_profile_on_signup()
returns trigger as $$
begin
  insert into profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;
 
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_profile_on_signup();
 
-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
 
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table goals enable row level security;
alter table milestones enable row level security;
alter table checkins enable row level security;
alter table relations enable row level security;
 
-- PROFILES: anyone can read non-deleted profiles, only own profile can be updated
create policy "Profiles are viewable by everyone"
  on profiles for select
  using (is_deleted = false);
 
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);
 
-- GOALS: owner can see own non-deleted goals, public goals are viewable by everyone
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
 
-- MILESTONES: owner can manage, public goal milestones are viewable
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
 
-- CHECKINS: owner can manage non-deleted, public goal checkins are viewable if allowed
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
 
-- RELATIONS: users can manage their own relations, can see who follows them
create policy "Users can manage own relations"
  on relations for all
  using (auth.uid() = source_id);
 
create policy "Users can see who follows them"
  on relations for select
  using (auth.uid() = destination_id);
 