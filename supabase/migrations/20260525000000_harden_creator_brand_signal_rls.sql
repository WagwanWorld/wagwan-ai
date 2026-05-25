-- Remove overly broad policies from the creator brand signals rollout.
-- Server-side writes use the Supabase service role, which bypasses RLS, so
-- public anon/authenticated roles must not receive blanket insert/roster CRUD.
DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;

DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;
