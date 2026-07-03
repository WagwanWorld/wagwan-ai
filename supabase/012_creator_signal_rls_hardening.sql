-- Remove permissive policies introduced with creator brand signals.
-- App writes use the service role; client-facing reads/writes must remain creator-scoped.
DO $$
BEGIN
  IF to_regclass('public.creator_brand_signals') IS NOT NULL THEN
    DROP POLICY IF EXISTS creator_signals_insert ON creator_brand_signals;
  END IF;

  IF to_regclass('public.brand_creator_roster') IS NOT NULL THEN
    DROP POLICY IF EXISTS roster_brand_select ON brand_creator_roster;
    DROP POLICY IF EXISTS roster_brand_insert ON brand_creator_roster;
    DROP POLICY IF EXISTS roster_brand_update ON brand_creator_roster;
    DROP POLICY IF EXISTS roster_brand_delete ON brand_creator_roster;
  END IF;
END $$;
