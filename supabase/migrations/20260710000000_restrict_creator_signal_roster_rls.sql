-- Harden creator signal and roster policies after the service-role API moved
-- authorization checks server-side.

DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;

DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;

CREATE POLICY creator_signals_service_role_all ON creator_brand_signals
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY roster_service_role_all ON brand_creator_roster
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
