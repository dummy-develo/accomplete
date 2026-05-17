-- Generated total-score column + feed sort indexes.
--
-- score_total = score_checkin + score_milestone, maintained automatically
-- by Postgres. Lets the global feed sort by total score (PostgREST can't
-- order by an expression — it needs a real column).
alter table goals
  add column score_total integer
  generated always as (score_checkin + score_milestone) stored;

-- Partial composite indexes for the global feed. Every feed query filters
-- is_public + not deleted + username public, then orders by the chosen
-- sort column with a (created_at desc, id desc) deterministic tie-break.
-- The index key order mirrors that ORDER BY so it can be used directly,
-- and the partial predicate keeps the indexes small.
create index idx_goals_feed_created_at
  on goals (created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

create index idx_goals_feed_current_streak
  on goals (current_streak desc, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

create index idx_goals_feed_best_streak
  on goals (best_streak desc, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

-- nulls last: goals with no check-in yet sink to the bottom of the
-- "recently active" sort, matching the query's nullsFirst: false.
create index idx_goals_feed_last_checkin
  on goals (last_checkin_date desc nulls last, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;

create index idx_goals_feed_score_total
  on goals (score_total desc, created_at desc, id desc)
  where is_public = true and is_deleted = false and is_username_public = true;
