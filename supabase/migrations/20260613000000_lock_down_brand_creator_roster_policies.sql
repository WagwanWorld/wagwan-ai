-- Remove permissive roster policies accidentally added with creator brand signals.
-- Brand roster access is mediated by service-role server routes that enforce brand sessions.
DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;

ALTER TABLE brand_creator_roster ENABLE ROW LEVEL SECURITY;

-- Legitimate signal inserts are performed through service-role server code.
DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;
