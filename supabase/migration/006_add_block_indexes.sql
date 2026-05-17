-- Partial indexes for block lookups on the relations table.
-- The existing idx_relations_source / idx_relations_destination indexes
-- are partial on is_following = true, so block-set queries (the two
-- per-viewer reads that derive effective-blocked status at read time)
-- would otherwise table-scan.
create index idx_relations_blocked_source
  on relations(source_id) where is_blocked = true;

create index idx_relations_blocked_destination
  on relations(destination_id) where is_blocked = true;
