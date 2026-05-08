-- Add score_completion to goals
-- Nullable integer, only populated when a goal is completed (5× bonus).
alter table goals add column score_completion integer;
