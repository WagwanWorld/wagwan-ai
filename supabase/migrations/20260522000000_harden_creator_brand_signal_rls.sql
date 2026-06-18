-- Remove overly broad policies from the creator brand-signal rollout.
-- Server-side marketplace routes use the service-role client, which bypasses RLS.
DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;

DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;
