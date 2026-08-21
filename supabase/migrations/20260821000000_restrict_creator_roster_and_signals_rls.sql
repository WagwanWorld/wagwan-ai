-- Remove permissive public policies added with creator brand signals.
-- Server routes use the service role client; browsers should not get direct roster or signal writes.

DO $$
BEGIN
  IF to_regclass('public.brand_creator_roster') IS NOT NULL THEN
    DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
    DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
    DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
    DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;
    DROP POLICY IF EXISTS "Service role full access on brand_creator_roster" ON brand_creator_roster;

    CREATE POLICY "Service role full access on brand_creator_roster"
      ON brand_creator_roster
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF to_regclass('public.creator_brand_signals') IS NOT NULL THEN
    DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;
    DROP POLICY IF EXISTS "Service role insert on creator_brand_signals" ON creator_brand_signals;

    CREATE POLICY "Service role insert on creator_brand_signals"
      ON creator_brand_signals
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
