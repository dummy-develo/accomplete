-- Accomplete: Fix follower-count trigger blocked by RLS
-- Date: 2026-05-31
--
-- Bug: sync_follower_counts() (migration 009) was created WITHOUT security
-- definer, so it runs as the calling `authenticated` user. The function bumps
-- TWO profile rows on each follow:
--
--   following_count on source_id      (the follower — their own row)
--   followers_count on destination_id (the followee — someone ELSE's row)
--
-- The profiles UPDATE policy only allows `auth.uid() = id`, so the second
-- update — touching the followee's row — is silently blocked by RLS (0 rows).
-- Net effect: following_count stays correct, followers_count never increments
-- (and never decrements on unfollow). Symptom: a user with real followers
-- shows "Followers 0".
--
-- Fix: recreate the function as SECURITY DEFINER so it runs as the table owner
-- (which bypasses RLS), exactly like create_profile_on_signup. search_path is
-- pinned to '' for safety, which forces fully-qualified names (public.profiles).
-- The trigger binding from 009 still points at this function — no need to
-- recreate the trigger.

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

-- Repair existing data: every count the broken trigger skipped is now wrong.
-- Recompute both columns from the relations table as the source of truth.
-- (Same shape as migration 009's backfill, but run for ALL profiles so rows
-- with zero follows get reset to 0 rather than left stale.)
update profiles p
set following_count = coalesce(sub.cnt, 0)
from (
  select id from profiles
) ids
left join (
  select source_id, count(*) as cnt
  from relations
  where is_following = true
  group by source_id
) sub on sub.source_id = ids.id
where p.id = ids.id;

update profiles p
set followers_count = coalesce(sub.cnt, 0)
from (
  select id from profiles
) ids
left join (
  select destination_id, count(*) as cnt
  from relations
  where is_following = true
  group by destination_id
) sub on sub.destination_id = ids.id
where p.id = ids.id;
