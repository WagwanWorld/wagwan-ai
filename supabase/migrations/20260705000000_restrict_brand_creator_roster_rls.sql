-- Close the public CRUD policies accidentally added for brand_creator_roster.
-- Server-side marketplace APIs use the service-role key; anon clients should
-- not be able to read or mutate cross-brand roster contact data directly.

DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;
DROP POLICY IF EXISTS roster_service_role_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_service_role_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_service_role_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_service_role_delete ON brand_creator_roster;

CREATE POLICY roster_service_role_select ON brand_creator_roster
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY roster_service_role_insert ON brand_creator_roster
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY roster_service_role_update ON brand_creator_roster
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY roster_service_role_delete ON brand_creator_roster
  FOR DELETE USING (auth.role() = 'service_role');
