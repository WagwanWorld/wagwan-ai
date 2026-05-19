-- ============================================
-- TRUNCATE ALL DATA — FRESH START
-- 2026-05-09: Wipe all rows, keep schema intact
-- ============================================
-- Uses DO block to skip tables that don't exist in this database.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    -- Brand Creative Assets
    'brand_assets',
    -- Brand OS V2 / Intelligence
    'post_metric_snapshots',
    'performance_predictions',
    'daily_briefs',
    'insight_findings',
    'comment_clusters',
    'content_pillars',
    'post_fingerprints',
    'brand_ai_call_logs',
    'brand_weekly_briefs',
    'brand_insights_cache',
    'scheduled_posts',
    -- Brand Engine
    'brand_audience_matches',
    'brand_cohorts',
    'brand_queries',
    'correlation_index',
    -- Brand Accounts
    'brand_accounts',
    -- Creator Marketplace
    'brief_assets',
    'brief_responses',
    'campaign_interactions',
    'campaign_audience',
    'campaigns',
    'brands',
    'user_earnings',
    'creator_rates',
    'portrait_visibility',
    'user_marketing_prefs',
    -- Chat & Agent System
    'messages',
    'chats',
    'agent_states',
    -- Identity System
    'user_identity_claims',
    'user_identity_inference_snapshots',
    -- Caching
    'cached_content',
    -- Core User (last)
    'user_profiles'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl);
      RAISE NOTICE 'Truncated: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (does not exist): %', tbl;
    END IF;
  END LOOP;
END $$;
