-- ============================================
-- DROP UNUSED TABLES (cancelled)
-- 2026-05-09: This migration was originally intended to remove tables
-- believed to be unused, but live API routes still read/write several of
-- them via REST URLs (not `.from(...)` calls):
--   - scheduled_post_carousel_items
--   - content_activity_log
--   - brand_competitors
--   - brand_action_proposals
--
-- Keep this migration as a no-op so environments that have not applied it
-- do not drop tables required by the deployed application.
-- ============================================

BEGIN;

SELECT '20260509000000_drop_unused_tables skipped: referenced tables preserved' AS notice;

COMMIT;
