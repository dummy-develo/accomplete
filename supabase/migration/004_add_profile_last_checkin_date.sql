-- Add last_checkin_date to profiles table for global streak calculation.
-- Tracks the most recent day the user checked in to any goal.

alter table public.profiles
  add column last_checkin_date date;
