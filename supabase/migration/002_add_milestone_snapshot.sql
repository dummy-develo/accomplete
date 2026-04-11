-- Accomplete: Add milestone score snapshot column
-- Date: April 11, 2026
--
-- Adds `checkin_score_at_creation` to the milestones table.
-- This column stores goal.score_checkin at the moment the milestone row is
-- inserted, so the milestone bonus at reach time can be computed as a single
-- subtraction: goal.score_checkin (now) - milestone.checkin_score_at_creation.
--
-- For milestones created alongside a goal the value is 0 (goal has no checkins
-- yet). For milestones added later via goal extension, the value is whatever
-- goal.score_checkin is at that moment, which naturally prevents retroactive
-- bonuses.
--
-- See mvp-design-doc-new.md §6 for the full rationale.

alter table milestones
  add column checkin_score_at_creation integer not null default 0;
