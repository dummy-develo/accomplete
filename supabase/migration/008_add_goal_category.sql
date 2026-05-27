-- Accomplete: Add category to goals table
-- Date: 2026-05-26
--
-- Surfaces a small categorization for each goal (e.g. fitness, learning).
-- Used by the redesigned UI to show a category pill on goal cards,
-- goal detail, and feed items.
--
-- Predefined values used by the new-goal flow's pill selector:
-- fitness, learning, personal, work, health, custom. Stored as plain
-- text with no CHECK constraint — "custom" is a UI affordance that
-- lets the user type a free-form label, and we don't want a future
-- category addition to require a migration.

alter table goals
  add column category text;
