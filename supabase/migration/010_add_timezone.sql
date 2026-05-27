-- Accomplete: Store IANA timezone per profile
-- Date: 2026-05-27
--
-- Streak / last_checkin_date math needs a stable definition of "today" that
-- matches the user's local calendar. Up to now the client sent its local
-- date with every request, which was simple but unauthenticated — anyone
-- could spoof the day to bend their own streak.
--
-- Storing an IANA timezone per profile moves the source of truth to the DB.
-- The server computes "today" itself via
--   `to_char(now() at time zone profile.timezone, 'YYYY-MM-DD')`
-- in SQL, or the equivalent `Intl.DateTimeFormat` call in app code.
--
-- Default is 'UTC' so existing rows don't break. New users get their browser
-- timezone written during onboarding; existing users pick in Settings.

alter table profiles
  add column timezone text not null default 'UTC';

-- No backfill needed — UTC is a sensible fallback for any account that
-- doesn't actively pick a zone, and onboarding will set the right value for
-- new signups.
