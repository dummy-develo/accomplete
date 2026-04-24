-- Accomplete: Add last_checkin_date to goals table
-- Date: April 13, 2026
--
-- Stores the date of the most recent check-in for each goal.
-- Used to determine if a check-in should be scored (one scored check-in
-- per day per goal). Avoids querying the checkins table on every check-in.

alter table goals
  add column last_checkin_date date;
