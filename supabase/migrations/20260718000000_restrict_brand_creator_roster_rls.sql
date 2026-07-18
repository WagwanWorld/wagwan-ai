-- Remove globally permissive roster policies introduced with creator signals.
-- Brand roster rows include invite URLs, messages, and creator link state, so
-- access must stay behind server-side brand/creator authorization.
DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;

CREATE POLICY roster_service_role_select ON brand_creator_roster
  FOR SELECT TO service_role USING (true);

CREATE POLICY roster_service_role_insert ON brand_creator_roster
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY roster_service_role_update ON brand_creator_roster
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY roster_service_role_delete ON brand_creator_roster
  FOR DELETE TO service_role USING (true);
