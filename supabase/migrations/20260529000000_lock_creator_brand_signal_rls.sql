-- Lock down creator-signal direct table access.
-- Server routes use the service role client, which bypasses RLS. Public clients
-- should not be able to mutate brand roster rows or forge creator signals.
DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;

DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;
