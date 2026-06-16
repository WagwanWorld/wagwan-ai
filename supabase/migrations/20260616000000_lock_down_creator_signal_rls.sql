-- Repair the creator brand-signal rollout: these policies granted direct
-- anon/authenticated access to roster data and signal creation. App routes use
-- the service role and do not need public INSERT or roster policies.
DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;

DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;
