-- Accomplete: Cache follower/following counts on profiles
-- Date: 2026-05-27
--
-- The Social page needs to show "you follow N people" and "M people follow
-- you" at a glance. Counting live on every load would mean two count(*)
-- queries against the relations table per page open. Caching the totals on
-- profiles is consistent with how we already cache total_score, streaks,
-- and goal counts on the same table.
--
-- following_count: how many people THIS user follows (source_id = me, is_following = true)
-- followers_count: how many people follow THIS user (destination_id = me, is_following = true)
--
-- A trigger on `relations` keeps both counters in sync on insert / update /
-- delete. Block toggles do not affect counts; only the is_following flag does.

alter table profiles
  add column followers_count integer default 0 not null,
  add column following_count integer default 0 not null;

-- Backfill: count existing follow relationships into the new columns.
update profiles p
set following_count = sub.cnt
from (
  select source_id, count(*) as cnt
  from relations
  where is_following = true
  group by source_id
) sub
where p.id = sub.source_id;

update profiles p
set followers_count = sub.cnt
from (
  select destination_id, count(*) as cnt
  from relations
  where is_following = true
  group by destination_id
) sub
where p.id = sub.destination_id;

-- Trigger function: applies a +/- delta to both endpoints when is_following
-- changes. Handles insert (NEW only), delete (OLD only), and update where
-- the flag flips. Row is from the relations table.
create or replace function sync_follower_counts()
returns trigger as $$
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
    update profiles set following_count = greatest(0, following_count - 1) where id = old.source_id;
    update profiles set followers_count = greatest(0, followers_count - 1) where id = old.destination_id;
  end if;

  if is_following_now then
    update profiles set following_count = following_count + 1 where id = new.source_id;
    update profiles set followers_count = followers_count + 1 where id = new.destination_id;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger relations_sync_follower_counts
  after insert or update or delete on relations
  for each row execute function sync_follower_counts();
